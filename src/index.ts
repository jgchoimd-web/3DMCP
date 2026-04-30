#!/usr/bin/env node
import { access, mkdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildMesh, getBounds } from "./geometry.js";
import {
  CreateStlInputSchema,
  CreateStlOutputSchema,
  type CreateStlInput,
  type CreateStlOutput
} from "./schemas.js";
import { writeAsciiStl } from "./stl.js";

const MIME_TYPE = "model/stl" as const;

export async function createStlFile(input: CreateStlInput): Promise<CreateStlOutput> {
  const triangles = buildMesh(input.solids);

  if (triangles.length === 0) {
    throw new Error("No printable triangles were generated from the requested solids.");
  }

  const bounds = getBounds(triangles);
  const outputDir = resolveOutputDir(input.outputDir);
  const fileName = normalizeFileName(input.fileName);
  await mkdir(outputDir, { recursive: true });

  const requestedPath = resolve(outputDir, fileName);
  assertPathInside(outputDir, requestedPath);
  const { filePath, overwritten } = await resolveWritablePath(requestedPath, input.overwrite);
  const stl = writeAsciiStl(input.solidName, triangles);
  await writeFile(filePath, stl, "utf8");
  const fileStats = await stat(filePath);

  return {
    fileName: basename(filePath),
    filePath,
    uri: pathToFileURL(filePath).href,
    mimeType: MIME_TYPE,
    byteLength: fileStats.size,
    triangleCount: triangles.length,
    units: input.units,
    bounds,
    overwritten
  };
}

const server = new McpServer({
  name: "3dmcp",
  version: "0.1.0"
});

server.registerTool(
  "create_stl",
  {
    title: "Create STL",
    description:
      "Generate an ASCII STL file for 3D printing from parametric solids. Coordinates use Z-up orientation. Multiple solids are combined into one STL without boolean union.",
    inputSchema: CreateStlInputSchema,
    outputSchema: CreateStlOutputSchema
  },
  async (input) => {
    const result = await createStlFile(input);

    return {
      structuredContent: result,
      content: [
        {
          type: "text",
          text: `Created ${result.fileName} at ${result.filePath} with ${result.triangleCount} triangles.`
        },
        {
          type: "resource_link",
          uri: result.uri,
          name: result.fileName,
          mimeType: result.mimeType,
          description: "Generated 3D-printable STL file",
          size: result.byteLength
        }
      ]
    };
  }
);

server.registerTool(
  "stl_examples",
  {
    title: "STL Examples",
    description: "Return sample create_stl inputs for common 3D-printable shapes."
  },
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(getExamples(), null, 2)
      }
    ],
    structuredContent: {
      examples: getExamples()
    }
  })
);

function resolveOutputDir(outputDir: string): string {
  return isAbsolute(outputDir) ? resolve(outputDir) : resolve(process.cwd(), outputDir);
}

function normalizeFileName(fileName: string): string {
  const trimmed = fileName.trim();

  if (basename(trimmed) !== trimmed || trimmed.includes("/") || trimmed.includes("\\")) {
    throw new Error("fileName must be a simple file name, not a path.");
  }

  const withExtension = extname(trimmed).toLowerCase() === ".stl" ? trimmed : `${trimmed}.stl`;

  if (!/^[A-Za-z0-9._ -]+\.stl$/i.test(withExtension)) {
    throw new Error("fileName may contain only letters, numbers, spaces, dots, underscores, and hyphens.");
  }

  return withExtension;
}

async function resolveWritablePath(
  requestedPath: string,
  overwrite: boolean
): Promise<{ filePath: string; overwritten: boolean }> {
  if (overwrite) {
    return {
      filePath: requestedPath,
      overwritten: await pathExists(requestedPath)
    };
  }

  if (!(await pathExists(requestedPath))) {
    return {
      filePath: requestedPath,
      overwritten: false
    };
  }

  const directory = dirname(requestedPath);
  const extension = extname(requestedPath);
  const baseName = basename(requestedPath, extension);

  for (let index = 1; index <= 999; index += 1) {
    const candidate = resolve(directory, `${baseName}-${index}${extension}`);

    if (!(await pathExists(candidate))) {
      return {
        filePath: candidate,
        overwritten: false
      };
    }
  }

  throw new Error("Could not find an available output file name after 999 attempts.");
}

function assertPathInside(parentDir: string, childPath: string): void {
  const pathDifference = relative(parentDir, childPath);

  if (pathDifference.startsWith("..") || isAbsolute(pathDifference)) {
    throw new Error("Resolved output file path escaped the output directory.");
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function getExamples(): Record<string, CreateStlInput> {
  return {
    calibrationCube: {
      fileName: "calibration-cube.stl",
      outputDir: "generated",
      overwrite: false,
      solidName: "calibration_cube",
      units: "mm",
      solids: [
        {
          type: "box",
          size: [20, 20, 20],
          position: [0, 0, 10]
        }
      ]
    },
    simpleVaseBlank: {
      fileName: "vase-blank.stl",
      outputDir: "generated",
      overwrite: false,
      solidName: "vase_blank",
      units: "mm",
      solids: [
        {
          type: "cone",
          radiusBottom: 18,
          radiusTop: 26,
          height: 60,
          segments: 96,
          position: [0, 0, 30]
        }
      ]
    },
    stackedToy: {
      fileName: "stacked-toy.stl",
      outputDir: "generated",
      overwrite: false,
      solidName: "stacked_toy",
      units: "mm",
      solids: [
        {
          type: "cylinder",
          radius: 22,
          height: 8,
          segments: 96,
          position: [0, 0, 4]
        },
        {
          type: "sphere",
          radius: 12,
          segments: 64,
          rings: 32,
          position: [0, 0, 22]
        }
      ]
    }
  };
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (isDirectRun()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}

function isDirectRun(): boolean {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}
