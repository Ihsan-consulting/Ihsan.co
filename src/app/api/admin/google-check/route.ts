import { google } from "googleapis";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Asks Google what the configured folder actually is.
 *
 * "The user's Drive storage quota has been exceeded" is Drive's error for a service
 * account creating a file it would then own — service accounts have zero storage, so the
 * only fix is for the folder to live on a Shared Drive, which owns its files instead.
 * Telling those two cases apart by argument is hopeless; `driveId` settles it, because
 * Drive only returns it for a file inside a Shared Drive.
 *
 * Behind the session gate (`/api/admin/*` is not public) and returns no credential.
 */
export async function GET(): Promise<Response> {
  const env = getEnv();
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = env.GOOGLE_PRIVATE_KEY;
  const folderId = env.GOOGLE_DRIVE_FOLDER_ID;

  if (!email || !rawKey || !folderId) {
    return Response.json({ ok: false, error: "google_not_configured" }, { status: 400 });
  }

  let key = rawKey.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  if (!key.includes("-----BEGIN")) {
    const decoded = Buffer.from(key, "base64").toString("utf8");
    if (decoded.includes("-----BEGIN")) key = decoded.trim();
  }
  key = `${key.replace(/\\n/g, "\n").trim()}\n`;

  try {
    const auth = new google.auth.JWT({
      email,
      key,
      // Deliberately wider than the export's `drive.file`, which only ever sees files the
      // app itself created — a folder the user made is invisible under it, so the check
      // would 404 on a perfectly well-shared folder and prove nothing. Read-only.
      scopes: ["https://www.googleapis.com/auth/drive.metadata.readonly"],
    });
    const folder = await google.drive({ version: "v3", auth }).files.get({
      fileId: folderId,
      fields: "id, name, mimeType, driveId, parents",
      supportsAllDrives: true,
    });

    const driveId = folder.data.driveId ?? null;
    return Response.json({
      ok: true,
      carpeta: folder.data.name ?? null,
      esUnidadCompartida: driveId !== null,
      driveId,
      diagnostico:
        driveId !== null
          ? "La carpeta está en una unidad compartida. La creación de documentos debería funcionar."
          : "La carpeta está en 'Mi unidad'. Una cuenta de servicio no tiene espacio propio, así que cualquier documento que cree ahí será rechazado por cuota. Hay que moverla a una unidad compartida.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    // The folder id is not a secret; the key and the account address never appear here.
    return Response.json(
      { ok: false, error: message.slice(0, 200), folderId },
      { status: 502 },
    );
  }
}
