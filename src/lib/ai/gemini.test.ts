import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ GEMINI_API_KEY: "test-key-not-real", GEMINI_MODEL: "gemini-3.6-flash" }),
}));

const {
  generateMeetingBrief,
  parseMeetingBrief,
  stripJsonFences,
  buildBriefPrompt,
  MAX_TRANSCRIPT_CHARS,
} = await import("@/lib/ai/gemini");

const BRIEF_JSON = JSON.stringify({
  headline: "Cierre de alcance con Cliente Demo",
  executive_summary: "Se confirmó el alcance de la fase 2.",
  key_decisions: ["Aprobar fase 2"],
  risks: ["Presupuesto sin firmar"],
  next_steps: ["Enviar SOW el 2026-09-26"],
  sentiment: "positivo",
});

beforeEach(() => {
  generateContent.mockReset();
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
  it("devuelve el brief y el modelo usado cuando Gemini responde bien", async () => {
    generateContent.mockResolvedValue({ text: "```json\n" + BRIEF_JSON + "\n```" });

    const result = await generateMeetingBrief({
      title: "Kickoff Cliente Demo",
      transcript: "Ana Demo: confirmamos alcance",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model).toBe("gemini-3.6-flash");
    expect(result.brief.sentiment).toBe("positivo");
  });

  it("devuelve un error controlado en vez de lanzar cuando la API falla", async () => {
    generateContent.mockRejectedValue(new Error("429 quota exceeded"));

    const result = await generateMeetingBrief({ title: "Kickoff", transcript: "" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("gemini_request_failed");
  });

  it("trata una respuesta vacía como fallo", async () => {
    generateContent.mockResolvedValue({ text: undefined });

    const result = await generateMeetingBrief({ title: "Kickoff", transcript: "" });

    expect(result).toEqual({ ok: false, reason: "empty_model_response" });
  });
});
