import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMesh, getBounds } from "./geometry.js";
import { writeAsciiStl } from "./stl.js";
import type { Solid } from "./schemas.js";

describe("geometry", () => {
  it("creates a watertight box mesh", () => {
    const solids: Solid[] = [
      {
        type: "box",
        size: [20, 10, 4]
      }
    ];

    const triangles = buildMesh(solids);
    const bounds = getBounds(triangles);

    assert.equal(triangles.length, 12);
    assert.deepEqual(bounds.min, [-10, -5, -2]);
    assert.deepEqual(bounds.max, [10, 5, 2]);
    assert.deepEqual(bounds.size, [20, 10, 4]);
  });

  it("creates a capped cylinder mesh", () => {
    const solids: Solid[] = [
      {
        type: "cylinder",
        radius: 5,
        height: 10,
        segments: 12
      }
    ];

    assert.equal(buildMesh(solids).length, 48);
  });

  it("writes ASCII STL facets", () => {
    const stl = writeAsciiStl("test shape", buildMesh([{ type: "box", size: [1, 1, 1] }]));

    assert.match(stl, /^solid test_shape/);
    assert.match(stl, /facet normal/);
    assert.match(stl, /endsolid test_shape\n$/);
  });
});
