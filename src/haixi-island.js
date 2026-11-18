import * as THREE from 'three';
import { GLTFLoader } from './assets/GLTFLoader.js';
import { HAIXI_GLB_B64 } from './haixi-model.js';

export const HAIXI_ID = '632800';
export const HAIXI_LONLAT = [97.3708, 37.3747];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function b64ToGzipBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function inflateGzip(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    return Promise.resolve(bytes.buffer);
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

/**
 * Full-screen minimal Haixi viewer: rotate + zoom only.
 * Loads the Blender-authored GLB (cream base + 海西 plaque + lake/mountain/camp).
 */
export function createHaixiIsland(container) {
  const layer = document.createElement('div');
  layer.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
  layer.dataset.state = 'loading';
  container.appendChild(layer);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(layer.clientWidth || window.innerWidth, layer.clientHeight || window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
  layer.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);

  (function makeEnv() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#fff6e8');
    grd.addColorStop(0.45, '#f0e2c8');
    grd.addColorStop(1, '#8a7358');
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    pmrem.dispose();
  })();

  scene.add(new THREE.HemisphereLight(0xfff3e2, 0x7a6248, 0.95));
  const key = new THREE.DirectionalLight(0xfff0da, 2.2);
  key.position.set(-0.8, 1.4, 0.9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0005;
  key.shadow.radius = 2.5;
  const sc = key.shadow.camera;
  sc.left = -0.4;
  sc.right = 0.4;
  sc.top = 0.4;
  sc.bottom = -0.4;
  sc.near = 0.1;
  sc.far = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfeaff, 0.45);
  fill.position.set(1.1, 0.7, 0.4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffd9b0, 0.4);
  rim.position.set(0.2, 0.5, -1.1);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.ShadowMaterial({ opacity: 0.16 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.0005;
  ground.receiveShadow = true;
  scene.add(ground);

  let model = null;
  let modelSize = new THREE.Vector3(0.34, 0.22, 0.34);
  let target = new THREE.Vector3(0, 0.08, 0);
  let baseDist = 0.72;
  let az = 0.55;
  let el = 0.42;
  let zoom = 1;

  function fit() {
    const w = layer.clientWidth || window.innerWidth;
    const h = layer.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    const fov = camera.fov * Math.PI / 180;
    const fitH = (modelSize.y * 1.08) / (2 * Math.tan(fov / 2));
    const fitW = (Math.max(modelSize.x, modelSize.z) * 1.08) / (2 * Math.tan(fov / 2) * camera.aspect);
    baseDist = Math.max(fitH, fitW) * 1.55;
    applyCamera();
  }

  function applyCamera() {
    const dist = baseDist * zoom;
    const ce = Math.cos(el);
    camera.position.set(
      target.x + dist * ce * Math.sin(az),
      target.y + dist * Math.sin(el),
      target.z + dist * ce * Math.cos(az)
    );
    camera.lookAt(target);
  }

  function onLoaded(gltf) {
    model = gltf.scene;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
          m.envMapIntensity = 0.75;
          // Campfire glow
          if (m.name && /fire|glow/i.test(m.name)) {
            m.emissive = m.emissive || new THREE.Color(0xff6a28);
            m.emissiveIntensity = Math.max(m.emissiveIntensity || 0, 1.5);
          }
        });
      }
    });

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;
    modelSize.copy(size);
    target.set(0, size.y * 0.42, 0);
    scene.add(model);

    // Short-range campfire fill only (keep local, not scene-wide)
    const fire = new THREE.PointLight(0xff6a28, 0.35, 0.06, 2);
    fire.position.set(0.1, Math.max(0.04, size.y * 0.22), -0.1);
    model.add(fire);
    fire.name = 'FireLightRuntime';

    key.shadow.camera.updateProjectionMatrix();
    fit();
    layer.dataset.state = 'ready';
  }

  function loadModel() {
    const bytes = b64ToGzipBuffer(HAIXI_GLB_B64);
    inflateGzip(bytes).then((buffer) => {
      const loader = new GLTFLoader();
      loader.parse(buffer, '', onLoaded, (e) => {
        console.error(e);
        layer.dataset.state = 'error';
      });
    }).catch((e) => {
      console.error(e);
      layer.dataset.state = 'error';
    });
  }

  const canvas = renderer.domElement;
  const pointers = new Map();
  let drag = null;
  let pinch = null;

  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      drag = { x: e.clientX, y: e.clientY, az, el };
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    } else if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      pinch = { d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), z: zoom };
      drag = null;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const pts = Array.from(pointers.values());
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinch.d > 0) zoom = clamp(pinch.z * (d / pinch.d), 0.55, 2.4);
      applyCamera();
    } else if (drag) {
      az = drag.az - (e.clientX - drag.x) * 0.006;
      el = clamp(drag.el + (e.clientY - drag.y) * 0.005, 0.08, 1.3);
      applyCamera();
    }
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) drag = null;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom = clamp(zoom * Math.exp(e.deltaY * 0.0011), 0.55, 2.4);
    applyCamera();
  }, { passive: false });
  canvas.addEventListener('dblclick', () => {
    az = 0.55;
    el = 0.42;
    zoom = 1;
    fit();
  });

  window.addEventListener('resize', fit);

  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    t += 0.04;
    if (model) {
      const light = model.getObjectByName('FireLightRuntime');
      if (light) light.intensity = 0.25 + 0.12 * Math.sin(t * 2.7);
    }
    renderer.render(scene, camera);
  }

  loadModel();
  animate();

  return {
    layer,
    enter() {
      layer.dataset.state = layer.dataset.state === 'error' ? 'error' : 'ready';
    },
    resize: fit
  };
}
