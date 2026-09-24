import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getEnv } from "@/lib/env";

/**
 * A two-hour meeting can produce several hundred thousand characters. Capping the input
 * keeps us inside the model context and, just as importantly, inside the free-tier quota.
 */
export const MAX_TRANSCRIPT_CHARS = 40_000;
const MAX_OUTPUT_TOKENS = 2048;
const TEMPERATURE = 0.2;

const SYSTEM_INSTRUCTION = [
  "Eres el analista senior de ihsan.co, una consultora. Recibes el material de una reunión",
  "con un cliente y produces un brief ejecutivo en español neutro.",
  "Reglas estrictas:",
  '- Responde EXCLUSIVAMENTE con un objeto JSON válido: {"headline": string, "executive_summary": string, "key_decisions": string[], "risks": string[], "next_steps": string[], "sentiment": string}.',
  "- headline: una sola línea de máximo 120 caracteres.",
  "- executive_summary: de 3 a 5 frases orientadas a negocio.",
  "- key_decisions, risks y next_steps: frases cortas y accionables; usa un array vacío si no hay nada sólido.",
  '- sentiment: una sola palabra entre "positivo", "neutral" o "negativo".',
  "- No inventes datos que no aparezcan en el material recibido.",
].join("\n");

export const meetingBriefSchema = z.object({
  headline: z.string().min(1),
  executive_summary: z.string().min(1),
  key_decisions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  next_steps: z.array(z.string()).default([]),
  sentiment: z.string().min(1),
});

export type MeetingBrief = z.infer<typeof meetingBriefSchema>;

export type MeetingBriefInput = {
  title: string;
  transcript: string;
  summaryMarkdown?: string | null;
  actionItems?: readonly string[];
  participants?: readonly string[];
};

export type MeetingBriefParse =
  | { ok: true; brief: MeetingBrief }
  | { ok: false; reason: string };

export type MeetingBriefResult =
  | { ok: true; brief: MeetingBrief; model: string; raw: string }
  | { ok: false; reason: string };

const FENCED = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/;

/** Models routinely wrap JSON in ```json fences even when told not to. */
export function stripJsonFences(text: string): string {
  const match = FENCED.exec(text);
  return (match?.[1] ?? text).trim();
}

export function parseMeetingBrief(raw: string): MeetingBriefParse {
  const cleaned = stripJsonFences(raw);
  if (!cleaned) return { ok: false, reason: "empty_model_response" };

  let decoded: unknown;
  try {
    decoded = JSON.parse(cleaned);
  } catch {
    return { ok: false, reason: "model_response_not_json" };
  }

  const parsed = meetingBriefSchema.safeParse(decoded);
  if (!parsed.success) return { ok: false, reason: "model_response_schema_mismatch" };

  return { ok: true, brief: parsed.data };
}

export function buildBriefPrompt(input: MeetingBriefInput): string {
  const truncated = input.transcript.length > MAX_TRANSCRIPT_CHARS;
  const transcript = truncated
    ? input.transcript.slice(0, MAX_TRANSCRIPT_CHARS)
    : input.transcript;

  const sections = [
    `Título de la reunión: ${input.title}`,
    input.participants?.length ? `Participantes: ${input.participants.join(", ")}` : null,
    input.actionItems?.length
      ? `Tareas detectadas por Fathom:\n- ${input.actionItems.join("\n- ")}`
      : null,
    input.summaryMarkdown
      ? `Resumen automático de Fathom:\n${input.summaryMarkdown}`
      : null,
    `Transcripción${truncated ? " (recortada)" : ""}:\n${transcript || "(sin transcripción disponible)"}`,
  ];

  return sections.filter((section): section is string => section !== null).join("\n\n");
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown_error";
}

let client: GoogleGenAI | undefined;

function getClient(apiKey: string): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

/** Never throws: a model or quota failure comes back as a value the caller can record. */
export async function generateMeetingBrief(
  input: MeetingBriefInput,
): Promise<MeetingBriefResult> {
  const env = getEnv();
  const model = env.GEMINI_MODEL;

  let text: string | undefined;
  try {
    const response = await getClient(env.GEMINI_API_KEY).models.generateContent({
      model,
      contents: buildBriefPrompt(input),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
        temperature: TEMPERATURE,
      },
    });
    text = response.text;
  } catch (error) {
    return { ok: false, reason: `gemini_request_failed: ${toMessage(error)}` };
  }

  if (!text) return { ok: false, reason: "empty_model_response" };

  const parsed = parseMeetingBrief(text);
  if (!parsed.ok) return parsed;

  return { ok: true, brief: parsed.brief, model, raw: text };
}
