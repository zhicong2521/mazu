import * as THREE from 'three';
import { AVATAR_OPTIONS } from '../data';
import type { AvatarConfig, EmoteType } from '../types';
import { createAvatarFaceTexture, createContactShadowTexture, createNameTagTexture } from './textures';

export interface ChibiAvatarRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftFoot: THREE.Mesh;
  rightFoot: THREE.Mesh;
  incenseGroup: THREE.Group;
  nameSprite: THREE.Sprite;
  faceMat: THREE.MeshStandardMaterial;
  setSpeechBubble: (text?: string) => void;
  updateAnimation: (
    dt: number,
    elapsed: number,
    speed: number,
    emote: EmoteType,
    holdingIncense: boolean,
  ) => void;
  dispose: () => void;
}

let sharedShadowTex: THREE.CanvasTexture | null = null;
function getShadowTex(): THREE.CanvasTexture {
  if (!sharedShadowTex) sharedShadowTex = createContactShadowTexture();
  return sharedShadowTex;
}

/**
 * Builds a composite multi-part (9–14 parts) Q-Chibi 3D Pilgrim Avatar pivoted at bottom-center (y = 0).
 */
export function buildChibiAvatar(
  config: AvatarConfig,
  options?: { isPlayer?: boolean; showNameTag?: boolean },
): ChibiAvatarRig {
  const isPlayer = options?.isPlayer ?? false;
  const showNameTag = options?.showNameTag ?? true;

  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  // Contact shadow disc grounded at y = 0.015
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: getShadowTex(),
      transparent: true,
      depthWrite: false,
      opacity: 0.48,
    }),
  );
  const shadowMesh = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(0.46, 20)), shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.015;
  root.add(shadowMesh);

  // Body Pivot (sits on ground, bobs/kneels smoothly)
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const outfitSpec =
    AVATAR_OPTIONS.outfitStyles.find((o) => o.id === config.outfitStyle) ??
    AVATAR_OPTIONS.outfitStyles[0];

  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.skinColor),
      roughness: 0.62,
      metalness: 0.02,
    }),
  );

  const clothMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(outfitSpec.primary),
      roughness: 0.78,
      metalness: 0.04,
    }),
  );

  const trimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(outfitSpec.trim),
      roughness: 0.35,
      metalness: 0.45,
    }),
  );

  const hairMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.hairColor),
      roughness: 0.52,
      metalness: 0.08,
    }),
  );

  const shoeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x261a18,
      roughness: 0.65,
      metalness: 0.08,
    }),
  );

  // 1. Little cute feet (shoes)
  const footGeo = trackGeo(new THREE.SphereGeometry(0.115, 14, 12));
  footGeo.scale(0.85, 0.62, 1.35);
  const leftFoot = new THREE.Mesh(footGeo, shoeMat);
  leftFoot.position.set(-0.13, 0.07, 0.02);
  leftFoot.castShadow = true;
  bodyPivot.add(leftFoot);

  const rightFoot = new THREE.Mesh(footGeo, shoeMat);
  rightFoot.position.set(0.13, 0.07, 0.02);
  rightFoot.castShadow = true;
  bodyPivot.add(rightFoot);

  // 2. Torso / Tunic (lathe-style tapered chibi garment)
  const torsoGeo = trackGeo(new THREE.CylinderGeometry(0.21, 0.31, 0.56, 20));
  const torso = new THREE.Mesh(torsoGeo, clothMat);
  torso.position.y = 0.42;
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  // Hem skirt flare & gold collar trim
  const hemGeo = trackGeo(new THREE.TorusGeometry(0.305, 0.024, 8, 22));
  const hem = new THREE.Mesh(hemGeo, trimMat);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.15;
  bodyPivot.add(hem);

  const collarGeo = trackGeo(new THREE.TorusGeometry(0.18, 0.032, 10, 20));
  const collar = new THREE.Mesh(collarGeo, trimMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.69;
  bodyPivot.add(collar);

  // Traditional frog buttons / waist sash accent on front (+Z)
  const sashGeo = trackGeo(new THREE.CylinderGeometry(0.262, 0.272, 0.075, 20));
  const sash = new THREE.Mesh(sashGeo, trimMat);
  sash.position.y = 0.36;
  bodyPivot.add(sash);

  const buttonGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.018, 0.02));
  for (let b = 0; b < 3; b++) {
    const btn = new THREE.Mesh(buttonGeo, trimMat);
    btn.position.set(0, 0.61 - b * 0.085, 0.235 + b * 0.012);
    bodyPivot.add(btn);
  }

  // 3. Articulated Left & Right Arms (sleeve + little hand)
  const makeArm = (side: -1 | 1): THREE.Group => {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.25, 0.63, 0);

    const sleeveGeo = trackGeo(new THREE.CapsuleGeometry(0.068, 0.16, 6, 12));
    const sleeve = new THREE.Mesh(sleeveGeo, clothMat);
    sleeve.position.y = -0.11;
    sleeve.castShadow = true;
    armGroup.add(sleeve);

    const handGeo = trackGeo(new THREE.SphereGeometry(0.062, 12, 10));
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.23;
    armGroup.add(hand);

    return armGroup;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  bodyPivot.add(leftArm, rightArm);

  // 4. Held Incense Sticks Group (3 lit sticks with glowing ember tips!)
  const incenseGroup = new THREE.Group();
  incenseGroup.position.set(0, 0.56, 0.34);
  incenseGroup.visible = false;

  const stickWoodMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xb83024, roughness: 0.7 }));
  const stickBodyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x8b673c, roughness: 0.85 }));
  const emberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xff5a1f,
      emissive: 0xff3b00,
      emissiveIntensity: 2.2,
      roughness: 0.4,
    }),
  );
  const baseGeo = trackGeo(new THREE.CylinderGeometry(0.009, 0.009, 0.14, 6));
  const shaftGeo = trackGeo(new THREE.CylinderGeometry(0.011, 0.011, 0.36, 6));
  const tipGeo = trackGeo(new THREE.SphereGeometry(0.016, 8, 8));

  [-0.032, 0, 0.032].forEach((offsetX, i) => {
    const single = new THREE.Group();
    single.position.set(offsetX, 0, 0);
    single.rotation.z = (i - 1) * -0.07;
    single.rotation.x = 0.25;

    const base = new THREE.Mesh(baseGeo, stickWoodMat);
    base.position.y = 0.06;
    const shaft = new THREE.Mesh(shaftGeo, stickBodyMat);
    shaft.position.y = 0.30;
    const tip = new THREE.Mesh(tipGeo, emberMat);
    tip.position.y = 0.49;

    single.add(base, shaft, tip);
    incenseGroup.add(single);
  });
  bodyPivot.add(incenseGroup);

  // 5. Big Adorable Q-Chibi Head with Canvas Face Texture
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.04;
  bodyPivot.add(headGroup);

  const faceTex = createAvatarFaceTexture(config);
  disposables.push(faceTex);
  const faceMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: faceTex,
      color: 0xffffff,
      roughness: 0.56,
      metalness: 0.02,
    }),
  );

  const headGeo = trackGeo(new THREE.SphereGeometry(0.365, 28, 22));
  headGeo.scale(1.03, 0.96, 0.98);
  const headMesh = new THREE.Mesh(headGeo, faceMat);
  // Rotate so u = 0.5 on SphereGeometry faces +Z (front of avatar)
  headMesh.rotation.y = -Math.PI / 2;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Cute ears
  const earGeo = trackGeo(new THREE.SphereGeometry(0.068, 10, 10));
  const leftEar = new THREE.Mesh(earGeo, skinMat);
  leftEar.position.set(-0.355, -0.02, 0);
  const rightEar = new THREE.Mesh(earGeo, skinMat);
  rightEar.position.set(0.355, -0.02, 0);
  headGroup.add(leftEar, rightEar);

  // 6. Hairstyles (multi-part composite hair)
  const hairGroup = new THREE.Group();
  headGroup.add(hairGroup);

  if (config.hairStyle !== 'monk') {
    // Hair cap covering back & top (raised slightly to frame forehead cleanly)
    const capGeo = trackGeo(
      new THREE.SphereGeometry(0.388, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.56),
    );
    capGeo.scale(1.03, 0.98, 1.02);
    const cap = new THREE.Mesh(capGeo, hairMat);
    cap.position.set(0, 0.075, -0.025);
    cap.castShadow = true;
    hairGroup.add(cap);

    // Back hair curtain
    const backShellGeo = trackGeo(
      new THREE.SphereGeometry(0.386, 20, 16, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.25, Math.PI * 0.65),
    );
    const backShell = new THREE.Mesh(backShellGeo, hairMat);
    backShell.rotation.y = Math.PI;
    backShell.position.set(0, 0.01, -0.02);
    hairGroup.add(backShell);

    // Front bangs (framed cleanly above eyebrows so eyes always sparkle clearly)
    const bangGeo = trackGeo(new THREE.SphereGeometry(0.095, 12, 10));
    bangGeo.scale(1.08, 0.56, 0.46);
    const bangCount = config.hairStyle === 'parted' ? 2 : 4;
    for (let i = 0; i < bangCount; i++) {
      const t = bangCount === 2 ? (i === 0 ? -0.14 : 0.14) : -0.17 + i * 0.113;
      const bang = new THREE.Mesh(bangGeo, hairMat);
      bang.position.set(t, 0.275, 0.275 - Math.abs(t) * 0.24);
      bang.rotation.z = -t * 0.9;
      hairGroup.add(bang);
    }

    const tieMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe64545, roughness: 0.4 }));
    if (config.hairStyle === 'twintails') {
      const tailGeo = trackGeo(new THREE.CapsuleGeometry(0.088, 0.24, 8, 12));
      const tieGeo = trackGeo(new THREE.TorusGeometry(0.068, 0.022, 8, 14));
      [-1, 1].forEach((side) => {
        const tie = new THREE.Mesh(tieGeo, tieMat);
        tie.position.set(side * 0.36, 0.08, -0.08);
        tie.rotation.y = Math.PI / 2;
        hairGroup.add(tie);

        const tail = new THREE.Mesh(tailGeo, hairMat);
        tail.position.set(side * 0.42, -0.06, -0.10);
        tail.rotation.z = side * 0.32;
        tail.castShadow = true;
        hairGroup.add(tail);
      });
    } else if (config.hairStyle === 'bun') {
      const bunGeo = trackGeo(new THREE.SphereGeometry(0.135, 16, 14));
      const tieGeo = trackGeo(new THREE.TorusGeometry(0.11, 0.022, 8, 16));
      [-1, 1].forEach((side) => {
        const bun = new THREE.Mesh(bunGeo, hairMat);
        bun.position.set(side * 0.28, 0.31, -0.04);
        bun.castShadow = true;
        hairGroup.add(bun);

        const ring = new THREE.Mesh(tieGeo, tieMat);
        ring.position.set(side * 0.25, 0.27, -0.04);
        ring.rotation.x = Math.PI / 2;
        ring.rotation.y = side * 0.4;
        hairGroup.add(ring);
      });
    } else if (config.hairStyle === 'long') {
      const drapeGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.37, 0.48, 16, 1, false, Math.PI * 0.65, Math.PI * 1.7));
      const drape = new THREE.Mesh(drapeGeo, hairMat);
      drape.position.set(0, -0.22, -0.05);
      drape.castShadow = true;
      hairGroup.add(drape);
    } else if (config.hairStyle === 'bob') {
      const sideGeo = trackGeo(new THREE.CapsuleGeometry(0.095, 0.16, 8, 12));
      [-1, 1].forEach((side) => {
        const lock = new THREE.Mesh(sideGeo, hairMat);
        lock.position.set(side * 0.33, -0.10, 0.06);
        lock.rotation.z = side * -0.14;
        hairGroup.add(lock);
      });
    }
  } else {
    // Subtle incense blessing dots on forehead for monk style
    const dotGeo = trackGeo(new THREE.SphereGeometry(0.015, 6, 6));
    const dotMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe6b85c, roughness: 0.4 }));
    for (let i = -1; i <= 1; i++) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(i * 0.045, 0.21, 0.32);
      hairGroup.add(dot);
    }
  }

  // 7. Headwear Accessories
  if (config.headwear !== 'none') {
    const hwGroup = new THREE.Group();
    headGroup.add(hwGroup);
    if (config.headwear === 'mazu_cap') {
      const capMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe58a1c, roughness: 0.55 }));
      const dome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.35, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.48)), capMat);
      dome.position.y = 0.16;
      const brim = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.28, 0.32, 0.03, 18, 1, false, -Math.PI * 0.35, Math.PI * 0.7)), capMat);
      brim.position.set(0, 0.21, 0.20);
      brim.rotation.x = 0.15;
      hwGroup.add(dome, brim);
    } else if (config.headwear === 'bamboo_hat') {
      const strawMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd9b36c, roughness: 0.85 }));
      const cone = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.64, 0.26, 22)), strawMat);
      cone.position.y = 0.42;
      cone.castShadow = true;
      const rim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.63, 0.02, 8, 24)), trimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.29;
      hwGroup.add(cone, rim);
    } else if (config.headwear === 'flower_crown') {
      const petalColors = [0xf78da7, 0xffd166, 0xfff0d4, 0xf25c78];
      const fGeo = trackGeo(new THREE.SphereGeometry(0.068, 10, 8));
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const fMat = trackMat(new THREE.MeshStandardMaterial({ color: petalColors[i % petalColors.length], roughness: 0.5 }));
        const flower = new THREE.Mesh(fGeo, fMat);
        flower.position.set(Math.cos(a) * 0.34, 0.28, Math.sin(a) * 0.34);
        hwGroup.add(flower);
      }
    } else if (config.headwear === 'cat_ears') {
      const earConeGeo = trackGeo(new THREE.ConeGeometry(0.11, 0.22, 4));
      const innerGeo = trackGeo(new THREE.ConeGeometry(0.06, 0.14, 4));
      const innerMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf4a2b2, roughness: 0.6 }));
      [-1, 1].forEach((side) => {
        const e = new THREE.Mesh(earConeGeo, hairMat);
        e.position.set(side * 0.22, 0.40, 0.04);
        e.rotation.z = side * -0.26;
        const inner = new THREE.Mesh(innerGeo, innerMat);
        inner.position.set(side * 0.22, 0.39, 0.075);
        inner.rotation.z = side * -0.26;
        hwGroup.add(e, inner);
      });
    } else if (config.headwear === 'wealth_hat') {
      const redHatMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.45 }));
      const goldMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf0c250, roughness: 0.28, metalness: 0.72 }));
      const crown = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.29, 0.22, 18)), redHatMat);
      crown.position.y = 0.40;
      const band = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.275, 0.032, 8, 20)), goldMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.31;
      const wingGeo = trackGeo(new THREE.BoxGeometry(0.26, 0.07, 0.03));
      [-1, 1].forEach((side) => {
        const wing = new THREE.Mesh(wingGeo, goldMat);
        wing.position.set(side * 0.36, 0.37, 0);
        wing.rotation.z = side * 0.18;
        hwGroup.add(wing);
      });
      hwGroup.add(crown, band);
    }
  }

  // 8. Glasses
  if (config.glasses !== 'none') {
    const gGroup = new THREE.Group();
    gGroup.position.set(0, -0.01, 0.355);
    headGroup.add(gGroup);

    const frameColor =
      config.glasses === 'heart' ? 0xe84878 : config.glasses === 'shades' ? 0x1a1a1a : 0xd4a24c;
    const frameMat = trackMat(
      new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.3, metalness: 0.65 }),
    );
    const lensGeo = trackGeo(new THREE.TorusGeometry(0.088, 0.014, 8, 20));
    const bridgeGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.016, 0.016));

    const leftRim = new THREE.Mesh(lensGeo, frameMat);
    leftRim.position.x = -0.115;
    const rightRim = new THREE.Mesh(lensGeo, frameMat);
    rightRim.position.x = 0.115;
    const bridge = new THREE.Mesh(bridgeGeo, frameMat);
    gGroup.add(leftRim, rightRim, bridge);

    if (config.glasses === 'shades') {
      const darkLensMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0x16161c, roughness: 0.15, metalness: 0.5 }),
      );
      const discGeo = trackGeo(new THREE.CircleGeometry(0.084, 18));
      const dl = new THREE.Mesh(discGeo, darkLensMat);
      dl.position.set(-0.115, 0, 0.004);
      const dr = new THREE.Mesh(discGeo, darkLensMat);
      dr.position.set(0.115, 0, 0.004);
      gGroup.add(dl, dr);
    }
  }

  // 9. Floating Name Tag + Speech Bubble Sprite
  let nameTex = createNameTagTexture(config.name, isPlayer);
  const nameSpriteMat = trackMat(
    new THREE.SpriteMaterial({
      map: nameTex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  const nameSprite = new THREE.Sprite(nameSpriteMat);
  nameSprite.position.set(0, 1.95, 0);
  nameSprite.scale.set(2.2, 0.82, 1);
  nameSprite.renderOrder = 20;
  nameSprite.visible = showNameTag;
  root.add(nameSprite);

  const setSpeechBubble = (text?: string) => {
    const nextTex = createNameTagTexture(config.name, isPlayer, text);
    nameSpriteMat.map = nextTex;
    nameSpriteMat.needsUpdate = true;
    nameTex.dispose();
    nameTex = nextTex;
  };

  let walkPhase = 0;

  const updateAnimation = (
    dt: number,
    elapsed: number,
    speed: number,
    emote: EmoteType,
    holdingIncense: boolean,
  ) => {
    incenseGroup.visible = holdingIncense;

    const damp = 1 - Math.exp(-10 * dt);
    const isMoving = speed > 0.15;

    if (isMoving) {
      walkPhase += dt * (4.5 + speed * 1.45);
    }

    // Target pose transforms
    let targetBodyY = 0;
    let targetBodyPitch = 0;
    let targetLeftArmX = 0;
    let targetRightArmX = 0;
    let targetLeftArmZ = 0.18;
    let targetRightArmZ = -0.18;
    let targetFootZ = 0.02;
    let targetHeadPitch = 0;

    if (isMoving) {
      const swing = Math.sin(walkPhase);
      targetBodyY = Math.abs(swing) * 0.065;
      leftFoot.position.z = 0.02 + swing * 0.12;
      rightFoot.position.z = 0.02 - swing * 0.12;
      targetLeftArmX = -swing * 0.45;
      targetRightArmX = swing * 0.45;
    } else {
      leftFoot.position.z = THREE.MathUtils.lerp(leftFoot.position.z, targetFootZ, damp);
      rightFoot.position.z = THREE.MathUtils.lerp(rightFoot.position.z, targetFootZ, damp);
      targetBodyY = Math.sin(elapsed * 2.2) * 0.015;
    }

    if (holdingIncense && emote !== 'wave') {
      targetLeftArmX = -1.1;
      targetRightArmX = -1.1;
      targetLeftArmZ = -0.32;
      targetRightArmZ = 0.32;
    }

    if (emote === 'kneel') {
      targetBodyY = -0.14;
      targetBodyPitch = 0.12 + Math.sin(elapsed * 3.2) * 0.08;
      targetHeadPitch = 0.14;
      targetLeftArmX = -1.15;
      targetRightArmX = -1.15;
      targetLeftArmZ = -0.36;
      targetRightArmZ = 0.36;
      leftFoot.position.z = THREE.MathUtils.lerp(leftFoot.position.z, -0.22, damp);
      rightFoot.position.z = THREE.MathUtils.lerp(rightFoot.position.z, -0.22, damp);
    } else if (emote === 'bow') {
      targetBodyPitch = 0.38 + Math.sin(elapsed * 5.0) * 0.12;
      targetHeadPitch = 0.18;
      targetLeftArmX = -1.25;
      targetRightArmX = -1.25;
      targetLeftArmZ = -0.38;
      targetRightArmZ = 0.38;
    } else if (emote === 'jump') {
      targetBodyY = Math.abs(Math.sin(elapsed * 7.5)) * 0.48;
      targetLeftArmZ = 1.25;
      targetRightArmZ = -1.25;
    } else if (emote === 'wave') {
      targetRightArmZ = -2.35 + Math.sin(elapsed * 11) * 0.38;
      targetRightArmX = -0.25;
    } else if (emote === 'meditate') {
      targetBodyY = -0.10 + Math.sin(elapsed * 2.5) * 0.04;
      targetLeftArmX = -0.65;
      targetRightArmX = -0.65;
      targetLeftArmZ = -0.24;
      targetRightArmZ = 0.24;
    }

    bodyPivot.position.y = THREE.MathUtils.lerp(bodyPivot.position.y, targetBodyY, damp);
    bodyPivot.rotation.x = THREE.MathUtils.lerp(bodyPivot.rotation.x, targetBodyPitch, damp);
    headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, targetHeadPitch, damp);
    leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, targetLeftArmX, damp);
    rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, targetRightArmX, damp);
    leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, targetLeftArmZ, damp);
    rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, targetRightArmZ, damp);
  };

  const dispose = () => {
    nameTex.dispose();
    for (const d of disposables) {
      d.dispose();
    }
  };

  return {
    root,
    bodyPivot,
    headGroup,
    leftArm,
    rightArm,
    leftFoot,
    rightFoot,
    incenseGroup,
    nameSprite,
    faceMat,
    setSpeechBubble,
    updateAnimation,
    dispose,
  };
}
