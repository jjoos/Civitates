import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadBuildings } from './buildings';
import './style.css';

const app = document.getElementById('app')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10151a);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  1,
  30000,
);
camera.position.set(1800, 1500, 1800);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
app.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.maxDistance = 15000;

scene.add(new THREE.HemisphereLight(0xddeeff, 0x22201c, 1.2));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.2);
sun.position.set(4000, 6000, 2000);
scene.add(sun);

const land = new THREE.Mesh(
  new THREE.PlaneGeometry(12000, 12000),
  new THREE.MeshStandardMaterial({ color: 0x5c6b52 }),
);
land.rotation.x = -Math.PI / 2;
land.position.y = -0.1;
scene.add(land);

const grid = new THREE.GridHelper(12000, 60, 0x333333, 0x222222);
scene.add(grid);

const yearSlider = document.getElementById('year-slider') as HTMLInputElement;
const yearLabel = document.getElementById('year-label') as HTMLElement;

const loadingLabel = document.createElement('div');
loadingLabel.id = 'loading';
loadingLabel.textContent = 'Loading buildings…';
document.body.appendChild(loadingLabel);

loadBuildings(scene, `${import.meta.env.BASE_URL}data/hoorn-bag.json`).then(({ setYear, center }) => {
  loadingLabel.remove();
  controls.target.set(center.x, 0, center.y);
  camera.position.set(center.x + 1800, 1500, center.y + 1800);
  land.position.set(center.x, -0.1, center.y);
  grid.position.set(center.x, 0, center.y);

  setYear(Number(yearSlider.value));
  yearSlider.addEventListener('input', () => {
    yearLabel.textContent = yearSlider.value;
    setYear(Number(yearSlider.value));
  });
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
