import * as THREE from 'three';
import type { AvatarConfig } from '../types';

/**
 * Creates a crisp gold-on-lacquer-black traditional Taiwanese temple plaque texture.
 */
export function createPlaqueTexture(
  text: string,
  options?: { bg?: string; border?: string; textColor?: string; width?: number; height?: number },
): THREE.CanvasTexture {
  const width = options?.width ?? 512;
  const height = options?.height ?? 160;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const bg = options?.bg ?? '#18110e';
  const border = options?.border ?? '#e6bc65';
  const textColor = options?.textColor ?? '#f6d177';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Outer & inner golden lacquer frame
  ctx.strokeStyle = border;
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, width - 16, height - 16);
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  // Corner flourishes
  const corners = [
    [20, 20],
    [width - 20, 20],
    [20, height - 20],
    [width - 20, height - 20],
  ];
  ctx.fillStyle = border;
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Calligraphic serif text
  ctx.fillStyle = textColor;
  ctx.font = `900 ${Math.floor(height * 0.5)}px "Noto Serif TC", "Songti TC", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.fillText(text, width / 2, height / 2 + 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates a vertical crimson-and-gold temple couplet pillar banner texture.
 */
export function createCoupletTexture(lines: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8b1614';
  ctx.fillRect(0, 0, 128, 768);

  ctx.strokeStyle = '#e8c166';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 112, 752);

  const chars = Array.from(lines);
  const step = 680 / Math.max(1, chars.length);
  ctx.fillStyle = '#f8d886';
  ctx.font = '700 54px "Noto Serif TC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  chars.forEach((ch, idx) => {
    ctx.fillText(ch, 64, 58 + idx * step + step * 0.45);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates a procedural tileable grayscale stone/brick bump texture.
 */
export function createNoiseBumpTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(110 + rand() * 50);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates a soft radial contact shadow disc texture for grounding avatars & props.
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(10, 4, 2, 0.72)');
  grad.addColorStop(0.55, 'rgba(10, 4, 2, 0.32)');
  grad.addColorStop(1, 'rgba(10, 4, 2, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates a glowing Blessing Lantern Wall (光明燈牆) texture showing rows of lit shrines.
 */
export function createLanternWallTexture(litSlots: number[]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#38120c';
  ctx.fillRect(0, 0, 512, 512);

  // Header
  ctx.fillStyle = '#1e0b08';
  ctx.fillRect(14, 14, 484, 62);
  ctx.strokeStyle = '#e7bd67';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, 484, 62);
  ctx.fillStyle = '#f8d682';
  ctx.font = '700 34px "Noto Serif TC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('光 明 祈 福 燈 牆', 256, 46);

  const cols = 6;
  const rows = 5;
  const cellW = 74;
  const cellH = 76;
  const startX = 34;
  const startY = 96;
  const litSet = new Set(litSlots);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const x = startX + c * cellW;
      const y = startY + r * cellH;
      const isLit = litSet.has(idx) || idx % 3 === 0;

      ctx.fillStyle = isLit ? '#4e1d0b' : '#260d09';
      ctx.fillRect(x + 4, y + 4, cellW - 8, cellH - 8);
      ctx.strokeStyle = isLit ? '#f4c75c' : '#7a4d2c';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 4, y + 4, cellW - 8, cellH - 8);

      // Mini lantern glow
      const cx = x + cellW / 2;
      const cy = y + cellH / 2;
      if (isLit) {
        const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26);
        g.addColorStop(0, 'rgba(255, 240, 175, 0.98)');
        g.addColorStop(0.55, 'rgba(248, 165, 45, 0.65)');
        g.addColorStop(1, 'rgba(248, 120, 20, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, 26, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = isLit ? '#ffea9c' : '#6b4228';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 12, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates an adorable Q-chibi facial texture mapped onto the front of the character head.
 */
export function createAvatarFaceTexture(config: AvatarConfig): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Fill entire head with skin tone
  ctx.fillStyle = config.skinColor;
  ctx.fillRect(0, 0, 512, 256);

  // On Three.js SphereGeometry UV mapping, u = 0.25..0.75 wraps around the equator;
  // u = 0.5 faces +X in default sphere, so we align head rotation so u = 0.5 faces +Z (front).
  const cx = 256;
  const cy = 134;

  // Rosy blush cheeks
  if (config.blushColor !== 'transparent') {
    ctx.save();
    ctx.globalAlpha = 0.48;
    ctx.fillStyle = config.blushColor;
    ctx.beginPath();
    ctx.ellipse(cx - 56, cy + 20, 20, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 56, cy + 20, 20, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Eyebrows
  ctx.strokeStyle = config.hairColor === '#c7ccd6' ? '#6d625a' : config.hairColor;
  ctx.lineWidth = config.eyebrowStyle === 'bold' ? 6.5 : 4;
  ctx.lineCap = 'round';
  const drawBrow = (side: -1 | 1) => {
    const bx = cx + side * 38;
    const by = cy - 28;
    ctx.beginPath();
    if (config.eyebrowStyle === 'soft') {
      ctx.moveTo(bx - 13, by + 2);
      ctx.quadraticCurveTo(bx, by - 5, bx + 13, by + 2);
    } else if (config.eyebrowStyle === 'arched') {
      ctx.moveTo(bx - 14, by + 4);
      ctx.quadraticCurveTo(bx, by - 10, bx + 14, by + 3);
    } else if (config.eyebrowStyle === 'bold') {
      ctx.moveTo(bx - 14, by - 1);
      ctx.lineTo(bx + 14, by - 3);
    } else {
      // worried / gentle tilt
      ctx.moveTo(bx - 12 * side, by - 3);
      ctx.lineTo(bx + 12 * side, by + 5);
    }
    ctx.stroke();
  };
  drawBrow(-1);
  drawBrow(1);

  // Eyes
  const drawEye = (side: -1 | 1) => {
    const ex = cx + side * 36;
    const ey = cy - 2;
    ctx.save();
    if (config.eyeStyle === 'round') {
      ctx.fillStyle = '#211512';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 11.5, 13.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 3.5, ey - 4.5, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + 4, ey + 4.5, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (config.eyeStyle === 'happy') {
      ctx.strokeStyle = '#261714';
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ex, ey + 4, 12, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    } else if (config.eyeStyle === 'star') {
      ctx.fillStyle = '#221518';
      ctx.beginPath();
      ctx.arc(ex, ey, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe378';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? 9.5 : 3.5;
        const a = (i * Math.PI) / 4 - Math.PI / 2;
        const px = ex + Math.cos(a) * r;
        const py = ey + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else if (config.eyeStyle === 'heart') {
      ctx.fillStyle = '#d93860';
      ctx.beginPath();
      ctx.moveTo(ex, ey + 11);
      ctx.bezierCurveTo(ex - 16, ey + 2, ex - 14, ey - 12, ex, ey - 4);
      ctx.bezierCurveTo(ex + 14, ey - 12, ex + 16, ey + 2, ex, ey + 11);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 4, ey - 3, 2.8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // calm / devout closed gentle downward arc
      ctx.strokeStyle = '#2a1a16';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ex, ey - 3, 11, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    ctx.restore();
  };
  drawEye(-1);
  drawEye(1);

  // Mouth
  ctx.strokeStyle = '#6c2d26';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const my = cy + 25;
  if (config.mouthStyle === 'smile') {
    ctx.beginPath();
    ctx.arc(cx, my - 4, 11, Math.PI * 0.16, Math.PI * 0.84);
    ctx.stroke();
  } else if (config.mouthStyle === 'cat') {
    ctx.beginPath();
    ctx.arc(cx - 6, my - 1, 6, 0, Math.PI * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 6, my - 1, 6, Math.PI * 0.1, Math.PI);
    ctx.stroke();
  } else if (config.mouthStyle === 'open') {
    ctx.fillStyle = '#c84b4b';
    ctx.beginPath();
    ctx.arc(cx, my - 2, 10, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 8, my + 2);
    ctx.quadraticCurveTo(cx, my + 5, cx + 8, my + 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a crisp floating name label & optional speech bubble sprite texture.
 */
export function createNameTagTexture(
  name: string,
  isPlayer: boolean,
  speechBubble?: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 192);

  if (speechBubble) {
    const trimmed = speechBubble.length > 22 ? `${speechBubble.slice(0, 21)}…` : speechBubble;
    ctx.font = '600 24px "Noto Sans TC", sans-serif';
    const textW = Math.min(460, Math.max(120, ctx.measureText(trimmed).width + 38));
    const bx = (512 - textW) / 2;
    const by = 14;
    const bh = 58;

    ctx.fillStyle = 'rgba(255, 250, 240, 0.95)';
    ctx.strokeStyle = '#d49a45';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(bx, by, textW, bh, 18);
    ctx.fill();
    ctx.stroke();

    // Tail triangle
    ctx.beginPath();
    ctx.moveTo(246, by + bh);
    ctx.lineTo(256, by + bh + 12);
    ctx.lineTo(266, by + bh);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#3c1b12';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(trimmed, 256, by + bh / 2 + 1);
  }

  // Name label pill-free clean dark translucent tag with crisp text (matches screenshot)
  const displayName = isPlayer ? `${name} (你)` : name;
  ctx.font = isPlayer ? '700 28px "Noto Sans TC", sans-serif' : '600 25px "Noto Sans TC", sans-serif';
  const nameW = Math.min(440, ctx.measureText(displayName).width + 30);
  const nx = (512 - nameW) / 2;
  const ny = 112;

  ctx.fillStyle = isPlayer ? 'rgba(42, 15, 10, 0.78)' : 'rgba(20, 12, 10, 0.62)';
  ctx.beginPath();
  ctx.roundRect(nx, ny, nameW, 44, 10);
  ctx.fill();

  if (isPlayer) {
    ctx.strokeStyle = 'rgba(246, 206, 118, 0.75)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.fillStyle = isPlayer ? '#ffefc4' : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayName, 256, ny + 23);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a serene, compassionate golden-ivory Taiwanese Mazu deity visage
 * with willow eyebrows, gentle half-closed eyes, cinnabar forehead mark, and peaceful smile.
 */
export function createMazuFaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Warm golden-ivory porcelain complexion
  ctx.fillStyle = '#f5d2a4';
  ctx.fillRect(0, 0, 512, 256);

  const cx = 256;
  const cy = 136;

  // Soft warm cheek radiance
  for (const side of [-1, 1]) {
    const grad = ctx.createRadialGradient(cx + side * 46, cy + 16, 4, cx + side * 46, cy + 16, 26);
    grad.addColorStop(0, 'rgba(222, 120, 108, 0.34)');
    grad.addColorStop(1, 'rgba(222, 120, 108, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx + side * 46, cy + 16, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cinnabar forehead blessing dot (眉心朱砂印)
  ctx.fillStyle = '#c82b24';
  ctx.beginPath();
  ctx.arc(cx, cy - 34, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Serene arched willow eyebrows (慈眉)
  ctx.strokeStyle = '#3b2418';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const bx = cx + side * 34;
    ctx.beginPath();
    ctx.moveTo(bx - 16 * side, cy - 18);
    ctx.quadraticCurveTo(bx, cy - 28, bx + 18 * side, cy - 16);
    ctx.stroke();
  }

  // Compassionate downcast eyes (善目)
  ctx.strokeStyle = '#2c1810';
  ctx.lineWidth = 4.5;
  for (const side of [-1, 1]) {
    const ex = cx + side * 34;
    ctx.beginPath();
    ctx.arc(ex, cy - 2, 13, Math.PI * 0.14, Math.PI * 0.86);
    ctx.stroke();
  }

  // Subtle nose bridge
  ctx.strokeStyle = 'rgba(150, 96, 56, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 4);
  ctx.lineTo(cx, cy + 14);
  ctx.stroke();

  // Peaceful cinnabar smile
  ctx.strokeStyle = '#b4342d';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy + 23, 12, Math.PI * 0.18, Math.PI * 0.82);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

