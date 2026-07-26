import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { loadBuildings } from './buildings';
import { loadBasemap } from './basemap';
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

// MapControls: left-drag/one-finger to pan, right-drag/two-finger to orbit,
// scroll/pinch to zoom - feels like a map viewer rather than orbiting a
// single fixed point, which suits inspecting a spread-out city.
const controls = new MapControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.minDistance = 20;
controls.maxDistance = 15000;
controls.listenToKeyEvents(window);
controls.keyPanSpeed = 14;

scene.add(new THREE.HemisphereLight(0xddeeff, 0x22201c, 1.2));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.2);
sun.position.set(4000, 6000, 2000);
scene.add(sun);

// Plain backdrop behind the real basemap texture, for when panning goes
// beyond the map's edge - matches the basemap's own blank/background tone.
const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(20000, 20000),
  new THREE.MeshStandardMaterial({ color: 0xf2f1ea }),
);
backdrop.rotation.x = -Math.PI / 2;
backdrop.position.y = -0.15;
scene.add(backdrop);

loadBasemap(scene, import.meta.env.BASE_URL);

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
  backdrop.position.set(center.x, -0.15, center.y);

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
