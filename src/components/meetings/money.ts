import type { PaymentStatus } from "@/lib/queries/meetings";

/** Client-safe (sin `server-only`): lo usan tanto el detalle como el cajón de datos. */
export function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null) return "Importe sin concretar";
  const code = currency?.trim().toUpperCase() || null;
  try {
    return new Intl.NumberFormat("es-ES", {
      style: code ? "currency" : "decimal",
      currency: code ?? undefined,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat("es-ES").format(amount)} ${code ?? ""}`.trim();
  }
}

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pagado: "Pagado",
  acordado: "Acordado",
  pendiente: "Pendiente",
  mencionado: "Mencionado",
};

export function scoreTone(score: number): "ok" | "warn" | "danger" {
  if (score >= 70) return "ok";
  if (score >= 45) return "warn";
  return "danger";
}

export function scoreVerdict(score: number): string {
  if (score >= 85) return "Llamada excelente";
  if (score >= 70) return "Buena llamada";
  if (score >= 45) return "Mejorable";
  return "Llamada floja";
}
