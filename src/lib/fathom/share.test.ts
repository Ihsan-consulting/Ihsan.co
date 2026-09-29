import { describe, expect, it } from "vitest";

import { fathomEmbedUrl, publicShareUrl } from "./share";

describe("publicShareUrl", () => {
  it("acepta el enlace público de Fathom", () => {
    expect(publicShareUrl("https://fathom.video/share/Abc_123-xyzTOKEN")).toBe(
      "https://fathom.video/share/Abc_123-xyzTOKEN",
    );
  });

  it("descarta enlaces privados, otros dominios y esquemas", () => {
    expect(publicShareUrl("https://fathom.video/calls/839072104")).toBeNull();
    expect(publicShareUrl("https://evil.example/share/Abc_123-xyzTOKEN")).toBeNull();
    expect(publicShareUrl("javascript:alert(1)")).toBeNull();
    expect(publicShareUrl("https://fathom.video/share/abc?x=1")).toBeNull();
    expect(publicShareUrl(null)).toBeNull();
  });
});

describe("fathomEmbedUrl", () => {
  it("convierte /share/ en /embed/", () => {
    expect(fathomEmbedUrl("https://fathom.video/share/Abc_123-xyzTOKEN")).toBe(
      "https://fathom.video/embed/Abc_123-xyzTOKEN",
    );
  });
});
