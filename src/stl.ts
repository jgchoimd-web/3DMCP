import { normalForTriangle, type Triangle } from "./geometry.js";

export function writeAsciiStl(solidName: string, triangles: Triangle[]): string {
  const safeSolidName = sanitizeSolidName(solidName);
  const lines = [`solid ${safeSolidName}`];

  for (const triangle of triangles) {
    const normal = normalForTriangle(triangle);

    lines.push(
      `  facet normal ${formatNumber(normal[0])} ${formatNumber(normal[1])} ${formatNumber(normal[2])}`,
      "    outer loop",
      `      vertex ${formatVertex(triangle[0])}`,
      `      vertex ${formatVertex(triangle[1])}`,
      `      vertex ${formatVertex(triangle[2])}`,
      "    endloop",
      "  endfacet"
    );
  }

  lines.push(`endsolid ${safeSolidName}`);
  return `${lines.join("\n")}\n`;
}

function formatVertex(vertex: Triangle[number]): string {
  return `${formatNumber(vertex[0])} ${formatNumber(vertex[1])} ${formatNumber(vertex[2])}`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot write non-finite STL coordinate: ${value}`);
  }

  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function sanitizeSolidName(name: string): string {
  return name.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 80) || "model";
}
