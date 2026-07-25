import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';

const app = document.getElementById('app')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10151a);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  10000,
);
camera.position.set(300, 250, 300);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
app.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xddeeff, 0x22201c, 1.2));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.2);
sun.position.set(400, 600, 200);
scene.add(sun);

// Placeholder land outline, roughly sized to the historic core of Hoorn.
// Real footprint data will replace this in a later phase.
const land = new THREE.Mesh(
  new THREE.PlaneGeometry(1000, 1000),
  new THREE.MeshStandardMaterial({ color: 0x5c6b52 }),
);
land.rotation.x = -Math.PI / 2;
scene.add(land);

const harbor = new THREE.Mesh(
  new THREE.PlaneGeometry(260, 180),
  new THREE.MeshStandardMaterial({ color: 0x2c4a63 }),
);
harbor.rotation.x = -Math.PI / 2;
harbor.position.set(280, 0.1, 0);
scene.add(harbor);

scene.add(new THREE.GridHelper(1000, 40, 0x333333, 0x222222));

const yearSlider = document.getElementById('year-slider') as HTMLInputElement;
const yearLabel = document.getElementById('year-label') as HTMLElement;
yearSlider.addEventListener('input', () => {
  yearLabel.textContent = yearSlider.value;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
