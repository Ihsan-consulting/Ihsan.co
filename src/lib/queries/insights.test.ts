import { describe, expect, it } from "vitest";

import {
  aggregateInsights,
  formatMoney,
  normalizeCurrency,
  parseObjections,
  parsePayments,
  type InsightRowInput,
  type MeetingRef,
} from "./insights";

const NOW = new Date("2026-09-29T12:00:00Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function row(id: number, partial: Partial<InsightRowInput>): InsightRowInput {
  return {
    recording_id: id,
    created_at: daysAgo(0),
    call_score: null,
    objections: null,
    payments: null,
    goals: null,
    ...partial,
  };
}

const meetings = new Map<number, MeetingRef>([
  [1, { recordingId: 1, title: "Llamada A", startedAt: daysAgo(2) }],
  [2, { recordingId: 2, title: "Llamada B", startedAt: daysAgo(9) }],
  [3, { recordingId: 3, title: "Llamada C", startedAt: daysAgo(1) }],
]);

describe("parsers", () => {
  it("returns null for unanalyzed columns and skips malformed entries", () => {
    expect(parseObjections(null)).toBeNull();
    expect(
      parseObjections([
        { objection: "  Es caro ", response: null, resolved: true },
        { objection: "" },
        "texto suelto",
        { response: "sin objeción" },
      ]),
    ).toEqual([{ objection: "Es caro", response: null, resolved: true }]);
  });

  it("validates payment status and normalizes currency", () => {
    expect(
      parsePayments([
        { concept: "Mentoría", amount: 1500, currency: "€", status: "acordado" },
        { concept: "Curso", amount: "900", currency: "eur", status: "pagado" },
        { concept: "Raro", amount: 10, currency: "EUR", status: "regalado" },
        { amount: 10, status: "pagado" },
      ]),
    ).toEqual([
      { concept: "Mentoría", amount: 1500, currency: "EUR", status: "acordado" },
      { concept: "Curso", amount: null, currency: "EUR", status: "pagado" },
    ]);
    expect(normalizeCurrency("usd")).toBe("USD");
    expect(normalizeCurrency("monedas")).toBeNull();
  });
});

describe("aggregateInsights", () => {
  const rows = [
    row(1, {
      call_score: 80,
      objections: [
        { objection: "Es muy caro", response: "Plan de pagos", resolved: true },
        { objection: "No tengo tiempo", response: null, resolved: false },
      ],
      payments: [{ concept: "Mentoría", amount: 1500, currency: "EUR", status: "acordado" }],
      goals: ["Llegar a 10k al mes"],
    }),
    row(2, {
      call_score: 40,
      objections: [{ objection: "es muy caro.", response: null, resolved: false }],
      payments: [
        { concept: "Curso", amount: 500, currency: "EUR", status: "pendiente" },
        { concept: "Extra", amount: 200, currency: "USD", status: "pagado" },
      ],
      goals: [],
    }),
    row(3, { call_score: 60, objections: [], payments: [], goals: ["Lanzar el curso"] }),
    row(4, {}),
  ];

  const result = aggregateInsights(rows, meetings, { now: NOW });

  it("counts analyzed vs pending briefs", () => {
    expect(result.analyzed).toBe(3);
    expect(result.pendingAnalysis).toBe(1);
  });

  it("groups objections case-insensitively with resolved rate and latest call", () => {
    expect(result.objectionsTotal).toBe(3);
    const top = result.objections[0];
    expect(top?.count).toBe(2);
    expect(top?.resolvedPct).toBe(50);
    expect(top?.latest.recordingId).toBe(1);
  });

  it("sums payments by status and currency without converting", () => {
    expect(result.agreedEur).toBe(1500);
    expect(result.agreedOtherCurrencies).toBe(1);
    const pending = result.paymentTotals.find((t) => t.status === "pendiente");
    expect(pending).toMatchObject({ currency: "EUR", total: 500, count: 1 });
    expect(result.latestPayments[0]?.meeting.title).toBe("Llamada A");
  });

  it("lists latest goals first and averages scores by window", () => {
    expect(result.goals.map((g) => g.goal)).toEqual(["Lanzar el curso", "Llegar a 10k al mes"]);
    expect(result.score.average).toBe(60);
    expect(result.score.last7).toBe(70);
    expect(result.score.prev7).toBe(40);
    expect(result.score.weekly).toHaveLength(8);
  });

  it("returns honest empty values with no rows", () => {
    const empty = aggregateInsights([], meetings, { now: NOW });
    expect(empty.score.average).toBeNull();
    expect(empty.objections).toEqual([]);
    expect(empty.agreedEur).toBe(0);
  });
});

describe("formatMoney", () => {
  it("formats EUR with es-ES and leaves unknown currency bare", () => {
    expect(formatMoney(1500, "EUR")).toMatch(/1\.?500\s?€/);
    expect(formatMoney(12, null)).toBe("12");
  });
});
