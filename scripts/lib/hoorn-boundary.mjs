// Shared by every data-prep script that needs Hoorn's municipal boundary and
// the local scene origin, so different datasets stay aligned to each other.
const BOUNDARY_WFS = 'https://service.pdok.nl/kadaster/bestuurlijkegebieden/wfs/v1_0';
const GEMEENTE_CODE = '0405'; // Hoorn

export async function getHoornBoundary() {
  const url =
    `${BOUNDARY_WFS}?service=WFS&version=2.0.0&request=GetFeature` +
    `&typeName=bestuurlijkegebieden:Gemeentegebied&outputFormat=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const data = await res.json();
  const feature = data.features.find((f) => f.properties.code === GEMEENTE_CODE);
  if (!feature) throw new Error(`Gemeente code ${GEMEENTE_CODE} not found`);
  return feature.geometry; // MultiPolygon, EPSG:28992
}

export function bboxOfMultiPolygon(geom) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const polygon of geom.coordinates) {
    for (const ring of polygon) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return [minX, minY, maxX, maxY];
}

// Even-odd point-in-polygon test across every ring (outer + holes) of every
// polygon in the MultiPolygon; correct for holes regardless of ring winding.
export function isInsideMultiPolygon([x, y], multiPolygon) {
  for (const polygon of multiPolygon.coordinates) {
    let inside = false;
    for (const ring of polygon) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        const intersects =
          yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersects) inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

// The single shared local-coordinate origin: center of the municipality
// bbox. X stays RD-easting; Z is flipped RD-northing (north = -Z in the
// three.js scene once buildings.ts's extra negation is applied on top).
export function originOf(bbox) {
  return { originX: (bbox[0] + bbox[2]) / 2, originY: (bbox[1] + bbox[3]) / 2 };
}
