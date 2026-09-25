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
const UPLOAD_MIME = "text/html";

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

/**
 * Todo lo que entra en el documento viene de una llamada: títulos, tareas y nombres son
 * texto de terceros. Se escapa siempre antes de componer el HTML.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Marca de ihsan.co. Vive en `public/`, así que la sirve el propio despliegue y no
 * depende de permisos de Drive, que es donde falla alojar la imagen en la carpeta.
 */
const LOGO_URL = "https://ihsan-co.vercel.app/logo-ihsan.png";

/** Negro de marca y tinta blanca; los grises conservan contraste sobre el negro. */
const INK = "#FFFFFF";
const INK_SOFT = "#C9C9CF";
const INK_FAINT = "#8E8E94";
const PAPER = "#000000";
const RULE = "#2A2A2F";
/** Inter primero, con alternativas por si el visor no la tiene instalada. */
const FONT = "Inter,Geist,'Helvetica Neue',Arial,sans-serif";

function bullets(items: readonly string[]): string {
  const rows = items
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map(
      (item) =>
        `<li style="margin-bottom:6pt;color:${INK};line-height:1.5">${esc(item)}</li>`,
    )
    .join("");
  return rows ? `<ul style="margin:4pt 0 0 0">${rows}</ul>` : "";
}

/** Se respetan los párrafos del resumen: una línea en blanco separa bloques. */
function paragraphs(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 9pt 0;color:${INK_SOFT};line-height:1.55">${esc(block).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

/** Etiqueta de sección: 12pt, mayúsculas, peso 700, tracking amplio. */
function section(heading: string, bodyHtml: string): string | null {
  if (!bodyHtml.trim()) return null;
  const style =
    `font-family:${FONT};font-size:12pt;font-weight:700;letter-spacing:1.4pt;` +
    `color:${INK};border-bottom:1px solid ${RULE};padding-bottom:5pt;margin:22pt 0 9pt 0`;
  return `<h2 style="${style}">${esc(heading.toUpperCase())}</h2>${bodyHtml}`;
}

function briefSections(brief: GoogleDocBrief | null): Array<string | null> {
  if (!brief) return [];
  return [
    brief.executiveSummary
      ? section("Resumen ejecutivo", paragraphs(brief.executiveSummary))
      : null,
    section("Decisiones clave", bullets(brief.keyDecisions)),
    section("Riesgos", bullets(brief.risks)),
    section("Próximos pasos", bullets(brief.nextSteps)),
    brief.sentiment
      ? section(
          "Tono de la llamada",
          `<p style="margin:0"><strong>${esc(brief.sentiment)}</strong></p>`,
        )
      : null,
  ];
}

/**
 * Cuerpo del documento como HTML. Drive lo convierte en un Doc con estilos reales
 * —titulares, listas, negritas—, cosa que el texto plano no permitía: salía un bloc de
 * notas sin jerarquía. Se sigue exportando para poder probarlo sin red.
 */
export function buildDocumentHtml(input: GoogleDocInput): string {
  const meta = [
    formatDateTime(input.startedAt),
    input.recordedByName ? `Grabado por ${esc(input.recordedByName)}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join(" · ");

  const header = [
    `<img src="${LOGO_URL}" width="46" height="46" alt="ihsan.co" style="margin:0 0 10pt 0">`,
    `<p style="font-family:${FONT};font-size:12pt;font-weight:700;letter-spacing:1.6pt;color:${INK_FAINT};margin:0 0 6pt 0">IHSAN.CO · BRIEF DE LLAMADA</p>`,
    `<h1 style="font-family:${FONT};font-size:30pt;font-weight:700;letter-spacing:-0.9pt;line-height:1.08;margin:0 0 8pt 0;color:${INK}">${esc(input.title)}</h1>`,
    input.brief?.headline
      ? `<p style="font-family:${FONT};font-size:14pt;font-weight:600;letter-spacing:-0.3pt;color:${INK_SOFT};margin:0 0 10pt 0;line-height:1.3">${esc(input.brief.headline)}</p>`
      : null,
    `<p style="font-size:10pt;color:${INK_FAINT};margin:0">${meta}</p>`,
    input.shareUrl
      ? `<p style="font-size:10pt;margin:5pt 0 0 0"><a href="${esc(input.shareUrl)}" style="color:${INK_SOFT}">Ver la grabación en Fathom</a></p>`
      : null,
    `<div style="border-top:2px solid ${INK};margin:16pt 0 0 0;height:1px"></div>`,
  ]
    .filter((line): line is string => line !== null)
    .join("");

  const blocks: Array<string | null> = [
    header,
    ...briefSections(input.brief),
    // El resumen propio de Fathom se queda fuera: no es un resumen, es un volcado
    // exhaustivo donde cada punto llega como enlace markdown con marca de tiempo. Se
    // comía el documento entero y enterraba el análisis. Quien quiera ese detalle tiene
    // el enlace a la grabación en la cabecera.
    section("Tareas", bullets(input.actionItems)),
    section("Asistentes", bullets(input.attendees)),
    // La transcripción completa se queda fuera a propósito: convertía cada documento en
    // ~37 páginas que nadie lee y enterraba lo único que se consulta —análisis, tono,
    // riesgos y compromisos—. El texto íntegro sigue en Supabase y en Fathom, cuyo
    // enlace va en la cabecera, así que no se pierde: se deja de repetir.
  ];

  const body = blocks.filter((block): block is string => Boolean(block)).join("");

  // El fondo va en la celda de una tabla a ancho completo, no en <body>: Drive descarta
  // el color de fondo del documento al convertir HTML, y si el negro no llegase mientras
  // el texto blanco sí, el documento saldría invisible. El fondo de una celda sí
  // sobrevive a la conversión, así que el negro y la tinta blanca viajan juntos.
  const shell =
    `<table width="100%" cellpadding="28" cellspacing="0" ` +
    `style="background-color:${PAPER};border-collapse:collapse;width:100%">` +
    `<tr><td style="background-color:${PAPER};color:${INK}">${body}</td></tr></table>`;

  return [
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head>`,
    `<body style="font-family:${FONT};background-color:${PAPER};color:${INK};font-size:11pt;line-height:1.5;margin:0">`,
    shell,
    `</body></html>`,
  ].join("");
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
      media: { mimeType: UPLOAD_MIME, body: buildDocumentHtml(input) },
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
