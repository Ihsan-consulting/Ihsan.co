import { beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    ANTHROPIC_API_KEY: "test-key-not-real",
    ANTHROPIC_MODEL: "claude-haiku-4-5-20251001",
  }),
}));

/** The SDK returns content blocks; the module reads the first text one. */
function reply(text: string) {
  return { content: [{ type: "text", text }] };
}

const {
  generateMeetingBrief,
  parseMeetingBrief,
  stripJsonFences,
  buildBriefPrompt,
  MAX_TRANSCRIPT_CHARS,
} = await import("@/lib/ai/claude");

const BRIEF_JSON = JSON.stringify({
  headline: "Cierre de alcance con Cliente Demo",
  executive_summary: "Se confirmó el alcance de la fase 2.",
  key_decisions: ["Aprobar fase 2"],
  risks: ["Presupuesto sin firmar"],
  next_steps: ["Enviar SOW el 2026-09-26"],
  sentiment: "positivo",
});

beforeEach(() => {
  create.mockReset();
});

describe("stripJsonFences", () => {
  it("quita las vallas ```json que el modelo añade", () => {
    expect(stripJsonFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripJsonFences('```\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripJsonFences('{"a":1}')).toBe('{"a":1}');
  });
});

describe("parseMeetingBrief", () => {
  it("parsea el JSON aunque venga envuelto en vallas de código", () => {
    const result = parseMeetingBrief("```json\n" + BRIEF_JSON + "\n```");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.headline).toBe("Cierre de alcance con Cliente Demo");
    expect(result.brief.key_decisions).toEqual(["Aprobar fase 2"]);
  });

  it("rechaza una respuesta que no cumple el esquema", () => {
    expect(parseMeetingBrief('{"headline":"Solo titular"}')).toEqual({
      ok: false,
      reason: "model_response_schema_mismatch",
    });
  });

  it("rechaza texto que no es JSON", () => {
    expect(parseMeetingBrief("lo siento, no puedo ayudarte")).toEqual({
      ok: false,
      reason: "model_response_not_json",
    });
  });
});

describe("buildBriefPrompt", () => {
  it("recorta la transcripción al límite de caracteres y lo señala", () => {
    const prompt = buildBriefPrompt({
      title: "Kickoff Cliente Demo",
      transcript: "a".repeat(50_000),
    });

    expect(prompt).toContain("(recortada)");
    expect(prompt.length).toBeLessThan(MAX_TRANSCRIPT_CHARS + 1_000);
  });

  it("no marca como recortada una transcripción corta", () => {
    const prompt = buildBriefPrompt({
      title: "Kickoff Cliente Demo",
      transcript: "Ana Demo: confirmamos alcance",
      participants: ["Ana Demo"],
      actionItems: ["Enviar SOW"],
    });

    expect(prompt).not.toContain("(recortada)");
    expect(prompt).toContain("Participantes: Ana Demo");
    expect(prompt).toContain("Enviar SOW");
  });
});

describe("generateMeetingBrief", () => {
  it("devuelve el brief y el modelo usado cuando Claude responde bien", async () => {
    create.mockResolvedValue(reply("```json\n" + BRIEF_JSON + "\n```"));

    const result = await generateMeetingBrief({
      title: "Kickoff Cliente Demo",
      transcript: "Ana Demo: confirmamos alcance",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model).toBe("claude-haiku-4-5-20251001");
    expect(result.brief.sentiment).toBe("positivo");
  });

  it("devuelve un error controlado en vez de lanzar cuando la API falla", async () => {
    create.mockRejectedValue(new Error("429 quota exceeded"));

    const result = await generateMeetingBrief({ title: "Kickoff", transcript: "" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("anthropic_request_failed");
  });

  it("trata una respuesta vacía como fallo", async () => {
    create.mockResolvedValue({ content: [] });

    const result = await generateMeetingBrief({ title: "Kickoff", transcript: "" });

    expect(result).toEqual({ ok: false, reason: "empty_model_response" });
  });
});
