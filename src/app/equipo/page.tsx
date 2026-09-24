import type { Metadata } from "next";

import { TeamBoard } from "@/components/team/TeamBoard";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { listTeamBoard } from "@/lib/queries/team";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Equipo",
  description:
    "Quién graba y quién tiene compromisos abiertos, calculado a partir de las propias llamadas.",
};

export default async function EquipoPage() {
  const members = await listTeamBoard();
  const open = members.reduce((total, member) => total + member.stats.todo.openCommitments, 0);

  return (
    <div className="wrap">
      <PageHeader
        kicker={
          members.length === 1
            ? "1 persona en las grabaciones"
            : `${String(members.length)} personas en las grabaciones`
        }
        title="Equipo"
        lede={
          members.length === 0
            ? "Aquí aparecerá cada persona en cuanto grabe una llamada o se le asigne un compromiso."
            : `Cada persona sale de las propias llamadas: de quién grabó o de a quién quedó asignado algo. Hoy hay ${String(open)} compromisos abiertos repartidos entre ellas.`
        }
      />

      {members.length === 0 ? (
        <EmptyState
          size="block"
          title="Todavía no hay nadie"
          body="Ninguna grabación registra quién la grabó ni deja compromisos asignados, así que no hay ninguna persona de la que informar."
          hint="No hay nada que configurar: la lista se construye sola con las llamadas."
        />
      ) : (
        <TeamBoard members={members} />
      )}
    </div>
  );
}
