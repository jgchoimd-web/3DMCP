# 3DMCP

3DMCP is a Model Context Protocol (MCP) server that creates STL files for 3D printing from simple parametric solids.

The server exposes a `create_stl` tool over stdio. It can generate ASCII STL meshes for boxes, cylinders, spheres, cones or frustums, and torus shapes. Multiple solids can be written into one STL file.

## Requirements

- Node.js 20 or newer
- npm

## Install

```bash
npm install
npm run build
```

## MCP Client Configuration

Use the built server as a stdio MCP server:

```json
{
  "mcpServers": {
    "3dmcp": {
      "command": "node",
      "args": ["/absolute/path/to/3DMCP/dist/index.js"],
      "cwd": "/absolute/path/to/3DMCP"
    }
  }
}
```

On Windows, use escaped backslashes or forward slashes:

```json
{
  "mcpServers": {
    "3dmcp": {
      "command": "node",
      "args": ["C:/Users/Administrator/Documents/3DMCP/dist/index.js"],
      "cwd": "C:/Users/Administrator/Documents/3DMCP"
    }
  }
}
```

## Tools

### create_stl

Creates an STL file and returns the generated file path, file URI, byte length, triangle count, units, and mesh bounds.

Input fields:

- `fileName`: output file name. `.stl` is added when omitted.
- `outputDir`: output directory. Relative paths are resolved from the server process `cwd`.
- `overwrite`: when `false`, an available numeric suffix is added instead of overwriting.
- `solidName`: STL solid name.
- `units`: `mm`, `cm`, `m`, or `in`.
- `solids`: one or more parametric solids.

Supported solid types:

- `box`: `size: [width, depth, height]`
- `cylinder`: `radius`, `height`, optional `segments`
- `sphere`: `radius`, optional `segments`, optional `rings`
- `cone`: `radiusBottom`, `radiusTop`, `height`, optional `segments`
- `torus`: `majorRadius`, `tubeRadius`, optional `radialSegments`, optional `tubeSegments`

Every solid can also include:

- `name`
- `position: [x, y, z]`
- `rotation: [xDegrees, yDegrees, zDegrees]`

The coordinate system is Z-up. Primitive meshes are centered at the origin before `position` is applied.

Example `create_stl` call:

```json
{
  "fileName": "calibration-cube.stl",
  "outputDir": "generated",
  "overwrite": false,
  "solidName": "calibration_cube",
  "units": "mm",
  "solids": [
    {
      "type": "box",
      "size": [20, 20, 20],
      "position": [0, 0, 10]
    }
  ]
}
```

Example with multiple solids:

```json
{
  "fileName": "stacked-toy.stl",
  "outputDir": "generated",
  "overwrite": false,
  "solidName": "stacked_toy",
  "units": "mm",
  "solids": [
    {
      "type": "cylinder",
      "radius": 22,
      "height": 8,
      "segments": 96,
      "position": [0, 0, 4]
    },
    {
      "type": "sphere",
      "radius": 12,
      "segments": 64,
      "rings": 32,
      "position": [0, 0, 22]
    }
  ]
}
```

### stl_examples

Returns sample `create_stl` inputs for common starter objects.

## Development

```bash
npm run build
npm test
```

Run the server directly:

```bash
npm start
```

For live TypeScript execution during development:

```bash
npm run dev
```

## Notes

3DMCP writes ASCII STL files. It combines multiple solids by placing their triangle meshes into one STL file; it does not perform boolean union, subtraction, smoothing, or mesh repair. For best slicer results, avoid heavily overlapping solids unless your slicer can merge them.
