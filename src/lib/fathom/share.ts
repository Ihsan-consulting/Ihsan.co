/**
 * Enlaces públicos de Fathom. Solo se acepta la forma exacta
 * `https://fathom.video/share/<token>`: el valor acaba en el `src` de un iframe, así que
 * cualquier otra cosa (otro dominio, otro esquema, rutas raras) se descarta.
 */
const SHARE_URL = /^https:\/\/fathom\.video\/share\/([A-Za-z0-9_-]{8,128})\/?$/;

export function publicShareUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = SHARE_URL.exec(raw.trim());
  return match ? `https://fathom.video/share/${match[1]}` : null;
}

/** `/share/<token>` no se deja incrustar; `/embed/<token>` sí. */
export function fathomEmbedUrl(shareUrl: string | null | undefined): string | null {
  const clean = publicShareUrl(shareUrl);
  return clean ? clean.replace("/share/", "/embed/") : null;
}
