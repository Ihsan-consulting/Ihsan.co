import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MeetingDigest } from "@/lib/queries/digests";

const { create, env } = vi.hoisted(() => ({
  create: vi.fn(),
  env: {
    ANTHROPIC_API_KEY: "test-key-not-real" as string | undefined,
    ANTHROPIC_MODEL: "claude-haiku-4-5-20251001",
  },
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));

vi.mock("@/lib/env", () => ({ getEnv: () => env }));

/** El SDK devuelve bloques de contenido; el módulo lee el primero de texto. */
function reply(text: string) {
  return { content: [{ type: "text", text }] };
}

const {
  answerMeetingQuestion,
  buildContextBlock,
  buildCorpus,
  normalizeHistory,
  parseCallScore,
  parseGoals,
  parseObjections,
  parsePayments,
  streamMeetingAnswer,
  MAX_CORPUS_CHARS,
} = await import("@/lib/ai/chat");

function digest(overrides: Partial<MeetingDigest> = {}): MeetingDigest {
  return {
    recordingId: 4210,
    title: "Kickoff Cliente Demo",
    startedAt: "2026-09-18T08:30:00Z",
    recordedByName: "Ana Demo",
    headline: "Cierre de alcance de la fase 2",
    executiveSummary: "Se confirmó el alcance de la fase 2.",
    keyDecisions: ["Aprobar fase 2"],
    risks: ["Presupuesto sin firmar"],
    nextSteps: ["Enviar SOW"],
    sentiment: "positivo",
    openCommitments: [{ description: "Enviar SOW", assigneeName: "Marwane Demo" }],
    ...overrides,
  };
}

beforeEach(() => {
  create.mockReset();
  env.ANTHROPIC_API_KEY = "test-key-not-real";
});

describe("buildCorpus", () => {
  it("incluye cada llamada con su fecha, su brief y sus compromisos", () => {
    const corpus = buildCorpus([digest()]);

    expect(corpus.included).toBe(1);
    expect(corpus.omitted).toBe(0);
    expect(corpus.text).toContain("Kickoff Cliente Demo");
    // Clave de día en Madrid: lo que hace resoluble un «esta semana».
    expect(corpus.text).toContain("2026-09-18");
    expect(corpus.text).toContain("Cierre de alcance de la fase 2");
    expect(corpus.text).toContain("Enviar SOW (responsable: Marwane Demo)");
  });

  it("marca el compromiso sin dueño en vez de atribuirlo a alguien", () => {
    const corpus = buildCorpus([
      digest({
        openCommitments: [{ description: "Revisar contrato", assigneeName: null }],
      }),
    ]);

    expect(corpus.text).toContain("Revisar contrato (responsable: sin asignar)");
  });

  it("dice que no hay pendientes cuando la llamada no dejó ninguno", () => {
    expect(buildCorpus([digest({ openCommitments: [] })]).text).toContain(
      "Compromisos abiertos: ninguno pendiente.",
    );
  });

  it("señala la llamada que todavía no tiene brief en vez de callarlo", () => {
    const corpus = buildCorpus([digest({ headline: null, executiveSummary: null })]);

    expect(corpus.text).toContain("todavía no tiene brief generado");
  });

  it("recorta las llamadas más antiguas al pasarse del presupuesto y las cuenta", () => {
    const fat = Array.from({ length: 5 }, (_, index) =>
      digest({ recordingId: index, executiveSummary: "a".repeat(20_000) }),
    );

    const corpus = buildCorpus(fat);

    expect(corpus.text.length).toBeLessThan(MAX_CORPUS_CHARS + 21_000);
    expect(corpus.included).toBeLessThan(5);
    expect(corpus.included + corpus.omitted).toBe(5);
  });
});

describe("buildContextBlock", () => {
  it("encierra el material entre delimitadores y declara la fecha de hoy", () => {
    const block = buildContextBlock(buildCorpus([digest()]), new Date("2026-09-29T10:00:00Z"));

    expect(block).toContain("<reuniones>");
    expect(block).toContain("</reuniones>");
    expect(block).toContain("2026-09-29");
    expect(block).not.toContain("Pregunta del equipo");
  });

  it("avisa de las llamadas que quedaron fuera para que el modelo no las dé por vistas", () => {
    const block = buildContextBlock({ text: "x", included: 12, omitted: 8 });

    expect(block).toContain("AVISO: 8 llamadas más antiguas quedaron fuera");
  });

  it("no inventa un aviso cuando cabe todo", () => {
    expect(buildContextBlock(buildCorpus([digest()]))).not.toContain("AVISO");
  });

  it("declara el vacío cuando no hay ninguna llamada archivada", () => {
    expect(buildContextBlock(buildCorpus([]))).toContain("(no hay ninguna llamada archivada)");
  });
});

describe("análisis ampliado en el corpus", () => {
  it("incluye objeciones, pagos, objetivos y puntuación cuando existen", () => {
    const corpus = buildCorpus([
      digest({
        objections: [
          {
            objection: "Es caro",
            response: "Pago en dos plazos",
            resolved: true,
          },
        ],
        payments: [
          {
            concept: "Fase 2",
            amount: 4500,
            currency: "EUR",
            status: "acordado",
          },
        ],
        goals: ["Lanzar en noviembre"],
        callScore: 82,
      }),
    ]);

    expect(corpus.text).toContain("Es caro → respuesta: Pago en dos plazos [resuelta]");
    expect(corpus.text).toMatch(/Fase 2: 4\.?500 EUR \[acordado\]/);
    expect(corpus.text).toContain("Lanzar en noviembre");
    expect(corpus.text).toContain("Puntuación de la llamada: 82/100");
  });

  it("dice «sin datos» en filas antiguas en vez de callarlo o inventar", () => {
    const corpus = buildCorpus([digest({ objections: null, payments: null })]);

    expect(corpus.text).toContain("Objeciones: sin datos");
    expect(corpus.text).toContain("Pagos: sin datos");
    expect(corpus.text).not.toContain("Puntuación");
  });

  it("marca el importe ausente en vez de poner un número", () => {
    const corpus = buildCorpus([
      digest({
        payments: [
          {
            concept: "Retainer",
            amount: null,
            currency: null,
            status: "mencionado",
          },
        ],
      }),
    ]);

    expect(corpus.text).toContain("Retainer: importe no indicado [mencionado]");
  });
});

describe("parsers de columnas jsonb", () => {
  it("parseObjections descarta basura y normaliza resolved", () => {
    expect(
      parseObjections([
        { objection: " Precio ", response: "", resolved: "sí" },
        { objection: "" },
        "texto suelto",
      ]),
    ).toEqual([{ objection: "Precio", response: null, resolved: false }]);
    expect(parseObjections(null)).toBeNull();
    expect(parseObjections([])).toEqual([]);
  });

  it("parsePayments valida importe y estado", () => {
    expect(
      parsePayments([
        { concept: "Setup", amount: "mil", currency: "USD", status: "raro" },
        {
          concept: "Mensualidad",
          amount: 900,
          currency: "EUR",
          status: "pagado",
        },
      ]),
    ).toEqual([
      { concept: "Setup", amount: null, currency: "USD", status: "mencionado" },
      {
        concept: "Mensualidad",
        amount: 900,
        currency: "EUR",
        status: "pagado",
      },
    ]);
    expect(parsePayments(undefined)).toBeNull();
  });

  it("parseGoals y parseCallScore aceptan sólo valores válidos", () => {
    expect(parseGoals(["  Crecer ", 3, ""])).toEqual(["Crecer"]);
    expect(parseGoals({})).toBeNull();
    expect(parseCallScore(77.6)).toBe(78);
    expect(parseCallScore(140)).toBeNull();
    expect(parseCallScore(null)).toBeNull();
  });
});

describe("normalizeHistory", () => {
  it("descarta los turnos de cabecera hasta el primero del usuario", () => {
    expect(
      normalizeHistory([
        { role: "assistant", content: "huérfano" },
        { role: "user", content: "hola" },
      ]),
    ).toEqual([{ role: "user", content: "hola" }]);
  });

  it("devuelve vacío si no queda ningún turno del usuario", () => {
    expect(normalizeHistory([{ role: "assistant", content: "solo" }])).toEqual([]);
  });

  it("se queda con los últimos turnos y arranca por el usuario", () => {
    const long = Array.from({ length: 30 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `t${String(index)}`,
    }));

    const kept = normalizeHistory(long);

    expect(kept.length).toBeLessThanOrEqual(10);
    expect(kept[0]?.role).toBe("user");
  });
});

describe("answerMeetingQuestion", () => {
  it("devuelve la respuesta y el modelo cuando Claude contesta", async () => {
    create.mockResolvedValue(reply("El 18 sept 2026 se le prometió el SOW.\n"));

    const result = await answerMeetingQuestion({
      question: "¿qué le prometimos a Marwane?",
      digests: [digest()],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model).toBe("claude-haiku-4-5-20251001");
    expect(result.answer).toBe("El 18 sept 2026 se le prometió el SOW.");
  });

  it("manda el material como datos delimitados, no como instrucciones", async () => {
    create.mockResolvedValue(reply("ok"));

    await answerMeetingQuestion({ question: "¿y esto?", digests: [digest()] });

    const call = create.mock.calls[0]?.[0] as {
      system: { text: string; cache_control?: { type: string } }[];
      messages: { role: string; content: string }[];
    };
    expect(call.system[0]?.text).toContain("nunca");
    expect(call.system[0]?.text).toContain("instrucciones");
    // El material va en un bloque de sistema cacheable, no mezclado con la pregunta.
    expect(call.system[1]?.text).toContain("<reuniones>");
    expect(call.system[1]?.cache_control).toEqual({ type: "ephemeral" });
    expect(call.messages.at(-1)?.content).toBe("Pregunta del equipo: ¿y esto?");
    expect(call.messages.at(-1)?.role).toBe("user");
  });

  it("devuelve un fallo controlado en vez de lanzar cuando la API falla", async () => {
    create.mockRejectedValue(new Error("429 quota exceeded"));

    const result = await answerMeetingQuestion({
      question: "¿algo?",
      digests: [digest()],
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "anthropic_request_failed",
    });
  });

  it("trata una respuesta vacía como fallo", async () => {
    create.mockResolvedValue({ content: [] });

    const result = await answerMeetingQuestion({
      question: "¿algo?",
      digests: [digest()],
    });

    expect(result).toEqual({ ok: false, reason: "empty_model_response" });
  });

  it("no llama al modelo si no hay clave configurada", async () => {
    env.ANTHROPIC_API_KEY = undefined;

    const result = await answerMeetingQuestion({
      question: "¿algo?",
      digests: [digest()],
    });

    expect(result).toEqual({ ok: false, reason: "anthropic_api_key_missing" });
    expect(create).not.toHaveBeenCalled();
  });
});

describe("streamMeetingAnswer", () => {
  async function collect(chunks: AsyncIterable<string>): Promise<string> {
    let out = "";
    for await (const chunk of chunks) out += chunk;
    return out;
  }

  it("emite sólo los deltas de texto del stream", async () => {
    create.mockResolvedValue(
      (async function* () {
        yield { type: "message_start" };
        yield {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "**Sí.** " },
        };
        yield {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Consta." },
        };
        yield { type: "message_stop" };
      })(),
    );

    const result = await streamMeetingAnswer({
      question: "¿algo?",
      digests: [digest()],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await collect(result.chunks)).toBe("**Sí.** Consta.");
    expect((create.mock.calls[0]?.[0] as { stream: boolean }).stream).toBe(true);
  });

  it("devuelve el fallo de arranque como valor", async () => {
    create.mockRejectedValue(new Error("401"));

    const result = await streamMeetingAnswer({
      question: "¿algo?",
      digests: [digest()],
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "anthropic_request_failed",
    });
  });
});
