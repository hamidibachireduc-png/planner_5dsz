import * as THREE from 'three';
import { FurnitureItem } from '../types/planner';
import { getContactShadowTexture } from './textures';

function makeMat(
  color: string | number,
  roughness = 0.65,
  metalness = 0.05
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness,
  });
}

function addPart(
  group: THREE.Group,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  castShadow = true
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = castShadow;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

function addContactShadow(group: THREE.Group, w: number, d: number): void {
  const geo = new THREE.PlaneGeometry(w * 1.08, d * 1.08);
  const mat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const plane = new THREE.Mesh(geo, mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.005;
  group.add(plane);
}

export function buildFurnitureGroup(
  item: FurnitureItem,
  isSoftwareGl: boolean,
  isSelected: boolean
): THREE.Group {
  const root = new THREE.Group();
  root.position.set(item.x, 0, item.z);
  root.rotation.y = item.rotation;
  root.userData = { furnitureId: item.id, kind: 'furniture' };

  const w = Math.max(0.25, item.width);
  const d = Math.max(0.25, item.depth);
  const h = Math.max(0.03, item.height);

  const primaryMat = makeMat(item.primaryColor, 0.78, 0.04);
  const accentMat = makeMat(item.accentColor, 0.42, 0.12);
  const brassMat = makeMat('#C8A45A', 0.2, 0.88);
  const chromeMat = makeMat('#E2E8F0', 0.14, 0.94);
  const darkMetalMat = makeMat('#1E293B', 0.35, 0.82);
  const ceramicMat = makeMat('#F8FAFC', 0.18, 0.05);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdbeafe,
    roughness: 0.08,
    metalness: 0.0,
    transmission: isSoftwareGl ? 0 : 0.88,
    transparent: true,
    opacity: isSoftwareGl ? 0.35 : 0.92,
    ior: 1.5,
  });

  const noFloorShadowTypes = new Set([
    'rug',
    'wall_art',
    'chandelier',
    'ac_split',
    'water_heater',
    'smart_tv_wall',
    'towel_warmer',
    'range_hood',
  ]);
  if (!noFloorShadowTypes.has(item.type)) {
    addContactShadow(root, w, d);
  }

  switch (item.type) {
    case 'sofa_3': {
      const legH = 0.12;
      const baseH = 0.18;
      // 4 tapered legs
      const legGeo = new THREE.CylinderGeometry(0.028, 0.018, legH, 10);
      [
        [-w / 2 + 0.08, -d / 2 + 0.08],
        [w / 2 - 0.08, -d / 2 + 0.08],
        [-w / 2 + 0.08, d / 2 - 0.08],
        [w / 2 - 0.08, d / 2 - 0.08],
      ].forEach(([lx, lz]) => addPart(root, legGeo, accentMat, lx, legH / 2, lz));
      // Timber plinth
      addPart(root, new THREE.BoxGeometry(w, 0.06, d * 0.92), accentMat, 0, legH + 0.03, 0);
      // 3 plush seat cushions
      const cushW = (w - 0.28) / 3;
      for (let i = -1; i <= 1; i++) {
        addPart(
          root,
          new THREE.BoxGeometry(cushW - 0.02, baseH, d * 0.78),
          primaryMat,
          i * cushW,
          legH + 0.06 + baseH / 2,
          0.05
        );
      }
      // Backrest & armrests
      addPart(root, new THREE.BoxGeometry(w - 0.04, h * 0.58, 0.2), primaryMat, 0, legH + h * 0.35, -d / 2 + 0.11);
      addPart(root, new THREE.BoxGeometry(0.14, h * 0.48, d * 0.92), primaryMat, -w / 2 + 0.07, legH + h * 0.26, 0);
      addPart(root, new THREE.BoxGeometry(0.14, h * 0.48, d * 0.92), primaryMat, w / 2 - 0.07, legH + h * 0.26, 0);
      // Accent throw pillows
      const pillowMat = makeMat(item.accentColor, 0.88, 0.02);
      const pillowGeo = new THREE.BoxGeometry(0.32, 0.32, 0.12);
      addPart(root, pillowGeo, pillowMat, -w / 2 + 0.32, legH + 0.38, -d / 2 + 0.28, -0.2, 0.3, 0.1);
      addPart(root, pillowGeo, pillowMat, w / 2 - 0.32, legH + 0.38, -d / 2 + 0.28, -0.2, -0.3, -0.1);
      break;
    }

    case 'sofa_l': {
      const legH = 0.1;
      // Main horizontal wing
      const mainD = d * 0.52;
      addPart(root, new THREE.BoxGeometry(w, 0.06, mainD), accentMat, 0, legH + 0.03, -d / 2 + mainD / 2);
      addPart(root, new THREE.BoxGeometry(w - 0.04, 0.2, mainD - 0.06), primaryMat, 0, legH + 0.16, -d / 2 + mainD / 2);
      // Chaise lounge wing (on left side)
      const chaiseW = w * 0.38;
      const chaiseD = d - mainD;
      addPart(root, new THREE.BoxGeometry(chaiseW, 0.06, chaiseD), accentMat, -w / 2 + chaiseW / 2, legH + 0.03, d / 2 - chaiseD / 2);
      addPart(root, new THREE.BoxGeometry(chaiseW - 0.04, 0.2, chaiseD - 0.04), primaryMat, -w / 2 + chaiseW / 2, legH + 0.16, d / 2 - chaiseD / 2);
      // Backrest & arms
      addPart(root, new THREE.BoxGeometry(w, h * 0.55, 0.22), primaryMat, 0, legH + h * 0.36, -d / 2 + 0.11);
      addPart(root, new THREE.BoxGeometry(0.16, h * 0.45, d), primaryMat, -w / 2 + 0.08, legH + h * 0.28, 0);
      addPart(root, new THREE.BoxGeometry(0.16, h * 0.45, mainD), primaryMat, w / 2 - 0.08, legH + h * 0.28, -d / 2 + mainD / 2);
      // Brass feet
      const footGeo = new THREE.CylinderGeometry(0.025, 0.02, legH, 10);
      [
        [-w / 2 + 0.1, -d / 2 + 0.1],
        [w / 2 - 0.1, -d / 2 + 0.1],
        [-w / 2 + 0.1, d / 2 - 0.1],
        [-w / 2 + chaiseW - 0.1, d / 2 - 0.1],
        [w / 2 - 0.1, -d / 2 + mainD - 0.1],
      ].forEach(([lx, lz]) => addPart(root, footGeo, brassMat, lx, legH / 2, lz));
      // Accent pillows
      const pillowMat = makeMat(item.accentColor, 0.88, 0.02);
      addPart(root, new THREE.BoxGeometry(0.34, 0.32, 0.12), pillowMat, -w / 2 + 0.34, legH + 0.38, -d / 2 + 0.28, -0.22, 0.35, 0);
      addPart(root, new THREE.BoxGeometry(0.34, 0.32, 0.12), pillowMat, w / 2 - 0.36, legH + 0.38, -d / 2 + 0.28, -0.22, -0.25, 0);
      break;
    }

    case 'armchair': {
      const legGeo = new THREE.CylinderGeometry(0.025, 0.016, 0.18, 10);
      [
        [-w * 0.36, -d * 0.34],
        [w * 0.36, -d * 0.34],
        [-w * 0.36, d * 0.34],
        [w * 0.36, d * 0.34],
      ].forEach(([lx, lz]) => addPart(root, legGeo, accentMat, lx, 0.09, lz));
      addPart(root, new THREE.BoxGeometry(w * 0.88, 0.16, d * 0.84), primaryMat, 0, 0.26, 0.02);
      addPart(root, new THREE.BoxGeometry(w * 0.88, h * 0.58, 0.16), primaryMat, 0, 0.54, -d * 0.35);
      addPart(root, new THREE.BoxGeometry(0.13, h * 0.42, d * 0.82), primaryMat, -w * 0.42, 0.42, 0.01);
      addPart(root, new THREE.BoxGeometry(0.13, h * 0.42, d * 0.82), primaryMat, w * 0.42, 0.42, 0.01);
      break;
    }

    case 'coffee_table': {
      const stoneMat = makeMat(item.primaryColor, 0.32, 0.05);
      // Architectural twin plinth legs
      addPart(root, new THREE.BoxGeometry(w * 0.22, h - 0.06, d * 0.62), accentMat, -w * 0.26, (h - 0.06) / 2, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.22, h - 0.06, d * 0.62), accentMat, w * 0.26, (h - 0.06) / 2, 0);
      // Travertine top slab
      addPart(root, new THREE.BoxGeometry(w, 0.06, d), stoneMat, 0, h - 0.03, 0);
      // Decorative art book & ceramic bowl
      addPart(root, new THREE.BoxGeometry(0.28, 0.035, 0.22), makeMat('#334155', 0.6, 0.05), -w * 0.18, h + 0.018, 0.04, 0, 0.18, 0);
      addPart(root, new THREE.CylinderGeometry(0.11, 0.06, 0.06, 18), ceramicMat, w * 0.16, h + 0.03, -0.04);
      break;
    }

    case 'tv_stand': {
      const credenzaH = 0.48;
      // Legs
      const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.14, 10);
      [
        [-w * 0.44, -d * 0.35],
        [w * 0.44, -d * 0.35],
        [-w * 0.44, d * 0.35],
        [w * 0.44, d * 0.35],
      ].forEach(([lx, lz]) => addPart(root, legGeo, darkMetalMat, lx, 0.07, lz));
      // Cabinet body + 3 slatted doors
      addPart(root, new THREE.BoxGeometry(w, credenzaH - 0.14, d), primaryMat, 0, 0.14 + (credenzaH - 0.14) / 2, 0);
      for (let i = -1; i <= 1; i++) {
        addPart(root, new THREE.BoxGeometry(w * 0.3, credenzaH - 0.18, 0.02), makeMat('#754E2A', 0.5, 0.08), i * (w * 0.32), 0.14 + (credenzaH - 0.14) / 2, d / 2 + 0.005);
      }
      // OLED Screen + stand neck
      const tvW = w * 0.72;
      const tvH = 0.68;
      addPart(root, new THREE.BoxGeometry(0.14, 0.14, 0.06), darkMetalMat, 0, credenzaH + 0.07, -0.05);
      addPart(root, new THREE.BoxGeometry(tvW, tvH, 0.035), accentMat, 0, credenzaH + 0.12 + tvH / 2, -0.04);
      addPart(root, new THREE.BoxGeometry(tvW - 0.04, tvH - 0.04, 0.01), makeMat('#0F172A', 0.1, 0.35), 0, credenzaH + 0.12 + tvH / 2, -0.02);
      break;
    }

    case 'rug': {
      addPart(root, new THREE.BoxGeometry(w, 0.016, d), makeMat(item.primaryColor, 0.95, 0.0), 0, 0.018, 0, 0, 0, 0, false);
      addPart(root, new THREE.BoxGeometry(w * 0.92, 0.018, d * 0.92), makeMat(item.accentColor, 0.95, 0.0), 0, 0.019, 0, 0, 0, 0, false);
      addPart(root, new THREE.BoxGeometry(w * 0.86, 0.02, d * 0.86), makeMat(item.primaryColor, 0.95, 0.0), 0, 0.02, 0, 0, 0, 0, false);
      break;
    }

    case 'bookshelf': {
      // Uprights
      addPart(root, new THREE.BoxGeometry(0.04, h, d), primaryMat, -w / 2 + 0.02, h / 2, 0);
      addPart(root, new THREE.BoxGeometry(0.04, h, d), primaryMat, w / 2 - 0.02, h / 2, 0);
      addPart(root, new THREE.BoxGeometry(w, h, 0.02), makeMat('#5A3D24', 0.6, 0.05), 0, h / 2, -d / 2 + 0.01);
      // 5 shelves + book clusters
      const bookColors = ['#334155', '#B45309', '#4D7C4F', '#64748B', '#E2E8F0'];
      for (let i = 0; i < 5; i++) {
        const sy = 0.06 + (i * (h - 0.12)) / 4;
        addPart(root, new THREE.BoxGeometry(w - 0.04, 0.03, d), primaryMat, 0, sy, 0);
        if (i < 4) {
          for (let b = 0; b < 4; b++) {
            const bh = 0.22 + ((i + b) % 3) * 0.04;
            addPart(
              root,
              new THREE.BoxGeometry(0.045, bh, d * 0.68),
              makeMat(bookColors[(i + b) % bookColors.length], 0.7, 0.05),
              -w * 0.3 + b * 0.06 + (i % 2) * 0.25,
              sy + 0.015 + bh / 2,
              0.02
            );
          }
        }
      }
      break;
    }

    case 'bed_double': {
      // Timber bed frame & headboard
      addPart(root, new THREE.BoxGeometry(w, h, 0.1), accentMat, 0, h / 2, -d / 2 + 0.05);
      addPart(root, new THREE.BoxGeometry(w - 0.06, 0.22, d - 0.08), accentMat, 0, 0.15, 0.03);
      // Mattress
      addPart(root, new THREE.BoxGeometry(w - 0.14, 0.22, d - 0.22), ceramicMat, 0, 0.34, 0.04);
      // Folded linen duvet
      addPart(root, new THREE.BoxGeometry(w - 0.1, 0.24, d * 0.62), primaryMat, 0, 0.36, d * 0.14);
      // 4 pillows
      const pillowMat = makeMat('#F5F2EB', 0.88, 0.02);
      const pw = (w - 0.36) / 2;
      addPart(root, new THREE.BoxGeometry(pw, 0.12, 0.42), pillowMat, -pw / 2 - 0.04, 0.5, -d / 2 + 0.38, 0.22, 0, 0);
      addPart(root, new THREE.BoxGeometry(pw, 0.12, 0.42), pillowMat, pw / 2 + 0.04, 0.5, -d / 2 + 0.38, 0.22, 0, 0);
      break;
    }

    case 'nightstand': {
      addPart(root, new THREE.BoxGeometry(w, h * 0.72, d), primaryMat, 0, h * 0.5, 0);
      addPart(root, new THREE.CylinderGeometry(0.02, 0.02, h * 0.15, 8), darkMetalMat, -w * 0.38, h * 0.075, -d * 0.35);
      addPart(root, new THREE.CylinderGeometry(0.02, 0.02, h * 0.15, 8), darkMetalMat, w * 0.38, h * 0.075, -d * 0.35);
      addPart(root, new THREE.CylinderGeometry(0.02, 0.02, h * 0.15, 8), darkMetalMat, -w * 0.38, h * 0.075, d * 0.35);
      addPart(root, new THREE.CylinderGeometry(0.02, 0.02, h * 0.15, 8), darkMetalMat, w * 0.38, h * 0.075, d * 0.35);
      // Brass drawer knob
      addPart(root, new THREE.SphereGeometry(0.018, 12, 12), brassMat, 0, h * 0.6, d / 2 + 0.015);
      // Bedside lamp
      addPart(root, new THREE.CylinderGeometry(0.07, 0.09, 0.16, 14), ceramicMat, 0, h * 0.86 + 0.08, 0);
      addPart(root, new THREE.CylinderGeometry(0.11, 0.15, 0.16, 16), makeMat('#FAF5E8', 0.85, 0.0), 0, h * 0.86 + 0.24, 0);
      break;
    }

    case 'wardrobe': {
      addPart(root, new THREE.BoxGeometry(w, h, d), primaryMat, 0, h / 2, 0);
      // Door split groove + twin handles
      addPart(root, new THREE.BoxGeometry(0.015, h - 0.1, 0.02), makeMat('#94A3B8', 0.4, 0.3), 0, h / 2, d / 2 + 0.005);
      addPart(root, new THREE.CylinderGeometry(0.012, 0.012, 0.35, 10), brassMat, -0.06, h * 0.5, d / 2 + 0.025);
      addPart(root, new THREE.CylinderGeometry(0.012, 0.012, 0.35, 10), brassMat, 0.06, h * 0.5, d / 2 + 0.025);
      break;
    }

    case 'kitchen_counter': {
      const baseH = h - 0.05;
      addPart(root, new THREE.BoxGeometry(w, baseH, d - 0.03), primaryMat, 0, baseH / 2, -0.01);
      // Countertop slab
      addPart(root, new THREE.BoxGeometry(w + 0.02, 0.05, d), makeMat(item.accentColor, 0.22, 0.08), 0, baseH + 0.025, 0);
      // Stainless steel sink basin + chrome faucet
      addPart(root, new THREE.BoxGeometry(0.62, 0.02, 0.42), chromeMat, 0.25, h + 0.005, 0);
      addPart(root, new THREE.CylinderGeometry(0.018, 0.022, 0.24, 12), chromeMat, 0.25, h + 0.12, -d * 0.32);
      addPart(root, new THREE.BoxGeometry(0.03, 0.03, 0.14), chromeMat, 0.25, h + 0.24, -d * 0.25);
      break;
    }

    case 'kitchen_island': {
      const baseH = h - 0.06;
      addPart(root, new THREE.BoxGeometry(w - 0.08, baseH, d * 0.68), primaryMat, 0, baseH / 2, -d * 0.1);
      // Waterfall marble top
      const stoneMat = makeMat(item.accentColor, 0.2, 0.08);
      addPart(root, new THREE.BoxGeometry(w, 0.06, d), stoneMat, 0, h - 0.03, 0);
      // 2 barstools tucked in front
      const stoolPositions = [-w * 0.25, w * 0.25];
      stoolPositions.forEach((sx) => {
        addPart(root, new THREE.CylinderGeometry(0.022, 0.022, 0.62, 10), darkMetalMat, sx, 0.31, d * 0.38);
        addPart(root, new THREE.CylinderGeometry(0.18, 0.17, 0.06, 18), makeMat('#C2956E', 0.6, 0.05), sx, 0.64, d * 0.38);
      });
      break;
    }

    case 'fridge': {
      const steelMat = makeMat(item.primaryColor, 0.25, 0.85);
      addPart(root, new THREE.BoxGeometry(w, h, d - 0.06), steelMat, 0, h / 2, -0.03);
      // Twin French doors + freezer drawer
      addPart(root, new THREE.BoxGeometry(w * 0.48, h * 0.62, 0.05), steelMat, -w * 0.25, h * 0.66, d / 2 - 0.03);
      addPart(root, new THREE.BoxGeometry(w * 0.48, h * 0.62, 0.05), steelMat, w * 0.25, h * 0.66, d / 2 - 0.03);
      addPart(root, new THREE.BoxGeometry(w * 0.96, h * 0.3, 0.05), steelMat, 0, h * 0.17, d / 2 - 0.03);
      // Handles
      addPart(root, new THREE.CylinderGeometry(0.014, 0.014, 0.55, 10), chromeMat, -0.06, h * 0.65, d / 2 + 0.02);
      addPart(root, new THREE.CylinderGeometry(0.014, 0.014, 0.55, 10), chromeMat, 0.06, h * 0.65, d / 2 + 0.02);
      break;
    }

    case 'stove': {
      addPart(root, new THREE.BoxGeometry(w, h, d), makeMat(item.primaryColor, 0.3, 0.7), 0, h / 2, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.82, h * 0.46, 0.02), makeMat('#0F172A', 0.1, 0.4), 0, h * 0.42, d / 2 + 0.01);
      // 4 stove burners
      const burnerGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.02, 16);
      [
        [-w * 0.22, -d * 0.2],
        [w * 0.22, -d * 0.2],
        [-w * 0.22, d * 0.2],
        [w * 0.22, d * 0.2],
      ].forEach(([bx, bz]) => addPart(root, burnerGeo, darkMetalMat, bx, h + 0.01, bz));
      break;
    }

    case 'dining_set': {
      const tableW = w * 0.78;
      const tableD = d * 0.58;
      // Table top & 4 legs
      addPart(root, new THREE.BoxGeometry(tableW, 0.05, tableD), primaryMat, 0, h - 0.025, 0);
      const legGeo = new THREE.CylinderGeometry(0.03, 0.02, h - 0.05, 10);
      [
        [-tableW * 0.43, -tableD * 0.4],
        [tableW * 0.43, -tableD * 0.4],
        [-tableW * 0.43, tableD * 0.4],
        [tableW * 0.43, tableD * 0.4],
      ].forEach(([lx, lz]) => addPart(root, legGeo, primaryMat, lx, (h - 0.05) / 2, lz));
      // Centerpiece ceramic bowl
      addPart(root, new THREE.CylinderGeometry(0.14, 0.08, 0.07, 18), ceramicMat, 0, h + 0.035, 0);
      // 4 dining chairs
      const chairOffsets = [
        [-tableW * 0.24, -tableD / 2 - 0.18, 0],
        [tableW * 0.24, -tableD / 2 - 0.18, 0],
        [-tableW * 0.24, tableD / 2 + 0.18, Math.PI],
        [tableW * 0.24, tableD / 2 + 0.18, Math.PI],
      ];
      chairOffsets.forEach(([cx, cz, ry]) => {
        const chair = new THREE.Group();
        chair.position.set(cx, 0, cz);
        chair.rotation.y = ry;
        addPart(chair, new THREE.BoxGeometry(0.42, 0.05, 0.4), accentMat, 0, 0.45, 0);
        addPart(chair, new THREE.BoxGeometry(0.42, 0.36, 0.05), accentMat, 0, 0.65, -0.18);
        addPart(chair, new THREE.CylinderGeometry(0.018, 0.015, 0.44, 8), primaryMat, -0.16, 0.22, -0.16);
        addPart(chair, new THREE.CylinderGeometry(0.018, 0.015, 0.44, 8), primaryMat, 0.16, 0.22, -0.16);
        addPart(chair, new THREE.CylinderGeometry(0.018, 0.015, 0.44, 8), primaryMat, -0.16, 0.22, 0.16);
        addPart(chair, new THREE.CylinderGeometry(0.018, 0.015, 0.44, 8), primaryMat, 0.16, 0.22, 0.16);
        root.add(chair);
      });
      break;
    }

    case 'work_desk': {
      addPart(root, new THREE.BoxGeometry(w, 0.04, d * 0.72), primaryMat, 0, h - 0.02, -d * 0.1);
      addPart(root, new THREE.BoxGeometry(0.05, h - 0.04, d * 0.65), darkMetalMat, -w * 0.45, (h - 0.04) / 2, -d * 0.1);
      addPart(root, new THREE.BoxGeometry(0.05, h - 0.04, d * 0.65), darkMetalMat, w * 0.45, (h - 0.04) / 2, -d * 0.1);
      // Monitor display
      addPart(root, new THREE.BoxGeometry(0.08, 0.12, 0.04), darkMetalMat, 0, h + 0.06, -d * 0.24);
      addPart(root, new THREE.BoxGeometry(0.56, 0.34, 0.025), darkMetalMat, 0, h + 0.26, -d * 0.22);
      // Office chair
      addPart(root, new THREE.CylinderGeometry(0.03, 0.03, 0.44, 10), chromeMat, 0, 0.22, d * 0.32);
      addPart(root, new THREE.CylinderGeometry(0.24, 0.24, 0.03, 14), darkMetalMat, 0, 0.03, d * 0.32);
      addPart(root, new THREE.BoxGeometry(0.46, 0.07, 0.44), accentMat, 0, 0.46, d * 0.32);
      addPart(root, new THREE.BoxGeometry(0.44, 0.42, 0.06), accentMat, 0, 0.7, d * 0.5);
      break;
    }

    case 'bathtub': {
      // Sculpted soaking tub outer shell & inner basin
      addPart(root, new THREE.BoxGeometry(w, h, d), ceramicMat, 0, h / 2, 0);
      addPart(root, new THREE.BoxGeometry(w - 0.14, 0.04, d - 0.14), makeMat('#BAE6FD', 0.15, 0.1), 0, h - 0.06, 0);
      // Freestanding chrome floor filler
      addPart(root, new THREE.CylinderGeometry(0.024, 0.03, h + 0.28, 12), chromeMat, w * 0.36, (h + 0.28) / 2, -d * 0.48);
      addPart(root, new THREE.BoxGeometry(0.04, 0.03, 0.18), chromeMat, w * 0.36, h + 0.26, -d * 0.38);
      break;
    }

    case 'vanity': {
      const cabH = 0.82;
      addPart(root, new THREE.BoxGeometry(w, 0.52, d), primaryMat, 0, cabH - 0.26, 0);
      addPart(root, new THREE.BoxGeometry(w + 0.02, 0.04, d + 0.02), ceramicMat, 0, cabH + 0.02, 0);
      // Vessel sink + chrome faucet
      addPart(root, new THREE.CylinderGeometry(0.22, 0.18, 0.12, 20), ceramicMat, 0, cabH + 0.1, 0.02);
      addPart(root, new THREE.CylinderGeometry(0.016, 0.02, 0.18, 10), chromeMat, 0, cabH + 0.12, -d * 0.34);
      // Round illuminated mirror
      addPart(root, new THREE.CylinderGeometry(w * 0.36, w * 0.36, 0.03, 28), chromeMat, 0, cabH + 0.58, -d * 0.42, Math.PI / 2, 0, 0);
      break;
    }

    case 'toilet': {
      addPart(root, new THREE.CylinderGeometry(0.16, 0.14, 0.38, 16), ceramicMat, 0, 0.19, 0.08);
      addPart(root, new THREE.CylinderGeometry(0.21, 0.18, 0.08, 18), ceramicMat, 0, 0.4, 0.08);
      addPart(root, new THREE.BoxGeometry(w * 0.9, 0.42, 0.2), ceramicMat, 0, 0.56, -d * 0.3);
      addPart(root, new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), chromeMat, 0, 0.78, -d * 0.3);
      break;
    }

    case 'shower_cabin': {
      // Tray
      addPart(root, new THREE.BoxGeometry(w, 0.08, d), ceramicMat, 0, 0.04, 0);
      // Glass enclosure walls
      addPart(root, new THREE.BoxGeometry(0.02, h, d), glassMat, w / 2 - 0.01, h / 2, 0, 0, 0, 0, false);
      addPart(root, new THREE.BoxGeometry(w, h, 0.02), glassMat, 0, h / 2, d / 2 - 0.01, 0, 0, 0, false);
      // Dark aluminum trim frame
      addPart(root, new THREE.BoxGeometry(0.04, h, 0.04), darkMetalMat, w / 2 - 0.02, h / 2, d / 2 - 0.02);
      // Rain showerhead & riser
      addPart(root, new THREE.CylinderGeometry(0.016, 0.016, h * 0.85, 10), chromeMat, -w * 0.35, h * 0.45, -d * 0.44);
      addPart(root, new THREE.CylinderGeometry(0.14, 0.14, 0.02, 18), chromeMat, -w * 0.35, h * 0.88, -d * 0.25);
      break;
    }

    case 'plant_olive': {
      // Ceramic planter pot + soil
      addPart(root, new THREE.CylinderGeometry(w * 0.34, w * 0.24, h * 0.28, 20), primaryMat, 0, h * 0.14, 0);
      addPart(root, new THREE.CylinderGeometry(w * 0.3, w * 0.3, 0.03, 18), makeMat('#3B2A1E', 0.95, 0), 0, h * 0.27, 0);
      // Woody trunk & branches
      const trunkMat = makeMat('#6E4B32', 0.85, 0.02);
      addPart(root, new THREE.CylinderGeometry(0.03, 0.045, h * 0.52, 10), trunkMat, 0, h * 0.5, 0);
      addPart(root, new THREE.CylinderGeometry(0.018, 0.026, h * 0.28, 8), trunkMat, 0.08, h * 0.65, 0.05, 0.3, 0, -0.4);
      // Multi-cluster organic foliage canopy
      const leafMat = makeMat(item.accentColor, 0.82, 0.02);
      const leafGeo = new THREE.DodecahedronGeometry(w * 0.28, 1);
      addPart(root, leafGeo, leafMat, 0, h * 0.82, 0);
      addPart(root, leafGeo, makeMat('#5D8D5E', 0.82, 0.02), 0.16, h * 0.74, 0.1, 0, 0.6, 0);
      addPart(root, leafGeo, leafMat, -0.15, h * 0.76, -0.08, 0, 1.2, 0);
      break;
    }

    case 'floor_lamp': {
      addPart(root, new THREE.CylinderGeometry(0.16, 0.18, 0.04, 20), makeMat('#E7E2D8', 0.3, 0.05), 0, 0.02, 0);
      addPart(root, new THREE.CylinderGeometry(0.016, 0.02, h - 0.25, 12), brassMat, 0, (h - 0.25) / 2 + 0.04, 0);
      addPart(root, new THREE.CylinderGeometry(0.16, 0.22, 0.28, 22), makeMat(item.accentColor, 0.85, 0.0), 0, h - 0.16, 0);
      // Emissive warm bulb
      addPart(
        root,
        new THREE.SphereGeometry(0.055, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd166, emissiveIntensity: 1.8 }),
        0,
        h - 0.18,
        0,
        0,
        0,
        0,
        false
      );
      break;
    }

    case 'wall_art': {
      addPart(root, new THREE.BoxGeometry(w, h, 0.04), primaryMat, 0, h / 2 + 1.25, 0);
      addPart(root, new THREE.BoxGeometry(w - 0.08, h - 0.08, 0.045), makeMat('#F8FAFC', 0.8, 0), 0, h / 2 + 1.25, 0.005);
      addPart(root, new THREE.BoxGeometry(w * 0.38, h * 0.56, 0.05), accentMat, -w * 0.16, h / 2 + 1.25, 0.01);
      break;
    }

    case 'sofa_2': {
      const legH = 0.12;
      const legGeo = new THREE.CylinderGeometry(0.025, 0.016, legH, 10);
      [
        [-w / 2 + 0.08, -d / 2 + 0.08],
        [w / 2 - 0.08, -d / 2 + 0.08],
        [-w / 2 + 0.08, d / 2 - 0.08],
        [w / 2 - 0.08, d / 2 - 0.08],
      ].forEach(([lx, lz]) => addPart(root, legGeo, accentMat, lx, legH / 2, lz));
      addPart(root, new THREE.BoxGeometry(w, 0.06, d * 0.9), accentMat, 0, legH + 0.03, 0);
      const cw = (w - 0.28) / 2;
      addPart(root, new THREE.BoxGeometry(cw - 0.02, 0.18, d * 0.78), primaryMat, -cw / 2, legH + 0.15, 0.05);
      addPart(root, new THREE.BoxGeometry(cw - 0.02, 0.18, d * 0.78), primaryMat, cw / 2, legH + 0.15, 0.05);
      addPart(root, new THREE.BoxGeometry(w - 0.04, h * 0.58, 0.18), primaryMat, 0, legH + h * 0.35, -d / 2 + 0.1);
      addPart(root, new THREE.BoxGeometry(0.13, h * 0.48, d * 0.9), primaryMat, -w / 2 + 0.065, legH + h * 0.26, 0);
      addPart(root, new THREE.BoxGeometry(0.13, h * 0.48, d * 0.9), primaryMat, w / 2 - 0.065, legH + h * 0.26, 0);
      break;
    }

    case 'ottoman': {
      const r = Math.min(w, d) / 2;
      addPart(root, new THREE.CylinderGeometry(r * 0.94, r * 0.88, 0.06, 24), darkMetalMat, 0, 0.03, 0);
      addPart(root, new THREE.CylinderGeometry(r, r * 0.96, h - 0.1, 24), primaryMat, 0, (h - 0.1) / 2 + 0.06, 0);
      addPart(root, new THREE.CylinderGeometry(r * 0.96, r, 0.05, 24), makeMat(item.primaryColor, 0.88, 0.02), 0, h - 0.025, 0);
      break;
    }

    case 'console_table': {
      const legGeo = new THREE.BoxGeometry(0.04, 0.78, 0.04);
      [
        [-w * 0.45, -d * 0.38],
        [w * 0.45, -d * 0.38],
        [-w * 0.45, d * 0.38],
        [w * 0.45, d * 0.38],
      ].forEach(([lx, lz]) => addPart(root, legGeo, brassMat, lx, 0.39, lz));
      addPart(root, new THREE.BoxGeometry(w, 0.05, d), primaryMat, 0, 0.8, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.92, 0.03, d * 0.84), primaryMat, 0, 0.22, 0);
      addPart(root, new THREE.CylinderGeometry(w * 0.28, w * 0.28, 0.03, 28), brassMat, 0, 1.38, -d * 0.38, Math.PI / 2, 0, 0);
      addPart(root, new THREE.CylinderGeometry(w * 0.25, w * 0.25, 0.035, 28), chromeMat, 0, 1.38, -d * 0.37, Math.PI / 2, 0, 0);
      break;
    }

    case 'bed_single': {
      addPart(root, new THREE.BoxGeometry(w, h, 0.08), accentMat, 0, h / 2, -d / 2 + 0.04);
      addPart(root, new THREE.BoxGeometry(w - 0.05, 0.2, d - 0.06), accentMat, 0, 0.14, 0.02);
      addPart(root, new THREE.BoxGeometry(w - 0.12, 0.2, d - 0.18), ceramicMat, 0, 0.32, 0.04);
      addPart(root, new THREE.BoxGeometry(w - 0.08, 0.22, d * 0.62), primaryMat, 0, 0.34, d * 0.14);
      addPart(root, new THREE.BoxGeometry(w * 0.65, 0.11, 0.38), makeMat('#F5F2EB', 0.88, 0.02), 0, 0.46, -d / 2 + 0.36, 0.2, 0, 0);
      break;
    }

    case 'dresser': {
      const bodyH = 0.82;
      addPart(root, new THREE.BoxGeometry(w, bodyH - 0.12, d), primaryMat, 0, 0.12 + (bodyH - 0.12) / 2, 0);
      const legGeo = new THREE.CylinderGeometry(0.02, 0.015, 0.12, 8);
      [
        [-w * 0.44, -d * 0.38],
        [w * 0.44, -d * 0.38],
        [-w * 0.44, d * 0.38],
        [w * 0.44, d * 0.38],
      ].forEach(([lx, lz]) => addPart(root, legGeo, accentMat, lx, 0.06, lz));
      for (let r = 0; r < 3; r++) {
        const y = 0.24 + r * 0.2;
        addPart(root, new THREE.CylinderGeometry(0.015, 0.015, 0.08, 10), brassMat, -w * 0.25, y, d / 2 + 0.015, 0, 0, Math.PI / 2);
        addPart(root, new THREE.CylinderGeometry(0.015, 0.015, 0.08, 10), brassMat, w * 0.25, y, d / 2 + 0.015, 0, 0, Math.PI / 2);
      }
      addPart(root, new THREE.BoxGeometry(w * 0.72, 0.75, 0.04), accentMat, 0, bodyH + 0.42, -d * 0.38);
      addPart(root, new THREE.BoxGeometry(w * 0.64, 0.67, 0.05), chromeMat, 0, bodyH + 0.42, -d * 0.37);
      break;
    }

    case 'crib': {
      const railH = h - 0.22;
      addPart(root, new THREE.BoxGeometry(w, 0.08, d), accentMat, 0, 0.24, 0);
      addPart(root, new THREE.BoxGeometry(w - 0.08, 0.14, d - 0.08), ceramicMat, 0, 0.34, 0);
      // 4 corner posts
      const postGeo = new THREE.BoxGeometry(0.05, h, 0.05);
      [
        [-w / 2 + 0.025, -d / 2 + 0.025],
        [w / 2 - 0.025, -d / 2 + 0.025],
        [-w / 2 + 0.025, d / 2 - 0.025],
        [w / 2 - 0.025, d / 2 - 0.025],
      ].forEach(([px, pz]) => addPart(root, postGeo, accentMat, px, h / 2, pz));
      // Top rails & spindles
      addPart(root, new THREE.BoxGeometry(w, 0.04, 0.04), primaryMat, 0, h - 0.02, -d / 2 + 0.025);
      addPart(root, new THREE.BoxGeometry(w, 0.04, 0.04), primaryMat, 0, h - 0.02, d / 2 - 0.025);
      for (let i = -4; i <= 4; i++) {
        const sx = i * ((w - 0.2) / 8);
        addPart(root, new THREE.CylinderGeometry(0.01, 0.01, railH, 8), primaryMat, sx, 0.24 + railH / 2, -d / 2 + 0.025);
        addPart(root, new THREE.CylinderGeometry(0.01, 0.01, railH, 8), primaryMat, sx, 0.24 + railH / 2, d / 2 - 0.025);
      }
      break;
    }

    case 'dishwasher': {
      addPart(root, new THREE.BoxGeometry(w, h - 0.04, d), makeMat(item.primaryColor, 0.24, 0.78), 0, (h - 0.04) / 2, 0);
      addPart(root, new THREE.BoxGeometry(w + 0.01, 0.04, d + 0.01), ceramicMat, 0, h - 0.02, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.92, 0.1, 0.03), accentMat, 0, h - 0.1, d / 2 + 0.005);
      addPart(root, new THREE.CylinderGeometry(0.012, 0.012, w * 0.65, 10), chromeMat, 0, h - 0.2, d / 2 + 0.03, 0, 0, Math.PI / 2);
      break;
    }

    case 'microwave_oven': {
      addPart(root, new THREE.BoxGeometry(w, h, d), primaryMat, 0, h / 2, 0);
      // Lower oven window
      addPart(root, new THREE.BoxGeometry(w * 0.84, 0.52, 0.03), darkMetalMat, 0, h * 0.45, d / 2 + 0.006);
      addPart(root, new THREE.BoxGeometry(w * 0.7, 0.34, 0.04), makeMat('#0F172A', 0.12, 0.45), 0, h * 0.44, d / 2 + 0.01);
      // Upper microwave
      addPart(root, new THREE.BoxGeometry(w * 0.84, 0.34, 0.03), darkMetalMat, 0, h * 0.72, d / 2 + 0.006);
      addPart(root, new THREE.CylinderGeometry(0.012, 0.012, w * 0.6, 10), chromeMat, 0, h * 0.58, d / 2 + 0.03, 0, 0, Math.PI / 2);
      break;
    }

    case 'range_hood': {
      const mountY = 1.65;
      addPart(root, new THREE.BoxGeometry(w, 0.1, d), makeMat(item.primaryColor, 0.25, 0.85), 0, mountY, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.58, 0.14, d * 0.65), makeMat(item.primaryColor, 0.25, 0.85), 0, mountY + 0.12, -d * 0.12);
      addPart(root, new THREE.BoxGeometry(w * 0.28, h - 0.24, d * 0.35), makeMat(item.primaryColor, 0.25, 0.85), 0, mountY + 0.19 + (h - 0.24) / 2, -d * 0.22);
      addPart(root, new THREE.BoxGeometry(w * 0.76, 0.02, 0.04), new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0xfde68a, emissiveIntensity: 1.3 }), 0, mountY - 0.05, d * 0.25, 0, 0, 0, false);
      break;
    }

    case 'coffee_machine': {
      const cabH = 0.82;
      addPart(root, new THREE.BoxGeometry(w, cabH, d), primaryMat, 0, cabH / 2, 0);
      addPart(root, new THREE.BoxGeometry(w + 0.02, 0.04, d + 0.02), ceramicMat, 0, cabH + 0.02, 0);
      // Espresso machine body
      addPart(root, new THREE.BoxGeometry(0.32, 0.36, 0.3), chromeMat, -w * 0.16, cabH + 0.22, 0);
      addPart(root, new THREE.BoxGeometry(0.28, 0.06, 0.12), darkMetalMat, -w * 0.16, cabH + 0.34, 0.12);
      addPart(root, new THREE.CylinderGeometry(0.045, 0.038, 0.09, 14), ceramicMat, -w * 0.16, cabH + 0.085, 0.12);
      // Coffee canister
      addPart(root, new THREE.CylinderGeometry(0.07, 0.07, 0.18, 14), accentMat, w * 0.22, cabH + 0.13, 0);
      break;
    }

    case 'washer': {
      addPart(root, new THREE.BoxGeometry(w, h, d), makeMat(item.primaryColor, 0.3, 0.35), 0, h / 2, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.96, 0.12, 0.02), accentMat, 0, h - 0.08, d / 2 + 0.005);
      addPart(root, new THREE.CylinderGeometry(w * 0.34, w * 0.34, 0.04, 24), chromeMat, 0, h * 0.44, d / 2 + 0.01, Math.PI / 2, 0, 0);
      addPart(root, new THREE.CylinderGeometry(w * 0.26, w * 0.26, 0.05, 24), glassMat, 0, h * 0.44, d / 2 + 0.02, Math.PI / 2, 0, 0);
      addPart(root, new THREE.CylinderGeometry(0.03, 0.03, 0.03, 14), chromeMat, -w * 0.25, h - 0.08, d / 2 + 0.02, Math.PI / 2, 0, 0);
      break;
    }

    case 'dryer': {
      addPart(root, new THREE.BoxGeometry(w, h, d), makeMat(item.primaryColor, 0.28, 0.55), 0, h / 2, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.96, 0.12, 0.02), accentMat, 0, h - 0.08, d / 2 + 0.005);
      addPart(root, new THREE.CylinderGeometry(w * 0.35, w * 0.35, 0.04, 24), darkMetalMat, 0, h * 0.45, d / 2 + 0.01, Math.PI / 2, 0, 0);
      addPart(root, new THREE.CylinderGeometry(w * 0.26, w * 0.26, 0.05, 24), makeMat('#0F172A', 0.15, 0.6), 0, h * 0.45, d / 2 + 0.02, Math.PI / 2, 0, 0);
      break;
    }

    case 'ac_split': {
      const mountY = 2.22;
      addPart(root, new THREE.BoxGeometry(w, h, d), makeMat(item.primaryColor, 0.28, 0.15), 0, mountY, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.92, 0.05, d * 0.4), accentMat, 0, mountY - h * 0.34, d * 0.28, 0.35, 0, 0);
      addPart(root, new THREE.BoxGeometry(0.12, 0.04, 0.02), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9 }), w * 0.35, mountY, d / 2 + 0.006, 0, 0, 0, false);
      break;
    }

    case 'water_heater': {
      const mountY = 1.65;
      const r = Math.min(w, d) / 2;
      addPart(root, new THREE.CylinderGeometry(r, r, h, 24), makeMat(item.primaryColor, 0.25, 0.35), 0, mountY, 0);
      addPart(root, new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.04, 24), accentMat, 0, mountY - h / 2 + 0.04, 0);
      addPart(root, new THREE.CylinderGeometry(0.018, 0.018, 0.24, 10), chromeMat, -r * 0.35, mountY - h / 2 - 0.12, 0);
      addPart(root, new THREE.CylinderGeometry(0.018, 0.018, 0.24, 10), chromeMat, r * 0.35, mountY - h / 2 - 0.12, 0);
      break;
    }

    case 'smart_tv_wall': {
      const mountY = 1.45;
      addPart(root, new THREE.BoxGeometry(w * 0.35, h * 0.3, 0.06), darkMetalMat, 0, mountY, -d * 0.25);
      addPart(root, new THREE.BoxGeometry(w, h, 0.04), accentMat, 0, mountY, 0);
      addPart(root, new THREE.BoxGeometry(w - 0.04, h - 0.04, 0.015), makeMat('#090D16', 0.08, 0.4), 0, mountY, 0.02);
      break;
    }

    case 'vacuum_robot': {
      const r = Math.min(w, d) * 0.46;
      addPart(root, new THREE.BoxGeometry(w * 0.45, h * 0.95, 0.1), accentMat, 0, h * 0.48, -d * 0.38);
      addPart(root, new THREE.CylinderGeometry(r, r, h * 0.65, 24), primaryMat, 0, h * 0.33, 0.05);
      addPart(root, new THREE.CylinderGeometry(r * 0.24, r * 0.24, h * 0.28, 16), accentMat, 0, h * 0.72, 0.05);
      break;
    }

    case 'air_purifier': {
      const r = Math.min(w, d) / 2;
      addPart(root, new THREE.CylinderGeometry(r * 0.92, r, h * 0.55, 24), accentMat, 0, h * 0.275, 0);
      addPart(root, new THREE.CylinderGeometry(r * 0.88, r * 0.92, h * 0.45, 24), makeMat(item.primaryColor, 0.3, 0.1), 0, h * 0.775, 0);
      addPart(root, new THREE.CylinderGeometry(r * 0.6, r * 0.6, 0.02, 20), darkMetalMat, 0, h + 0.01, 0);
      break;
    }

    case 'dining_round': {
      const tr = Math.min(w, d) * 0.32;
      addPart(root, new THREE.CylinderGeometry(tr * 0.45, tr * 0.6, 0.05, 20), accentMat, 0, 0.025, 0);
      addPart(root, new THREE.CylinderGeometry(0.08, 0.12, h - 0.05, 16), accentMat, 0, (h - 0.05) / 2, 0);
      addPart(root, new THREE.CylinderGeometry(tr, tr, 0.05, 28), primaryMat, 0, h - 0.025, 0);
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI) / 2 + Math.PI / 4;
        const cx = Math.cos(ang) * (tr + 0.24);
        const cz = Math.sin(ang) * (tr + 0.24);
        const chair = new THREE.Group();
        chair.position.set(cx, 0, cz);
        chair.rotation.y = -ang - Math.PI / 2;
        addPart(chair, new THREE.BoxGeometry(0.42, 0.05, 0.4), accentMat, 0, 0.45, 0);
        addPart(chair, new THREE.BoxGeometry(0.42, 0.36, 0.05), accentMat, 0, 0.65, -0.18);
        addPart(chair, new THREE.CylinderGeometry(0.02, 0.02, 0.44, 8), darkMetalMat, 0, 0.22, 0);
        root.add(chair);
      }
      break;
    }

    case 'gaming_desk': {
      addPart(root, new THREE.BoxGeometry(w, 0.045, d * 0.68), primaryMat, 0, h - 0.022, -d * 0.12);
      addPart(root, new THREE.BoxGeometry(0.06, h - 0.04, d * 0.62), darkMetalMat, -w * 0.44, (h - 0.04) / 2, -d * 0.12);
      addPart(root, new THREE.BoxGeometry(0.06, h - 0.04, d * 0.62), darkMetalMat, w * 0.44, (h - 0.04) / 2, -d * 0.12);
      // Dual curved monitors
      addPart(root, new THREE.BoxGeometry(0.62, 0.36, 0.025), darkMetalMat, -0.33, h + 0.28, -d * 0.24, 0, 0.15, 0);
      addPart(root, new THREE.BoxGeometry(0.62, 0.36, 0.025), darkMetalMat, 0.33, h + 0.28, -d * 0.24, 0, -0.15, 0);
      // PC Tower
      addPart(root, new THREE.BoxGeometry(0.22, 0.46, 0.42), accentMat, w * 0.38, h + 0.23, -d * 0.1);
      // Chair
      addPart(root, new THREE.CylinderGeometry(0.24, 0.24, 0.03, 14), darkMetalMat, 0, 0.03, d * 0.34);
      addPart(root, new THREE.CylinderGeometry(0.03, 0.03, 0.44, 10), darkMetalMat, 0, 0.22, d * 0.34);
      addPart(root, new THREE.BoxGeometry(0.5, 0.08, 0.46), accentMat, 0, 0.47, d * 0.34);
      addPart(root, new THREE.BoxGeometry(0.46, 0.56, 0.07), accentMat, 0, 0.78, d * 0.52);
      break;
    }

    case 'meeting_table': {
      const tw = w * 0.84;
      const td = d * 0.56;
      addPart(root, new THREE.BoxGeometry(tw, 0.055, td), primaryMat, 0, h - 0.028, 0);
      addPart(root, new THREE.BoxGeometry(0.14, h - 0.055, td * 0.68), accentMat, -tw * 0.32, (h - 0.055) / 2, 0);
      addPart(root, new THREE.BoxGeometry(0.14, h - 0.055, td * 0.68), accentMat, tw * 0.32, (h - 0.055) / 2, 0);
      [-tw * 0.32, 0, tw * 0.32].forEach((cx) => {
        [
          [cx, -td / 2 - 0.2, 0],
          [cx, td / 2 + 0.2, Math.PI],
        ].forEach(([px, pz, ry]) => {
          const ch = new THREE.Group();
          ch.position.set(px, 0, pz);
          ch.rotation.y = ry;
          addPart(ch, new THREE.BoxGeometry(0.42, 0.05, 0.4), accentMat, 0, 0.45, 0);
          addPart(ch, new THREE.BoxGeometry(0.42, 0.36, 0.05), accentMat, 0, 0.65, -0.18);
          addPart(ch, new THREE.CylinderGeometry(0.02, 0.02, 0.44, 8), darkMetalMat, 0, 0.22, 0);
          root.add(ch);
        });
      });
      break;
    }

    case 'bidet': {
      addPart(root, new THREE.CylinderGeometry(0.16, 0.13, h * 0.72, 16), ceramicMat, 0, h * 0.36, 0.04);
      addPart(root, new THREE.CylinderGeometry(0.2, 0.16, 0.1, 18), ceramicMat, 0, h - 0.05, 0.04);
      addPart(root, new THREE.CylinderGeometry(0.015, 0.018, 0.12, 10), chromeMat, 0, h + 0.04, -d * 0.28);
      break;
    }

    case 'towel_warmer': {
      const mountY = 1.25;
      addPart(root, new THREE.CylinderGeometry(0.018, 0.018, h, 10), chromeMat, -w * 0.45, mountY, 0);
      addPart(root, new THREE.CylinderGeometry(0.018, 0.018, h, 10), chromeMat, w * 0.45, mountY, 0);
      for (let i = 0; i < 6; i++) {
        const ry = mountY - h * 0.4 + (i * h * 0.8) / 5;
        addPart(root, new THREE.CylinderGeometry(0.012, 0.012, w * 0.9, 10), chromeMat, 0, ry, 0, 0, 0, Math.PI / 2);
      }
      addPart(root, new THREE.BoxGeometry(w * 0.55, h * 0.42, 0.04), makeMat('#EAE6DF', 0.9, 0.0), 0, mountY, 0.03);
      break;
    }

    case 'jacuzzi': {
      addPart(root, new THREE.BoxGeometry(w, h, d), ceramicMat, 0, h / 2, 0);
      addPart(root, new THREE.BoxGeometry(w - 0.18, 0.04, d - 0.18), makeMat(item.accentColor, 0.1, 0.15), 0, h - 0.05, 0);
      // Corner control panel + headrests
      addPart(root, new THREE.BoxGeometry(0.24, 0.05, 0.12), darkMetalMat, -w * 0.32, h + 0.02, -d * 0.36);
      addPart(root, new THREE.BoxGeometry(0.32, 0.09, 0.16), makeMat('#CBD5E1', 0.7, 0.05), -w * 0.26, h + 0.02, d * 0.36);
      addPart(root, new THREE.BoxGeometry(0.32, 0.09, 0.16), makeMat('#CBD5E1', 0.7, 0.05), w * 0.26, h + 0.02, -d * 0.26);
      break;
    }

    case 'chandelier': {
      const mountY = 2.35;
      addPart(root, new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16), brassMat, 0, 2.78, 0);
      addPart(root, new THREE.CylinderGeometry(0.012, 0.012, 0.45, 10), brassMat, 0, 2.56, 0);
      const ringGeo = new THREE.TorusGeometry(Math.min(w, d) * 0.42, 0.025, 12, 36);
      addPart(root, ringGeo, brassMat, 0, mountY, 0, Math.PI / 2, 0, 0);
      const glowRing = new THREE.TorusGeometry(Math.min(w, d) * 0.42, 0.018, 10, 36);
      addPart(
        root,
        glowRing,
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0xfde68a, emissiveIntensity: 1.6 }),
        0,
        mountY - 0.02,
        0,
        Math.PI / 2,
        0,
        0,
        false
      );
      break;
    }

    case 'curtain_panel': {
      addPart(root, new THREE.CylinderGeometry(0.015, 0.015, w, 10), darkMetalMat, 0, h - 0.03, 0, 0, 0, Math.PI / 2);
      const clothMat = makeMat(item.primaryColor, 0.9, 0.0);
      for (let side of [-1, 1]) {
        for (let p = 0; p < 3; p++) {
          addPart(root, new THREE.CylinderGeometry(0.045, 0.05, h - 0.05, 12), clothMat, side * (w * 0.34 + p * 0.07), (h - 0.05) / 2, 0);
        }
      }
      break;
    }

    case 'outdoor_lounge': {
      // Low teak sofa & side table
      addPart(root, new THREE.BoxGeometry(w, 0.14, d * 0.56), primaryMat, 0, 0.18, -d * 0.2);
      addPart(root, new THREE.BoxGeometry(w - 0.08, 0.15, d * 0.5), makeMat(item.accentColor, 0.88, 0.02), 0, 0.32, -d * 0.18);
      addPart(root, new THREE.BoxGeometry(w, h * 0.55, 0.12), primaryMat, 0, 0.48, -d * 0.44);
      // Coffee table in front
      addPart(root, new THREE.BoxGeometry(w * 0.56, 0.05, d * 0.34), primaryMat, 0, 0.34, d * 0.28);
      addPart(root, new THREE.BoxGeometry(w * 0.48, 0.28, d * 0.26), darkMetalMat, 0, 0.17, d * 0.28);
      break;
    }

    case 'piano': {
      addPart(root, new THREE.BoxGeometry(w, h, d * 0.62), primaryMat, 0, h / 2, -d * 0.18);
      addPart(root, new THREE.BoxGeometry(w, 0.14, d * 0.36), primaryMat, 0, 0.72, d * 0.22);
      addPart(root, new THREE.BoxGeometry(w * 0.92, 0.03, d * 0.24), makeMat('#F8FAFC', 0.25, 0.05), 0, 0.8, d * 0.24);
      addPart(root, new THREE.BoxGeometry(0.06, 0.68, 0.08), primaryMat, -w * 0.45, 0.34, d * 0.3);
      addPart(root, new THREE.BoxGeometry(0.06, 0.68, 0.08), primaryMat, w * 0.45, 0.34, d * 0.3);
      // Piano bench
      addPart(root, new THREE.BoxGeometry(0.75, 0.07, 0.32), primaryMat, 0, 0.46, d * 0.64);
      addPart(root, new THREE.BoxGeometry(0.05, 0.44, 0.26), primaryMat, -0.32, 0.22, d * 0.64);
      addPart(root, new THREE.BoxGeometry(0.05, 0.44, 0.26), primaryMat, 0.32, 0.22, d * 0.64);
      break;
    }

    case 'corner_display_cabinet': {
      addPart(root, new THREE.BoxGeometry(w, 0.42, d), primaryMat, 0, 0.21, 0);
      addPart(root, new THREE.BoxGeometry(w, h - 0.42, 0.04), primaryMat, 0, 0.42 + (h - 0.42) / 2, -d / 2 + 0.02);
      addPart(root, new THREE.BoxGeometry(0.04, h - 0.42, d), primaryMat, -w / 2 + 0.02, 0.42 + (h - 0.42) / 2, 0);
      addPart(root, new THREE.BoxGeometry(0.04, h - 0.42, d), primaryMat, w / 2 - 0.02, 0.42 + (h - 0.42) / 2, 0);
      addPart(root, new THREE.BoxGeometry(w, 0.05, d), primaryMat, 0, h - 0.025, 0);
      addPart(root, new THREE.BoxGeometry(w - 0.08, h - 0.5, 0.02), glassMat, 0, 0.42 + (h - 0.48) / 2, d / 2 - 0.02, 0, 0, 0, false);
      for (let i = 1; i <= 3; i++) {
        addPart(root, new THREE.BoxGeometry(w - 0.08, 0.025, d - 0.06), glassMat, 0, 0.42 + i * ((h - 0.5) / 4), 0, 0, 0, 0, false);
      }
      break;
    }

    case 'fireplace_modern': {
      // Hearth plinth & stone surround
      addPart(root, new THREE.BoxGeometry(w, 0.14, d), makeMat(item.primaryColor, 0.55, 0.05), 0, 0.07, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.92, h - 0.14, d * 0.82), makeMat(item.primaryColor, 0.72, 0.02), 0, 0.14 + (h - 0.14) / 2, -d * 0.06);
      // Firebox recess & glass
      addPart(root, new THREE.BoxGeometry(w * 0.58, 0.46, 0.06), darkMetalMat, 0, 0.44, d * 0.36);
      // Glowing embers
      addPart(
        root,
        new THREE.BoxGeometry(w * 0.46, 0.14, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 2.0 }),
        0,
        0.34,
        d * 0.38,
        0,
        0,
        0,
        false
      );
      // Timber mantel shelf
      addPart(root, new THREE.BoxGeometry(w * 0.98, 0.07, d * 0.92), accentMat, 0, h * 0.72, 0);
      break;
    }

    case 'bean_bag': {
      const r = Math.min(w, d) / 2;
      addPart(root, new THREE.CylinderGeometry(r * 0.96, r, h * 0.45, 22), primaryMat, 0, h * 0.225, 0);
      addPart(root, new THREE.SphereGeometry(r * 0.86, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.65), primaryMat, 0, h * 0.36, 0);
      addPart(root, new THREE.BoxGeometry(r * 1.1, h * 0.48, r * 0.45), accentMat, 0, h * 0.66, -r * 0.35, -0.25, 0, 0);
      break;
    }

    case 'shoe_cabinet': {
      // Bench + angled shoe rack + tall coat hooks
      addPart(root, new THREE.BoxGeometry(w, 0.46, d), primaryMat, 0, 0.23, 0);
      addPart(root, new THREE.BoxGeometry(w - 0.04, 0.07, d - 0.04), accentMat, 0, 0.495, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.94, h - 0.5, 0.04), primaryMat, 0, 0.5 + (h - 0.5) / 2, -d / 2 + 0.02);
      for (let i = -2; i <= 2; i++) {
        addPart(root, new THREE.CylinderGeometry(0.015, 0.015, 0.08, 8), brassMat, i * (w * 0.18), h - 0.22, -d / 2 + 0.07, Math.PI / 2, 0, 0);
      }
      break;
    }

    case 'bunk_bed': {
      const postGeo = new THREE.BoxGeometry(0.06, h, 0.06);
      [
        [-w / 2 + 0.03, -d / 2 + 0.03],
        [w / 2 - 0.03, -d / 2 + 0.03],
        [-w / 2 + 0.03, d / 2 - 0.03],
        [w / 2 - 0.03, d / 2 - 0.03],
      ].forEach(([px, pz]) => addPart(root, postGeo, accentMat, px, h / 2, pz));
      // Lower & upper bunks
      addPart(root, new THREE.BoxGeometry(w - 0.04, 0.14, d - 0.06), accentMat, 0, 0.24, 0);
      addPart(root, new THREE.BoxGeometry(w - 0.1, 0.16, d - 0.12), ceramicMat, 0, 0.38, 0);
      addPart(root, new THREE.BoxGeometry(w - 0.1, 0.1, d * 0.55), primaryMat, 0, 0.42, d * 0.16);
      const upperY = h * 0.66;
      addPart(root, new THREE.BoxGeometry(w - 0.04, 0.12, d - 0.06), accentMat, 0, upperY, 0);
      addPart(root, new THREE.BoxGeometry(w - 0.1, 0.16, d - 0.12), ceramicMat, 0, upperY + 0.13, 0);
      addPart(root, new THREE.BoxGeometry(w - 0.1, 0.1, d * 0.55), primaryMat, 0, upperY + 0.17, d * 0.16);
      // Safety rail + ladder
      addPart(root, new THREE.BoxGeometry(0.03, 0.24, d * 0.72), accentMat, -w / 2 + 0.03, upperY + 0.24, 0);
      addPart(root, new THREE.BoxGeometry(0.04, h * 0.72, 0.35), brassMat, w / 2 + 0.02, h * 0.36, d * 0.28);
      break;
    }

    case 'vanity_stool': {
      addPart(root, new THREE.BoxGeometry(w, 0.14, d * 0.62), primaryMat, 0, 0.72, -d * 0.16);
      const legGeo = new THREE.CylinderGeometry(0.02, 0.015, 0.65, 8);
      [
        [-w * 0.44, -d * 0.42],
        [w * 0.44, -d * 0.42],
        [-w * 0.44, d * 0.1],
        [w * 0.44, d * 0.1],
      ].forEach(([lx, lz]) => addPart(root, legGeo, brassMat, lx, 0.325, lz));
      // Hollywood mirror
      addPart(root, new THREE.CylinderGeometry(0.28, 0.28, 0.03, 24), brassMat, 0, 1.12, -d * 0.4, Math.PI / 2, 0, 0);
      addPart(root, new THREE.CylinderGeometry(0.25, 0.25, 0.035, 24), chromeMat, 0, 1.12, -d * 0.39, Math.PI / 2, 0, 0);
      // Velvet stool
      addPart(root, new THREE.CylinderGeometry(0.19, 0.19, 0.12, 20), accentMat, 0, 0.38, d * 0.34);
      addPart(root, new THREE.CylinderGeometry(0.02, 0.02, 0.32, 10), brassMat, 0, 0.16, d * 0.34);
      break;
    }

    case 'walk_in_closet': {
      // L-shaped open wardrobe system
      addPart(root, new THREE.BoxGeometry(w, h, 0.52), primaryMat, 0, h / 2, -d / 2 + 0.26);
      addPart(root, new THREE.BoxGeometry(0.52, h, d - 0.52), primaryMat, -w / 2 + 0.26, h / 2, 0.26);
      // Hanging rails + shelves
      addPart(root, new THREE.CylinderGeometry(0.014, 0.014, w * 0.86, 10), brassMat, 0.1, h * 0.72, -d / 2 + 0.32, 0, 0, Math.PI / 2);
      const shirtColors = ['#334155', '#E2E8F0', '#9A3412', '#5B7065', '#CBD5E1'];
      for (let i = 0; i < 5; i++) {
        addPart(root, new THREE.BoxGeometry(0.06, 0.65, 0.36), makeMat(shirtColors[i], 0.85, 0.02), -w * 0.22 + i * 0.14, h * 0.54, -d / 2 + 0.32);
      }
      break;
    }

    case 'pantry_cabinet': {
      addPart(root, new THREE.BoxGeometry(w, h, d), primaryMat, 0, h / 2, 0);
      addPart(root, new THREE.BoxGeometry(0.016, h - 0.08, 0.02), accentMat, 0, h / 2, d / 2 + 0.004);
      addPart(root, new THREE.CylinderGeometry(0.012, 0.012, 0.42, 10), brassMat, -0.07, h * 0.52, d / 2 + 0.025);
      addPart(root, new THREE.CylinderGeometry(0.012, 0.012, 0.42, 10), brassMat, 0.07, h * 0.52, d / 2 + 0.025);
      break;
    }

    case 'bar_counter': {
      const counterH = h;
      addPart(root, new THREE.BoxGeometry(w, counterH - 0.06, d * 0.52), primaryMat, 0, (counterH - 0.06) / 2, -d * 0.18);
      addPart(root, new THREE.BoxGeometry(w + 0.04, 0.06, d * 0.64), ceramicMat, 0, counterH - 0.03, -d * 0.14);
      [-w * 0.3, 0, w * 0.3].forEach((sx) => {
        addPart(root, new THREE.CylinderGeometry(0.02, 0.02, 0.68, 10), darkMetalMat, sx, 0.34, d * 0.34);
        addPart(root, new THREE.CylinderGeometry(0.17, 0.16, 0.06, 18), accentMat, sx, 0.7, d * 0.34);
      });
      break;
    }

    case 'water_dispenser': {
      addPart(root, new THREE.BoxGeometry(w, h * 0.72, d), makeMat(item.primaryColor, 0.3, 0.25), 0, h * 0.36, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.8, 0.2, 0.06), darkMetalMat, 0, h * 0.58, d / 2 - 0.01);
      addPart(root, new THREE.CylinderGeometry(w * 0.36, w * 0.36, h * 0.3, 20), glassMat, 0, h * 0.87, 0, 0, 0, 0, false);
      break;
    }

    case 'buffet_sideboard': {
      const legH = 0.16;
      const legGeo = new THREE.CylinderGeometry(0.022, 0.016, legH, 10);
      [
        [-w * 0.45, -d * 0.38],
        [w * 0.45, -d * 0.38],
        [-w * 0.45, d * 0.38],
        [w * 0.45, d * 0.38],
      ].forEach(([lx, lz]) => addPart(root, legGeo, brassMat, lx, legH / 2, lz));
      addPart(root, new THREE.BoxGeometry(w, h - legH - 0.04, d), primaryMat, 0, legH + (h - legH - 0.04) / 2, 0);
      addPart(root, new THREE.BoxGeometry(w + 0.02, 0.04, d + 0.02), ceramicMat, 0, h - 0.02, 0);
      for (let i = -1; i <= 1; i++) {
        addPart(root, new THREE.CylinderGeometry(0.012, 0.012, 0.18, 10), brassMat, i * (w * 0.3) + 0.06, h * 0.56, d / 2 + 0.02);
      }
      break;
    }

    case 'reading_nook': {
      addPart(root, new THREE.BoxGeometry(w, h, d * 0.36), primaryMat, 0, h / 2, -d * 0.32);
      for (let i = 0; i < 4; i++) {
        const sy = 0.2 + i * ((h - 0.4) / 3);
        addPart(root, new THREE.BoxGeometry(w - 0.06, 0.03, d * 0.34), primaryMat, 0, sy, -d * 0.32);
      }
      // Cushioned reading bench in front
      addPart(root, new THREE.BoxGeometry(w * 0.92, 0.36, d * 0.56), primaryMat, 0, 0.18, d * 0.18);
      addPart(root, new THREE.BoxGeometry(w * 0.88, 0.1, d * 0.52), accentMat, 0, 0.41, d * 0.18);
      break;
    }

    case 'double_vanity': {
      const cabH = 0.82;
      addPart(root, new THREE.BoxGeometry(w, 0.52, d), primaryMat, 0, cabH - 0.26, 0);
      addPart(root, new THREE.BoxGeometry(w + 0.02, 0.04, d + 0.02), ceramicMat, 0, cabH + 0.02, 0);
      [-w * 0.28, w * 0.28].forEach((sx) => {
        addPart(root, new THREE.CylinderGeometry(0.22, 0.18, 0.11, 20), ceramicMat, sx, cabH + 0.095, 0.02);
        addPart(root, new THREE.CylinderGeometry(0.015, 0.018, 0.18, 10), chromeMat, sx, cabH + 0.12, -d * 0.34);
        addPart(root, new THREE.CylinderGeometry(0.28, 0.28, 0.03, 24), chromeMat, sx, cabH + 0.58, -d * 0.42, Math.PI / 2, 0, 0);
      });
      break;
    }

    case 'laundry_hamper': {
      addPart(root, new THREE.BoxGeometry(w, h, d), primaryMat, 0, h / 2, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.42, h * 0.72, 0.03), accentMat, -w * 0.24, h * 0.44, d / 2 + 0.005);
      addPart(root, new THREE.BoxGeometry(w * 0.42, h * 0.72, 0.03), accentMat, w * 0.24, h * 0.44, d / 2 + 0.005);
      addPart(root, new THREE.BoxGeometry(w + 0.02, 0.04, d + 0.02), ceramicMat, 0, h + 0.02, 0);
      break;
    }

    case 'pergola_swing': {
      // A-frame wooden swing stand + hanging canopy bench
      const postGeo = new THREE.CylinderGeometry(0.04, 0.045, h, 10);
      [
        [-w * 0.46, -d * 0.38, -0.18],
        [-w * 0.46, d * 0.38, 0.18],
        [w * 0.46, -d * 0.38, -0.18],
        [w * 0.46, d * 0.38, 0.18],
      ].forEach(([px, pz, rx]) => addPart(root, postGeo, primaryMat, px, h / 2, pz, rx, 0, 0));
      addPart(root, new THREE.CylinderGeometry(0.04, 0.04, w, 10), primaryMat, 0, h - 0.05, 0, 0, 0, Math.PI / 2);
      // Canopy & bench seat
      addPart(root, new THREE.BoxGeometry(w * 0.96, 0.05, d * 0.85), accentMat, 0, h - 0.02, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.72, 0.12, d * 0.44), accentMat, 0, 0.46, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.72, 0.42, 0.08), accentMat, 0, 0.7, -d * 0.2);
      addPart(root, new THREE.CylinderGeometry(0.01, 0.01, h - 0.55, 8), darkMetalMat, -w * 0.34, (h + 0.46) / 2, 0);
      addPart(root, new THREE.CylinderGeometry(0.01, 0.01, h - 0.55, 8), darkMetalMat, w * 0.34, (h + 0.46) / 2, 0);
      break;
    }

    case 'islamic_screen': {
      // Ornamental Mashrabiya wooden divider frame + geometric lattice
      addPart(root, new THREE.BoxGeometry(w, 0.06, d), primaryMat, 0, 0.03, 0);
      addPart(root, new THREE.BoxGeometry(w, 0.06, d), primaryMat, 0, h - 0.03, 0);
      addPart(root, new THREE.BoxGeometry(0.06, h, d), primaryMat, -w / 2 + 0.03, h / 2, 0);
      addPart(root, new THREE.BoxGeometry(0.06, h, d), primaryMat, w / 2 - 0.03, h / 2, 0);
      for (let i = -2; i <= 2; i++) {
        addPart(root, new THREE.BoxGeometry(0.03, h - 0.12, d * 0.5), accentMat, i * (w * 0.18), h / 2, 0);
      }
      for (let r = 1; r <= 4; r++) {
        addPart(root, new THREE.BoxGeometry(w - 0.12, 0.03, d * 0.5), accentMat, 0, (r * h) / 5, 0);
      }
      break;
    }

    case 'algerian_sedari': {
      // Carved wood plinth + thick padded mattress + back pillows + cylindrical bolsters (Mkhadda)
      addPart(root, new THREE.BoxGeometry(w, 0.18, d), accentMat, 0, 0.09, 0);
      addPart(root, new THREE.BoxGeometry(w - 0.08, 0.22, d * 0.88), primaryMat, 0, 0.29, 0.02);
      // Carved armrests
      addPart(root, new THREE.BoxGeometry(0.1, 0.52, d), accentMat, -w / 2 + 0.05, 0.26, 0);
      addPart(root, new THREE.BoxGeometry(0.1, 0.52, d), accentMat, w / 2 - 0.05, 0.26, 0);
      // Back cushions
      const cushCount = 4;
      const cw = (w - 0.26) / cushCount;
      for (let i = 0; i < cushCount; i++) {
        const cx = -w / 2 + 0.13 + cw * (i + 0.5);
        addPart(root, new THREE.BoxGeometry(cw - 0.03, 0.34, 0.18), primaryMat, cx, 0.56, -d * 0.32, -0.14);
      }
      // Cylindrical side bolsters
      addPart(root, new THREE.CylinderGeometry(0.1, 0.1, d * 0.68, 16), accentMat, -w / 2 + 0.22, 0.48, 0.04, Math.PI / 2);
      addPart(root, new THREE.CylinderGeometry(0.1, 0.1, d * 0.68, 16), accentMat, w / 2 - 0.22, 0.48, 0.04, Math.PI / 2);
      break;
    }

    case 'brass_tea_table': {
      // Traditional Algerian Mida: carved wooden cross legs + engraved brass tray top
      const r = Math.min(w, d) / 2;
      addPart(root, new THREE.CylinderGeometry(r, r * 0.96, 0.03, 28), brassMat, 0, h - 0.015, 0);
      addPart(root, new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.02, 28), primaryMat, 0, h - 0.035, 0);
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3;
        addPart(root, new THREE.CylinderGeometry(0.022, 0.016, h - 0.04, 10), primaryMat, Math.cos(ang) * r * 0.62, (h - 0.04) / 2, Math.sin(ang) * r * 0.62);
      }
      // Brass teapot & tray centerpiece
      addPart(root, new THREE.CylinderGeometry(0.09, 0.12, 0.16, 16), brassMat, 0, h + 0.08, 0);
      addPart(root, new THREE.SphereGeometry(0.04, 12, 12), brassMat, 0, h + 0.17, 0);
      break;
    }

    case 'privacy_partition': {
      // Three-panel folding privacy screen (Paravent) for Algerian home vestibule & salon separation
      const panelW = w / 3;
      [-1, 0, 1].forEach((idx) => {
        const angle = idx === 0 ? 0 : idx * 0.18;
        const px = idx * (panelW * 0.96);
        const pz = idx === 0 ? 0 : 0.06;
        addPart(root, new THREE.BoxGeometry(panelW - 0.02, h, 0.04), primaryMat, px, h / 2, pz, 0, angle, 0);
        addPart(root, new THREE.BoxGeometry(panelW - 0.14, h * 0.68, 0.05), glassMat, px, h * 0.56, pz, 0, angle, 0, false);
      });
      break;
    }

    case 'hallway_coat_bench': {
      // Entryway shoe bench + backrest hooks + mirror
      addPart(root, new THREE.BoxGeometry(w, 0.44, d), primaryMat, 0, 0.22, 0);
      addPart(root, new THREE.BoxGeometry(w - 0.04, 0.08, d - 0.04), accentMat, 0, 0.48, 0);
      addPart(root, new THREE.BoxGeometry(w, h - 0.52, 0.06), primaryMat, 0, 0.52 + (h - 0.52) / 2, -d / 2 + 0.03);
      addPart(root, new THREE.BoxGeometry(w * 0.42, 0.72, 0.025), chromeMat, -w * 0.22, 1.32, -d / 2 + 0.065);
      for (let i = 0; i < 3; i++) {
        addPart(root, new THREE.CylinderGeometry(0.014, 0.014, 0.07, 8), brassMat, w * 0.1 + i * 0.15, 1.48, -d / 2 + 0.08, Math.PI / 2);
      }
      break;
    }

    case 'prayer_corner': {
      // Prayer rug (Sajada) + wooden Quran stand (Rehal) + small Islamic bookshelf
      addPart(root, new THREE.BoxGeometry(w * 0.72, 0.02, d * 0.92), accentMat, -w * 0.12, 0.01, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.54, 0.024, d * 0.72), primaryMat, -w * 0.12, 0.014, 0);
      // Small wooden shelf beside rug
      addPart(root, new THREE.BoxGeometry(0.36, h, 0.34), primaryMat, w * 0.34, h / 2, -d * 0.24);
      addPart(root, new THREE.BoxGeometry(0.28, 0.04, 0.22), accentMat, w * 0.34, h + 0.02, -d * 0.24);
      break;
    }

    case 'underbed_storage_bed': {
      // Deep storage box base + mattress + pillows + upholstered headboard
      addPart(root, new THREE.BoxGeometry(w, 0.34, d * 0.94), accentMat, 0, 0.17, 0.03);
      addPart(root, new THREE.BoxGeometry(w * 0.96, 0.22, d * 0.9), ceramicMat, 0, 0.45, 0.04);
      addPart(root, new THREE.BoxGeometry(w + 0.04, h, 0.12), primaryMat, 0, h / 2, -d / 2 + 0.06);
      addPart(root, new THREE.BoxGeometry(w * 0.97, 0.16, d * 0.6), primaryMat, 0, 0.54, d * 0.18);
      addPart(root, new THREE.BoxGeometry(w * 0.36, 0.1, 0.34), ceramicMat, -w * 0.23, 0.61, -d * 0.28);
      addPart(root, new THREE.BoxGeometry(w * 0.36, 0.1, 0.34), ceramicMat, w * 0.23, 0.61, -d * 0.28);
      break;
    }

    case 'sliding_wardrobe_mirror': {
      addPart(root, new THREE.BoxGeometry(w, h, d), primaryMat, 0, h / 2, 0);
      // Two sliding doors, right half full mirror
      addPart(root, new THREE.BoxGeometry(w * 0.48, h - 0.1, 0.03), accentMat, -w * 0.245, h / 2, d / 2 + 0.005);
      addPart(root, new THREE.BoxGeometry(w * 0.48, h - 0.1, 0.035), chromeMat, w * 0.245, h / 2, d / 2 + 0.01);
      addPart(root, new THREE.BoxGeometry(0.02, h - 0.1, 0.04), darkMetalMat, 0, h / 2, d / 2 + 0.015);
      break;
    }

    case 'couscous_prep_counter': {
      // Sturdy wood base + thick white marble slab + traditional wooden/ceramic kneading bowl (Gasaa)
      addPart(root, new THREE.BoxGeometry(w, h - 0.06, d), primaryMat, 0, (h - 0.06) / 2, 0);
      addPart(root, new THREE.BoxGeometry(w + 0.04, 0.06, d + 0.04), ceramicMat, 0, h - 0.03, 0);
      addPart(root, new THREE.CylinderGeometry(0.24, 0.14, 0.12, 22), makeMat('#C59B6D', 0.65, 0.05), -w * 0.2, h + 0.06, 0);
      addPart(root, new THREE.CylinderGeometry(0.025, 0.025, 0.38, 12), accentMat, w * 0.22, h + 0.025, 0.06, 0, 0.3, Math.PI / 2);
      break;
    }

    case 'freezer_chest': {
      addPart(root, new THREE.BoxGeometry(w, h - 0.06, d), ceramicMat, 0, (h - 0.06) / 2, 0);
      addPart(root, new THREE.BoxGeometry(w + 0.01, 0.06, d + 0.01), makeMat('#E2E8F0', 0.25, 0.15), 0, h - 0.03, 0);
      addPart(root, new THREE.BoxGeometry(0.24, 0.03, 0.04), darkMetalMat, 0, h - 0.04, d / 2 + 0.02);
      addPart(root, new THREE.BoxGeometry(0.14, 0.06, 0.02), makeMat('#16A34A', 0.3, 0.2), w * 0.35, 0.14, d / 2 + 0.01);
      break;
    }

    case 'gas_oven_5burner': {
      addPart(root, new THREE.BoxGeometry(w, h - 0.04, d), chromeMat, 0, (h - 0.04) / 2, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.84, h * 0.45, 0.03), darkMetalMat, 0, h * 0.36, d / 2 + 0.01);
      addPart(root, new THREE.CylinderGeometry(0.012, 0.012, w * 0.72, 10), chromeMat, 0, h * 0.62, d / 2 + 0.04, 0, 0, Math.PI / 2);
      // 5 burners on top
      [
        [0, 0],
        [-w * 0.3, -d * 0.24],
        [w * 0.3, -d * 0.24],
        [-w * 0.3, d * 0.24],
        [w * 0.3, d * 0.24],
      ].forEach(([bx, bz]) => {
        addPart(root, new THREE.CylinderGeometry(0.065, 0.075, 0.025, 16), darkMetalMat, bx, h - 0.015, bz);
      });
      break;
    }

    case 'gas_heater_algerian': {
      addPart(root, new THREE.BoxGeometry(w, h, d), primaryMat, 0, h / 2, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.72, h * 0.56, 0.04), darkMetalMat, 0, h * 0.48, d / 2 + 0.005);
      addPart(root, new THREE.BoxGeometry(w * 0.56, h * 0.2, 0.045), makeMat('#F97316', 0.4, 0.1), 0, h * 0.42, d / 2 + 0.01);
      break;
    }

    case 'water_tank_pump': {
      const r = Math.min(w, d) * 0.44;
      // Vertical cylindrical blue/slate water cistern + side booster pump
      addPart(root, new THREE.CylinderGeometry(r, r, h * 0.88, 24), primaryMat, -w * 0.06, h * 0.44, 0);
      addPart(root, new THREE.CylinderGeometry(r * 0.9, r * 0.9, 0.06, 20), accentMat, -w * 0.06, h * 0.91, 0);
      addPart(root, new THREE.CylinderGeometry(0.14, 0.14, 0.26, 14), brassMat, w * 0.36, 0.16, 0, 0, 0, Math.PI / 2);
      break;
    }

    case 'ablution_station': {
      // Low ceramic ablution basin + seated marble/wood stool + low chrome faucet
      addPart(root, new THREE.BoxGeometry(w * 0.54, 0.48, d * 0.8), ceramicMat, -w * 0.2, 0.24, 0);
      addPart(root, new THREE.CylinderGeometry(0.16, 0.14, 0.1, 18), chromeMat, -w * 0.2, 0.5, 0.04);
      addPart(root, new THREE.CylinderGeometry(0.014, 0.016, 0.22, 10), chromeMat, -w * 0.2, 0.58, -d * 0.24);
      // Seated bench
      addPart(root, new THREE.BoxGeometry(w * 0.38, 0.34, d * 0.68), accentMat, w * 0.28, 0.17, 0);
      break;
    }

    case 'turkish_hammam_bench': {
      // Marble heated seat + sculpted stone kurna basin + brass taps
      addPart(root, new THREE.BoxGeometry(w * 0.65, 0.45, d), ceramicMat, -w * 0.16, 0.225, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.32, h, d * 0.68), primaryMat, w * 0.32, h / 2, -d * 0.12);
      addPart(root, new THREE.CylinderGeometry(0.18, 0.14, 0.18, 20), ceramicMat, w * 0.32, h + 0.05, -d * 0.12);
      addPart(root, new THREE.CylinderGeometry(0.015, 0.015, 0.18, 10), brassMat, w * 0.32, h + 0.22, -d * 0.32);
      break;
    }

    case 'outdoor_bbq_grill': {
      // Stone hearth base + side prep counter + firebox + chimney hood
      addPart(root, new THREE.BoxGeometry(w, 0.84, d), primaryMat, 0, 0.42, 0);
      addPart(root, new THREE.BoxGeometry(w + 0.04, 0.05, d + 0.04), ceramicMat, 0, 0.865, 0);
      addPart(root, new THREE.BoxGeometry(w * 0.56, 0.45, d * 0.85), darkMetalMat, -w * 0.18, 1.12, -0.02);
      addPart(root, new THREE.CylinderGeometry(0.16, 0.36, 0.48, 4), primaryMat, -w * 0.18, 1.58, -0.02, 0, Math.PI / 4, 0);
      break;
    }

    case 'courtyard_fountain': {
      // Octagonal Zellige basin + central tiered pedestal + water plane
      const r = Math.min(w, d) / 2;
      addPart(root, new THREE.CylinderGeometry(r, r * 1.04, 0.38, 8), primaryMat, 0, 0.19, 0);
      addPart(root, new THREE.CylinderGeometry(r * 0.86, r * 0.86, 0.04, 8), makeMat('#38BDF8', 0.1, 0.1), 0, 0.35, 0);
      addPart(root, new THREE.CylinderGeometry(0.12, 0.18, h * 0.65, 16), ceramicMat, 0, h * 0.48, 0);
      addPart(root, new THREE.CylinderGeometry(0.28, 0.12, 0.12, 16), brassMat, 0, h * 0.82, 0);
      break;
    }
  }

  // Selection outline ring if currently selected in studio
  if (isSelected) {
    const ringGeo = new THREE.RingGeometry(Math.max(w, d) * 0.55, Math.max(w, d) * 0.6, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x2563eb,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.014;
    root.add(ring);
  }

  return root;
}
