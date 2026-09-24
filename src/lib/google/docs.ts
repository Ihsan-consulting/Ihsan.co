import "server-only";

import { google } from "googleapis";

import { formatDateTime } from "@/components/formatting";
import { getEnv } from "@/lib/env";

/**
 * Espejo de cada reunión en un Google Doc dentro de una carpeta de Drive.
 *
 * Mismo contrato que src/lib/discord/notify.ts: nunca lanza, siempre devuelve un
 * valor, y ninguna credencial llega jamás a un log ni a la base de datos.
 *
 * El Doc se crea subiendo texto plano y dejando que Drive lo convierta
 * (`mimeType: application/vnd.google-apps.document`). Es una sola llamada y basta
 * con el ámbito más estrecho, `drive.file`: la API de Docs exigiría además el
 * ámbito `documents` y una segunda llamada para mover el archivo a la carpeta.
 */

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const DOC_MIME = "application/vnd.google-apps.document";
const UPLOAD_MIME = "text/plain";

/** Drive rechaza nombres largos y el título de la reunión es texto libre. */
const NAME_LIMIT = 180;
const REASON_LIMIT = 300;

export type GoogleDocBrief = {
  headline: string | null;
  executiveSummary: string | null;
  keyDecisions: readonly string[];
  risks: readonly string[];
  nextSteps: readonly string[];
  sentiment: string | null;
};

export type GoogleDocInput = {
  title: string;
  startedAt: string | null;
  shareUrl: string | null;
  recordedByName: string | null;
  brief: GoogleDocBrief | null;
  fathomSummaryMarkdown: string | null;
  actionItems: readonly string[];
  attendees: readonly string[];
  transcript: string;
};

export type GoogleDocResult =
  | { ok: true; docId: string; docUrl: string }
  | { ok: false; reason: string };

type GoogleConfig = {
  clientEmail: string;
  privateKey: string;
  folderId: string;
  projectId: string;
};

/**
 * Las cuatro variables son opcionales. Si falta cualquiera —o si la validación
 * global del entorno falla por otro motivo— devolvemos `null` y el pipeline sigue
 * como si el export no existiera.
 */
function readConfig(): GoogleConfig | null {
  let clientEmail: string | undefined;
  let rawKey: string | undefined;
  let folderId: string | undefined;
  let projectId: string | undefined;

  try {
    const env = getEnv();
    clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    rawKey = env.GOOGLE_PRIVATE_KEY;
    folderId = env.GOOGLE_DRIVE_FOLDER_ID;
    projectId = env.GOOGLE_PROJECT_ID;
  } catch {
    return null;
  }

  if (!clientEmail || !rawKey || !folderId || !projectId) return null;

  // Copiar y pegar un id en el formulario de un proveedor arrastra espacios con
  // facilidad, y Drive responde "File not found" al id con el espacio incluido: parece
  // que el id es incorrecto cuando lo único que sobra es un carácter invisible.
  return {
    clientEmail: clientEmail.trim(),
    privateKey: normalizePrivateKey(rawKey),
    folderId: folderId.trim(),
    projectId: projectId.trim(),
  };
}

/**
 * Acepta la clave en cualquiera de las formas en que puede sobrevivir al viaje.
 *
 * Pegar un PEM en el formulario de un proveedor es donde esta integración suele morir:
 * unos campos conservan las secuencias `\n` de dos caracteres, otros las convierten en
 * saltos de línea reales y otros las pierden. El fallo resultante es siempre el mismo
 * error opaco, `DECODER routines::unsupported`, que no dice nada de la causa.
 *
 * Aceptar las tres formas —y además base64, la única sin ningún carácter que un
 * formulario pueda estropear— elimina el problema en vez de pedir que se pegue mejor.
 */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();

  // Los archivos .env envuelven el valor en comillas y el copiar/pegar se las lleva.
  const quoted =
    (key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"));
  if (quoted) key = key.slice(1, -1).trim();

  // Un bloque base64 no tiene cabecera PEM hasta que se decodifica.
  if (!key.includes("-----BEGIN")) {
    const decoded = Buffer.from(key, "base64").toString("utf8");
    if (decoded.includes("-----BEGIN")) key = decoded.trim();
  }

  key = key.replace(/\\n/g, "\n").trim();

  // OpenSSL exige el salto de línea final del PEM.
  return `${key}\n`;
}

/** Permite al pipeline saltarse el intento sin registrar una entrega fallida. */
export function isGoogleConfigured(): boolean {
  return readConfig() !== null;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function bullets(items: readonly string[]): string {
  return items
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => `• ${item}`)
    .join("\n");
}

function section(heading: string, body: string | null): string | null {
  const text = body?.trim();
  return text ? `${heading}\n${text}` : null;
}

function briefSections(brief: GoogleDocBrief | null): Array<string | null> {
  if (!brief) return [];
  return [
    section("TITULAR", brief.headline),
    section("RESUMEN EJECUTIVO", brief.executiveSummary),
    section("DECISIONES CLAVE", bullets(brief.keyDecisions)),
    section("RIESGOS", bullets(brief.risks)),
    section("PRÓXIMOS PASOS", bullets(brief.nextSteps)),
    section("TONO", brief.sentiment),
  ];
}

/** Cuerpo del documento, en español. Exportado para poder probarlo sin red. */
export function buildDocumentText(input: GoogleDocInput): string {
  const header = [
    input.title,
    formatDateTime(input.startedAt),
    input.recordedByName ? `Grabado por ${input.recordedByName}` : null,
    input.shareUrl ? `Grabación: ${input.shareUrl}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const blocks: Array<string | null> = [
    header,
    ...briefSections(input.brief),
    section("RESUMEN DE FATHOM", input.fathomSummaryMarkdown),
    section("TAREAS", bullets(input.actionItems)),
    section("ASISTENTES", bullets(input.attendees)),
    section("TRANSCRIPCIÓN", input.transcript),
  ];

  return blocks.filter((block): block is string => Boolean(block)).join("\n\n");
}

export function buildDocumentName(input: GoogleDocInput): string {
  return truncate(`${input.title} — ${formatDateTime(input.startedAt)}`, NAME_LIMIT);
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown_error";
}

/**
 * Un error de googleapis puede arrastrar la configuración de la petición. Antes de
 * guardar o registrar nada, fuera el bloque PEM y la identidad de la cuenta.
 */
function redact(message: string, config: GoogleConfig): string {
  const clean = message
    .replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, "[clave]")
    .split(config.privateKey)
    .join("[clave]")
    .split(config.clientEmail)
    .join("[cuenta]");
  return truncate(clean, REASON_LIMIT);
}

/** Nunca lanza hacia el pipeline: cada desenlace vuelve como valor. */
export async function createMeetingDoc(input: GoogleDocInput): Promise<GoogleDocResult> {
  const config = readConfig();
  if (!config) return { ok: false, reason: "google_not_configured" };

  try {
    const auth = new google.auth.JWT({
      email: config.clientEmail,
      key: config.privateKey,
      scopes: SCOPES,
    });

    const created = await google.drive({ version: "v3", auth }).files.create({
      requestBody: {
        name: buildDocumentName(input),
        mimeType: DOC_MIME,
        parents: [config.folderId],
      },
      media: { mimeType: UPLOAD_MIME, body: buildDocumentText(input) },
      fields: "id, webViewLink",
      supportsAllDrives: true,
    });

    const docId = created.data.id;
    if (!docId) return { ok: false, reason: "google_docs_missing_id" };

    return {
      ok: true,
      docId,
      docUrl: created.data.webViewLink ?? `https://docs.google.com/document/d/${docId}/edit`,
    };
  } catch (error) {
    const reason = `google_docs_failed: ${redact(toMessage(error), config)}`;
    console.error(`google docs export failed: ${reason}`);
    return { ok: false, reason };
  }
}
