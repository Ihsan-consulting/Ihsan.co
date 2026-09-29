import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { resendMeetingToDiscord } from "@/lib/discord/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ recordingId: string }> };

function parseRecordingId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * Reenvía el brief de una llamada a Discord. El proxy ya exige sesión en `api/`, pero
 * esta ruta escribe con la clave de servicio y publica fuera, así que vuelve a comprobar
 * la cookie en vez de fiarse solo del matcher.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const secret = process.env.SESSION_SECRET;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!secret || !(await verifySessionToken(secret, token))) {
    return NextResponse.json(
      { ok: false, error: "La sesión ha caducado. Vuelve a entrar." },
      { status: 401 },
    );
  }

  const { recordingId } = await context.params;
  const id = parseRecordingId(recordingId);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "Llamada no válida." }, { status: 400 });
  }

  try {
    const outcome = await resendMeetingToDiscord(id);
    if (!outcome.ok) {
      return NextResponse.json({ ok: false, error: outcome.error }, { status: outcome.status });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[discord-resend] unexpected", {
      recordingId: id,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: "Error inesperado al enviar." }, { status: 500 });
  }
}
