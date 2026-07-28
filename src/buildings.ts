import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface BagData {
  originX: number;
  originY: number;
  buildings: Array<{ id: string; year: number | null; rings: number[][][] }>;
}

// No BAG record means we don't know the year; treat as always-there rather
// than hiding it, since these are backlog gaps in the dataset, not new builds.
const FALLBACK_YEAR = 1800;

function hashHeight(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 6 + (h % 8); // 6-14m, just enough variation to read as a city, not a slab
}

export async function loadBuildings(
  scene: THREE.Scene,
  dataUrl: string,
): Promise<{ setYear: (year: number) => void; setVisible: (on: boolean) => void; center: THREE.Vector2 }> {
  const data: BagData = await (await fetch(dataUrl)).json();

  const geometries: THREE.BufferGeometry[] = [];
  let sumX = 0;
  let sumZ = 0;
  let pointCount = 0;
  for (const b of data.buildings) {
    // geom.rotateX(-90deg) below maps a shape point (x, y) to world (x, ., -y),
    // so we negate here to keep world Z equal to the data's z coordinate.
    const [outer, ...holes] = b.rings;
    const shape = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const hole of holes) {
      shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
    }
    for (const [x, z] of outer) {
      sumX += x;
      sumZ += z;
      pointCount++;
    }

    const geom = new THREE.ExtrudeGeometry(shape, { depth: hashHeight(b.id), bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    geom.deleteAttribute('uv');

    const year = b.year ?? FALLBACK_YEAR;
    const count = geom.attributes.position.count;
    geom.setAttribute('aYear', new THREE.BufferAttribute(new Float32Array(count).fill(year), 1));
    geometries.push(geom);
  }
  const center = new THREE.Vector2(sumX / pointCount, sumZ / pointCount);

  const merged = mergeGeometries(geometries, false);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uYear: { value: 2026 },
      uLightDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    },
    vertexShader: /* glsl */ `
      attribute float aYear;
      varying float vYear;
      varying vec3 vNormal;
      void main() {
        vYear = aYear;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uYear;
      uniform vec3 uLightDir;
      varying float vYear;
      varying vec3 vNormal;
      void main() {
        if (vYear > uYear) discard;
        vec3 old = vec3(0.55, 0.42, 0.32);
        vec3 mid = vec3(0.62, 0.58, 0.52);
        vec3 modern = vec3(0.72, 0.74, 0.78);
        vec3 color = vYear < 1900.0
          ? old
          : mix(mid, modern, clamp((vYear - 1900.0) / 126.0, 0.0, 1.0));
        float diffuse = max(dot(vNormal, uLightDir), 0.0);
        vec3 lit = color * (0.45 + 0.55 * diffuse);
        gl_FragColor = vec4(lit, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(merged, material);
  scene.add(mesh);

  return {
    center,
    setVisible: (on: boolean) => { mesh.visible = on; },
    setYear: (year: number) => {
      material.uniforms.uYear.value = year;
    },
  };
}
