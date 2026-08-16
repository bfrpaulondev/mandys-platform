import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  STOREFRONT_URL: z.string().url().default("http://localhost:3000"),
  BACKOFFICE_URL: z.string().url().default("http://localhost:3001"),
});

export type ApiEnvironment = z.infer<typeof environmentSchema>;

export function getEnvironment(source: NodeJS.ProcessEnv = process.env): ApiEnvironment {
  return environmentSchema.parse(source);
}
