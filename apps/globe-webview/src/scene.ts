import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const GLOBE_GLB_URL = 'file:///android_asset/globe/globe.glb';
const GLOBE_TEXTURE_URL = 'file:///android_asset/globe/globe_texture.jpeg';
const GLOBE_SCALE = 5;

export interface SceneState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  globe: THREE.Group | null;
  /** Pre-scale local radius. World-space radius = globeLocalRadius × GLOBE_SCALE (5). */
  globeLocalRadius: number;
  targetCameraPos: THREE.Vector3 | null;
  isAnimatingCamera: boolean;
  onGlobeReady(cb: () => void): void;
  onAnimationFrame(cb: () => void): void;
}

export function showError(msg: string): void {
  const box = document.getElementById('error-box');
  if (box) {
    box.style.display = 'block';
    box.textContent = msg;
  }
}

export function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export function initScene(): SceneState {
  const width = window.innerWidth;
  const height = window.innerHeight;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 10;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.rotateSpeed = 1.2;
  controls.zoomSpeed = 1.0;

  const state: SceneState = {
    scene,
    camera,
    renderer,
    controls,
    globe: null,
    globeLocalRadius: 1.0,
    targetCameraPos: null,
    isAnimatingCamera: false,
    onGlobeReady: (cb) => globeReadyCallbacks.push(cb),
    onAnimationFrame: (cb) => animFrameCallbacks.push(cb),
  };

  const globeReadyCallbacks: Array<() => void> = [];
  const animFrameCallbacks: Array<() => void> = [];

  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load(
    GLOBE_TEXTURE_URL,
    (tex) => {
      tex.flipY = false;
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.x = 1;
      tex.offset.x = 0;
      tex.needsUpdate = true;
    },
    undefined,
    (e) => showError(`Texture load error: ${e}`),
  );

  const gltfLoader = new GLTFLoader();
  gltfLoader.load(
    GLOBE_GLB_URL,
    (gltf) => {
      const globe = gltf.scene;

      globe.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          (mesh.material as THREE.MeshStandardMaterial).map = texture;
          (mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
        }
      });

      globe.scale.set(GLOBE_SCALE, GLOBE_SCALE, GLOBE_SCALE);
      globe.position.set(0, 0, 0);
      scene.add(globe);

      // Auto-fit camera to globe bounds
      const box = new THREE.Box3().setFromObject(globe);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // Local radius is pre-scale; markers use this for LOCAL-space positioning
      state.globeLocalRadius = maxDim / 2 / GLOBE_SCALE;

      const fov = camera.fov * (Math.PI / 180);
      const camDist = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.5;

      controls.minDistance = camDist * 0.7;
      controls.maxDistance = camDist * 2.0;

      camera.position.set(0, 0, camDist);
      camera.near = camDist / 100;
      camera.far = camDist * 100;
      camera.updateProjectionMatrix();

      globe.position.sub(center);

      state.globe = globe;

      // Flush all queued ready callbacks
      for (const cb of globeReadyCallbacks) cb();
      // Future calls resolve immediately
      state.onGlobeReady = (cb) => cb();

      startAnimationLoop();
    },
    undefined,
    (error) => showError(`GLB load error: ${error}`),
  );

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  function startAnimationLoop() {
    function animate() {
      requestAnimationFrame(animate);
      controls.update();

      // Camera lerp animation (used by CAMERA_SET handler)
      if (state.isAnimatingCamera && state.targetCameraPos) {
        const curLen = camera.position.length();
        camera.position.lerp(state.targetCameraPos, 0.05);
        camera.position.setLength(curLen);

        if (camera.position.distanceTo(state.targetCameraPos) < 0.1) {
          camera.position.copy(state.targetCameraPos);
          state.isAnimatingCamera = false;
        }
      }

      for (const cb of animFrameCallbacks) cb();

      renderer.render(scene, camera);
    }
    animate();
  }

  return state;
}
