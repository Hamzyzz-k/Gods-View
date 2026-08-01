import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AppState } from "./state.js";

// Builds the renderer, camera, controls and lighting, and stores them on
// AppState. This is the only module that constructs these singletons.
export function initScene() {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    5000
  );
  camera.position.set(0, 60, 140);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 3;
  controls.maxDistance = 800;
  controls.zoomSpeed = 4.5; // higher = more sensitive scroll/pinch zoom

  // ---------- lighting ----------
  const sunLight = new THREE.PointLight(0xffffff, 3.2, 0, 0);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  const ambient = new THREE.AmbientLight(0x222233, 0.6);
  scene.add(ambient);

  AppState.scene = scene;
  AppState.camera = camera;
  AppState.renderer = renderer;
  AppState.controls = controls;
  AppState.sunLight = sunLight;
  AppState.ambient = ambient;

  return AppState;
}
