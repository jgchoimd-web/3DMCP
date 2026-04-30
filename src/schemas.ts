import { z } from "zod";

const PositiveNumberSchema = z.number().positive();
const NonNegativeNumberSchema = z.number().nonnegative();

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export const PositiveVec3Schema = z.tuple([
  PositiveNumberSchema,
  PositiveNumberSchema,
  PositiveNumberSchema
]);

const BaseSolidSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  position: Vec3Schema.optional().describe("Translation [x, y, z] in the selected units."),
  rotation: Vec3Schema.optional().describe("Euler rotation [x, y, z] in degrees.")
});

export const BoxSolidSchema = BaseSolidSchema.extend({
  type: z.literal("box"),
  size: PositiveVec3Schema.describe("Box size [width, depth, height].")
});

export const CylinderSolidSchema = BaseSolidSchema.extend({
  type: z.literal("cylinder"),
  radius: PositiveNumberSchema,
  height: PositiveNumberSchema,
  segments: z.number().int().min(3).max(256).default(64)
});

export const SphereSolidSchema = BaseSolidSchema.extend({
  type: z.literal("sphere"),
  radius: PositiveNumberSchema,
  segments: z.number().int().min(8).max(256).default(64),
  rings: z.number().int().min(4).max(128).default(32)
});

export const ConeSolidSchema = BaseSolidSchema.extend({
  type: z.literal("cone"),
  radiusBottom: NonNegativeNumberSchema,
  radiusTop: NonNegativeNumberSchema,
  height: PositiveNumberSchema,
  segments: z.number().int().min(3).max(256).default(64)
});

export const TorusSolidSchema = BaseSolidSchema.extend({
  type: z.literal("torus"),
  majorRadius: PositiveNumberSchema.describe("Distance from torus center to tube center."),
  tubeRadius: PositiveNumberSchema.describe("Tube radius."),
  radialSegments: z.number().int().min(8).max(256).default(96),
  tubeSegments: z.number().int().min(6).max(128).default(32)
});

export const SolidSchema = z
  .discriminatedUnion("type", [
    BoxSolidSchema,
    CylinderSolidSchema,
    SphereSolidSchema,
    ConeSolidSchema,
    TorusSolidSchema
  ])
  .superRefine((solid, context) => {
    if (solid.type === "cone" && solid.radiusBottom === 0 && solid.radiusTop === 0) {
      context.addIssue({
        code: "custom",
        message: "A cone needs at least one non-zero radius.",
        path: ["radiusBottom"]
      });
    }

    if (
      solid.type === "torus" &&
      solid.tubeRadius >= solid.majorRadius
    ) {
      context.addIssue({
        code: "custom",
        message: "tubeRadius must be smaller than majorRadius for a printable torus.",
        path: ["tubeRadius"]
      });
    }
  });

export const CreateStlInputSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .default("model.stl")
    .describe("Output file name. The .stl extension is added when omitted."),
  outputDir: z
    .string()
    .trim()
    .min(1)
    .max(260)
    .default("generated")
    .describe("Output directory. Relative paths are resolved from the server process cwd."),
  overwrite: z
    .boolean()
    .default(false)
    .describe("Overwrite an existing file. When false, a numeric suffix is added instead."),
  solidName: z.string().trim().min(1).max(80).default("model"),
  units: z.enum(["mm", "cm", "m", "in"]).default("mm"),
  solids: z.array(SolidSchema).min(1).max(64)
});

export const BoundsSchema = z.object({
  min: Vec3Schema,
  max: Vec3Schema,
  size: Vec3Schema
});

export const CreateStlOutputSchema = z.object({
  fileName: z.string(),
  filePath: z.string(),
  uri: z.string(),
  mimeType: z.literal("model/stl"),
  byteLength: z.number().int().nonnegative(),
  triangleCount: z.number().int().nonnegative(),
  units: z.enum(["mm", "cm", "m", "in"]),
  bounds: BoundsSchema,
  overwritten: z.boolean()
});

export type Vec3 = z.infer<typeof Vec3Schema>;
export type Solid = z.infer<typeof SolidSchema>;
export type CreateStlInput = z.infer<typeof CreateStlInputSchema>;
export type CreateStlOutput = z.infer<typeof CreateStlOutputSchema>;
