"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { getAdminClient } from "@/lib/supabase/admin";

export type CommitmentResult = { ok: true } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cierra o reabre un compromiso desde el panel.
 *
 * El proxy ya exige sesión para cualquier POST a una página, pero esta acción escribe
 * con la clave de servicio, así que vuelve a comprobar la cookie en vez de fiarse solo
 * del matcher.
 */
export async function setCommitmentDone(id: string, done: boolean): Promise<CommitmentResult> {
  const secret = process.env.SESSION_SECRET;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!secret || !(await verifySessionToken(secret, token))) {
    return { ok: false, message: "La sesión ha caducado. Vuelve a entrar." };
  }

  if (typeof id !== "string" || !UUID.test(id) || typeof done !== "boolean") {
    return { ok: false, message: "Compromiso no válido." };
  }

  const { data, error } = await getAdminClient()
    .from("action_items")
    .update({ completed: done })
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[commitments] update failed", { id, message: error.message });
    return { ok: false, message: "No se pudo guardar. Inténtalo de nuevo." };
  }
  if (!data || data.length === 0) {
    return { ok: false, message: "Ese compromiso ya no existe." };
  }

  // El estado de un compromiso se ve en inicio, alertas, clientes, equipo y el detalle.
  revalidatePath("/", "layout");
  return { ok: true };
}
