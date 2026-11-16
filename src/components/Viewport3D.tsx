import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  Footprints,
  Moon,
  Sun,
  Sunset,
} from 'lucide-react';
import { buildFurnitureGroup } from '../three/furnitureBuilder';
import { getFloorTexture, getGroundLawnTexture } from '../three/textures';
import {
  CameraPreset,
  FloorPlanData,
  LightingMood,
  Opening,
  SelectionTarget,
  Wall,
} from '../types/planner';

interface Viewport3DProps {
  floorPlan: FloorPlanData;
  selection: SelectionTarget;
  onSelect: (target: SelectionTarget) => void;
  isDarkTheme: boolean;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => {
          if (m.map && !m.map.userData?.cached) m.map.dispose();
          m.dispose();
        });
      } else if (child.material) {
        if (child.material.map && !child.material.map.userData?.cached) {
          // textures from textureCache are reused across rebuilds
        }
        child.material.dispose();
      }
    }
  });
}

function buildWallWithOpenings(
  wall: Wall,
  wallOpenings: Opening[],
  effectiveHeight: number,
  isSoftwareGl: boolean,
  isSelected: boolean
): THREE.Group {
  const group = new THREE.Group();
  const dx = wall.x2 - wall.x1;
  const dz = wall.z2 - wall.z1;
  const length = Math.hypot(dx, dz);
  if (length < 0.05) return group;

  const angle = Math.atan2(dz, dx);
  const cx = (wall.x1 + wall.x2) / 2;
  const cz = (wall.z1 + wall.z2) / 2;

  group.position.set(cx, 0, cz);
  group.rotation.y = -angle;
  group.userData = { kind: 'wall', wallId: wall.id };

  const wallColor = isSelected ? '#93C5FD' : wall.color || '#F5F2EB';
  const wallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(wallColor),
    roughness: 0.86,
    metalness: 0.02,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4A3728'),
    roughness: 0.45,
    metalness: 0.08,
  });
  const frameDarkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1E293B'),
    roughness: 0.35,
    metalness: 0.6,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdbeafe,
    roughness: 0.05,
    metalness: 0.0,
    transmission: isSoftwareGl ? 0 : 0.88,
    transparent: true,
    opacity: isSoftwareGl ? 0.36 : 0.9,
    ior: 1.5,
  });

  const thick = wall.thickness || 0.16;
  const h = Math.min(wall.height || 2.8, effectiveHeight);

  // Sort openings along the wall [-length/2, +length/2]
  const intervals = wallOpenings
    .map((op) => {
      const center = (op.offsetRatio - 0.5) * length;
      const halfW = Math.min(op.width / 2, length * 0.44);
      const start = Math.max(-length / 2 + 0.06, center - halfW);
      const end = Math.min(length / 2 - 0.06, center + halfW);
      return { op, start, end };
    })
    .filter((i) => i.end > i.start + 0.1)
    .sort((a, b) => a.start - b.start);

  let cursor = -length / 2;

  const addWallBox = (segStart: number, segEnd: number, yBottom: number, yTop: number) => {
    const segLen = segEnd - segStart;
    const segH = yTop - yBottom;
    if (segLen <= 0.01 || segH <= 0.01) return;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(segLen, segH, thick), wallMat);
    mesh.position.set((segStart + segEnd) / 2, yBottom + segH / 2, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { kind: 'wall', wallId: wall.id };
    group.add(mesh);
  };

  for (const { op, start, end } of intervals) {
    if (start > cursor) {
      addWallBox(cursor, start, 0, h);
    }
    const opW = end - start;
    const opCenterX = (start + end) / 2;
    const sill = op.type === 'window' ? Math.min(op.sillHeight, h - 0.2) : 0;
    const opTop = Math.min(h, sill + op.height);

    // Sill below window
    if (sill > 0.02) {
      addWallBox(start, end, 0, sill);
    }
    // Lintel above door/window
    if (h > opTop + 0.02) {
      addWallBox(start, end, opTop, h);
    }

    // 3D Architectural Door or Window assembly
    if (op.type === 'door' && opTop > 0.3) {
      const doorH = opTop;
      // Door jambs
      const jambGeo = new THREE.BoxGeometry(0.05, doorH, thick + 0.03);
      const leftJamb = new THREE.Mesh(jambGeo, trimMat);
      leftJamb.position.set(start + 0.025, doorH / 2, 0);
      group.add(leftJamb);
      const rightJamb = new THREE.Mesh(jambGeo, trimMat);
      rightJamb.position.set(end - 0.025, doorH / 2, 0);
      group.add(rightJamb);
      const topJamb = new THREE.Mesh(
        new THREE.BoxGeometry(opW, 0.05, thick + 0.03),
        trimMat
      );
      topJamb.position.set(opCenterX, doorH - 0.025, 0);
      group.add(topJamb);

      // Door leaf slightly ajar (28 deg) for architectural depth
      const leafW = Math.max(0.2, opW - 0.1);
      const leafPivot = new THREE.Group();
      leafPivot.position.set(start + 0.05, 0, 0);
      leafPivot.rotation.y = op.swing === 'out' ? 0.45 : -0.45;
      const leafMesh = new THREE.Mesh(
        new THREE.BoxGeometry(leafW, doorH - 0.05, 0.045),
        new THREE.MeshStandardMaterial({ color: '#8C6239', roughness: 0.52, metalness: 0.05 })
      );
      leafMesh.position.set(leafW / 2, (doorH - 0.05) / 2, 0);
      leafMesh.castShadow = true;
      leafPivot.add(leafMesh);
      // Brass handle
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.025, 0.09),
        new THREE.MeshStandardMaterial({ color: '#D4AF37', roughness: 0.2, metalness: 0.9 })
      );
      handle.position.set(leafW - 0.1, 1.0, 0);
      leafPivot.add(handle);
      group.add(leafPivot);
    } else if (op.type === 'window' && opTop > sill + 0.15) {
      const winH = opTop - sill;
      const winMidY = sill + winH / 2;
      // Aluminum outer frame
      const frameThick = thick + 0.02;
      const topBar = new THREE.Mesh(new THREE.BoxGeometry(opW, 0.045, frameThick), frameDarkMat);
      topBar.position.set(opCenterX, opTop - 0.022, 0);
      group.add(topBar);
      const botBar = new THREE.Mesh(new THREE.BoxGeometry(opW, 0.05, frameThick + 0.03), frameDarkMat);
      botBar.position.set(opCenterX, sill + 0.025, 0);
      group.add(botBar);
      const leftBar = new THREE.Mesh(new THREE.BoxGeometry(0.045, winH, frameThick), frameDarkMat);
      leftBar.position.set(start + 0.022, winMidY, 0);
      group.add(leftBar);
      const rightBar = new THREE.Mesh(new THREE.BoxGeometry(0.045, winH, frameThick), frameDarkMat);
      rightBar.position.set(end - 0.022, winMidY, 0);
      group.add(rightBar);
      // Center mullion
      if (opW > 1.1) {
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.035, winH, frameThick * 0.8), frameDarkMat);
        mullion.position.set(opCenterX, winMidY, 0);
        group.add(mullion);
      }
      // Glass pane
      const glassPane = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.1, opW - 0.08), Math.max(0.1, winH - 0.08), 0.018),
        glassMat
      );
      glassPane.position.set(opCenterX, winMidY, 0);
      group.add(glassPane);
    }

    cursor = end;
  }

  if (cursor < length / 2) {
    addWallBox(cursor, length / 2, 0, h);
  }

  return group;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  floorPlan,
  selection,
  onSelect,
  isDarkTheme,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('perspective');
  const [mood, setMood] = useState<LightingMood>('daylight');
  const [wallScale, setWallScale] = useState<number>(1);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Refs bridging React state into the persistent Three.js loop without re-mounting WebGL
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const cameraPresetRef = useRef(cameraPreset);
  cameraPresetRef.current = cameraPreset;
  const activeWalkBtnRef = useRef<'fwd' | 'back' | 'left' | 'right' | null>(null);
  const walkBtnRafRef = useRef<number>(0);

  const sceneRefs = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    houseGroup: THREE.Group;
    sunLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
    rimLight: THREE.DirectionalLight;
    eveningPointLight: THREE.PointLight;
    isSoftwareGl: boolean;
    requestRender: () => void;
    transitionTarget: { pos: THREE.Vector3; look: THREE.Vector3 } | null;
  } | null>(null);

  const stepWalkDirection = (dir: 'fwd' | 'back' | 'left' | 'right') => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const speed = 0.14;
    refs.camera.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();
    _right.crossVectors(_forward, refs.camera.up).normalize();

    _vec3A.set(0, 0, 0);
    if (dir === 'fwd') _vec3A.add(_forward);
    if (dir === 'back') _vec3A.sub(_forward);
    if (dir === 'right') _vec3A.add(_right);
    if (dir === 'left') _vec3A.sub(_right);

    if (_vec3A.lengthSq() > 0) {
      _vec3A.normalize().multiplyScalar(speed);
      refs.camera.position.add(_vec3A);
      refs.controls.target.add(_vec3A);
      refs.transitionTarget = null;
      refs.requestRender();
    }
  };

  const startTouchWalk = (dir: 'fwd' | 'back' | 'left' | 'right') => {
    activeWalkBtnRef.current = dir;
    if (walkBtnRafRef.current) cancelAnimationFrame(walkBtnRafRef.current);
    const loop = () => {
      if (!activeWalkBtnRef.current) {
        walkBtnRafRef.current = 0;
        return;
      }
      stepWalkDirection(activeWalkBtnRef.current);
      walkBtnRafRef.current = requestAnimationFrame(loop);
    };
    loop();
  };

  const stopTouchWalk = () => {
    activeWalkBtnRef.current = null;
    if (walkBtnRafRef.current) {
      cancelAnimationFrame(walkBtnRafRef.current);
      walkBtnRafRef.current = 0;
    }
  };

  // Keyboard shortcut H to collapse HUD + WASD walkthrough controls
  useEffect(() => {
    const keys = new Set<string>();
    let walkAnim = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'h') {
        setDockCollapsed((prev) => !prev);
      }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        keys.add(e.code);
        if (!walkAnim) stepWalk();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };

    const stepWalk = () => {
      const refs = sceneRefs.current;
      if (!refs || keys.size === 0) {
        walkAnim = 0;
        return;
      }
      const speed = 0.14;
      refs.camera.getWorldDirection(_forward);
      _forward.y = 0;
      _forward.normalize();
      _right.crossVectors(_forward, refs.camera.up).normalize();

      _vec3A.set(0, 0, 0);
      if (keys.has('KeyW') || keys.has('ArrowUp')) _vec3A.add(_forward);
      if (keys.has('KeyS') || keys.has('ArrowDown')) _vec3A.sub(_forward);
      if (keys.has('KeyD') || keys.has('ArrowRight')) _vec3A.add(_right);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) _vec3A.sub(_right);

      if (_vec3A.lengthSq() > 0) {
        _vec3A.normalize().multiplyScalar(speed);
        refs.camera.position.add(_vec3A);
        refs.controls.target.add(_vec3A);
        refs.transitionTarget = null;
        refs.requestRender();
      }
      walkAnim = requestAnimationFrame(stepWalk);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (walkAnim) cancelAnimationFrame(walkAnim);
    };
  }, []);

  // Initialize WebGL once on mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('تعذر تشغيل محرك العرض ثلاثي الأبعاد (WebGL) في هذا المتصفح.');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initBg = isDarkTheme ? 0x161a20 : 0xeef2f6;
    scene.background = new THREE.Color(initBg);
    scene.fog = new THREE.FogExp2(initBg, 0.011);

    // Mandatory procedural RoomEnvironment for PBR reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      46,
      (container.clientWidth || 800) / (container.clientHeight || 600),
      0.1,
      200
    );
    camera.position.set(11, 10, 12);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 1.2;
    controls.maxDistance = 48;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controls.target.set(0, 0.8, 0);

    // 3-Point Architectural Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x94a3b8, 0.72);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.55);
    sunLight.position.set(12, 18, 10);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 55;
    const d = 14;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xe0f2fe, 0.45);
    rimLight.position.set(-14, 10, -12);
    scene.add(rimLight);

    const eveningPointLight = new THREE.PointLight(0xffcf87, 0, 18, 1.4);
    eveningPointLight.position.set(0, 2.3, 0);
    scene.add(eveningPointLight);

    // Ground site perimeter (grounded outdoor garden/architectural terrace, never an empty void)
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const groundTex = getGroundLawnTexture(maxAniso);
    const groundGeo = new THREE.PlaneGeometry(140, 140);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.94,
      metalness: 0.0,
    });
    const groundPlane = new THREE.Mesh(groundGeo, groundMat);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -0.065;
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);

    const houseGroup = new THREE.Group();
    scene.add(houseGroup);

    // On-demand rendering with software-WebGL afterDraw fence pacing
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((now) => {
        renderDirty = false;
        const delta = Math.min(0.1, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        const refs = sceneRefs.current;
        let stillTransitioning = false;
        if (refs && refs.transitionTarget) {
          const { pos, look } = refs.transitionTarget;
          const lambda = 7.5;
          camera.position.x = THREE.MathUtils.damp(camera.position.x, pos.x, lambda, delta);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, pos.y, lambda, delta);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, pos.z, lambda, delta);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, look.x, lambda, delta);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, look.y, lambda, delta);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, look.z, lambda, delta);

          if (camera.position.distanceTo(pos) < 0.05 && controls.target.distanceTo(look) < 0.05) {
            camera.position.copy(pos);
            controls.target.copy(look);
            refs.transitionTarget = null;
          } else {
            stillTransitioning = true;
          }
        }

        const needsDamp = controls.update();
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || stillTransitioning || (needsDamp && !isSoftwareGl)) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    controls.addEventListener('change', requestRender);
    controls.addEventListener('start', () => {
      if (sceneRefs.current) {
        sceneRefs.current.transitionTarget = null;
      }
    });

    // Raycast click-to-select 3D objects
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(houseGroup.children, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && obj !== houseGroup) {
          if (obj.userData?.kind === 'furniture' && obj.userData.furnitureId) {
            onSelectRef.current({ kind: 'furniture', id: obj.userData.furnitureId });
            return;
          }
          if (obj.userData?.kind === 'wall' && obj.userData.wallId) {
            onSelectRef.current({ kind: 'wall', id: obj.userData.wallId });
            return;
          }
          if (obj.userData?.kind === 'room' && obj.userData.roomId) {
            onSelectRef.current({ kind: 'room', id: obj.userData.roomId });
            return;
          }
          obj = obj.parent;
        }
      }
      onSelectRef.current(null);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('تم تعليق سياق العرض ثلاثي الأبعاد مؤقتاً.');
    };
    const onContextRestored = () => {
      setWebglError(null);
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(100, container.clientWidth);
      const h = Math.max(100, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    });
    resizeObserver.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    sceneRefs.current = {
      renderer,
      scene,
      camera,
      controls,
      houseGroup,
      sunLight,
      hemiLight,
      rimLight,
      eveningPointLight,
      isSoftwareGl,
      requestRender,
      transitionTarget: null,
    };

    requestRender();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      disposeObject3D(scene);
      renderer.dispose();
      sceneRefs.current = null;
    };
  }, []);

  // Rebuild 3D architectural geometry whenever floorPlan, selection, or wallScale changes
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const { houseGroup, renderer, isSoftwareGl, requestRender } = refs;

    while (houseGroup.children.length > 0) {
      const child = houseGroup.children[0];
      houseGroup.remove(child);
      disposeObject3D(child);
    }

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // 1. Rooms (Floors + Architectural Baseboard Plinth)
    floorPlan.rooms.forEach((room) => {
      const slabGeo = new THREE.BoxGeometry(room.width, 0.06, room.depth);
      const tex = getFloorTexture(room.floorStyle, room.width, room.depth, maxAniso);
      const isSelected = selection?.kind === 'room' && selection.id === room.id;
      const slabMat = new THREE.MeshStandardMaterial({
        map: tex,
        color: isSelected ? new THREE.Color('#DBEAFE') : new THREE.Color('#FFFFFF'),
        roughness: room.floorStyle === 'marble' ? 0.28 : 0.68,
        metalness: 0.04,
      });
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.set(room.x + room.width / 2, -0.03, room.z + room.depth / 2);
      slab.receiveShadow = true;
      slab.userData = { kind: 'room', roomId: room.id };
      houseGroup.add(slab);
    });

    // 2. Walls & Openings
    const effectiveH = Math.max(0.45, floorPlan.wallHeight * wallScale);
    floorPlan.walls.forEach((wall) => {
      const wallOpenings = floorPlan.openings.filter((o) => o.wallId === wall.id);
      const isSelected = selection?.kind === 'wall' && selection.id === wall.id;
      const wallGroup = buildWallWithOpenings(
        wall,
        wallOpenings,
        effectiveH,
        isSoftwareGl,
        isSelected
      );
      houseGroup.add(wallGroup);
    });

    // 3. Furniture & Fixtures (3-12 part composite groups)
    floorPlan.furniture.forEach((item) => {
      const isSelected = selection?.kind === 'furniture' && selection.id === item.id;
      const group = buildFurnitureGroup(item, isSoftwareGl, isSelected);
      houseGroup.add(group);
    });

    requestRender();
  }, [floorPlan, selection, wallScale]);

  // Update Lighting Mood & Theme
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const { scene, sunLight, hemiLight, rimLight, eveningPointLight, requestRender } = refs;

    if (mood === 'daylight') {
      const bg = isDarkTheme ? 0x161c24 : 0xeef2f6;
      scene.background = new THREE.Color(bg);
      scene.fog = new THREE.FogExp2(bg, 0.011);
      sunLight.color.setHex(0xfff4e0);
      sunLight.intensity = 1.55;
      sunLight.position.set(12, 18, 10);
      hemiLight.color.setHex(0xdbeafe);
      hemiLight.groundColor.setHex(0x94a3b8);
      hemiLight.intensity = 0.72;
      rimLight.intensity = 0.45;
      eveningPointLight.intensity = 0;
    } else if (mood === 'golden') {
      const bg = isDarkTheme ? 0x1e1918 : 0xf5ebe0;
      scene.background = new THREE.Color(bg);
      scene.fog = new THREE.FogExp2(bg, 0.013);
      sunLight.color.setHex(0xffb56b);
      sunLight.intensity = 1.75;
      sunLight.position.set(18, 7, 14);
      hemiLight.color.setHex(0xfde68a);
      hemiLight.groundColor.setHex(0x78716c);
      hemiLight.intensity = 0.58;
      rimLight.intensity = 0.35;
      eveningPointLight.intensity = 1.5;
    } else {
      const bg = 0x0f172a;
      scene.background = new THREE.Color(bg);
      scene.fog = new THREE.FogExp2(bg, 0.016);
      sunLight.color.setHex(0x93c5fd);
      sunLight.intensity = 0.42;
      sunLight.position.set(-10, 14, -8);
      hemiLight.color.setHex(0x334155);
      hemiLight.groundColor.setHex(0x0f172a);
      hemiLight.intensity = 0.45;
      rimLight.intensity = 0.25;
      eveningPointLight.intensity = 14;
    }

    requestRender();
  }, [mood, isDarkTheme]);

  // Apply Camera Preset Transitions
  const applyCameraPreset = (preset: CameraPreset) => {
    setCameraPreset(preset);
    const refs = sceneRefs.current;
    if (!refs) return;

    // Compute floor plan bounding center
    let minX = -4, maxX = 4, minZ = -4, maxZ = 4;
    if (floorPlan.rooms.length > 0) {
      minX = Math.min(...floorPlan.rooms.map((r) => r.x));
      maxX = Math.max(...floorPlan.rooms.map((r) => r.x + r.width));
      minZ = Math.min(...floorPlan.rooms.map((r) => r.z));
      maxZ = Math.max(...floorPlan.rooms.map((r) => r.z + r.depth));
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const span = Math.max(8, maxX - minX, maxZ - minZ);

    if (preset === 'perspective') {
      refs.transitionTarget = {
        pos: new THREE.Vector3(cx + span * 0.85, span * 0.72, cz + span * 0.9),
        look: new THREE.Vector3(cx, 0.8, cz),
      };
    } else if (preset === 'isometric') {
      refs.transitionTarget = {
        pos: new THREE.Vector3(cx + span * 1.15, span * 1.05, cz + span * 1.15),
        look: new THREE.Vector3(cx, 0.4, cz),
      };
    } else if (preset === 'top') {
      refs.transitionTarget = {
        pos: new THREE.Vector3(cx, span * 1.45, cz + 0.01),
        look: new THREE.Vector3(cx, 0, cz),
      };
    } else if (preset === 'walkthrough') {
      refs.transitionTarget = {
        pos: new THREE.Vector3(cx, 1.65, cz + span * 0.25),
        look: new THREE.Vector3(cx, 1.5, cz - 2),
      };
    }
    refs.requestRender();
  };

  const handleSnapshot = () => {
    const refs = sceneRefs.current;
    if (!refs) return;
    refs.renderer.render(refs.scene, refs.camera);
    const dataUrl = refs.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `bachir-5d-render-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#EEF2F6] dark:bg-[#161A20]">
      {/* Isolated WebGL Mount Container */}
      <div
        ref={mountRef}
        className="w-full h-full touch-none cursor-grab active:cursor-grabbing"
      />

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-6 text-center">
          <div className="max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{webglError}</p>
          </div>
        </div>
      )}

      {/* Minimal Walkthrough Hint when in walkthrough mode */}
      {cameraPreset === 'walkthrough' && (
        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 max-w-[92vw] text-center z-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm">
          <span className="hidden md:inline">
            استخدم مفاتيح WASD أو الأسهم للتجول داخل المنزل، واسحب الفأرة للالتفاف
          </span>
          <span className="md:hidden">
            اسحب بإصبعك للالتفاف واستخدم أزرار المشي للتنقل
          </span>
        </div>
      )}

      {/* Touch Walkthrough Directional Pad (for phones/tablets) */}
      {cameraPreset === 'walkthrough' && (
        <div
          className="lg:hidden absolute right-3 bottom-24 z-20 grid grid-cols-3 gap-1 w-28 select-none"
          aria-label="أزرار التجول داخل النموذج"
        >
          <div />
          <button
            type="button"
            onPointerDown={() => startTouchWalk('fwd')}
            onPointerUp={stopTouchWalk}
            onPointerLeave={stopTouchWalk}
            onPointerCancel={stopTouchWalk}
            aria-label="التقدم للأمام"
            className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 flex items-center justify-center shadow-sm active:bg-blue-600 active:text-white touch-none"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <div />
          <button
            type="button"
            onPointerDown={() => startTouchWalk('right')}
            onPointerUp={stopTouchWalk}
            onPointerLeave={stopTouchWalk}
            onPointerCancel={stopTouchWalk}
            aria-label="تحرك يمين"
            className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 flex items-center justify-center shadow-sm active:bg-blue-600 active:text-white touch-none"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onPointerDown={() => startTouchWalk('back')}
            onPointerUp={stopTouchWalk}
            onPointerLeave={stopTouchWalk}
            onPointerCancel={stopTouchWalk}
            aria-label="التراجع للخلف"
            className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 flex items-center justify-center shadow-sm active:bg-blue-600 active:text-white touch-none"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onPointerDown={() => startTouchWalk('left')}
            onPointerUp={stopTouchWalk}
            onPointerLeave={stopTouchWalk}
            onPointerCancel={stopTouchWalk}
            aria-label="تحرك يسار"
            className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 flex items-center justify-center shadow-sm active:bg-blue-600 active:text-white touch-none"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion, No backdrop-blur over WebGL) */}
      <div className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center w-auto max-w-[96vw]">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="mb-1.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-3 py-1.5 sm:py-1 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          title="اختصار لوحة المفاتيح: H"
        >
          {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{dockCollapsed ? 'إظهار أدوات المشهد' : 'إخفاء الأدوات'}</span>
        </button>

        {!dockCollapsed && (
          <div className="w-full overflow-x-auto no-scrollbar rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-lg">
            <div className="flex items-center justify-start sm:justify-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-2 min-w-max">
              {/* Camera Presets */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => applyCameraPreset('perspective')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    cameraPreset === 'perspective'
                      ? 'bg-white dark:bg-slate-950 text-blue-700 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>منظور</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyCameraPreset('isometric')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    cameraPreset === 'isometric'
                      ? 'bg-white dark:bg-slate-950 text-blue-700 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>إيزومتري</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyCameraPreset('walkthrough')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    cameraPreset === 'walkthrough'
                      ? 'bg-white dark:bg-slate-950 text-blue-700 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Footprints className="w-3.5 h-3.5" />
                  <span>جولة داخلية</span>
                </button>
              </div>

              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 shrink-0" />

              {/* Lighting Moods */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => setMood('daylight')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    mood === 'daylight'
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>نهار</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMood('golden')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    mood === 'golden'
                      ? 'bg-white dark:bg-slate-950 text-amber-700 dark:text-amber-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Sunset className="w-3.5 h-3.5" />
                  <span>غروب</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMood('evening')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    mood === 'evening'
                      ? 'bg-white dark:bg-slate-950 text-indigo-700 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>مساء</span>
                </button>
              </div>

              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 shrink-0" />

              {/* Wall Cutaway Slider */}
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
                <span>الجدران</span>
                <input
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={wallScale}
                  onChange={(e) => setWallScale(Number(e.target.value))}
                  className="w-20 accent-blue-600 cursor-pointer"
                />
              </label>

              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 shrink-0" />

              {/* Render Snapshot Button */}
              <button
                type="button"
                onClick={handleSnapshot}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>التقاط 3D</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
