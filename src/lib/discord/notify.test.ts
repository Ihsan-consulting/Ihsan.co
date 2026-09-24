import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { WEBHOOK_URL } = vi.hoisted(() => ({
  WEBHOOK_URL: "https://discord.com/api/webhooks/123456789012345678/TEST_TOKEN_NOT_REAL",
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ DISCORD_DEFAULT_WEBHOOK_URL: WEBHOOK_URL }),
}));

const { buildMeetingEmbed, truncate, redactWebhookUrl, sendDiscordBrief, DISCORD_LIMITS } =
  await import("@/lib/discord/notify");

const OVERSIZED = {
  title: "Kickoff Cliente Demo",
  shareUrl: "https://fathom.video/share/demo",
  headline: "Cierre de alcance",
  executiveSummary: "x".repeat(9_000),
  keyDecisions: ["d".repeat(3_000)],
  risks: ["r".repeat(3_000)],
  nextSteps: ["Enviar SOW el 2026-09-26"],
  sentiment: "positivo",
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("truncate", () => {
  it("deja intacto lo que cabe y recorta lo que no", () => {
    expect(truncate("corto", 10)).toBe("corto");
    expect(truncate("abcdef", 3)).toHaveLength(3);
    expect(truncate("abcdef", 0)).toBe("");
  });
});

describe("buildMeetingEmbed", () => {
  it("recorta la descripción al límite de 4096 caracteres", () => {
    const embed = buildMeetingEmbed(OVERSIZED);

    expect(embed.description.length).toBeLessThanOrEqual(DISCORD_LIMITS.description);
  });

  it("recorta el valor de cada campo al límite de 1024 caracteres", () => {
    const embed = buildMeetingEmbed(OVERSIZED);

    expect(embed.fields.length).toBeGreaterThan(0);
    for (const field of embed.fields) {
      expect(field.value.length).toBeLessThanOrEqual(DISCORD_LIMITS.fieldValue);
    }
  });

  it("respeta el máximo de 25 campos y los 6000 caracteres totales", () => {
    const embed = buildMeetingEmbed(OVERSIZED);
    const total =
      embed.title.length +
      embed.description.length +
      embed.fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0) +
      (embed.footer?.text.length ?? 0);

    expect(embed.fields.length).toBeLessThanOrEqual(DISCORD_LIMITS.fields);
    expect(total).toBeLessThanOrEqual(DISCORD_LIMITS.total);
  });

  it("omite los campos vacíos en lugar de enviarlos en blanco", () => {
    const embed = buildMeetingEmbed({
      title: "Kickoff Cliente Demo",
      headline: "Cierre de alcance",
      executiveSummary: "Resumen breve.",
      keyDecisions: [],
      risks: [],
      nextSteps: [],
    });

    expect(embed.fields).toEqual([]);
    expect(embed.url).toBeUndefined();
  });
});

describe("redactWebhookUrl", () => {
  it("elimina el token del webhook", () => {
    expect(redactWebhookUrl(WEBHOOK_URL)).toBe(
      "https://discord.com/api/webhooks/123456789012345678",
    );
    expect(redactWebhookUrl(WEBHOOK_URL)).not.toContain("TEST_TOKEN_NOT_REAL");
  });

  it("no lanza con una URL inválida", () => {
    expect(redactWebhookUrl("no-es-una-url")).toBe("discord");
  });
});

describe("sendDiscordBrief", () => {
  it("devuelve ok y el target sin token cuando Discord acepta", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 });

    const result = await sendDiscordBrief(OVERSIZED);

    expect(result).toEqual({
      ok: true,
      target: "https://discord.com/api/webhooks/123456789012345678",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no lanza cuando Discord responde con error HTTP", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const result = await sendDiscordBrief(OVERSIZED);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("discord_http_500");
    expect(result.target).not.toContain("TEST_TOKEN_NOT_REAL");
  });

  it("no lanza cuando la red falla", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));

    const result = await sendDiscordBrief(OVERSIZED);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("discord_request_failed");
  });
});
