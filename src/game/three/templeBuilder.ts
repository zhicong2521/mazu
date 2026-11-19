import * as THREE from 'three';
import { KNEELING_CUSHION_POSITIONS, TEXTURE_PATHS } from '../data';
import {
  createCoupletTexture,
  createLanternWallTexture,
  createMazuFaceTexture,
  createNoiseBumpTexture,
  createPlaqueTexture,
} from './textures';

export interface TempleWorldHandles {
  root: THREE.Group;
  lanterns: THREE.Group[];
  bellPivot: THREE.Group;
  playerOfferingsGroup: THREE.Group;
  lanternWallMesh: THREE.Mesh;
  smokeSources: THREE.Vector3[];
  updateLanternWall: (litSlots: number[]) => void;
  dispose: () => void;
}

/**
 * Builds the complete grounded 3D Taiwanese Cloud Tianhou Temple (雲端天后宮).
 * All hero props & structures are composite 3–12 part THREE.Group assemblies.
 */
export function buildTempleWorld(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
): TempleWorldHandles {
  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const lanterns: THREE.Group[] = [];
  const smokeSources: THREE.Vector3[] = [];

  const maxAniso = isSoftwareGl ? 1 : Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const loader = new THREE.TextureLoader();

  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // Load 3 local generated textures with proper color space & wrapping
  const brickTex = track(loader.load(TEXTURE_PATHS.redBrick));
  brickTex.colorSpace = THREE.SRGBColorSpace;
  brickTex.wrapS = THREE.RepeatWrapping;
  brickTex.wrapT = THREE.RepeatWrapping;
  brickTex.repeat.set(7, 3.2);
  brickTex.anisotropy = maxAniso;

  const brickTexSide = track(loader.load(TEXTURE_PATHS.redBrick));
  brickTexSide.colorSpace = THREE.SRGBColorSpace;
  brickTexSide.wrapS = THREE.RepeatWrapping;
  brickTexSide.wrapT = THREE.RepeatWrapping;
  brickTexSide.repeat.set(6, 3.2);
  brickTexSide.anisotropy = maxAniso;

  const floorTex = track(loader.load(TEXTURE_PATHS.stoneFloor));
  floorTex.colorSpace = THREE.SRGBColorSpace;
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(9, 11);
  floorTex.anisotropy = maxAniso;

  const muralTex = track(loader.load(TEXTURE_PATHS.mazuMural));
  muralTex.colorSpace = THREE.SRGBColorSpace;
  // Slightly crop UV inside the ornate frame so no outer gray stone border shows
  muralTex.repeat.set(0.86, 0.86);
  muralTex.offset.set(0.07, 0.07);
  muralTex.anisotropy = maxAniso;

  const stoneBump = track(createNoiseBumpTexture(256));
  stoneBump.repeat.set(8, 8);

  // Shared PBR Material Library (varied roughness & metalness)
  const matBrickWall = track(
    new THREE.MeshStandardMaterial({
      map: brickTex,
      bumpMap: stoneBump,
      bumpScale: 0.02,
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.02,
    }),
  );
  const matBrickSide = track(
    new THREE.MeshStandardMaterial({
      map: brickTexSide,
      bumpMap: stoneBump,
      bumpScale: 0.02,
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.02,
    }),
  );
  const matFloor = track(
    new THREE.MeshStandardMaterial({
      map: floorTex,
      bumpMap: stoneBump,
      bumpScale: 0.015,
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.06,
    }),
  );
  const matLacquerRed = track(
    new THREE.MeshStandardMaterial({
      color: 0x9b1f1a,
      roughness: 0.36,
      metalness: 0.1,
    }),
  );
  const matDarkWood = track(
    new THREE.MeshStandardMaterial({
      color: 0x421d12,
      roughness: 0.68,
      metalness: 0.05,
    }),
  );
  const matGold = track(
    new THREE.MeshStandardMaterial({
      color: 0xe8b94f,
      roughness: 0.28,
      metalness: 0.82,
    }),
  );
  const matBronze = track(
    new THREE.MeshStandardMaterial({
      color: 0x8f6b32,
      roughness: 0.38,
      metalness: 0.75,
    }),
  );
  const matStonePillar = track(
    new THREE.MeshStandardMaterial({
      color: 0xd9cfc4,
      roughness: 0.65,
      metalness: 0.05,
    }),
  );
  const matSilkGold = track(
    new THREE.MeshStandardMaterial({
      color: 0xd9a134,
      roughness: 0.58,
      metalness: 0.25,
    }),
  );
  const matRoofTile = track(
    new THREE.MeshStandardMaterial({
      color: 0xb64b1d,
      roughness: 0.52,
      metalness: 0.12,
    }),
  );
  const matCushionRed = track(
    new THREE.MeshStandardMaterial({
      color: 0xc22b23,
      roughness: 0.84,
      metalness: 0.02,
    }),
  );
  const matEmber = track(
    new THREE.MeshStandardMaterial({
      color: 0xff621a,
      emissive: 0xff4500,
      emissiveIntensity: 1.8,
      roughness: 0.5,
    }),
  );
  const matLanternGlow = track(
    new THREE.MeshStandardMaterial({
      color: 0xe63524,
      emissive: 0xd93818,
      emissiveIntensity: 0.75,
      roughness: 0.45,
    }),
  );
  const matCandleGlow = track(
    new THREE.MeshStandardMaterial({
      color: 0xffdf78,
      emissive: 0xffb338,
      emissiveIntensity: 1.9,
      roughness: 0.2,
    }),
  );

  // =========================================================================
  // 1. FLOOR, COURTYARD, EXTENDED OUTER GROUNDS & DISTANT HILLS (No Floating Void!)
  // =========================================================================
  const mainFloor = new THREE.Mesh(track(new THREE.PlaneGeometry(26, 30)), matFloor);
  mainFloor.rotation.x = -Math.PI / 2;
  mainFloor.position.set(0, 0, 2);
  mainFloor.receiveShadow = true;
  root.add(mainFloor);

  // Extended surrounding stone plaza & distant terrain so horizon blends seamlessly into fog
  const outerGroundMat = track(
    new THREE.MeshStandardMaterial({ color: 0x3b2a22, roughness: 0.94, metalness: 0.02 }),
  );
  const outerGround = new THREE.Mesh(track(new THREE.PlaneGeometry(180, 180)), outerGroundMat);
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.set(0, -0.04, 14);
  root.add(outerGround);

  // Distant warm misty mountain silhouettes framing the open South courtyard
  const hillMat = track(
    new THREE.MeshStandardMaterial({ color: 0x3e2420, roughness: 0.96, metalness: 0.0 }),
  );
  const hillSpecs = [
    { x: -34, z: 54, rx: 28, ry: 12, rz: 16 },
    { x: 0, z: 62, rx: 36, ry: 15, rz: 18 },
    { x: 36, z: 52, rx: 26, ry: 11, rz: 16 },
  ];
  for (const h of hillSpecs) {
    const hill = new THREE.Mesh(track(new THREE.ConeGeometry(1, 1, 7)), hillMat);
    hill.scale.set(h.rx, h.ry, h.rz);
    hill.position.set(h.x, h.ry * 0.45 - 0.5, h.z);
    root.add(hill);
  }

  // Red sanctuary aisle carpet leading from gateway to Mazu altar (disjoint Y = 0.02)
  const carpetMat = track(
    new THREE.MeshStandardMaterial({ color: 0x7c1714, roughness: 0.9, metalness: 0.02 }),
  );
  const aisleCarpet = new THREE.Mesh(track(new THREE.BoxGeometry(2.6, 0.025, 11.4)), carpetMat);
  aisleCarpet.position.set(0, 0.013, 0.6);
  aisleCarpet.receiveShadow = true;
  root.add(aisleCarpet);

  // Gold carpet border trims
  const trimStripGeo = track(new THREE.BoxGeometry(0.12, 0.028, 11.4));
  [-1.24, 1.24].forEach((tx) => {
    const strip = new THREE.Mesh(trimStripGeo, matGold);
    strip.position.set(tx, 0.014, 0.6);
    root.add(strip);
  });

  // =========================================================================
  // 2. RED-BRICK TEMPLE WALLS, CARVED LATTICE WINDOWS, CEILING & GATEWAY
  // =========================================================================
  const wallH = 8.4;

  // North back wall
  const northWall = new THREE.Mesh(track(new THREE.BoxGeometry(25.6, wallH, 0.6)), matBrickWall);
  northWall.position.set(0, wallH / 2, -12.6);
  northWall.receiveShadow = true;
  root.add(northWall);

  // West & East Hall walls (z: -12.6 .. +7.8)
  const westWall = new THREE.Mesh(track(new THREE.BoxGeometry(0.6, wallH, 20.6)), matBrickSide);
  westWall.position.set(-12.6, wallH / 2, -2.4);
  westWall.receiveShadow = true;
  root.add(westWall);

  const eastWall = new THREE.Mesh(track(new THREE.BoxGeometry(0.6, wallH, 20.6)), matBrickSide);
  eastWall.position.set(12.6, wallH / 2, -2.4);
  eastWall.receiveShadow = true;
  root.add(eastWall);

  // South front hall walls flanking wide central gateway (x: -4.2 .. +4.2 open!)
  const frontWallLeft = new THREE.Mesh(track(new THREE.BoxGeometry(8.5, wallH, 0.7)), matBrickSide);
  frontWallLeft.position.set(-8.45, wallH / 2, 7.7);
  root.add(frontWallLeft);

  const frontWallRight = new THREE.Mesh(track(new THREE.BoxGeometry(8.5, wallH, 0.7)), matBrickSide);
  frontWallRight.position.set(8.45, wallH / 2, 7.7);
  root.add(frontWallRight);

  // Upper lintel beam & signboard over the wide central gateway
  const gateLintel = new THREE.Mesh(track(new THREE.BoxGeometry(8.8, 2.2, 0.85)), matLacquerRed);
  gateLintel.position.set(0, 7.3, 7.7);
  root.add(gateLintel);

  const gateRoof = new THREE.Mesh(track(new THREE.BoxGeometry(10.2, 0.35, 2.2)), matRoofTile);
  gateRoof.position.set(0, 8.45, 7.9);
  root.add(gateRoof);

  // Traditional red-wood lattice window frames (花窗) on West & East walls
  const buildLatticeWindow = (x: number, z: number, rotY: number) => {
    const winGroup = new THREE.Group();
    winGroup.position.set(x, 3.3, z);
    winGroup.rotation.y = rotY;

    const frame = new THREE.Mesh(track(new THREE.BoxGeometry(3.4, 2.8, 0.16)), matLacquerRed);
    winGroup.add(frame);

    const glowPane = new THREE.Mesh(
      track(new THREE.PlaneGeometry(3.0, 2.4)),
      track(
        new THREE.MeshBasicMaterial({
          color: 0xffd28e,
          transparent: true,
          opacity: 0.32,
          side: THREE.DoubleSide,
        }),
      ),
    );
    glowPane.position.z = 0.09;
    winGroup.add(glowPane);

    // Lattice bars
    const vBarGeo = track(new THREE.BoxGeometry(0.08, 2.5, 0.2));
    for (let i = -2; i <= 2; i++) {
      const b = new THREE.Mesh(vBarGeo, matLacquerRed);
      b.position.set(i * 0.62, 0, 0.02);
      winGroup.add(b);
    }
    const hBarGeo = track(new THREE.BoxGeometry(3.1, 0.08, 0.2));
    for (let j = -1; j <= 1; j++) {
      const b = new THREE.Mesh(hBarGeo, matLacquerRed);
      b.position.set(0, j * 0.72, 0.02);
      winGroup.add(b);
    }

    // Center circular medallion ring
    const ring = new THREE.Mesh(track(new THREE.TorusGeometry(0.75, 0.07, 8, 22)), matGold);
    ring.position.z = 0.09;
    winGroup.add(ring);

    root.add(winGroup);
  };
  buildLatticeWindow(12.22, -4.2, -Math.PI / 2);
  buildLatticeWindow(-12.22, -4.2, Math.PI / 2);

  // Low courtyard red-brick perimeter walls with tiled coping (z: 7.7 .. 16.5)
  const buildCourtyardWall = (x: number, z: number, w: number, d: number) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(track(new THREE.BoxGeometry(w, 2.1, d)), matBrickSide);
    base.position.set(x, 1.05, z);
    const cap = new THREE.Mesh(track(new THREE.BoxGeometry(w + 0.25, 0.24, d + 0.25)), matRoofTile);
    cap.position.set(x, 2.22, z);
    g.add(base, cap);
    root.add(g);
  };
  buildCourtyardWall(-12.6, 12.1, 0.6, 9.0);
  buildCourtyardWall(12.6, 12.1, 0.6, 9.0);
  buildCourtyardWall(-8.2, 16.5, 9.2, 0.6);
  buildCourtyardWall(8.2, 16.5, 9.2, 0.6);

  // Courtyard Southern Archway (牌樓山門) framing the distant hills
  const archGroup = new THREE.Group();
  archGroup.position.set(0, 0, 16.5);
  [-3.8, 3.8].forEach((ax) => {
    const col = new THREE.Mesh(track(new THREE.CylinderGeometry(0.32, 0.36, 5.2, 16)), matLacquerRed);
    col.position.set(ax, 2.6, 0);
    const base = new THREE.Mesh(track(new THREE.CylinderGeometry(0.48, 0.54, 0.45, 8)), matStonePillar);
    base.position.set(ax, 0.225, 0);
    archGroup.add(col, base);
  });
  const archBeam = new THREE.Mesh(track(new THREE.BoxGeometry(8.6, 0.75, 0.65)), matLacquerRed);
  archBeam.position.set(0, 5.0, 0);
  const archRoof = new THREE.Mesh(track(new THREE.BoxGeometry(9.6, 0.35, 1.8)), matRoofTile);
  archRoof.position.set(0, 5.55, 0);
  const archPlaqueTex = track(createPlaqueTexture('宮后天端雲', { width: 512, height: 144 }));
  const archPlaque = new THREE.Mesh(
    track(new THREE.BoxGeometry(3.2, 0.9, 0.14)),
    track(new THREE.MeshStandardMaterial({ map: archPlaqueTex, color: 0xffffff, roughness: 0.35 })),
  );
  archPlaque.position.set(0, 4.95, -0.35);
  archGroup.add(archBeam, archRoof, archPlaque);
  root.add(archGroup);

  // Ceiling wooden rafters & dark warm roof over Main Hall
  const ceilingSlab = new THREE.Mesh(track(new THREE.BoxGeometry(25.8, 0.4, 21.0)), matDarkWood);
  ceilingSlab.position.set(0, wallH + 0.15, -2.4);
  root.add(ceilingSlab);

  const beamGeo = track(new THREE.BoxGeometry(25.2, 0.42, 0.38));
  for (let bz = -10.5; bz <= 6.5; bz += 3.4) {
    const beam = new THREE.Mesh(beamGeo, matLacquerRed);
    beam.position.set(0, wallH - 0.3, bz);
    root.add(beam);
  }

  // =========================================================================
  // 3. 4 GRAND DRAGON-COILED PILLARS (龍柱)
  // =========================================================================
  const buildDragonPillar = (x: number, z: number) => {
    const pGroup = new THREE.Group();
    pGroup.position.set(x, 0, z);

    // Octagonal stone base
    const plinth = new THREE.Mesh(track(new THREE.CylinderGeometry(0.62, 0.72, 0.55, 8)), matStonePillar);
    plinth.position.y = 0.275;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    pGroup.add(plinth);

    const ringBase = new THREE.Mesh(track(new THREE.TorusGeometry(0.55, 0.08, 8, 18)), matGold);
    ringBase.rotation.x = Math.PI / 2;
    ringBase.position.y = 0.56;
    pGroup.add(ringBase);

    // Tall stone column shaft
    const shaft = new THREE.Mesh(track(new THREE.CylinderGeometry(0.44, 0.48, 7.4, 20)), matStonePillar);
    shaft.position.y = 4.25;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    pGroup.add(shaft);

    // Spiraling Golden Dragon sculpted via TubeGeometry!
    const spiralPts: THREE.Vector3[] = [];
    const turns = 2.6;
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * Math.PI * 2 * turns;
      const r = 0.52;
      spiralPts.push(new THREE.Vector3(Math.cos(angle) * r, 0.95 + t * 5.8, Math.sin(angle) * r));
    }
    const curve = new THREE.CatmullRomCurve3(spiralPts);
    const dragonTube = new THREE.Mesh(track(new THREE.TubeGeometry(curve, 44, 0.085, 8, false)), matGold);
    dragonTube.castShadow = true;
    pGroup.add(dragonTube);

    // Sculpted dragon head at top of coil
    const dHead = new THREE.Mesh(track(new THREE.SphereGeometry(0.16, 12, 10)), matGold);
    const topPt = spiralPts[spiralPts.length - 1];
    dHead.position.copy(topPt);
    dHead.scale.set(1.2, 0.9, 1.3);
    pGroup.add(dHead);

    // Ornate red & gold capital
    const cap = new THREE.Mesh(track(new THREE.CylinderGeometry(0.68, 0.46, 0.52, 12)), matLacquerRed);
    cap.position.y = 7.8;
    pGroup.add(cap);

    root.add(pGroup);
  };

  buildDragonPillar(-4.8, -5.1);
  buildDragonPillar(4.8, -5.1);
  buildDragonPillar(-5.2, 5.0);
  buildDragonPillar(5.2, 5.0);

  // =========================================================================
  // 4. HANGING CRIMSON TEMPLE LANTERNS (大紅燈籠)
  // =========================================================================
  const buildLantern = (x: number, y: number, z: number, scale = 1) => {
    const lGroup = new THREE.Group();
    lGroup.position.set(x, y, z);
    lGroup.scale.setScalar(scale);

    const cord = new THREE.Mesh(track(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 6)), matGold);
    cord.position.y = -0.55;
    const topCap = new THREE.Mesh(track(new THREE.CylinderGeometry(0.24, 0.28, 0.14, 14)), matGold);
    topCap.position.y = -1.1;
    const globe = new THREE.Mesh(track(new THREE.SphereGeometry(0.5, 16, 14)), matLanternGlow);
    globe.scale.set(1.06, 0.86, 1.06);
    globe.position.y = -1.52;
    const botCap = new THREE.Mesh(track(new THREE.CylinderGeometry(0.26, 0.22, 0.14, 14)), matGold);
    botCap.position.y = -1.96;
    const tassel = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.11, 0.52, 10)), matLacquerRed);
    tassel.position.y = -2.28;

    lGroup.add(cord, topCap, globe, botCap, tassel);
    lGroup.userData.phase = x * 0.7 + z * 0.4;
    root.add(lGroup);
    lanterns.push(lGroup);
  };

  buildLantern(-4.8, 8.2, -3.5, 1.05);
  buildLantern(4.8, 8.2, -3.5, 1.05);
  buildLantern(-4.8, 8.2, 2.2, 0.95);
  buildLantern(4.8, 8.2, 2.2, 0.95);
  buildLantern(-8.5, 8.1, -6.2, 0.82);
  buildLantern(8.5, 8.1, -6.2, 0.82);
  buildLantern(-2.6, 8.2, 6.2, 0.9);
  buildLantern(2.6, 8.2, 6.2, 0.9);

  // =========================================================================
  // 5. GRAND CENTRAL MAZU SHRINE (天上聖母 正殿)
  // =========================================================================
  const mazuGroup = new THREE.Group();
  mazuGroup.position.set(0, 0, -9.6);
  root.add(mazuGroup);

  // Raised tiered red & gold sanctuary dais
  const dais1 = new THREE.Mesh(track(new THREE.BoxGeometry(9.0, 0.36, 4.8)), matLacquerRed);
  dais1.position.set(0, 0.18, 0.2);
  dais1.receiveShadow = true;
  const daisTrim = new THREE.Mesh(track(new THREE.BoxGeometry(9.1, 0.08, 4.9)), matGold);
  daisTrim.position.set(0, 0.37, 0.2);
  mazuGroup.add(dais1, daisTrim);

  // 4 Gold Shrine Columns supporting canopy
  [-3.9, -2.15, 2.15, 3.9].forEach((cx) => {
    const col = new THREE.Mesh(track(new THREE.CylinderGeometry(0.16, 0.18, 5.4, 14)), matGold);
    col.position.set(cx, 3.05, 1.75);
    col.castShadow = true;
    mazuGroup.add(col);
  });

  // Ornate Canopy Roof + Upturned Eaves
  const canopyBase = new THREE.Mesh(track(new THREE.BoxGeometry(8.8, 0.95, 3.8)), matDarkWood);
  canopyBase.position.set(0, 6.0, 0.3);
  const canopyRoof = new THREE.Mesh(track(new THREE.BoxGeometry(9.6, 0.38, 4.4)), matLacquerRed);
  canopyRoof.position.set(0, 6.65, 0.3);
  const canopyRidge = new THREE.Mesh(track(new THREE.BoxGeometry(8.6, 0.28, 0.55)), matGold);
  canopyRidge.position.set(0, 7.0, 0.3);
  mazuGroup.add(canopyBase, canopyRoof, canopyRidge);

  // Iconic Gold-on-Black Plaque: 母聖上天 (traditional R-to-L: 天上聖母)
  const mazuPlaqueTex = track(createPlaqueTexture('母聖上天', { width: 512, height: 148 }));
  const mazuPlaque = new THREE.Mesh(
    track(new THREE.BoxGeometry(3.2, 0.92, 0.16)),
    track(new THREE.MeshStandardMaterial({ map: mazuPlaqueTex, color: 0xffffff, roughness: 0.32 })),
  );
  mazuPlaque.position.set(0, 6.05, 2.25);
  mazuGroup.add(mazuPlaque);

  // Vertical Crimson Couplets on inner shrine columns
  const coupletLeftTex = track(createCoupletTexture('天后聖德護千家'));
  const coupletRightTex = track(createCoupletTexture('海上慈航庇萬眾'));
  const coupletGeo = track(new THREE.BoxGeometry(0.38, 3.2, 0.08));
  const cLeft = new THREE.Mesh(
    coupletGeo,
    track(new THREE.MeshStandardMaterial({ map: coupletLeftTex, color: 0xffffff, roughness: 0.4 })),
  );
  cLeft.position.set(-2.15, 3.4, 1.95);
  const cRight = new THREE.Mesh(
    coupletGeo,
    track(new THREE.MeshStandardMaterial({ map: coupletRightTex, color: 0xffffff, roughness: 0.4 })),
  );
  cRight.position.set(2.15, 3.4, 1.95);
  mazuGroup.add(cLeft, cRight);

  // Draped Golden Silk Curtains flanking mural
  const curtainGeo = track(new THREE.CylinderGeometry(0.42, 0.55, 4.9, 12, 1, false, 0, Math.PI));
  [-3.1, 3.1].forEach((sx) => {
    const curtain = new THREE.Mesh(curtainGeo, matSilkGold);
    curtain.position.set(sx, 3.1, 0.65);
    mazuGroup.add(curtain);
  });

  // Back Sanctuary Mural (generated twin-dragon sea-wave artwork!)
  const muralPlane = new THREE.Mesh(
    track(new THREE.PlaneGeometry(5.6, 4.5)),
    track(new THREE.MeshStandardMaterial({ map: muralTex, color: 0xffffff, roughness: 0.55, metalness: 0.08 })),
  );
  muralPlane.position.set(0, 3.05, -1.65);
  mazuGroup.add(muralPlane);

  // Sculpted 3D Golden Mazu Statue (Composite 10-part Deity Sculpture!)
  const buildMazuStatue = () => {
    const stat = new THREE.Group();
    stat.position.set(0, 0.4, -0.55);

    // Ornate golden pedestal & dragon chair
    const ped = new THREE.Mesh(track(new THREE.BoxGeometry(1.9, 1.05, 1.45)), matLacquerRed);
    ped.position.y = 0.525;
    const pedGold = new THREE.Mesh(track(new THREE.BoxGeometry(2.05, 0.14, 1.6)), matGold);
    pedGold.position.y = 1.08;
    const throneBack = new THREE.Mesh(track(new THREE.BoxGeometry(1.65, 2.35, 0.18)), matGold);
    throneBack.position.set(0, 2.25, -0.56);
    stat.add(ped, pedGold, throneBack);

    // Imperial crimson & gold seated robe
    const robeBase = new THREE.Mesh(track(new THREE.CylinderGeometry(0.46, 0.78, 1.35, 16)), matLacquerRed);
    robeBase.position.set(0, 1.82, 0);
    const goldOvercoat = new THREE.Mesh(track(new THREE.CylinderGeometry(0.49, 0.72, 1.05, 16)), matGold);
    goldOvercoat.position.set(0, 1.9, 0.04);
    const sleeves = new THREE.Mesh(track(new THREE.BoxGeometry(1.22, 0.42, 0.48)), matGold);
    sleeves.position.set(0, 2.08, 0.18);
    // Ceremonial jade tablet (朝笏) held in front
    const tablet = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.16, 0.54, 0.06)),
      track(new THREE.MeshStandardMaterial({ color: 0xf4e3b8, roughness: 0.3, metalness: 0.2 })),
    );
    tablet.position.set(0, 2.22, 0.46);
    tablet.rotation.x = -0.18;

    // Serene compassionate painted Mazu deity visage
    const mazuFaceTex = track(createMazuFaceTexture());
    const face = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.32, 22, 18)),
      track(new THREE.MeshStandardMaterial({ map: mazuFaceTex, color: 0xffffff, roughness: 0.42, metalness: 0.12 })),
    );
    face.position.set(0, 2.86, 0.05);
    face.rotation.y = -Math.PI / 2;

    // Imperial Beaded Crown (冕冠)
    const crownBase = new THREE.Mesh(track(new THREE.CylinderGeometry(0.34, 0.30, 0.28, 16)), matGold);
    crownBase.position.set(0, 3.18, 0.05);
    const crownBoard = new THREE.Mesh(track(new THREE.BoxGeometry(0.95, 0.08, 0.56)), matGold);
    crownBoard.position.set(0, 3.36, 0.05);
    // Hanging golden beads
    const beadGeo = track(new THREE.CylinderGeometry(0.014, 0.014, 0.32, 6));
    for (let i = -3; i <= 3; i++) {
      const bead = new THREE.Mesh(beadGeo, matGold);
      bead.position.set(i * 0.11, 3.16, 0.30);
      stat.add(bead);
    }

    // Radiant Golden Halo behind Mazu
    const halo = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.76, 0.06, 10, 32)),
      track(
        new THREE.MeshStandardMaterial({
          color: 0xffe07d,
          emissive: 0xffb833,
          emissiveIntensity: 0.9,
          roughness: 0.2,
          metalness: 0.8,
        }),
      ),
    );
    halo.position.set(0, 2.95, -0.34);

    stat.add(robeBase, goldOvercoat, sleeves, tablet, face, crownBase, crownBoard, halo);
    mazuGroup.add(stat);
  };
  buildMazuStatue();

  // Flanking Guardians: 千里眼 (Green) & 順風耳 (Crimson)
  const buildGuardian = (x: number, bodyColor: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0.4, 0.55);
    const bodyMat = track(new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5, metalness: 0.2 }));
    const base = new THREE.Mesh(track(new THREE.CylinderGeometry(0.36, 0.42, 0.35, 12)), matLacquerRed);
    base.position.y = 0.175;
    const torso = new THREE.Mesh(track(new THREE.CylinderGeometry(0.24, 0.34, 0.92, 12)), matGold);
    torso.position.y = 0.8;
    const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.22, 14, 12)), bodyMat);
    head.position.y = 1.46;
    const horns = new THREE.Mesh(track(new THREE.ConeGeometry(0.18, 0.28, 8)), matGold);
    horns.position.y = 1.72;
    g.add(base, torso, head, horns);
    mazuGroup.add(g);
  };
  buildGuardian(-2.85, 0x3b8c58);
  buildGuardian(2.85, 0xb8322a);

  // Floral Basket Arrangements flanking Main Altar (matches screenshot!)
  const buildFloralBasket = (x: number, z: number) => {
    const fg = new THREE.Group();
    fg.position.set(x, 0, z);
    const stand = new THREE.Mesh(track(new THREE.CylinderGeometry(0.26, 0.38, 1.05, 12)), matLacquerRed);
    stand.position.y = 0.525;
    const leafMat = track(new THREE.MeshStandardMaterial({ color: 0x266b32, roughness: 0.75 }));
    const foliage = new THREE.Mesh(track(new THREE.SphereGeometry(0.56, 12, 10)), leafMat);
    foliage.scale.set(1.15, 0.95, 0.85);
    foliage.position.y = 1.42;
    fg.add(stand, foliage);

    const bloomColors = [0xe83b3b, 0xf7c948, 0xff8fa3, 0xf57c20];
    const bloomGeo = track(new THREE.SphereGeometry(0.13, 8, 8));
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const r = 0.25 + (i % 2) * 0.24;
      const b = new THREE.Mesh(
        bloomGeo,
        track(new THREE.MeshStandardMaterial({ color: bloomColors[i % bloomColors.length], roughness: 0.55 })),
      );
      b.position.set(Math.cos(a) * r, 1.38 + (i % 3) * 0.18, Math.sin(a) * r * 0.7 + 0.14);
      fg.add(b);
    }
    root.add(fg);
  };
  buildFloralBasket(-3.9, -6.9);
  buildFloralBasket(3.9, -6.9);
  buildFloralBasket(-10.4, -7.8);
  buildFloralBasket(10.4, -7.8);

  // Main Offering Table (供桌) in front of Mazu
  const tableGroup = new THREE.Group();
  tableGroup.position.set(0, 0, -6.95);
  const tableTop = new THREE.Mesh(track(new THREE.BoxGeometry(6.8, 0.16, 1.3)), matLacquerRed);
  tableTop.position.y = 1.04;
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  const tableApron = new THREE.Mesh(track(new THREE.BoxGeometry(6.5, 0.96, 1.1)), matDarkWood);
  tableApron.position.y = 0.48;
  const tableGoldTrim = new THREE.Mesh(track(new THREE.BoxGeometry(6.86, 0.08, 1.34)), matGold);
  tableGoldTrim.position.y = 0.95;
  tableGroup.add(tableTop, tableApron, tableGoldTrim);

  // Glowing electric/wax candle lamps on the offering table
  [-2.8, 2.8].forEach((lx) => {
    const base = new THREE.Mesh(track(new THREE.CylinderGeometry(0.12, 0.16, 0.34, 10)), matGold);
    base.position.set(lx, 1.29, 0);
    const flame = new THREE.Mesh(track(new THREE.SphereGeometry(0.11, 10, 10)), matCandleGlow);
    flame.scale.set(0.75, 1.35, 0.75);
    flame.position.set(lx, 1.56, 0);
    tableGroup.add(base, flame);
  });

  // Dynamic Player Offerings Group (appears on offering table when placed!)
  const playerOfferingsGroup = new THREE.Group();
  playerOfferingsGroup.position.set(0, 1.12, 0.1);
  playerOfferingsGroup.visible = false;

  // Fruit platter
  const plateGeo = track(new THREE.CylinderGeometry(0.34, 0.24, 0.07, 16));
  const plate1 = new THREE.Mesh(plateGeo, matGold);
  plate1.position.set(-1.05, 0.04, 0);
  const appleMat = track(new THREE.MeshStandardMaterial({ color: 0xd93026, roughness: 0.35 }));
  const orangeMat = track(new THREE.MeshStandardMaterial({ color: 0xf08c1e, roughness: 0.45 }));
  [
    [-1.16, 0.15, 0.06, appleMat],
    [-0.94, 0.15, 0.04, orangeMat],
    [-1.05, 0.15, -0.09, appleMat],
    [-1.05, 0.27, 0.0, orangeMat],
  ].forEach(([fx, fy, fz, fm]) => {
    const fruit = new THREE.Mesh(track(new THREE.SphereGeometry(0.11, 10, 10)), fm as THREE.Material);
    fruit.position.set(fx as number, fy as number, fz as number);
    playerOfferingsGroup.add(fruit);
  });

  // Traditional temple cakes (壽桃/糕餅)
  const plate2 = new THREE.Mesh(plateGeo, matGold);
  plate2.position.set(1.05, 0.04, 0);
  const peachMat = track(new THREE.MeshStandardMaterial({ color: 0xf7a1b5, roughness: 0.5 }));
  for (let i = 0; i < 3; i++) {
    const cake = new THREE.Mesh(track(new THREE.SphereGeometry(0.11, 10, 10)), peachMat);
    cake.position.set(0.92 + i * 0.13, 0.16, (i % 2) * 0.08 - 0.04);
    playerOfferingsGroup.add(cake);
  }

  // Fresh Flower Vases
  [-1.95, 1.95].forEach((vx) => {
    const vase = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.11, 0.16, 0.38, 12)),
      track(new THREE.MeshStandardMaterial({ color: 0x3b7ea1, roughness: 0.25, metalness: 0.15 })),
    );
    vase.position.set(vx, 0.19, -0.1);
    const blossom = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.2, 10, 10)),
      track(new THREE.MeshStandardMaterial({ color: 0xf77896, roughness: 0.5 })),
    );
    blossom.position.set(vx, 0.48, -0.1);
    playerOfferingsGroup.add(vase, blossom);
  });

  playerOfferingsGroup.add(plate1, plate2);
  tableGroup.add(playerOfferingsGroup);
  root.add(tableGroup);

  // Central Mazu Incense Burner (香爐) & Donation Box (香油箱)
  const buildIncenseBurner = (x: number, z: number, scale = 1) => {
    const bg = new THREE.Group();
    bg.position.set(x, 0, z);
    bg.scale.setScalar(scale);

    const legGeo = track(new THREE.CylinderGeometry(0.08, 0.11, 0.55, 8));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(legGeo, matBronze);
      leg.position.set(Math.cos(a) * 0.34, 0.275, Math.sin(a) * 0.34);
      bg.add(leg);
    }
    const pot = new THREE.Mesh(track(new THREE.CylinderGeometry(0.56, 0.44, 0.62, 18)), matBronze);
    pot.position.y = 0.78;
    pot.castShadow = true;
    const rim = new THREE.Mesh(track(new THREE.TorusGeometry(0.56, 0.06, 8, 22)), matGold);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.09;
    const ash = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.49, 0.49, 0.06, 16)),
      track(new THREE.MeshStandardMaterial({ color: 0x8e867c, roughness: 0.95 })),
    );
    ash.position.y = 1.06;

    // Ears/handles
    [-0.62, 0.62].forEach((hx) => {
      const ear = new THREE.Mesh(track(new THREE.TorusGeometry(0.14, 0.035, 8, 12)), matGold);
      ear.position.set(hx, 0.96, 0);
      bg.add(ear);
    });

    // Cluster of lit incense sticks already planted inside burner
    const stickGeo = track(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6));
    const stickMat = track(new THREE.MeshStandardMaterial({ color: 0x9b7042, roughness: 0.85 }));
    for (let s = 0; s < 9; s++) {
      const ang = (s / 9) * Math.PI * 2;
      const r = 0.08 + (s % 3) * 0.09;
      const st = new THREE.Mesh(stickGeo, stickMat);
      st.position.set(Math.cos(ang) * r, 1.24, Math.sin(ang) * r);
      st.rotation.z = (Math.cos(ang) * 0.14);
      bg.add(st);
    }

    bg.add(pot, rim, ash);
    root.add(bg);
    smokeSources.push(new THREE.Vector3(x, 1.45 * scale, z));
  };

  buildIncenseBurner(0, -5.25, 1.0);
  buildIncenseBurner(0, 11.4, 1.45); // Grand Heaven Incense Burner (天公爐) in courtyard!

  // Wooden Donation Box (香油箱) left of Mazu offering table
  const donationBox = new THREE.Mesh(track(new THREE.BoxGeometry(0.75, 0.92, 0.55)), matLacquerRed);
  donationBox.position.set(-3.9, 0.46, -6.1);
  const donationPlaque = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.58, 0.36)),
    track(
      new THREE.MeshStandardMaterial({
        map: track(createPlaqueTexture('香油', { width: 256, height: 140 })),
        color: 0xffffff,
      }),
    ),
  );
  donationPlaque.position.set(-3.9, 0.56, -5.81);
  root.add(donationBox, donationPlaque);

  // =========================================================================
  // 6. 12 PLUSH CRIMSON KNEELING CUSHIONS (紅色拜墊)
  // =========================================================================
  const cushionGeo = track(new THREE.BoxGeometry(1.18, 0.13, 0.96));
  const cushionBaseGeo = track(new THREE.BoxGeometry(1.26, 0.05, 1.04));
  for (const pos of KNEELING_CUSHION_POSITIONS) {
    const cg = new THREE.Group();
    cg.position.set(pos.x, 0, pos.z);
    const woodBase = new THREE.Mesh(cushionBaseGeo, matDarkWood);
    woodBase.position.y = 0.025;
    const pad = new THREE.Mesh(cushionGeo, matCushionRed);
    pad.position.y = 0.11;
    pad.receiveShadow = true;
    pad.castShadow = true;
    cg.add(woodBase, pad);
    root.add(cg);
  }

  // =========================================================================
  // 7. 4 SIDE DEITY SHRINES (關聖帝君, 玄天上帝, 月下老人, 武財神 & 虎爺)
  // =========================================================================
  const buildSideShrine = (opts: {
    x: number;
    z: number;
    rotY: number;
    plaqueText: string;
    robeColor: number;
    faceColor: number;
    accentColor: number;
    hasBeard?: boolean;
    hasPeachTree?: boolean;
    hasTigerLord?: boolean;
  }) => {
    const sg = new THREE.Group();
    sg.position.set(opts.x, 0, opts.z);
    sg.rotation.y = opts.rotY;

    // Shrine backdrop & canopy
    const back = new THREE.Mesh(track(new THREE.BoxGeometry(4.2, 4.6, 0.3)), matDarkWood);
    back.position.set(0, 2.3, -1.2);
    const roof = new THREE.Mesh(track(new THREE.BoxGeometry(4.7, 0.34, 2.4)), matLacquerRed);
    roof.position.set(0, 4.75, -0.2);
    const roofGold = new THREE.Mesh(track(new THREE.BoxGeometry(4.3, 0.18, 0.32)), matGold);
    roofGold.position.set(0, 5.02, -0.2);
    sg.add(back, roof, roofGold);

    // Side golden pillars
    [-1.85, 1.85].forEach((px) => {
      const c = new THREE.Mesh(track(new THREE.CylinderGeometry(0.11, 0.12, 4.5, 12)), matGold);
      c.position.set(px, 2.25, 0.72);
      sg.add(c);
    });

    // Plaque
    const pTex = track(createPlaqueTexture(opts.plaqueText, { width: 512, height: 140 }));
    const plaque = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.4, 0.68, 0.14)),
      track(new THREE.MeshStandardMaterial({ map: pTex, color: 0xffffff, roughness: 0.35 })),
    );
    plaque.position.set(0, 4.18, 0.88);
    sg.add(plaque);

    // Altar Table
    const tbl = new THREE.Mesh(track(new THREE.BoxGeometry(3.6, 1.05, 1.25)), matLacquerRed);
    tbl.position.set(0, 0.525, 0.25);
    const tblTrim = new THREE.Mesh(track(new THREE.BoxGeometry(3.68, 0.08, 1.32)), matGold);
    tblTrim.position.set(0, 1.06, 0.25);
    sg.add(tbl, tblTrim);

    // Sculpted 3D Deity Statue
    const robeMat = track(new THREE.MeshStandardMaterial({ color: opts.robeColor, roughness: 0.45, metalness: 0.2 }));
    const faceMat = track(new THREE.MeshStandardMaterial({ color: opts.faceColor, roughness: 0.48 }));
    const accMat = track(new THREE.MeshStandardMaterial({ color: opts.accentColor, roughness: 0.32, metalness: 0.65 }));

    const pedestal = new THREE.Mesh(track(new THREE.BoxGeometry(1.3, 0.45, 0.9)), matGold);
    pedestal.position.set(0, 1.3, -0.1);
    const robe = new THREE.Mesh(track(new THREE.CylinderGeometry(0.34, 0.56, 1.08, 14)), robeMat);
    robe.position.set(0, 2.04, -0.1);
    const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.24, 14, 12)), faceMat);
    head.position.set(0, 2.8, -0.06);
    const crown = new THREE.Mesh(track(new THREE.CylinderGeometry(0.22, 0.25, 0.26, 12)), accMat);
    crown.position.set(0, 3.08, -0.06);
    sg.add(pedestal, robe, head, crown);

    if (opts.hasBeard) {
      const beard = new THREE.Mesh(
        track(new THREE.ConeGeometry(0.14, 0.42, 8)),
        track(new THREE.MeshStandardMaterial({ color: opts.plaqueText.includes('月') ? 0xf2f0eb : 0x1e1b18, roughness: 0.7 })),
      );
      beard.rotation.x = Math.PI;
      beard.position.set(0, 2.52, 0.14);
      sg.add(beard);
    }

    // Small incense burner on altar
    const miniPot = new THREE.Mesh(track(new THREE.CylinderGeometry(0.24, 0.19, 0.28, 14)), matBronze);
    miniPot.position.set(0, 1.24, 0.65);
    sg.add(miniPot);

    // Glowing side candle lamps
    [-1.25, 1.25].forEach((lx) => {
      const lamp = new THREE.Mesh(track(new THREE.SphereGeometry(0.09, 10, 8)), matCandleGlow);
      lamp.position.set(lx, 1.32, 0.45);
      sg.add(lamp);
    });

    // Optional Peach Blossom Tree (月老殿 桃花樹!)
    if (opts.hasPeachTree) {
      const trunk = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.16, 1.8, 8)), matDarkWood);
      trunk.position.set(-2.3, 0.9, 0.4);
      const canopyMat = track(new THREE.MeshStandardMaterial({ color: 0xf48fb1, roughness: 0.65 }));
      const c1 = new THREE.Mesh(track(new THREE.SphereGeometry(0.68, 12, 10)), canopyMat);
      c1.position.set(-2.3, 2.15, 0.4);
      const c2 = new THREE.Mesh(track(new THREE.SphereGeometry(0.5, 10, 8)), canopyMat);
      c2.position.set(-1.95, 2.45, 0.65);
      sg.add(trunk, c1, c2);
    }

    // Optional Tiger Lord (虎爺) sitting under the Wealth God altar!
    if (opts.hasTigerLord) {
      // Hollow alcove look using dark shadow backing on front of table
      const alcove = new THREE.Mesh(
        track(new THREE.BoxGeometry(1.15, 0.78, 0.12)),
        track(new THREE.MeshStandardMaterial({ color: 0x1a0b08, roughness: 0.95 })),
      );
      alcove.position.set(0, 0.42, 0.85);
      // Cute golden Tiger Lord figurine
      const tigerMat = track(new THREE.MeshStandardMaterial({ color: 0xf0aa2e, roughness: 0.45, metalness: 0.25 }));
      const tBody = new THREE.Mesh(track(new THREE.SphereGeometry(0.24, 12, 10)), tigerMat);
      tBody.scale.set(1.0, 0.95, 1.25);
      tBody.position.set(0, 0.28, 1.05);
      const tHead = new THREE.Mesh(track(new THREE.SphereGeometry(0.2, 12, 10)), tigerMat);
      tHead.position.set(0, 0.56, 1.16);
      const earGeo = track(new THREE.SphereGeometry(0.065, 8, 8));
      [-0.14, 0.14].forEach((ex) => {
        const te = new THREE.Mesh(earGeo, tigerMat);
        te.position.set(ex, 0.73, 1.15);
        sg.add(te);
      });
      // Bowl of "錢水" (coin water) in front of Tiger Lord
      const bowl = new THREE.Mesh(track(new THREE.CylinderGeometry(0.22, 0.16, 0.12, 14)), matGold);
      bowl.position.set(0, 0.06, 1.48);
      sg.add(alcove, tBody, tHead, bowl);
    }

    // Kneeling cushion right in front of side shrine
    const cPad = new THREE.Mesh(cushionGeo, matCushionRed);
    cPad.position.set(0, 0.08, 2.0);
    sg.add(cPad);

    root.add(sg);
  };

  // Guan Yu (Left North Wing)
  buildSideShrine({
    x: -7.8,
    z: -10.1,
    rotY: 0,
    plaqueText: '君帝聖關',
    robeColor: 0x1e6b3f,
    faceColor: 0xc94132,
    accentColor: 0xe6b94c,
    hasBeard: true,
  });

  // Xuan Tian Shang Di (Right North Wing)
  buildSideShrine({
    x: 7.8,
    z: -10.1,
    rotY: 0,
    plaqueText: '帝上天玄',
    robeColor: 0x222c44,
    faceColor: 0xebb98f,
    accentColor: 0xd9b150,
    hasBeard: true,
  });

  // Yue Lao Matchmaker (Left West Wall facing East)
  buildSideShrine({
    x: -10.7,
    z: -0.2,
    rotY: Math.PI / 2,
    plaqueText: '人老下月',
    robeColor: 0xc2385c,
    faceColor: 0xf4c8a6,
    accentColor: 0xf296ad,
    hasBeard: true,
    hasPeachTree: true,
  });

  // Wealth God Zhao Gongming & Tiger Lord (Right East Wall facing West)
  buildSideShrine({
    x: 10.7,
    z: -0.2,
    rotY: -Math.PI / 2,
    plaqueText: '神財武 · 爺虎',
    robeColor: 0xd18a1f,
    faceColor: 0xdf9f6c,
    accentColor: 0xf7cf52,
    hasBeard: true,
    hasTigerLord: true,
  });

  // =========================================================================
  // 8. SERVICE COUNTER (廟宇服務處) — Front-Left
  // =========================================================================
  const serviceGroup = new THREE.Group();
  serviceGroup.position.set(-10.5, 0, 5.2);
  serviceGroup.rotation.y = Math.PI / 2;

  const desk = new THREE.Mesh(track(new THREE.BoxGeometry(3.6, 1.05, 1.15)), matDarkWood);
  desk.position.set(0, 0.525, 0.25);
  const deskTop = new THREE.Mesh(track(new THREE.BoxGeometry(3.8, 0.12, 1.3)), matLacquerRed);
  deskTop.position.set(0, 1.08, 0.25);
  const svcPlaqueTex = track(createPlaqueTexture('處 務 服 廟 宇', { width: 512, height: 128 }));
  const svcPlaque = new THREE.Mesh(
    track(new THREE.BoxGeometry(2.8, 0.65, 0.12)),
    track(new THREE.MeshStandardMaterial({ map: svcPlaqueTex, color: 0xffffff, roughness: 0.35 })),
  );
  svcPlaque.position.set(0, 2.95, 0.2);
  // Display trays of incense & gold paper on counter
  const tray1 = new THREE.Mesh(track(new THREE.BoxGeometry(0.7, 0.24, 0.45)), matGold);
  tray1.position.set(-0.9, 1.24, 0.35);
  const tray2 = new THREE.Mesh(track(new THREE.BoxGeometry(0.7, 0.22, 0.45)), matLacquerRed);
  tray2.position.set(0.9, 1.23, 0.35);
  serviceGroup.add(desk, deskTop, svcPlaque, tray1, tray2);
  root.add(serviceGroup);

  // =========================================================================
  // 9. TEMPLE BELL (平安古鐘) — East Wall (matches right side of screenshot!)
  // =========================================================================
  const bellFrame = new THREE.Group();
  bellFrame.position.set(10.6, 0, -4.2);
  bellFrame.rotation.y = -Math.PI / 2;

  [-0.85, 0.85].forEach((bx) => {
    const post = new THREE.Mesh(track(new THREE.CylinderGeometry(0.08, 0.1, 3.1, 10)), matLacquerRed);
    post.position.set(bx, 1.55, 0);
    bellFrame.add(post);
  });
  const crossbar = new THREE.Mesh(track(new THREE.BoxGeometry(2.15, 0.18, 0.2)), matLacquerRed);
  crossbar.position.set(0, 3.05, 0);
  bellFrame.add(crossbar);

  const bellPivot = new THREE.Group();
  bellPivot.position.set(0, 2.95, 0);
  const bellHang = new THREE.Mesh(track(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8)), matBronze);
  bellHang.position.y = -0.22;
  const bellBody = new THREE.Mesh(track(new THREE.CylinderGeometry(0.28, 0.56, 1.05, 18)), matBronze);
  bellBody.position.y = -0.88;
  const bellRim = new THREE.Mesh(track(new THREE.TorusGeometry(0.56, 0.06, 8, 20)), matGold);
  bellRim.rotation.x = Math.PI / 2;
  bellRim.position.y = -1.38;
  bellPivot.add(bellHang, bellBody, bellRim);
  bellFrame.add(bellPivot);
  root.add(bellFrame);

  // =========================================================================
  // 10. BLESSING LANTERN WALL (光明燈牆) — Front-Right
  // =========================================================================
  let lanternWallTex = createLanternWallTexture([2, 7, 12]);
  const lanternWallMat = track(
    new THREE.MeshStandardMaterial({
      map: lanternWallTex,
      emissiveMap: lanternWallTex,
      emissive: new THREE.Color(0xffb84d),
      emissiveIntensity: 0.7,
      color: 0xffffff,
      roughness: 0.35,
    }),
  );
  const lanternCabinet = new THREE.Group();
  lanternCabinet.position.set(10.8, 0, 5.0);
  lanternCabinet.rotation.y = -Math.PI / 2;
  const cabBody = new THREE.Mesh(track(new THREE.BoxGeometry(3.4, 3.8, 0.6)), matDarkWood);
  cabBody.position.set(0, 1.9, -0.1);
  const lanternWallMesh = new THREE.Mesh(track(new THREE.PlaneGeometry(3.15, 3.45)), lanternWallMat);
  lanternWallMesh.position.set(0, 1.95, 0.22);
  lanternCabinet.add(cabBody, lanternWallMesh);
  root.add(lanternCabinet);

  const updateLanternWall = (litSlots: number[]) => {
    const next = createLanternWallTexture(litSlots);
    lanternWallMat.map = next;
    lanternWallMat.emissiveMap = next;
    lanternWallMat.needsUpdate = true;
    lanternWallTex.dispose();
    lanternWallTex = next;
  };

  // =========================================================================
  // 11. GOLDEN JOSS PAPER FURNACE (招財金爐) — East Courtyard
  // =========================================================================
  const jinluGroup = new THREE.Group();
  jinluGroup.position.set(8.4, 0, 12.6);

  const fBase = new THREE.Mesh(track(new THREE.CylinderGeometry(1.25, 1.45, 0.9, 8)), matBrickSide);
  fBase.position.y = 0.45;
  const fBody = new THREE.Mesh(track(new THREE.CylinderGeometry(1.05, 1.2, 2.0, 8)), matLacquerRed);
  fBody.position.y = 1.9;
  const fMouth = new THREE.Mesh(track(new THREE.BoxGeometry(0.75, 0.72, 0.4)), matEmber);
  fMouth.position.set(-1.05, 1.38, 0);
  const fRoof1 = new THREE.Mesh(track(new THREE.ConeGeometry(1.65, 0.9, 8)), matRoofTile);
  fRoof1.position.y = 3.25;
  const fRoof2 = new THREE.Mesh(track(new THREE.ConeGeometry(1.1, 0.85, 8)), matGold);
  fRoof2.position.y = 4.05;
  const fSpire = new THREE.Mesh(track(new THREE.SphereGeometry(0.22, 10, 10)), matGold);
  fSpire.position.y = 4.6;
  jinluGroup.add(fBase, fBody, fMouth, fRoof1, fRoof2, fSpire);
  root.add(jinluGroup);
  smokeSources.push(new THREE.Vector3(8.4, 4.75, 12.6));

  const dispose = () => {
    lanternWallTex.dispose();
    for (const d of disposables) {
      d.dispose();
    }
  };

  return {
    root,
    lanterns,
    bellPivot,
    playerOfferingsGroup,
    lanternWallMesh,
    smokeSources,
    updateLanternWall,
    dispose,
  };
}
