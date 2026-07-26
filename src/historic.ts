import * as THREE from 'three';

interface HistoricHouse {
  id: string;
  street: string;
  attested_from: number;
  attested_to: number | null;
  facade_m: number;
  eaves: number;
  ridge: number;
  tint?: number;
  position_confidence: 'located' | 'approximate';
  /** front-left, front-right, back-right, back-left — in local scene coords */
  quad: number[][];
}

interface HistoricData {
  sources: string[];
  assumptions: Record<string, unknown>;
  houses: HistoricHouse[];
}

type V3 = [number, number, number];

/**
 * Houses reconstructed from historical maps. Rendered alongside the BAG
 * buildings but deliberately distinct: they are evidence, not survey data.
 *
 * Each is a gabled house rather than a flat box. Blaeu draws them that way,
 * and it matters practically — neighbours in a terrace touch exactly, so a
 * row of flat boxes renders as one featureless mass. The sawtooth roofline is
 * what makes the individual houses read.
 */
export async function loadHistoricHouses(
  scene: THREE.Scene,
  dataUrl: string,
): Promise<{ setYear: (year: number) => void; count: number; centre: THREE.Vector2 | null }> {
  const data: HistoricData = await (await fetch(dataUrl)).json();
  if (!data.houses.length) return { setYear: () => {}, count: 0, centre: null };

  const pos: number[] = [];
  const nrm: number[] = [];
  const from: number[] = [];
  const to: number[] = [];
  const tint: number[] = [];

  const tri = (a: V3, b: V3, c: V3, h: HistoricHouse) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const p of [a, b, c]) {
      pos.push(p[0], p[1], p[2]);
      nrm.push(nx, ny, nz);
      from.push(h.attested_from);
      to.push(h.attested_to ?? 9999);
      tint.push(h.tint ?? 0.5);
    }
  };
  const quadFace = (a: V3, b: V3, c: V3, d: V3, h: HistoricHouse) => {
    tri(a, b, c, h);
    tri(a, c, d, h);
  };

  let sumX = 0, sumZ = 0, nPts = 0;
  for (const h of data.houses) {
    const [fl, fr, br, bl] = h.quad;          // front-left, front-right, back-right, back-left
    const e = h.eaves;
    const r = h.ridge;
    const at = (p: number[], y: number): V3 => [p[0], y, p[1]];
    // ridge runs front-to-back, so the gable end faces the street
    const apexF: V3 = [(fl[0] + fr[0]) / 2, r, (fl[1] + fr[1]) / 2];
    const apexB: V3 = [(bl[0] + br[0]) / 2, r, (bl[1] + br[1]) / 2];

    quadFace(at(fl, 0), at(fr, 0), at(fr, e), at(fl, e), h);   // street facade
    quadFace(at(br, 0), at(bl, 0), at(bl, e), at(br, e), h);   // rear
    quadFace(at(fr, 0), at(br, 0), at(br, e), at(fr, e), h);   // right party wall
    quadFace(at(bl, 0), at(fl, 0), at(fl, e), at(bl, e), h);   // left party wall
    tri(at(fl, e), at(fr, e), apexF, h);                       // front gable
    tri(at(br, e), at(bl, e), apexB, h);                       // rear gable
    quadFace(at(fr, e), at(br, e), apexB, apexF, h);           // roof plane
    quadFace(at(bl, e), at(fl, e), apexF, apexB, h);           // roof plane

    for (const p of h.quad) { sumX += p[0]; sumZ += p[1]; nPts++; }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geom.setAttribute('aFrom', new THREE.Float32BufferAttribute(from, 1));
  geom.setAttribute('aTo', new THREE.Float32BufferAttribute(to, 1));
  geom.setAttribute('aTint', new THREE.Float32BufferAttribute(tint, 1));

  const material = new THREE.ShaderMaterial({
    // faces are built by hand; render both sides so a winding slip shows as a
    // shading oddity rather than a hole
    side: THREE.DoubleSide,
    uniforms: {
      uYear: { value: 1649 },
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
    fragmentShader: /* glsl */ `
      uniform float uYear;
      uniform vec3 uLightDir;
      varying float vFrom;
      varying float vTo;
      varying float vTint;
      varying vec3 vNormal;
      void main() {
        if (uYear < vFrom || uYear > vTo) discard;
        // warm brick, clearly not the BAG palette; tint varies per house so
        // adjacent houses in a terrace stay individually legible
        vec3 base = vec3(0.78, 0.36, 0.20) * (0.80 + 0.36 * vTint);
        float diffuse = abs(dot(normalize(vNormal), uLightDir));
        gl_FragColor = vec4(base * (0.45 + 0.55 * diffuse), 1.0);
      }
    `,
  });

  scene.add(new THREE.Mesh(geom, material));

  return {
    count: data.houses.length,
    centre: new THREE.Vector2(sumX / nPts, sumZ / nPts),
    setYear: (year: number) => {
      material.uniforms.uYear.value = year;
    },
  };
}
