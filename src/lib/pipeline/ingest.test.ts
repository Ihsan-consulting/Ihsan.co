import { describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  findCall,
  type OutcomeResolver,
  type RecordedCall,
} from "@/lib/testing/supabase-mock";

const { state } = vi.hoisted(() => ({ state: { client: undefined as unknown } }));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => state.client,
}));

const { ingestMeeting } = await import("@/lib/pipeline/ingest");
const { fathomWebhookPayloadSchema } = await import("@/lib/fathom/payload");

function withMock(resolve?: OutcomeResolver): RecordedCall[] {
  const mock = createSupabaseMock(resolve);
  state.client = mock.client;
  return mock.calls;
}

function parse(raw: unknown) {
  const parsed = fathomWebhookPayloadSchema.safeParse(raw);
  if (!parsed.success) throw new Error("fixture no válido");
  return parsed.data;
}

describe("ingestMeeting", () => {
  it("persiste la reunión aunque falten todos los bloques opcionales", async () => {
    const calls = withMock();

    const result = await ingestMeeting(parse({ recording_id: 987654321 }));

    expect(result).toEqual({ ok: true, recordingId: 987654321 });

    const upsert = findCall(calls, "meetings", "upsert");
    expect(upsert?.args[0]?.[0]).toMatchObject({
      recording_id: 987654321,
      title: "Reunión 987654321",
      transcript: null,
    });
    expect(upsert?.args[0]?.[1]).toEqual({ onConflict: "recording_id" });

    // Sin invitados ni tareas no debe tocar esas tablas.
    expect(calls.some((call) => call.table === "meeting_invitees")).toBe(false);
    expect(calls.some((call) => call.table === "action_items")).toBe(false);
  });

  it("mapea url a share_url y deduplica invitados y tareas", async () => {
    const calls = withMock();

    await ingestMeeting(
      parse({
        recording_id: 987654321,
        title: "  Kickoff Cliente Demo  ",
        url: "https://fathom.video/share/demo",
        meeting_url: "https://meet.example/abc",
        scheduled_start_time: "2026-09-24T15:00:00.000Z",
        recorded_by: {
          name: "Equipo ihsan",
          email: "equipo@ihsan.example",
          team: "Consultoría",
        },
        calendar_invitees: [
          { name: "Ana Demo", email: "Ana@Cliente-Demo.example", is_external: true },
          { name: "Ana Demo (duplicada)", email: "ana@cliente-demo.example" },
          { name: "Sin correo", email: null },
        ],
        action_items: [{ description: "Enviar SOW" }, { description: "Enviar SOW" }],
      }),
    );

    const meeting = findCall(calls, "meetings", "upsert")?.args[0]?.[0];
    expect(meeting).toMatchObject({
      title: "Kickoff Cliente Demo",
      share_url: "https://fathom.video/share/demo",
      meeting_url: "https://meet.example/abc",
      scheduled_start_time: "2026-09-24T15:00:00.000Z",
      recorded_by_email: "equipo@ihsan.example",
    });

    const invitees = findCall(calls, "meeting_invitees", "upsert");
    expect(invitees?.args[0]?.[0]).toEqual([
      {
        recording_id: 987654321,
        name: "Ana Demo (duplicada)",
        email: "ana@cliente-demo.example",
        is_external: null,
      },
    ]);
    expect(invitees?.args[0]?.[1]).toEqual({ onConflict: "recording_id,email" });

    const actions = findCall(calls, "action_items", "upsert");
    expect(actions?.args[0]?.[0]).toHaveLength(1);
    expect(actions?.args[0]?.[1]).toEqual({ onConflict: "recording_id,description" });
  });

  it("devuelve un error en vez de lanzar cuando falla el upsert de meetings", async () => {
    withMock((table) =>
      table === "meetings"
        ? { error: { message: "permission denied for table meetings", code: "42501" } }
        : { data: null, error: null },
    );

    const result = await ingestMeeting(parse({ recording_id: 987654321 }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("meetings_upsert_failed");
  });
});
