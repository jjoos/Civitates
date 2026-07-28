import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { layer, TIME_FILTER_GLSL } from './palette';

interface HistoricBlock {
  id: string;
  source: string;
  attested_from: number;
  attested_to: number | null;
  height: number;
  tint: number;
  /** outer ring in local scene coords */
  ring: number[][];
}

interface BlockData {
  sources: Array<{ id: string; year: number; block_count: number }>;
  assumptions: Record<string, unknown>;
  blocks: HistoricBlock[];
}

/**
 * City-wide massing extracted from a georeferenced Topotijdreis sheet.
 *
 * The coarse end of the project's "mixed" fidelity, and the opposite end from
 * the Blaeu houses: here the FOOTPRINTS are trustworthy (the sheet is
 * published georeferenced, nothing was fitted) and the HEIGHTS are invented.
 * With the Blaeu houses it is the other way round. Hence the separate colour.
 */
export async function loadHistoricBlocks(
  scene: THREE.Scene,
  dataUrl: string,
): Promise<{
  setYear: (year: number) => void;
  setVisible: (on: boolean) => void;
  count: number;
  years: number[];
  centre: THREE.Vector2 | null;
}> {
  const data: BlockData = await (await fetch(dataUrl)).json();
  if (!data.blocks.length) return { setYear: () => {}, setVisible: () => {}, count: 0, years: [], centre: null };

  const geometries: THREE.BufferGeometry[] = [];
  // Camera target = the centroid of the LARGEST block. Neither a plain nor an
  // area-weighted centroid works here: the blocks span the whole 12 km
  // municipality and most of them are outlying farms, so both land in open
  // country. On this sheet the historic core comes out as one contiguous mass
  // of 25 ha — bigger than anything else by an order of magnitude — so
  // "largest block" is reliably "the town".
  let best = { area: 0, x: 0, z: 0 };
  for (const b of data.blocks) {
    if (b.ring.length < 3) continue;
    let a2 = 0, cx = 0, cz = 0;
    for (let i = 0, j = b.ring.length - 1; i < b.ring.length; j = i++) {
      const cross = b.ring[j][0] * b.ring[i][1] - b.ring[i][0] * b.ring[j][1];
      a2 += cross;
      cx += (b.ring[j][0] + b.ring[i][0]) * cross;
      cz += (b.ring[j][1] + b.ring[i][1]) * cross;
    }
    const area = Math.abs(a2) / 2;
    if (a2 !== 0 && area > best.area) {
      best = { area, x: cx / (3 * a2), z: cz / (3 * a2) };
    }
  }

  for (const b of data.blocks) {
    if (b.ring.length < 3) continue;
    // ExtrudeGeometry works in the XY plane and rotateX(-90deg) then maps a
    // shape point (x, y) to world (x, ., -y) — so negate here, exactly as
    // buildings.ts does, or the whole layer comes out mirrored in Z.
    const shape = new THREE.Shape(b.ring.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geom = new THREE.ExtrudeGeometry(shape, { depth: b.height, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    geom.deleteAttribute('uv');

    const n = geom.attributes.position.count;
    geom.setAttribute('aFrom', new THREE.BufferAttribute(new Float32Array(n).fill(b.attested_from), 1));
    geom.setAttribute('aTo', new THREE.BufferAttribute(new Float32Array(n).fill(b.attested_to ?? 9999), 1));
    geom.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(n).fill(b.tint), 1));
    geometries.push(geom);
  }
  if (!geometries.length) return { setYear: () => {}, setVisible: () => {}, count: 0, years: [], centre: null };

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uYear: { value: 1880 },
      uColor: { value: layer('topoRaster').color.clone() },
      uLightDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    },
    vertexShader: /* glsl */ `
      attribute float aFrom;
      attribute float aTo;
      attribute float aTint;
      varying float vFrom;
      varying float vTo;
      varying float vTint;
      varying vec3 vNormal;
      void main() {
        vFrom = aFrom;
        vTo = aTo;
        vTint = aTint;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: TIME_FILTER_GLSL + /* glsl */ `
      uniform float uYear;
      uniform vec3 uColor;
      uniform vec3 uLightDir;
      varying float vFrom;
      varying float vTo;
      varying float vTint;
      varying vec3 vNormal;
      void main() {
        if (uYear < vFrom) discard;              // nothing before the sheet's survey
        vec3 base = applyAttestation(uColor * (0.80 + 0.36 * vTint), uYear, vFrom, vTo);
        float diffuse = max(dot(normalize(vNormal), uLightDir), 0.0);
        gl_FragColor = vec4(base * (0.45 + 0.55 * diffuse), 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(mergeGeometries(geometries, false), material);
  scene.add(mesh);

  return {
    setVisible: (on: boolean) => { mesh.visible = on; },
    count: data.blocks.length,
    years: data.sources.map((s) => s.year),
    centre: best.area > 0 ? new THREE.Vector2(best.x, best.z) : null,
    setYear: (year: number) => {
      material.uniforms.uYear.value = year;
    },
  };
}
