import * as THREE from 'three';

interface BasemapMeta {
  localMinX: number;
  localMaxX: number;
  localMinZ: number;
  localMaxZ: number;
}

export async function loadBasemap(scene: THREE.Scene, baseUrl: string): Promise<void> {
  const meta: BasemapMeta = await (await fetch(`${baseUrl}data/hoorn-basemap.json`)).json();
  const texture = await new THREE.TextureLoader().loadAsync(`${baseUrl}data/hoorn-basemap.jpg`);
  texture.colorSpace = THREE.SRGBColorSpace;

  const width = meta.localMaxX - meta.localMinX;
  const depth = meta.localMaxZ - meta.localMinZ;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ map: texture }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(
    (meta.localMinX + meta.localMaxX) / 2,
    -0.05,
    (meta.localMinZ + meta.localMaxZ) / 2,
  );
  scene.add(plane);
}
