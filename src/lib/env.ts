import "server-only";
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  FATHOM_WEBHOOK_SECRET: z.string().min(1),
  FATHOM_API_KEY: z.string().min(1).optional(),

  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.6-flash"),

  DISCORD_DEFAULT_WEBHOOK_URL: z.string().url(),

  // Las cuatro son opcionales a propósito: el pipeline está en producción y el espejo
  // en Google Drive nunca puede impedir que se genere el brief ni que se publique en
  // Discord. Sin las cuatro, el export simplemente no se intenta.
  // GOOGLE_PRIVATE_KEY se guarda con secuencias `\n` literales de dos caracteres; la
  // conversión a saltos de línea reales vive en src/lib/google/docs.ts.
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().min(1).optional(),
  GOOGLE_PROJECT_ID: z.string().min(1).optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().min(1).optional(),
  GOOGLE_PRIVATE_KEY: z.string().min(1).optional(),

  // The login throttle lives in one serverless instance's memory and resets on cold
  // start, so it cannot be the real defence against guessing. Password length is.
  DASHBOARD_PASSWORD: z.string().min(24),
  SESSION_SECRET: z.string().min(32),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/**
 * Validated at first use rather than at import, so a missing variable surfaces as a
 * loud runtime error on the affected route instead of breaking an unrelated build step.
 */
/**
 * Names of the variables that fail validation, with the reason — never their values.
 *
 * The names are already public (`.env.example` is committed), so exposing which one is
 * wrong costs nothing and turns "503, good luck" into an actionable answer.
 */
export function describeEnvProblems(): string[] {
  const parsed = schema.safeParse(process.env);
  if (parsed.success) return [];
  return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration -> ${missing}`);
  }

  cached = parsed.data;
  return cached;
}
