import * as THREE from 'three';
import { RoomFloorStyle } from '../types/planner';

const textureCache = new Map<string, THREE.CanvasTexture>();

function createCanvas(size = 512): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function getFloorTexture(
  style: RoomFloorStyle,
  widthMeters: number,
  depthMeters: number,
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const repeatX = Math.max(1, Math.round(widthMeters / 1.8));
  const repeatY = Math.max(1, Math.round(depthMeters / 1.8));
  const key = `${style}_${repeatX}_${repeatY}`;
  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }

  const [canvas, ctx] = createCanvas(512);

  if (style === 'oak' || style === 'walnut') {
    const isWalnut = style === 'walnut';
    ctx.fillStyle = isWalnut ? '#65432A' : '#C59B6D';
    ctx.fillRect(0, 0, 512, 512);

    const plankRows = 8;
    const plankH = 512 / plankRows;
    for (let r = 0; r < plankRows; r++) {
      const y = r * plankH;
      const toneOffset = ((r * 37) % 18) - 9;
      const baseR = (isWalnut ? 101 : 197) + toneOffset;
      const baseG = (isWalnut ? 67 : 155) + toneOffset;
      const baseB = (isWalnut ? 42 : 109) + toneOffset;
      ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
      ctx.fillRect(0, y + 1, 512, plankH - 2);

      // Wood grain lines
      ctx.strokeStyle = isWalnut ? 'rgba(38,22,12,0.18)' : 'rgba(120,82,42,0.14)';
      ctx.lineWidth = 1.2;
      for (let g = 0; g < 6; g++) {
        ctx.beginPath();
        const gy = y + 6 + g * (plankH / 7);
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(170, gy + ((r + g) % 3) - 1, 340, gy - ((r + g) % 3) + 1, 512, gy);
        ctx.stroke();
      }

      // Plank seams
      ctx.fillStyle = isWalnut ? 'rgba(30,18,10,0.45)' : 'rgba(90,60,30,0.28)';
      ctx.fillRect(0, y, 512, 2);
      const splitX = ((r * 193 + 90) % 420) + 46;
      ctx.fillRect(splitX, y, 2, plankH);
    }
  } else if (style === 'marble') {
    ctx.fillStyle = '#F2F0EC';
    ctx.fillRect(0, 0, 512, 512);
    // Subtle veining
    ctx.strokeStyle = 'rgba(148, 155, 165, 0.28)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.moveTo((i * 73) % 512, 0);
      ctx.bezierCurveTo(
        ((i * 120) % 512) + 40,
        170,
        ((i * 180) % 512) - 40,
        340,
        ((i * 97 + 200) % 512),
        512
      );
      ctx.stroke();
    }
    // Large square slab grout lines
    ctx.strokeStyle = 'rgba(180, 178, 172, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 254, 254);
    ctx.strokeRect(256, 1, 255, 254);
    ctx.strokeRect(1, 256, 254, 255);
    ctx.strokeRect(256, 256, 255, 255);
  } else if (style === 'tile') {
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(0, 0, 512, 512);
    const grid = 4;
    const cell = 512 / grid;
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const shade = 226 + ((x * 7 + y * 13) % 14);
        ctx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 8})`;
        ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
      }
    }
  } else if (style === 'terrazzo') {
    ctx.fillStyle = '#EAE4DC';
    ctx.fillRect(0, 0, 512, 512);
    const chips = ['#A67B5B', '#64748B', '#D4A373', '#475569', '#C9ADA7'];
    for (let i = 0; i < 240; i++) {
      const cx = (i * 137.5) % 512;
      const cy = (i * 293.3) % 512;
      const r = 3 + (i % 7);
      ctx.fillStyle = chips[i % chips.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r, cy + r * 0.4);
      ctx.lineTo(cx + r * 0.3, cy + r);
      ctx.closePath();
      ctx.fill();
    }
  } else if (style === 'concrete') {
    ctx.fillStyle = '#B8BEC5';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 600; i++) {
      const x = (i * 197) % 512;
      const y = (i * 313) % 512;
      const v = 165 + (i % 35);
      ctx.fillStyle = `rgba(${v},${v + 2},${v + 5},0.16)`;
      ctx.fillRect(x, y, 16, 16);
    }
    ctx.strokeStyle = 'rgba(100,116,139,0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 512, 512);
  } else {
    // Woven carpet
    ctx.fillStyle = '#DDD6CA';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = 'rgba(130, 120, 105, 0.14)';
    for (let y = 0; y < 512; y += 6) {
      for (let x = (y % 12 === 0 ? 0 : 3); x < 512; x += 6) {
        ctx.fillRect(x, y, 3, 2);
      }
    }
  }

  const tex = finalizeTexture(canvas, repeatX, repeatY, maxAnisotropy);
  textureCache.set(key, tex);
  return tex;
}

export function getGroundLawnTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const key = 'outdoor_lawn';
  if (textureCache.has(key)) return textureCache.get(key)!;
  const [canvas, ctx] = createCanvas(512);
  ctx.fillStyle = '#D9DFCF';
  ctx.fillRect(0, 0, 512, 512);
  // Subtle architectural site grid & natural texture
  for (let i = 0; i < 400; i++) {
    const x = (i * 149) % 512;
    const y = (i * 271) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(162, 178, 146, 0.25)' : 'rgba(235, 238, 228, 0.25)';
    ctx.fillRect(x, y, 8, 8);
  }
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.14)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  const tex = finalizeTexture(canvas, 24, 24, maxAnisotropy);
  textureCache.set(key, tex);
  return tex;
}

export function getContactShadowTexture(): THREE.CanvasTexture {
  const key = 'contact_shadow';
  if (textureCache.has(key)) return textureCache.get(key)!;
  const [canvas, ctx] = createCanvas(256);
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 126);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.16)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}
