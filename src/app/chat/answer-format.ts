/**
 * Formato mínimo y seguro de las respuestas del asistente.
 *
 * El modelo escribe con cuatro marcas (**negrita**, «- », «1. », «### »). Aquí se
 * convierten en una estructura de datos que el componente pinta como elementos de
 * React: el texto nunca entra como HTML, así que nada de lo que diga el modelo (ni lo
 * que alguien dictara en una llamada) puede inyectar marcado.
 */

export type Inline = { text: string; bold: boolean };

export type Block =
  | { kind: "heading"; content: Inline[] }
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "ul"; items: Inline[][] }
  | { kind: "ol"; items: Inline[][] };

/** Parte `**así**` en tramos; un `**` sin cerrar (p. ej. a mitad de streaming) queda como texto. */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    const start = match.index;
    if (start > last) out.push({ text: line.slice(last, start), bold: false });
    out.push({ text: match[1] ?? "", bold: true });
    last = start + match[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), bold: false });
  return out;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

export function parseAnswer(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({
      kind: "paragraph",
      content: parseInline(paragraph.join(" ")),
    });
    paragraph = [];
  };

  const pushItem = (kind: "ul" | "ol", body: string) => {
    flushParagraph();
    const previous = blocks.at(-1);
    const item = parseInline(body);
    if (previous && previous.kind === kind) previous.items.push(item);
    else blocks.push({ kind, items: [item] });
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flushParagraph();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "heading", content: parseInline(heading[1] ?? "") });
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      pushItem("ul", bullet[1] ?? "");
      continue;
    }
    const numbered = NUMBERED.exec(line);
    if (numbered) {
      pushItem("ol", numbered[1] ?? "");
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  return blocks;
}

export type Source = { id: number; title: string; date: string | null };

/** Las llamadas cuyo título aparece en la respuesta: son las que el asistente citó. */
export function citedSources(answer: string, sources: readonly Source[]): Source[] {
  const haystack = answer.toLocaleLowerCase("es");
  const seen = new Set<number>();
  return sources.filter((source) => {
    const title = source.title.trim().toLocaleLowerCase("es");
    if (title.length < 4 || seen.has(source.id) || !haystack.includes(title)) return false;
    seen.add(source.id);
    return true;
  });
}
