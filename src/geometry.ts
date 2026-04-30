import type { Solid, Vec3 } from "./schemas.js";

export type Triangle = [Vec3, Vec3, Vec3];

export interface Bounds {
  min: Vec3;
  max: Vec3;
  size: Vec3;
}

const EPSILON = 1e-9;

export function buildMesh(solids: Solid[]): Triangle[] {
  const triangles = solids.flatMap((solid) => transformTriangles(buildSolidMesh(solid), solid));
  return triangles.filter((triangle) => vectorLength(rawNormal(triangle)) > EPSILON);
}

export function getBounds(triangles: Triangle[]): Bounds {
  if (triangles.length === 0) {
    throw new Error("Cannot calculate bounds for an empty mesh.");
  }

  const min: Vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: Vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

  for (const triangle of triangles) {
    for (const vertex of triangle) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], vertex[axis]);
        max[axis] = Math.max(max[axis], vertex[axis]);
      }
    }
  }

  return {
    min,
    max,
    size: subtract(max, min)
  };
}

export function normalForTriangle(triangle: Triangle): Vec3 {
  return normalize(rawNormal(triangle));
}

function buildSolidMesh(solid: Solid): Triangle[] {
  switch (solid.type) {
    case "box":
      return box(solid.size);
    case "cylinder":
      return cylinder(solid.radius, solid.height, solid.segments);
    case "sphere":
      return sphere(solid.radius, solid.segments, solid.rings);
    case "cone":
      return cone(solid.radiusBottom, solid.radiusTop, solid.height, solid.segments);
    case "torus":
      return torus(solid.majorRadius, solid.tubeRadius, solid.radialSegments, solid.tubeSegments);
  }
}

function transformTriangles(triangles: Triangle[], solid: Solid): Triangle[] {
  const rotation = solid.rotation ?? [0, 0, 0];
  const position = solid.position ?? [0, 0, 0];

  return triangles.map((triangle) => [
    transformVertex(triangle[0], rotation, position),
    transformVertex(triangle[1], rotation, position),
    transformVertex(triangle[2], rotation, position)
  ]);
}

function transformVertex(vertex: Vec3, rotationDegrees: Vec3, position: Vec3): Vec3 {
  const [rx, ry, rz] = rotationDegrees.map((degrees) => (degrees * Math.PI) / 180) as Vec3;
  const sinX = Math.sin(rx);
  const cosX = Math.cos(rx);
  const sinY = Math.sin(ry);
  const cosY = Math.cos(ry);
  const sinZ = Math.sin(rz);
  const cosZ = Math.cos(rz);

  let [x, y, z] = vertex;

  [y, z] = [y * cosX - z * sinX, y * sinX + z * cosX];
  [x, z] = [x * cosY + z * sinY, -x * sinY + z * cosY];
  [x, y] = [x * cosZ - y * sinZ, x * sinZ + y * cosZ];

  return [x + position[0], y + position[1], z + position[2]];
}

function box(size: Vec3): Triangle[] {
  const [width, depth, height] = size;
  const x = width / 2;
  const y = depth / 2;
  const z = height / 2;

  const nnn: Vec3 = [-x, -y, -z];
  const pnn: Vec3 = [x, -y, -z];
  const ppn: Vec3 = [x, y, -z];
  const npn: Vec3 = [-x, y, -z];
  const nnp: Vec3 = [-x, -y, z];
  const pnp: Vec3 = [x, -y, z];
  const ppp: Vec3 = [x, y, z];
  const npp: Vec3 = [-x, y, z];

  return [
    [nnp, pnp, ppp],
    [nnp, ppp, npp],
    [nnn, npn, ppn],
    [nnn, ppn, pnn],
    [pnn, ppn, ppp],
    [pnn, ppp, pnp],
    [nnn, nnp, npp],
    [nnn, npp, npn],
    [npn, npp, ppp],
    [npn, ppp, ppn],
    [nnn, pnn, pnp],
    [nnn, pnp, nnp]
  ];
}

function cylinder(radius: number, height: number, segments: number): Triangle[] {
  const triangles: Triangle[] = [];
  const bottomZ = -height / 2;
  const topZ = height / 2;
  const bottomCenter: Vec3 = [0, 0, bottomZ];
  const topCenter: Vec3 = [0, 0, topZ];

  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    const b1 = circlePoint(radius, index, segments, bottomZ);
    const b2 = circlePoint(radius, next, segments, bottomZ);
    const t1 = circlePoint(radius, index, segments, topZ);
    const t2 = circlePoint(radius, next, segments, topZ);

    triangles.push([b1, b2, t2], [b1, t2, t1], [topCenter, t1, t2], [bottomCenter, b2, b1]);
  }

  return triangles;
}

function cone(radiusBottom: number, radiusTop: number, height: number, segments: number): Triangle[] {
  const triangles: Triangle[] = [];
  const bottomZ = -height / 2;
  const topZ = height / 2;
  const bottomCenter: Vec3 = [0, 0, bottomZ];
  const topCenter: Vec3 = [0, 0, topZ];

  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    const b1 = circlePoint(radiusBottom, index, segments, bottomZ);
    const b2 = circlePoint(radiusBottom, next, segments, bottomZ);
    const t1 = circlePoint(radiusTop, index, segments, topZ);
    const t2 = circlePoint(radiusTop, next, segments, topZ);

    if (radiusBottom > 0 && radiusTop > 0) {
      triangles.push([b1, b2, t2], [b1, t2, t1]);
    } else if (radiusBottom > 0) {
      triangles.push([b1, b2, topCenter]);
    } else {
      triangles.push([bottomCenter, t2, t1]);
    }

    if (radiusTop > 0) {
      triangles.push([topCenter, t1, t2]);
    }

    if (radiusBottom > 0) {
      triangles.push([bottomCenter, b2, b1]);
    }
  }

  return triangles;
}

function sphere(radius: number, segments: number, rings: number): Triangle[] {
  const triangles: Triangle[] = [];

  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const nextSegment = (segment + 1) % segments;
      const p00 = spherePoint(radius, ring, segment, rings, segments);
      const p01 = spherePoint(radius, ring, nextSegment, rings, segments);
      const p10 = spherePoint(radius, ring + 1, segment, rings, segments);
      const p11 = spherePoint(radius, ring + 1, nextSegment, rings, segments);

      if (ring === 0) {
        triangles.push([p00, p10, p11]);
      } else if (ring === rings - 1) {
        triangles.push([p00, p10, p01]);
      } else {
        triangles.push([p00, p10, p11], [p00, p11, p01]);
      }
    }
  }

  return triangles;
}

function torus(
  majorRadius: number,
  tubeRadius: number,
  radialSegments: number,
  tubeSegments: number
): Triangle[] {
  const triangles: Triangle[] = [];

  for (let radial = 0; radial < radialSegments; radial += 1) {
    for (let tube = 0; tube < tubeSegments; tube += 1) {
      const nextRadial = (radial + 1) % radialSegments;
      const nextTube = (tube + 1) % tubeSegments;
      const p00 = torusPoint(majorRadius, tubeRadius, radial, tube, radialSegments, tubeSegments);
      const p10 = torusPoint(majorRadius, tubeRadius, nextRadial, tube, radialSegments, tubeSegments);
      const p11 = torusPoint(majorRadius, tubeRadius, nextRadial, nextTube, radialSegments, tubeSegments);
      const p01 = torusPoint(majorRadius, tubeRadius, radial, nextTube, radialSegments, tubeSegments);

      triangles.push([p00, p10, p11], [p00, p11, p01]);
    }
  }

  return triangles;
}

function circlePoint(radius: number, index: number, segments: number, z: number): Vec3 {
  const theta = (index / segments) * Math.PI * 2;
  return [radius * Math.cos(theta), radius * Math.sin(theta), z];
}

function spherePoint(radius: number, ring: number, segment: number, rings: number, segments: number): Vec3 {
  const phi = (ring / rings) * Math.PI;
  const theta = (segment / segments) * Math.PI * 2;
  const sinPhi = Math.sin(phi);

  return [
    radius * sinPhi * Math.cos(theta),
    radius * sinPhi * Math.sin(theta),
    radius * Math.cos(phi)
  ];
}

function torusPoint(
  majorRadius: number,
  tubeRadius: number,
  radial: number,
  tube: number,
  radialSegments: number,
  tubeSegments: number
): Vec3 {
  const u = (radial / radialSegments) * Math.PI * 2;
  const v = (tube / tubeSegments) * Math.PI * 2;
  const ringRadius = majorRadius + tubeRadius * Math.cos(v);

  return [
    ringRadius * Math.cos(u),
    ringRadius * Math.sin(u),
    tubeRadius * Math.sin(v)
  ];
}

function rawNormal(triangle: Triangle): Vec3 {
  return cross(subtract(triangle[1], triangle[0]), subtract(triangle[2], triangle[0]));
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function normalize(vector: Vec3): Vec3 {
  const length = vectorLength(vector);

  if (length <= EPSILON) {
    return [0, 0, 0];
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function vectorLength(vector: Vec3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}
