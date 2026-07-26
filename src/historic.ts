import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface HistoricHouse {
  id: string;
  street: string;
  attested_from: number;
  attested_to: number | null;
  facade_m: number;
  height: number;
  position_confidence: 'located' | 'approximate';
  ring: number[][];
}

interface HistoricData {
  sources: string[];
  assumptions: Record<string, unknown>;
  houses: HistoricHouse[];
}

/**
 * Houses reconstructed from historical maps, rendered alongside the BAG
 * buildings but deliberately distinct: they are evidence, not survey data.
 * Each is visible only while the slider sits inside the window the sources
 * actually attest, and rendered in a warm tone so it never reads as a
 * present-day footprint.
 */
export async function loadHistoricHouses(
  scene: THREE.Scene,
  dataUrl: string,
): Promise<{ setYear: (year: number) => void; count: number; centre: THREE.Vector2 | null }> {
  const data: HistoricData = await (await fetch(dataUrl)).json();
  if (!data.houses.length) return { setYear: () => {}, count: 0, centre: null };

  const geometries: THREE.BufferGeometry[] = [];
  let sumX = 0;
  let sumZ = 0;
  for (const h of data.houses) {
    // ring is [x, z] in local scene coords; the extrude/rotate pair below
    // flips the second axis, so negate it to keep world Z == data z.
    const shape = new THREE.Shape(h.ring.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geom = new THREE.ExtrudeGeometry(shape, { depth: h.height, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    geom.deleteAttribute('uv');

    const count = geom.attributes.position.count;
    const from = new Float32Array(count).fill(h.attested_from);
    const to = new Float32Array(count).fill(h.attested_to ?? 9999);
    geom.setAttribute('aFrom', new THREE.BufferAttribute(from, 1));
    geom.setAttribute('aTo', new THREE.BufferAttribute(to, 1));
    geometries.push(geom);

    for (const [x, z] of h.ring) { sumX += x; sumZ += z; }
  }
  const n = data.houses.reduce((a, h) => a + h.ring.length, 0);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uYear: { value: 1649 },
      uLightDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    },
    vertexShader: /* glsl */ `
      attribute float aFrom;
      attribute float aTo;
      varying float vFrom;
      varying float vTo;
      varying vec3 vNormal;
      void main() {
        vFrom = aFrom;
        vTo = aTo;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uYear;
      uniform vec3 uLightDir;
      varying float vFrom;
      varying float vTo;
      varying vec3 vNormal;
      void main() {
        if (uYear < vFrom || uYear > vTo) discard;
        vec3 base = vec3(0.78, 0.36, 0.20);   // warm brick, clearly not the BAG palette
        float diffuse = max(dot(vNormal, uLightDir), 0.0);
        gl_FragColor = vec4(base * (0.5 + 0.5 * diffuse), 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(mergeGeometries(geometries, false), material);
  scene.add(mesh);

  return {
    count: data.houses.length,
    centre: new THREE.Vector2(sumX / n, sumZ / n),
    setYear: (year: number) => {
      material.uniforms.uYear.value = year;
    },
  };
}
