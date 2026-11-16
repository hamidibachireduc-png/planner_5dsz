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
  tex.userData = { cached: true };
  tex.needsUpdate = true;
  return tex;
}

function drawEightPointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fillA: string,
  fillB: string,
  centerFill: string
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = fillA;
  ctx.fillRect(-r * 0.62, -r * 0.62, r * 1.24, r * 1.24);

  ctx.save();
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = fillB;
  ctx.fillRect(-r * 0.56, -r * 0.56, r * 1.12, r * 1.12);
  ctx.restore();

  ctx.fillStyle = centerFill;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  } else if (style === 'zellige_casbah') {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, 512, 512);
    const grid = 4;
    const cell = 512 / grid;
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const cx = x * cell + cell / 2;
        const cy = y * cell + cell / 2;
        ctx.fillStyle = (x + y) % 2 === 0 ? '#EFF6FF' : '#F8FAFC';
        ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
        drawEightPointStar(ctx, cx, cy, cell * 0.38, '#1D4ED8', '#0284C7', '#D97706');
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.85)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
      }
    }
  } else if (style === 'zellige_tlemcen') {
    ctx.fillStyle = '#FEFCE8';
    ctx.fillRect(0, 0, 512, 512);
    const grid = 4;
    const cell = 512 / grid;
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const cx = x * cell + cell / 2;
        const cy = y * cell + cell / 2;
        ctx.fillStyle = (x + y) % 2 === 0 ? '#F7FEE7' : '#FEFCE8';
        ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
        drawEightPointStar(ctx, cx, cy, cell * 0.38, '#047857', '#B45309', '#451A03');
        ctx.strokeStyle = 'rgba(217, 199, 165, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
      }
    }
  } else if (style === 'bejaia_terracotta') {
    ctx.fillStyle = '#9A4831';
    ctx.fillRect(0, 0, 512, 512);
    const grid = 4;
    const cell = 512 / grid;
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const shift = ((x * 11 + y * 17) % 16) - 8;
        ctx.fillStyle = `rgb(${194 + shift}, ${106 + Math.round(shift * 0.6)}, ${74 + Math.round(shift * 0.4)})`;
        ctx.fillRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6);
        // Subtle Amazigh diamond motif
        const cx = x * cell + cell / 2;
        const cy = y * cell + cell / 2;
        ctx.strokeStyle = 'rgba(245, 230, 211, 0.34)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - cell * 0.24);
        ctx.lineTo(cx + cell * 0.24, cy);
        ctx.lineTo(cx, cy + cell * 0.24);
        ctx.lineTo(cx - cell * 0.24, cy);
        ctx.closePath();
        ctx.stroke();
      }
    }
  } else if (style === 'sahara_sandstone') {
    ctx.fillStyle = '#C4A67A';
    ctx.fillRect(0, 0, 512, 512);
    const grid = 3;
    const cell = 512 / grid;
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const offset = ((x * 13 + y * 7) % 14) - 7;
        ctx.fillStyle = `rgb(${216 + offset}, ${185 + offset}, ${138 + Math.round(offset * 0.8)})`;
        ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
      }
    }
    for (let i = 0; i < 420; i++) {
      const sx = (i * 151) % 512;
      const sy = (i * 277) % 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(135, 102, 62, 0.16)' : 'rgba(255, 245, 224, 0.22)';
      ctx.fillRect(sx, sy, 3, 3);
    }
  } else if (style === 'ceramic_marble_dz' || style === 'ceramic_calacatta') {
    const isDz = style === 'ceramic_marble_dz';
    ctx.fillStyle = isDz ? '#F5EFE4' : '#FAF9F6';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 11; i++) {
      ctx.strokeStyle =
        i % 3 === 0
          ? 'rgba(180, 134, 62, 0.28)'
          : isDz
            ? 'rgba(148, 138, 122, 0.22)'
            : 'rgba(120, 126, 138, 0.26)';
      ctx.lineWidth = i % 3 === 0 ? 1.8 : 2.6;
      ctx.beginPath();
      ctx.moveTo((i * 61) % 512, 0);
      ctx.bezierCurveTo(
        ((i * 113) % 512) + 55,
        165,
        ((i * 179) % 512) - 55,
        345,
        (i * 89 + 190) % 512,
        512
      );
      ctx.stroke();
    }
    ctx.strokeStyle = isDz ? 'rgba(195, 184, 165, 0.5)' : 'rgba(180, 184, 192, 0.45)';
    ctx.lineWidth = 2;
    const step = isDz ? 128 : 256;
    for (let y = 0; y < 512; y += step) {
      for (let x = 0; x < 512; x += step) {
        ctx.strokeRect(x + 1, y + 1, step - 2, step - 2);
      }
    }
  } else if (style === 'ceramic_nero_marquina') {
    ctx.fillStyle = '#17191C';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle =
        i % 4 === 0 ? 'rgba(217, 170, 92, 0.35)' : 'rgba(241, 245, 249, 0.45)';
      ctx.lineWidth = i % 4 === 0 ? 1.4 : 2.1;
      ctx.beginPath();
      ctx.moveTo(0, (i * 53) % 512);
      ctx.bezierCurveTo(
        170,
        ((i * 97) % 512) + 38,
        340,
        ((i * 131) % 512) - 38,
        512,
        (i * 71 + 140) % 512
      );
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 254, 254);
    ctx.strokeRect(256, 1, 255, 254);
    ctx.strokeRect(1, 256, 254, 255);
    ctx.strokeRect(256, 256, 255, 255);
  } else if (style === 'ceramic_hex_nordic') {
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(0, 0, 512, 512);
    const hexR = 36;
    const hexH = Math.sqrt(3) * hexR;
    const palette = ['#F8FAFC', '#F1F5F9', '#E2E8F0', '#FFFFFF'];
    let idx = 0;
    for (let row = -1; row < 10; row++) {
      for (let col = -1; col < 10; col++) {
        const cx = col * hexR * 1.5;
        const cy = row * hexH + (col % 2 === 0 ? 0 : hexH / 2);
        ctx.fillStyle = palette[(idx + row * 3 + col) % palette.length];
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const ang = (Math.PI / 3) * a;
          const px = cx + (hexR - 1.8) * Math.cos(ang);
          const py = cy + (hexR - 1.8) * Math.sin(ang);
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        idx++;
      }
    }
  } else if (style === 'ceramic_herringbone') {
    ctx.fillStyle = '#9C7A56';
    ctx.fillRect(0, 0, 512, 512);
    const colW = 64;
    const rowH = 32;
    for (let c = 0; c < 512 / colW; c++) {
      const dir = c % 2 === 0 ? 1 : -1;
      for (let r = -2; r < 512 / rowH + 2; r++) {
        const x = c * colW;
        const y = r * rowH;
        const shade = ((c * 13 + r * 7) % 18) - 9;
        ctx.fillStyle = `rgb(${186 + shade}, ${146 + shade}, ${106 + Math.round(shade * 0.8)})`;
        ctx.beginPath();
        ctx.moveTo(x + 1, y + 1);
        ctx.lineTo(x + colW - 1, y + dir * 24 + 1);
        ctx.lineTo(x + colW - 1, y + dir * 24 + rowH - 2);
        ctx.lineTo(x + 1, y + rowH - 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(72, 48, 28, 0.32)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  } else if (style === 'ceramic_emerald_gloss') {
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(0, 0, 512, 512);
    const cols = 4;
    const rows = 8;
    const cw = 512 / cols;
    const ch = 512 / rows;
    const tones = ['#0F766E', '#115E59', '#0D9488', '#134E4A'];
    for (let r = 0; r < rows; r++) {
      const offset = r % 2 === 0 ? 0 : cw / 2;
      for (let c = -1; c <= cols; c++) {
        ctx.fillStyle = tones[(r * 3 + c + 4) % tones.length];
        ctx.fillRect(c * cw + offset + 2, r * ch + 2, cw - 4, ch - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(c * cw + offset + 6, r * ch + 6, cw - 12, 5);
      }
    }
  } else if (style === 'ceramic_travertine') {
    ctx.fillStyle = '#C9B99F';
    ctx.fillRect(0, 0, 512, 512);
    const rows = 4;
    const cols = 2;
    const cw = 512 / cols;
    const ch = 512 / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const shift = ((r * 11 + c * 19) % 12) - 6;
        ctx.fillStyle = `rgb(${224 + shift}, ${210 + shift}, ${190 + shift})`;
        ctx.fillRect(c * cw + 2, r * ch + 2, cw - 4, ch - 4);
        // Sedimentary streaks
        for (let s = 0; s < 5; s++) {
          ctx.fillStyle = s % 2 === 0 ? 'rgba(165, 145, 118, 0.16)' : 'rgba(250, 244, 232, 0.22)';
          ctx.fillRect(c * cw + 4, r * ch + 14 + s * 22, cw - 8, 4);
        }
      }
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
