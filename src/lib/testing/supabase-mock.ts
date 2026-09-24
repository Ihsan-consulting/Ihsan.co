import type { AdminClient } from "@/lib/supabase/admin";

/** Postgrest-shaped envelope every awaited query builder resolves to. */
export type QueryOutcome = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
};

export type RecordedCall = {
  table: string;
  ops: string[];
  args: unknown[][];
};

export type OutcomeResolver = (table: string, ops: readonly string[]) => QueryOutcome;

const DEFAULT_OUTCOME: QueryOutcome = { data: null, error: null };

/**
 * A chainable stand-in for the service-role client. Every builder method is recorded and
 * returns the same proxy, and awaiting it resolves through `resolve(table, ops)` — which
 * lets a test answer differently for, say, `deliveries.select` and `deliveries.upsert`.
 */
export function createSupabaseMock(
  resolve: OutcomeResolver = () => DEFAULT_OUTCOME,
): { client: AdminClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];

  const from = (table: string): unknown => {
    const record: RecordedCall = { table, ops: [], args: [] };
    calls.push(record);

    const chain: unknown = new Proxy(
      {},
      {
        get(_target, property) {
          if (typeof property !== "string") return undefined;

          if (property === "then") {
            const settled = Promise.resolve({
              ...DEFAULT_OUTCOME,
              ...resolve(table, record.ops),
            });
            return settled.then.bind(settled);
          }

          return (...args: unknown[]) => {
            record.ops.push(property);
            record.args.push(args);
            return chain;
          };
        },
      },
    );

    return chain;
  };

  return { client: { from } as unknown as AdminClient, calls };
}

/** Finds the recorded call for a table whose chain includes the given operation. */
export function findCall(
  calls: readonly RecordedCall[],
  table: string,
  op: string,
): RecordedCall | undefined {
  return calls.find((call) => call.table === table && call.ops.includes(op));
}
