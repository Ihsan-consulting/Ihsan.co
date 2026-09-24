import { beforeEach, describe, expect, it, vi } from "vitest";

const { env, filesCreate, jwt } = vi.hoisted(() => ({
  env: { value: {} as Record<string, string | undefined> },
  filesCreate: vi.fn(),
  jwt: { options: undefined as { email?: string; key?: string; scopes?: string[] } | undefined },
}));

vi.mock("@/lib/env", () => ({ getEnv: () => env.value }));
vi.mock("googleapis", () => ({
  google: {
    auth: {
      JWT: class {
        constructor(options: { email?: string; key?: string; scopes?: string[] }) {
          jwt.options = options;
        }
      },
    },
    drive: () => ({ files: { create: filesCreate } }),
  },
}));

const { buildDocumentName, buildDocumentHtml, createMeetingDoc, isGoogleConfigured } = await import(
  "@/lib/google/docs"
);

/** La clave llega de una variable de entorno: `\n` de dos caracteres, no saltos reales. */
const ESCAPED_KEY =
  "-----BEGIN PRIVATE KEY-----\\nFAKEKEYLINE1\\nFAKEKEYLINE2\\n-----END PRIVATE KEY-----\\n";

const CONFIGURED = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "ihsan-docs@ihsan-co-471203.iam.gserviceaccount.com",
  GOOGLE_PROJECT_ID: "ihsan-co-471203",
  GOOGLE_DRIVE_FOLDER_ID: "1AbCdEfGhIjKlMnOpQrStUvWxYz012345",
  GOOGLE_PRIVATE_KEY: ESCAPED_KEY,
};

const INPUT = {
  title: "Kickoff Cliente Demo",
  startedAt: "2026-09-24T09:15:00.000Z",
  shareUrl: "https://fathom.video/share/demo",
  recordedByName: "Ana Demo",
  brief: {
    headline: "Cierre de alcance",
    executiveSummary: "Se confirmó el alcance de la fase 2.",
    keyDecisions: ["Aprobar fase 2"],
    risks: [],
    nextSteps: ["Enviar SOW el 2026-09-26"],
    sentiment: "positivo",
  },
  fathomSummaryMarkdown: "## Resumen de Fathom",
  actionItems: ["Enviar SOW"],
  attendees: ["Ana Demo", "Luis Cliente"],
  transcript: "Ana Demo: Confirmamos alcance",
};

const CREATED = {
  data: {
    id: "1zYxWvU_docId",
    webViewLink: "https://docs.google.com/document/d/1zYxWvU_docId/edit",
  },
};

beforeEach(() => {
  env.value = { ...CONFIGURED };
  jwt.options = undefined;
  filesCreate.mockReset();
});

describe("buildDocumentHtml", () => {
  it("incluye brief, resumen de Fathom, tareas y asistentes, sin transcripción", () => {
    const text = buildDocumentHtml(INPUT);

    expect(text).toContain("Kickoff Cliente Demo");
    expect(text).toContain("Grabado por Ana Demo");
    // El titular ya no es una sección: encabeza el documento, bajo el título.
    expect(text).toContain("IHSAN.CO · BRIEF DE LLAMADA");
    expect(text).toContain("Cierre de alcance");
    expect(text).toContain("RESUMEN EJECUTIVO");
    expect(text).toContain("DECISIONES CLAVE");
    expect(text).toContain('<li style="margin-bottom:6pt">Aprobar fase 2</li>');
    expect(text).toContain("PRÓXIMOS PASOS");
    expect(text).toContain("Enviar SOW el 2026-09-26");
    expect(text).toContain("RESUMEN DE FATHOM");
    expect(text).toContain("TAREAS");
    expect(text).toContain("ASISTENTES");
    expect(text).toContain("Luis Cliente");
    // La transcripción se excluye a propósito: hacía documentos de ~37 páginas que
    // enterraban el análisis. El texto íntegro sigue en Supabase y en Fathom.
    expect(text).not.toContain("TRANSCRIPCIÓN");
    expect(text).not.toContain("Ana Demo: Confirmamos alcance");
  });

  it("omite las secciones vacías en lugar de dejar encabezados huérfanos", () => {
    const text = buildDocumentHtml({
      ...INPUT,
      brief: null,
      fathomSummaryMarkdown: null,
      actionItems: [],
      attendees: [],
    });

    expect(text).not.toContain("RESUMEN EJECUTIVO");
    expect(text).not.toContain("RIESGOS");
    expect(text).not.toContain("TAREAS");
    expect(text).not.toContain("TRANSCRIPCIÓN");
  });

  it("fecha el nombre del documento en es-ES y Europe/Madrid", () => {
    // Las 09:15 UTC del 24 de septiembre son las 11:15 en Madrid.
    const name = buildDocumentName(INPUT);

    expect(name).toContain("Kickoff Cliente Demo");
    expect(name).toContain("2026");
    expect(name).toContain("11:15");
  });
});

describe("createMeetingDoc", () => {
  it("convierte los `\\n` literales de la clave y crea el Doc en la carpeta", async () => {
    filesCreate.mockResolvedValue(CREATED);

    const result = await createMeetingDoc(INPUT);

    expect(result).toEqual({
      ok: true,
      docId: "1zYxWvU_docId",
      docUrl: "https://docs.google.com/document/d/1zYxWvU_docId/edit",
    });

    expect(jwt.options?.key).toContain("\n");
    expect(jwt.options?.key).not.toContain("\\n");
    expect(jwt.options?.scopes).toEqual(["https://www.googleapis.com/auth/drive.file"]);

    const request = filesCreate.mock.calls[0][0];
    expect(request.requestBody.mimeType).toBe("application/vnd.google-apps.document");
    expect(request.requestBody.parents).toEqual(["1AbCdEfGhIjKlMnOpQrStUvWxYz012345"]);
    expect(request.media.mimeType).toBe("text/html");
    expect(request.media.body).not.toContain("TRANSCRIPCIÓN");
  });

  it("deriva la URL del id cuando Drive no devuelve webViewLink", async () => {
    filesCreate.mockResolvedValue({ data: { id: "1zYxWvU_docId" } });

    await expect(createMeetingDoc(INPUT)).resolves.toEqual({
      ok: true,
      docId: "1zYxWvU_docId",
      docUrl: "https://docs.google.com/document/d/1zYxWvU_docId/edit",
    });
  });

  it("no intenta nada si falta cualquiera de las cuatro variables", async () => {
    env.value = { ...CONFIGURED, GOOGLE_DRIVE_FOLDER_ID: undefined };

    expect(isGoogleConfigured()).toBe(false);
    await expect(createMeetingDoc(INPUT)).resolves.toEqual({
      ok: false,
      reason: "google_not_configured",
    });
    expect(filesCreate).not.toHaveBeenCalled();
  });

  it("devuelve un motivo sin credenciales cuando Drive falla", async () => {
    filesCreate.mockRejectedValue(
      new Error(
        `403 sobre ${CONFIGURED.GOOGLE_SERVICE_ACCOUNT_EMAIL}: -----BEGIN PRIVATE KEY-----\nFAKEKEYLINE1\n-----END PRIVATE KEY-----`,
      ),
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createMeetingDoc(INPUT);
    const reason = result.ok ? "" : result.reason;

    expect(result.ok).toBe(false);
    expect(reason).toContain("google_docs_failed");
    expect(reason).toContain("403");
    expect(reason).not.toContain("FAKEKEYLINE1");
    expect(reason).not.toContain("BEGIN PRIVATE KEY");
    expect(reason).not.toContain(CONFIGURED.GOOGLE_SERVICE_ACCOUNT_EMAIL);

    spy.mockRestore();
  });

  it("señala la respuesta sin id en lugar de inventar una URL", async () => {
    filesCreate.mockResolvedValue({ data: {} });

    await expect(createMeetingDoc(INPUT)).resolves.toEqual({
      ok: false,
      reason: "google_docs_missing_id",
    });
  });
});
