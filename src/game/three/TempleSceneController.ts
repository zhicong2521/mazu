import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  KNEELING_CUSHION_POSITIONS,
  NPC_PILGRIMS,
  PLAYER_SPAWN,
  TEMPLE_ZONES,
} from '../data';
import { clampPlayerPosition, findNearestZone } from '../rules';
import type { RemotePlayerState } from '../multiplayer';
import type { AvatarConfig, EmoteType, GamePhase, TempleZone, ZoneId } from '../types';
import { buildChibiAvatar, type ChibiAvatarRig } from './avatarBuilder';
import { buildTempleWorld, type TempleWorldHandles } from './templeBuilder';

export interface SceneHudSnapshot {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  nearestZone: TempleZone | null;
  autoWalking: boolean;
}

export interface TempleSceneCallbacks {
  onHudTick: (snapshot: SceneHudSnapshot) => void;
  onAutoWalkArrive: (zoneId: ZoneId) => void;
  onPlayerTransformTick?: (transform: {
    x: number;
    z: number;
    yaw: number;
    emote: EmoteType;
    holdingIncense: boolean;
  }) => void;
}

interface RemotePlayerRuntime {
  id: string;
  rig: ChibiAvatarRig;
  avatarKey: string;
  x: number;
  z: number;
  yaw: number;
  targetX: number;
  targetZ: number;
  targetYaw: number;
  emote: EmoteType;
  holdingIncense: boolean;
  bubbleTimer: number;
}

interface NpcRuntime {
  id: string;
  name: string;
  rig: ChibiAvatarRig;
  x: number;
  z: number;
  yaw: number;
  targetX: number;
  targetZ: number;
  state: 'walk' | 'kneel' | 'idle';
  stateTimer: number;
  bubbleTimer: number;
  chatter: string[];
  holdingIncense: boolean;
}

function detectSoftwareGl(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class TempleSceneController {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private temple: TempleWorldHandles;
  private playerRig: ChibiAvatarRig;
  private npcs: NpcRuntime[] = [];
  private npcGroup: THREE.Group;
  private remotePlayers = new Map<string, RemotePlayerRuntime>();
  private remotePlayersGroup: THREE.Group;

  // Smoke & blessing sparkle pooled InstancedMesh
  private smokeInstanced: THREE.InstancedMesh;
  private smokeData: Array<{
    x: number;
    y: number;
    z: number;
    vy: number;
    life: number;
    maxLife: number;
    sourceIdx: number;
  }> = [];
  private sparkleInstanced: THREE.InstancedMesh;
  private sparkleData: Array<{
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
  }> = [];

  // Reusable zero-GC math helpers
  private readonly _dummy = new THREE.Object3D();
  private readonly _camTarget = new THREE.Vector3();
  private readonly _camDesired = new THREE.Vector3();
  private readonly _lookDesired = new THREE.Vector3();

  // Game & control state
  private phase: GamePhase = 'title';
  private playerX: number = PLAYER_SPAWN.x + (Math.random() - 0.5) * 2.2;
  private playerZ: number = PLAYER_SPAWN.z + (Math.random() - 0.5) * 0.9;
  private playerYaw: number = PLAYER_SPAWN.yaw;
  private cameraOrbitYaw = 0; // 0 => behind player facing -Z (North)
  private cameraPitch = 0.34;
  private cameraDist = 6.2;
  private currentEmote: EmoteType = 'idle';
  private emoteTimer = 0;
  private holdingIncense = false;
  private bellSwingVel = 0;
  private bellAngle = 0;
  private showNpcs = true;

  // Input states
  private keys = new Set<string>();
  private joyX = 0;
  private joyY = 0;
  private isDraggingCamera = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private autoWalkTarget: { x: number; z: number; zoneId: ZoneId } | null = null;
  private playerBubbleTimer = 0;

  // Timing & lifecycle
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private elapsed = 0;
  private hudSyncAccum = 0;
  private callbacks: TempleSceneCallbacks;
  private resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    initialAvatar: AvatarConfig,
    callbacks: TempleSceneCallbacks,
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareGl();

    // Renderer configured cleanly with software-WebGL guard
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.appendChild(this.renderer.domElement);

    // Scene & warm evening temple sky/fog continuity
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a1410);
    this.scene.fog = new THREE.FogExp2(0x2a1410, 0.017);

    // Studio RoomEnvironment reflection map on every device
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Camera
    const aspect = (container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.15, 160);
    this.camera.position.set(0, 3.8, 10.0);
    this.camera.lookAt(0, 2.2, -7.5);

    // Warm/cool contrast lighting rig (<= 4 unshadowed PointLights + 1 Key DirectionalLight)
    const hemi = new THREE.HemisphereLight(0xc8d8f8, 0x6e311d, 0.65);
    this.scene.add(hemi);

    const keySun = new THREE.DirectionalLight(0xffe1b0, 1.55);
    keySun.position.set(9, 16, 12);
    if (!this.isSoftwareGl) {
      keySun.castShadow = true;
      keySun.shadow.mapSize.set(1024, 1024);
      keySun.shadow.camera.left = -15;
      keySun.shadow.camera.right = 15;
      keySun.shadow.camera.top = 16;
      keySun.shadow.camera.bottom = -16;
      keySun.shadow.camera.near = 2;
      keySun.shadow.camera.far = 42;
      keySun.shadow.bias = -0.0005;
      keySun.shadow.normalBias = 0.02;
    }
    this.scene.add(keySun);

    // Warm sanctuary PointLights (strictly <= 4)
    const mazuLight = new THREE.PointLight(0xffb852, 4.2, 18, 1.4);
    mazuLight.position.set(0, 4.4, -7.2);
    this.scene.add(mazuLight);

    const hallWarmLight = new THREE.PointLight(0xff9b42, 3.0, 22, 1.4);
    hallWarmLight.position.set(0, 5.8, 0.5);
    this.scene.add(hallWarmLight);

    const yuelaoLight = new THREE.PointLight(0xff8eb3, 2.2, 12, 1.5);
    yuelaoLight.position.set(-8.6, 3.6, -0.2);
    this.scene.add(yuelaoLight);

    const caishenLight = new THREE.PointLight(0xffcb47, 2.4, 12, 1.5);
    caishenLight.position.set(8.6, 3.6, -0.2);
    this.scene.add(caishenLight);

    // Build 3D Temple World
    this.temple = buildTempleWorld(this.renderer, this.isSoftwareGl);
    this.scene.add(this.temple.root);

    // Build Player Chibi Avatar
    this.playerRig = buildChibiAvatar(initialAvatar, { isPlayer: true, showNameTag: true });
    this.playerRig.root.position.set(this.playerX, 0, this.playerZ);
    this.playerRig.root.rotation.y = this.playerYaw;
    this.scene.add(this.playerRig.root);

    // Build NPC Pilgrims & Real-Time Online Remote Players Group
    this.npcGroup = new THREE.Group();
    this.scene.add(this.npcGroup);
    this.initNpcs();

    this.remotePlayersGroup = new THREE.Group();
    this.scene.add(this.remotePlayersGroup);

    // Build Pooled Incense Smoke InstancedMesh (wispy pre-staggered rising plumes)
    const smokeGeo = new THREE.SphereGeometry(0.095, 7, 6);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xe6d9c8,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
    });
    const smokeCount = 36;
    this.smokeInstanced = new THREE.InstancedMesh(smokeGeo, smokeMat, smokeCount);
    this.smokeInstanced.frustumCulled = false;
    for (let i = 0; i < smokeCount; i++) {
      const sourceIdx = i % Math.max(1, this.temple.smokeSources.length);
      const src = this.temple.smokeSources[sourceIdx] ?? new THREE.Vector3(0, 1.5, -5.2);
      const maxLife = 2.6 + (i % 5) * 0.45;
      const initLife = (i / smokeCount) * maxLife;
      const vy = 0.44 + (i % 4) * 0.08;
      this.smokeData.push({
        x: src.x + Math.sin(i * 1.9) * 0.18,
        y: src.y + initLife * vy,
        z: src.z + Math.cos(i * 1.7) * 0.18,
        vy,
        life: initLife,
        maxLife,
        sourceIdx,
      });
    }
    this.scene.add(this.smokeInstanced);

    // Build Pooled Golden Blessing Sparkles InstancedMesh
    const sparkleGeo = new THREE.OctahedronGeometry(0.08, 0);
    const sparkleMat = new THREE.MeshBasicMaterial({
      color: 0xffe484,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const sparkleCount = 36;
    this.sparkleInstanced = new THREE.InstancedMesh(sparkleGeo, sparkleMat, sparkleCount);
    this.sparkleInstanced.frustumCulled = false;
    for (let i = 0; i < sparkleCount; i++) {
      this.sparkleData.push({ x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, life: 99, maxLife: 1 });
    }
    this.scene.add(this.sparkleInstanced);

    // Pre-warm shaders on GPU devices
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind events
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    // Start loop
    this.tick();
  }

  private initNpcs(): void {
    for (const seed of NPC_PILGRIMS) {
      const rig = buildChibiAvatar(seed.avatar, { isPlayer: false, showNameTag: true });
      rig.root.position.set(seed.startX, 0, seed.startZ);
      const zone = TEMPLE_ZONES[seed.homeZone];
      const yaw = Math.atan2(zone.position.x - seed.startX, zone.position.z - seed.startZ);
      rig.root.rotation.y = yaw;
      this.npcGroup.add(rig.root);

      this.npcs.push({
        id: seed.id,
        name: seed.name,
        rig,
        x: seed.startX,
        z: seed.startZ,
        yaw,
        targetX: seed.startX,
        targetZ: seed.startZ,
        state: Math.random() > 0.35 ? 'kneel' : 'idle',
        stateTimer: 2 + Math.random() * 6,
        bubbleTimer: 3 + Math.random() * 9,
        chatter: seed.chatter,
        holdingIncense: Math.random() > 0.35,
      });
    }
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: true });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      if (this.phase === 'playing') e.preventDefault();
    }
    this.keys.add(e.code);
    if (
      this.phase === 'playing' &&
      ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)
    ) {
      this.autoWalkTarget = null;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onWindowBlur = (): void => {
    this.keys.clear();
    this.joyX = 0;
    this.joyY = 0;
    this.isDraggingCamera = false;
  };

  public clearMovementKeys(): void {
    this.keys.clear();
    this.joyX = 0;
    this.joyY = 0;
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.keys.clear();
      this.joyX = 0;
      this.joyY = 0;
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.phase !== 'playing') return;
    this.isDraggingCamera = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDraggingCamera || this.phase !== 'playing') return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.cameraOrbitYaw -= dx * 0.0055;
    this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + dy * 0.004, 0.14, 0.72);
  };

  private onPointerUp = (): void => {
    this.isDraggingCamera = false;
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.phase !== 'playing') return;
    this.cameraDist = THREE.MathUtils.clamp(this.cameraDist + e.deltaY * 0.004, 3.6, 10.5);
  };

  private handleResize(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ==================== Public API called by React ====================

  public setPhase(phase: GamePhase): void {
    const prev = this.phase;
    this.phase = phase;
    if (phase === 'playing' && prev !== 'playing') {
      this.keys.clear();
      this.isDraggingCamera = false;
      this.cameraOrbitYaw = 0;
      this.cameraPitch = 0.34;
    }
  }

  public updatePlayerAvatar(config: AvatarConfig): void {
    this.scene.remove(this.playerRig.root);
    this.playerRig.dispose();
    this.playerRig = buildChibiAvatar(config, { isPlayer: true, showNameTag: true });
    this.playerRig.root.position.set(this.playerX, 0, this.playerZ);
    this.playerRig.root.rotation.y = this.playerYaw;
    this.scene.add(this.playerRig.root);
  }

  public setHoldingIncense(holding: boolean): void {
    this.holdingIncense = holding;
  }

  public setOfferingsVisible(visible: boolean): void {
    this.temple.playerOfferingsGroup.visible = visible;
    if (visible) {
      this.spawnBlessingBurst(0, 1.8, -6.9);
    }
  }

  public updateLanternWall(litSlots: number[]): void {
    this.temple.updateLanternWall(litSlots);
    this.spawnBlessingBurst(10.2, 2.2, 5.0);
  }

  public setShowNpcs(show: boolean): void {
    this.showNpcs = show;
    this.npcGroup.visible = show;
  }

  public setJoystick(nx: number, ny: number): void {
    this.joyX = nx;
    this.joyY = ny;
    if (Math.hypot(nx, ny) > 0.15) {
      this.autoWalkTarget = null;
    }
  }

  public rotateCameraStep(deltaYaw: number): void {
    this.cameraOrbitYaw += deltaYaw;
  }

  public triggerEmote(emote: EmoteType, duration = 2.8): void {
    this.currentEmote = emote;
    this.emoteTimer = duration;
    if (emote === 'bow' || emote === 'kneel') {
      this.spawnBlessingBurst(this.playerX, 1.2, this.playerZ);
    }
  }

  public showPlayerSpeechBubble(text: string): void {
    this.playerRig.setSpeechBubble(text);
    this.playerBubbleTimer = 5.5;
  }

  public ringBell(): void {
    this.bellSwingVel = 3.2;
    this.spawnBlessingBurst(10.4, 2.1, -4.2);
  }

  public navigateToZone(zoneId: ZoneId): void {
    const zone = TEMPLE_ZONES[zoneId];
    if (!zone) return;
    this.autoWalkTarget = {
      x: zone.standPos.x,
      z: zone.standPos.z,
      zoneId,
    };
  }

  public faceZone(zoneId: ZoneId): void {
    const zone = TEMPLE_ZONES[zoneId];
    if (!zone) return;
    this.playerYaw = Math.atan2(zone.position.x - this.playerX, zone.position.z - this.playerZ);
  }

  public resetToSpawn(): void {
    this.playerX = PLAYER_SPAWN.x;
    this.playerZ = PLAYER_SPAWN.z;
    this.playerYaw = PLAYER_SPAWN.yaw;
    this.cameraOrbitYaw = 0;
    this.autoWalkTarget = null;
    this.currentEmote = 'idle';
    this.playerRig.root.position.set(this.playerX, 0, this.playerZ);
    this.playerRig.root.rotation.y = this.playerYaw;
  }

  public spawnBlessingBurst(x: number, y: number, z: number): void {
    for (let i = 0; i < this.sparkleData.length; i++) {
      const p = this.sparkleData[i];
      const ang = (i / this.sparkleData.length) * Math.PI * 2;
      const spd = 0.6 + (i % 4) * 0.32;
      p.x = x + (Math.random() - 0.5) * 0.4;
      p.y = y + Math.random() * 0.4;
      p.z = z + (Math.random() - 0.5) * 0.4;
      p.vx = Math.cos(ang) * spd;
      p.vy = 1.1 + Math.random() * 1.3;
      p.vz = Math.sin(ang) * spd;
      p.life = 0;
      p.maxLife = 0.9 + Math.random() * 0.6;
    }
  }

  // ==================== Real-Time Multiplayer Remote Avatars ====================

  public syncRemotePlayers(players: RemotePlayerState[]): void {
    const nextIds = new Set(players.map((p) => p.id));
    for (const id of Array.from(this.remotePlayers.keys())) {
      if (!nextIds.has(id)) {
        this.removeRemotePlayer(id);
      }
    }
    for (const p of players) {
      this.upsertRemotePlayer(p);
    }
  }

  public upsertRemotePlayer(state: RemotePlayerState): void {
    const avatarKey = JSON.stringify(state.avatar);
    const existing = this.remotePlayers.get(state.id);
    if (existing) {
      existing.targetX = state.x;
      existing.targetZ = state.z;
      existing.targetYaw = state.yaw;
      existing.emote = state.emote;
      existing.holdingIncense = state.holdingIncense;
      if (existing.avatarKey !== avatarKey) {
        this.remotePlayersGroup.remove(existing.rig.root);
        existing.rig.dispose();
        const rebuilt = buildChibiAvatar(state.avatar, { isPlayer: false, showNameTag: true });
        rebuilt.root.position.set(existing.x, 0, existing.z);
        rebuilt.root.rotation.y = existing.yaw;
        this.remotePlayersGroup.add(rebuilt.root);
        existing.rig = rebuilt;
        existing.avatarKey = avatarKey;
      }
      return;
    }

    const rig = buildChibiAvatar(state.avatar, { isPlayer: false, showNameTag: true });
    rig.root.position.set(state.x, 0, state.z);
    rig.root.rotation.y = state.yaw;
    this.remotePlayersGroup.add(rig.root);

    this.remotePlayers.set(state.id, {
      id: state.id,
      rig,
      avatarKey,
      x: state.x,
      z: state.z,
      yaw: state.yaw,
      targetX: state.x,
      targetZ: state.z,
      targetYaw: state.yaw,
      emote: state.emote,
      holdingIncense: state.holdingIncense,
      bubbleTimer: 0,
    });
  }

  public updateRemotePlayerTransform(patch: {
    id: string;
    x: number;
    z: number;
    yaw: number;
    emote: EmoteType;
    holdingIncense: boolean;
    avatar?: AvatarConfig;
  }): void {
    const existing = this.remotePlayers.get(patch.id);
    if (!existing) {
      if (patch.avatar) {
        this.upsertRemotePlayer({
          id: patch.id,
          x: patch.x,
          z: patch.z,
          yaw: patch.yaw,
          emote: patch.emote,
          holdingIncense: patch.holdingIncense,
          avatar: patch.avatar,
        });
      }
      return;
    }

    existing.targetX = patch.x;
    existing.targetZ = patch.z;
    existing.targetYaw = patch.yaw;
    existing.emote = patch.emote;
    existing.holdingIncense = patch.holdingIncense;

    if (patch.avatar) {
      const nextKey = JSON.stringify(patch.avatar);
      if (nextKey !== existing.avatarKey) {
        this.remotePlayersGroup.remove(existing.rig.root);
        existing.rig.dispose();
        const rebuilt = buildChibiAvatar(patch.avatar, { isPlayer: false, showNameTag: true });
        rebuilt.root.position.set(existing.x, 0, existing.z);
        rebuilt.root.rotation.y = existing.yaw;
        this.remotePlayersGroup.add(rebuilt.root);
        existing.rig = rebuilt;
        existing.avatarKey = nextKey;
      }
    }
  }

  public removeRemotePlayer(id: string): void {
    const existing = this.remotePlayers.get(id);
    if (!existing) return;
    this.remotePlayersGroup.remove(existing.rig.root);
    existing.rig.dispose();
    this.remotePlayers.delete(id);
  }

  public showRemotePlayerSpeechBubble(id: string, text: string): void {
    const existing = this.remotePlayers.get(id);
    if (!existing) return;
    existing.rig.setSpeechBubble(text);
    existing.bubbleTimer = 5.5;
  }

  private updateRemotePlayers(dt: number): void {
    const damp = 1 - Math.exp(-10 * dt);
    for (const remote of this.remotePlayers.values()) {
      const prevX = remote.x;
      const prevZ = remote.z;
      remote.x += (remote.targetX - remote.x) * damp;
      remote.z += (remote.targetZ - remote.z) * damp;

      let yawDiff = remote.targetYaw - remote.yaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      remote.yaw += yawDiff * damp;

      const movedDist = Math.hypot(remote.x - prevX, remote.z - prevZ);
      const approxSpeed = dt > 0 ? movedDist / dt : 0;

      if (remote.bubbleTimer > 0) {
        remote.bubbleTimer -= dt;
        if (remote.bubbleTimer <= 0) {
          remote.rig.setSpeechBubble(undefined);
        }
      }

      remote.rig.root.position.set(remote.x, 0, remote.z);
      remote.rig.root.rotation.y = remote.yaw;
      remote.rig.updateAnimation(
        dt,
        this.elapsed + remote.x,
        approxSpeed > 0.15 ? approxSpeed : 0,
        remote.emote,
        remote.holdingIncense,
      );
    }
  }

  // ==================== Per-Frame Simulation Loop ====================

  private updatePlayer(dt: number): void {
    let moveX = 0;
    let moveZ = 0;

    if (this.phase === 'playing') {
      const fwd =
        (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
        (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) -
        this.joyY;
      const right =
        (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
        (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) +
        this.joyX;

      if (Math.abs(fwd) > 0.05 || Math.abs(right) > 0.05) {
        // Camera-relative movement direction
        const sinY = Math.sin(this.cameraOrbitYaw);
        const cosY = Math.cos(this.cameraOrbitYaw);
        // Forward is (-sinY, -cosY) in world XZ; Right is (cosY, -sinY)
        moveX = -sinY * fwd + cosY * right;
        moveZ = -cosY * fwd - sinY * right;
        const len = Math.hypot(moveX, moveZ);
        if (len > 1) {
          moveX /= len;
          moveZ /= len;
        }
        this.currentEmote = 'idle';
      } else if (this.autoWalkTarget) {
        // Waypoint steering around the front wall gateway when crossing Z = 7.7
        let wx = this.autoWalkTarget.x;
        let wz = this.autoWalkTarget.z;
        const crossingDoor =
          (this.playerZ < 6.8 && wz > 8.2) || (this.playerZ > 8.6 && wz < 7.2);
        if (crossingDoor && Math.abs(this.playerX) > 3.2) {
          wx = 0;
          wz = this.playerZ < 7.5 ? 7.2 : 8.2;
        }
        const dx = wx - this.playerX;
        const dz = wz - this.playerZ;
        const dist = Math.hypot(dx, dz);
        const finalDist = Math.hypot(
          this.autoWalkTarget.x - this.playerX,
          this.autoWalkTarget.z - this.playerZ,
        );
        if (finalDist < 0.42) {
          const arrivedZone = this.autoWalkTarget.zoneId;
          this.autoWalkTarget = null;
          this.faceZone(arrivedZone);
          this.callbacks.onAutoWalkArrive(arrivedZone);
        } else if (dist > 0.05) {
          moveX = dx / dist;
          moveZ = dz / dist;
          this.currentEmote = 'idle';
        }
      }
    }

    const moveSpeed = 4.6;
    const speed = Math.hypot(moveX, moveZ) * moveSpeed;

    if (speed > 0.05) {
      const nextPos = clampPlayerPosition(
        this.playerX + moveX * moveSpeed * dt,
        this.playerZ + moveZ * moveSpeed * dt,
      );
      this.playerX = nextPos.x;
      this.playerZ = nextPos.z;
      const targetYaw = Math.atan2(moveX, moveZ);
      let diff = targetYaw - this.playerYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.playerYaw += diff * (1 - Math.exp(-12 * dt));
    }

    if (this.emoteTimer > 0) {
      this.emoteTimer -= dt;
      if (this.emoteTimer <= 0 && this.currentEmote !== 'kneel' && this.currentEmote !== 'meditate') {
        this.currentEmote = 'idle';
      }
    }

    if (this.playerBubbleTimer > 0) {
      this.playerBubbleTimer -= dt;
      if (this.playerBubbleTimer <= 0) {
        this.playerRig.setSpeechBubble(undefined);
      }
    }

    this.playerRig.root.position.set(this.playerX, 0, this.playerZ);
    this.playerRig.root.rotation.y = this.playerYaw;
    this.playerRig.updateAnimation(dt, this.elapsed, speed, this.currentEmote, this.holdingIncense);
  }

  private updateNpcs(dt: number): void {
    if (!this.showNpcs) return;

    for (const npc of this.npcs) {
      npc.stateTimer -= dt;
      npc.bubbleTimer -= dt;

      if (npc.bubbleTimer <= 0) {
        if (Math.random() > 0.4) {
          const line = npc.chatter[Math.floor(Math.random() * npc.chatter.length)];
          npc.rig.setSpeechBubble(line);
          npc.bubbleTimer = 5.5;
        } else {
          npc.rig.setSpeechBubble(undefined);
          npc.bubbleTimer = 6 + Math.random() * 8;
        }
      }

      let speed = 0;
      if (npc.state === 'walk') {
        const dx = npc.targetX - npc.x;
        const dz = npc.targetZ - npc.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.35 || npc.stateTimer <= 0) {
          npc.state = Math.random() > 0.3 ? 'kneel' : 'idle';
          npc.stateTimer = 4 + Math.random() * 6;
          // Face Mazu altar or nearest shrine
          const nearest = findNearestZone(npc.x, npc.z);
          if (nearest) {
            npc.yaw = Math.atan2(nearest.position.x - npc.x, nearest.position.z - npc.z);
          } else {
            npc.yaw = Math.PI;
          }
        } else {
          const spd = 1.65;
          const clamped = clampPlayerPosition(
            npc.x + (dx / dist) * spd * dt,
            npc.z + (dz / dist) * spd * dt,
          );
          npc.x = clamped.x;
          npc.z = clamped.z;
          npc.yaw = Math.atan2(dx, dz);
          speed = spd;
        }
      } else if (npc.stateTimer <= 0) {
        if (Math.random() > 0.45) {
          // Pick a cushion or shrine stand spot
          const pickCushion = KNEELING_CUSHION_POSITIONS[Math.floor(Math.random() * KNEELING_CUSHION_POSITIONS.length)];
          npc.targetX = pickCushion.x + (Math.random() - 0.5) * 0.35;
          npc.targetZ = pickCushion.z + (Math.random() - 0.5) * 0.35;
          npc.state = 'walk';
          npc.stateTimer = 7;
        } else {
          npc.state = npc.state === 'kneel' ? 'idle' : 'kneel';
          npc.stateTimer = 4 + Math.random() * 5;
        }
      }

      npc.rig.root.position.set(npc.x, 0, npc.z);
      npc.rig.root.rotation.y = npc.yaw;
      npc.rig.updateAnimation(
        dt,
        this.elapsed + npc.x,
        speed,
        npc.state === 'kneel' ? 'kneel' : 'idle',
        npc.holdingIncense,
      );
    }
  }

  private updateAtmosphere(dt: number): void {
    // Gentle lantern sway
    for (const l of this.temple.lanterns) {
      const p = (l.userData.phase as number) || 0;
      l.rotation.z = Math.sin(this.elapsed * 1.2 + p) * 0.045;
      l.rotation.x = Math.cos(this.elapsed * 0.9 + p) * 0.025;
    }

    // Damped pendulum physics for Temple Bell
    if (Math.abs(this.bellSwingVel) > 0.001 || Math.abs(this.bellAngle) > 0.001) {
      const spring = -14.0 * this.bellAngle;
      this.bellSwingVel = (this.bellSwingVel + spring * dt) * Math.exp(-1.2 * dt);
      this.bellAngle += this.bellSwingVel * dt;
      this.temple.bellPivot.rotation.z = this.bellAngle;
    }

    // Pooled Incense Smoke particles
    for (let i = 0; i < this.smokeData.length; i++) {
      const p = this.smokeData[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        const src = this.temple.smokeSources[p.sourceIdx];
        p.x = src.x + (Math.random() - 0.5) * 0.32;
        p.y = src.y;
        p.z = src.z + (Math.random() - 0.5) * 0.32;
        p.life = 0;
      } else {
        p.y += p.vy * dt;
        p.x += Math.sin(this.elapsed * 1.4 + i) * 0.12 * dt;
      }
      const progress = p.life / p.maxLife;
      const scale = 0.5 + progress * 1.8;
      this._dummy.position.set(p.x, p.y, p.z);
      this._dummy.scale.setScalar(scale * (1 - progress * 0.65));
      this._dummy.updateMatrix();
      this.smokeInstanced.setMatrixAt(i, this._dummy.matrix);
    }
    this.smokeInstanced.instanceMatrix.needsUpdate = true;

    // Pooled Golden Blessing Sparkles
    let sparklesActive = false;
    for (let i = 0; i < this.sparkleData.length; i++) {
      const s = this.sparkleData[i];
      if (s.life < s.maxLife) {
        sparklesActive = true;
        s.life += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;
        s.vy -= 1.2 * dt;
        const fade = Math.max(0, 1 - s.life / s.maxLife);
        this._dummy.position.set(s.x, s.y, s.z);
        this._dummy.rotation.set(this.elapsed * 4, this.elapsed * 3, 0);
        this._dummy.scale.setScalar(fade * 1.15);
      } else {
        this._dummy.position.set(0, -20, 0);
        this._dummy.scale.setScalar(0.001);
      }
      this._dummy.updateMatrix();
      this.sparkleInstanced.setMatrixAt(i, this._dummy.matrix);
    }
    if (sparklesActive || this.elapsed < 0.2) {
      this.sparkleInstanced.instanceMatrix.needsUpdate = true;
    }
  }

  private updateCamera(dt: number): void {
    const damp = 1 - Math.exp(-6.5 * dt);

    if (this.phase === 'title') {
      // Smooth scenic temple tour looking down the lantern-lit aisle toward Mazu
      const sway = Math.sin(this.elapsed * 0.28);
      this._camDesired.set(sway * 1.9, 3.85 + Math.cos(this.elapsed * 0.22) * 0.2, 4.9);
      this._lookDesired.set(0, 2.55, -8.2);
      this.camera.position.lerp(this._camDesired, damp);
      this._camTarget.lerp(this._lookDesired, damp);
      this.camera.lookAt(this._camTarget);
      return;
    }

    // Third-person smooth chase camera around player
    const sinY = Math.sin(this.cameraOrbitYaw);
    const cosY = Math.cos(this.cameraOrbitYaw);
    const horizDist = Math.cos(this.cameraPitch) * this.cameraDist;
    const camY = 1.65 + Math.sin(this.cameraPitch) * this.cameraDist;

    let desiredX = this.playerX + sinY * horizDist;
    let desiredZ = this.playerZ + cosY * horizDist;

    // Gentle wall pull-in so camera never clips outside the red-brick walls
    desiredX = THREE.MathUtils.clamp(desiredX, -11.4, 11.4);
    desiredZ = THREE.MathUtils.clamp(desiredZ, -11.0, 15.6);

    this._camDesired.set(desiredX, camY, desiredZ);
    this._lookDesired.set(this.playerX, 1.45, this.playerZ - 1.2 * cosY);

    this.camera.position.lerp(this._camDesired, damp);
    this._camTarget.lerp(this._lookDesired, damp);
    this.camera.lookAt(this._camTarget);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 90);
    }
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    if (this.phase !== 'paused') {
      this.elapsed += dt;
      this.updatePlayer(dt);
      this.updateNpcs(dt);
      this.updateRemotePlayers(dt);
      this.updateAtmosphere(dt);
      this.updateCamera(dt);

      // Throttled HUD & multiplayer transform sync (~8-10 Hz)
      this.hudSyncAccum += dt;
      if (this.hudSyncAccum >= 0.1) {
        this.hudSyncAccum = 0;
        this.callbacks.onHudTick({
          playerX: this.playerX,
          playerZ: this.playerZ,
          playerYaw: this.playerYaw,
          nearestZone: findNearestZone(this.playerX, this.playerZ),
          autoWalking: this.autoWalkTarget !== null,
        });
        this.callbacks.onPlayerTransformTick?.({
          x: this.playerX,
          z: this.playerZ,
          yaw: this.playerYaw,
          emote: this.currentEmote,
          holdingIncense: this.holdingIncense,
        });
      }
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('wheel', this.onWheel);

    this.playerRig.dispose();
    for (const npc of this.npcs) npc.rig.dispose();
    for (const remote of this.remotePlayers.values()) remote.rig.dispose();
    this.remotePlayers.clear();
    this.temple.dispose();
    this.smokeInstanced.geometry.dispose();
    (this.smokeInstanced.material as THREE.Material).dispose();
    this.sparkleInstanced.geometry.dispose();
    (this.sparkleInstanced.material as THREE.Material).dispose();
    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
