import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { loadBuildings } from './buildings';
import { loadBasemap } from './basemap';
import { loadHistoricHouses } from './historic';
import { dataUrl } from './data-manifest';
import './style.css';

const app = document.getElementById('app')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10151a);

// near/far ratio drives depth precision. minDistance is 20, so a 1 m near
// plane bought nothing and cost precision - close-up facades z-fought.
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  8,
  24000,
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

const historic = loadHistoricHouses(scene, dataUrl(import.meta.env.BASE_URL, 'hoorn-historic-houses.json'))
  .catch(() => ({ setYear: () => {}, count: 0, centre: null }));

loadBuildings(scene, dataUrl(import.meta.env.BASE_URL, 'hoorn-bag.json')).then(async ({ setYear, center }) => {
  loadingLabel.remove();
  const hist = await historic;
  controls.target.set(center.x, 0, center.y);
  camera.position.set(center.x + 1800, 1500, center.y + 1800);
  backdrop.position.set(center.x, -0.15, center.y);

  const apply = (y: number) => { setYear(y); hist.setYear(y); };
  apply(Number(yearSlider.value));
  yearSlider.addEventListener('input', () => {
    yearLabel.textContent = yearSlider.value;
    apply(Number(yearSlider.value));
  });

  // The reconstructed houses are a handful of ~4 m frontages in a 12 km-wide
  // scene, so they are impossible to find by panning. Make the note fly there.
  if (hist.count && hist.centre) {
    const note = document.createElement('button');
    note.id = 'historic-note';
    note.textContent = `${hist.count} houses reconstructed from Blaeu 1649 — show me`;
    note.addEventListener('click', () => {
      const { x, y } = hist.centre!;
      controls.target.set(x, 0, y);
      camera.position.set(x + 55, 45, y + 55);
      yearSlider.value = '1649';
      yearLabel.textContent = '1649';
      apply(1649);
    });
    document.body.appendChild(note);
  }
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
