import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  findCall,
  type OutcomeResolver,
  type RecordedCall,
} from "@/lib/testing/supabase-mock";

const { state, generateMeetingBrief, sendDiscordBrief } = vi.hoisted(() => ({
  state: { client: undefined as unknown },
  generateMeetingBrief: vi.fn(),
  sendDiscordBrief: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => state.client }));
vi.mock("@/lib/ai/claude", () => ({ generateMeetingBrief }));
vi.mock("@/lib/discord/notify", () => ({ sendDiscordBrief }));

const { processMeeting } = await import("@/lib/pipeline/process");

const MEETING_ROW = {
  title: "Kickoff Cliente Demo",
  share_url: "https://fathom.video/share/demo",
  transcript: [
    {
      speaker: { display_name: "Ana Demo" },
      text: "Confirmamos alcance",
      timestamp: "00:00:12",
    },
  ],
  default_summary_markdown: null,
};

const BRIEF_OK = {
  ok: true,
  model: "gemini-3.6-flash",
  raw: '{"headline":"Cierre de alcance"}',
  brief: {
    headline: "Cierre de alcance",
    executive_summary: "Se confirmó el alcance de la fase 2.",
    key_decisions: ["Aprobar fase 2"],
    risks: [],
    next_steps: ["Enviar SOW el 2026-09-26"],
    sentiment: "positivo",
  },
};

const resolver: OutcomeResolver = (table, ops) => {
  if (table === "meetings") return { data: MEETING_ROW, error: null };
  if (table === "deliveries" && ops.includes("select")) {
    return { data: { attempts: 1 }, error: null };
  }
  return { data: null, error: null };
};

function withMock(): RecordedCall[] {
  const mock = createSupabaseMock(resolver);
  state.client = mock.client;
  return mock.calls;
}

beforeEach(() => {
  generateMeetingBrief.mockReset();
  sendDiscordBrief.mockReset();
});

describe("processMeeting", () => {
  it("guarda insights, envía a Discord e incrementa attempts", async () => {
    const calls = withMock();
    generateMeetingBrief.mockResolvedValue(BRIEF_OK);
    sendDiscordBrief.mockResolvedValue({
      ok: true,
      target: "https://discord.com/api/webhooks/123456789012345678",
    });

    const result = await processMeeting({
      recordingId: 987654321,
      webhookId: "msg_2abc123",
    });

    expect(result).toEqual({ ok: true, recordingId: 987654321 });

    const insights = findCall(calls, "meeting_insights", "upsert");
    expect(insights?.args[0]?.[0]).toMatchObject({
      recording_id: 987654321,
      model: "gemini-3.6-flash",
      language: "es",
      sentiment: "positivo",
    });
    expect(insights?.args[0]?.[1]).toEqual({ onConflict: "recording_id,model" });

    expect(findCall(calls, "deliveries", "upsert")?.args[0]?.[0]).toMatchObject({
      channel: "discord",
      status: "sent",
      attempts: 2,
    });

    expect(findCall(calls, "webhook_events", "update")?.args[0]?.[0]).toMatchObject({
      process_error: null,
    });
  });

  it("registra el fallo de Gemini sin llamar a Discord", async () => {
    const calls = withMock();
    generateMeetingBrief.mockResolvedValue({
      ok: false,
      reason: "gemini_request_failed: 429 quota exceeded",
    });

    const result = await processMeeting({
      recordingId: 987654321,
      webhookId: "msg_2abc123",
    });

    expect(result.ok).toBe(false);
    expect(sendDiscordBrief).not.toHaveBeenCalled();

    expect(findCall(calls, "deliveries", "upsert")?.args[0]?.[0]).toMatchObject({
      status: "failed",
      error: "gemini_request_failed: 429 quota exceeded",
    });
    expect(findCall(calls, "webhook_events", "update")?.args[0]?.[0]).toMatchObject({
      processed_at: null,
      process_error: "gemini_request_failed: 429 quota exceeded",
    });
    expect(findCall(calls, "meeting_insights", "upsert")).toBeUndefined();
  });

  it("registra el fallo de Discord después de guardar los insights", async () => {
    const calls = withMock();
    generateMeetingBrief.mockResolvedValue(BRIEF_OK);
    sendDiscordBrief.mockResolvedValue({
      ok: false,
      target: "https://discord.com/api/webhooks/123456789012345678",
      error: "discord_http_500",
    });

    const result = await processMeeting({
      recordingId: 987654321,
      webhookId: "msg_2abc123",
    });

    expect(result).toEqual({ ok: false, error: "discord_http_500" });
    expect(findCall(calls, "meeting_insights", "upsert")).toBeDefined();
    expect(findCall(calls, "deliveries", "upsert")?.args[0]?.[0]).toMatchObject({
      status: "failed",
      error: "discord_http_500",
      sent_at: null,
    });
  });
});
