import { z } from "zod";

import {
  MAX_HISTORY_TURNS,
  MAX_QUESTION_CHARS,
  answerMeetingQuestion,
  type ChatFailure,
} from "@/lib/ai/chat";
import { listMeetingDigests, type MeetingDigest } from "@/lib/queries/digests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Preguntas del equipo sobre sus propias llamadas.
 *
 * Protegida por la puerta de sesión: `/api/chat` no está en la lista pública de
 * `src/proxy.ts`, así que una petición sin sesión acaba redirigida a /login y nunca
 * llega hasta aquí —lo que importa, porque esto lee el archivo entero de llamadas
 * y gasta cuota de Anthropic—.
 *
 * No guarda nada: la conversación vive en el estado del componente y se pierde al
 * recargar. Una tabla de historial sería una segunda copia de material sensible de
 * clientes, y nadie la ha pedido.
 */

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(MAX_QUESTION_CHARS),
});

const bodySchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION_CHARS),
  history: z.array(turnSchema).max(MAX_HISTORY_TURNS).optional(),
});

/** Motivos legibles: el panel los enseña tal cual, así que no pueden filtrar internals. */
const FAILURE_MESSAGES: Record<ChatFailure, string> = {
  anthropic_api_key_missing:
    "El asistente no está configurado: falta la clave de Anthropic en el entorno.",
  anthropic_request_failed: "El modelo no respondió. Vuelve a intentarlo en unos segundos.",
  empty_model_response: "El modelo devolvió una respuesta vacía. Prueba a reformular la pregunta.",
};

function fail(reason: string, status: number): Response {
  return Response.json({ ok: false, reason }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("La petición no es JSON válido.", 400);
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return fail(
      `Pregunta no válida: debe tener entre 1 y ${String(MAX_QUESTION_CHARS)} caracteres.`,
      400,
    );
  }

  let digests: MeetingDigest[];
  try {
    digests = await listMeetingDigests();
  } catch {
    return fail("No se pudo leer el archivo de llamadas. Inténtalo de nuevo.", 502);
  }

  if (digests.length === 0) {
    return fail("Todavía no hay llamadas archivadas sobre las que poder responder.", 200);
  }

  const result = await answerMeetingQuestion({
    question: parsed.data.question,
    history: parsed.data.history ?? [],
    digests,
  });

  if (!result.ok) {
    // `result.detail` puede traer texto crudo del SDK: se queda en el servidor.
    const status = result.reason === "anthropic_api_key_missing" ? 500 : 502;
    return fail(FAILURE_MESSAGES[result.reason], status);
  }

  return Response.json({ ok: true, answer: result.answer });
}
