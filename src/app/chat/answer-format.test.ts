import { describe, expect, it } from "vitest";

import { citedSources, parseAnswer, parseInline } from "./answer-format";

describe("parseInline", () => {
  it("separa negritas y deja el resto como texto", () => {
    expect(parseInline("Hay **3 pagos** pendientes")).toEqual([
      { text: "Hay ", bold: false },
      { text: "3 pagos", bold: true },
      { text: " pendientes", bold: false },
    ]);
  });

  it("deja un ** sin cerrar como texto (streaming a medias)", () => {
    expect(parseInline("Hay **3 pag")).toEqual([{ text: "Hay **3 pag", bold: false }]);
  });

  it("no interpreta HTML: el marcado queda como texto literal", () => {
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([
      { text: "<img src=x onerror=alert(1)>", bold: false },
    ]);
  });
});

describe("parseAnswer", () => {
  it("reconoce titular, subtítulo, viñetas y lista numerada", () => {
    const blocks = parseAnswer(
      "**Dos objeciones se repiten.**\n\n### Precio\n- Es caro (Kickoff, 18 sept)\n- Plazos\n\n1. Llamar\n2. Enviar",
    );

    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "heading", "ul", "ol"]);
    const list = blocks[2];
    expect(list?.kind === "ul" ? list.items.length : 0).toBe(2);
  });

  it("une líneas consecutivas en un mismo párrafo", () => {
    expect(parseAnswer("uno\ndos")).toEqual([
      { kind: "paragraph", content: [{ text: "uno dos", bold: false }] },
    ]);
  });
});

describe("citedSources", () => {
  const sources = [
    { id: 1, title: "Kickoff Cliente Demo", date: null },
    { id: 2, title: "Seguimiento Acme", date: null },
  ];

  it("devuelve sólo las llamadas que la respuesta nombra, sin distinguir mayúsculas", () => {
    expect(citedSources("Según kickoff cliente demo (18 sept)…", sources)).toEqual([sources[0]]);
  });

  it("no devuelve nada si no cita ninguna", () => {
    expect(citedSources("No consta en las llamadas archivadas.", sources)).toEqual([]);
  });
});
