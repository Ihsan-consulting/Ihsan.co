import type { Metadata } from "next";

import { MeetingsExplorer } from "@/components/meetings/MeetingsExplorer";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { listMeetings } from "@/lib/queries/meetings";

import styles from "./meetings.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reuniones",
  description: "Todas las reuniones grabadas con Fathom y su estado de entrega.",
};

export default async function MeetingsPage() {
  const meetings = await listMeetings(200);

  const withoutBrief = meetings.filter((meeting) => !meeting.hasBrief).length;
  const failed = meetings.filter((meeting) => meeting.deliveryStatus === "failed").length;

  return (
    <div className="wrap">
      <PageHeader
        kicker="Archivo"
        title="Reuniones"
        lede="Todas las grabaciones recibidas, de la más reciente a la más antigua. Filtra por estado de entrega o busca por cliente, titular o persona que grabó."
        aside={
          <>
            <span className="num">{meetings.length} en total</span>
            {withoutBrief > 0 ? <span className="num">{withoutBrief} sin brief</span> : null}
            {failed > 0 ? <span className="num">{failed} con entrega fallida</span> : null}
          </>
        }
      />

      {meetings.length === 0 ? (
        <div className={styles.emptyArchive}>
          <EmptyState
            size="block"
            title="El archivo está vacío"
            body="Todavía no se ha registrado ninguna grabación. La primera reunión que envíe Fathom aparecerá aquí automáticamente."
            hint="No hace falta importar nada a mano."
          />
        </div>
      ) : (
        <MeetingsExplorer meetings={meetings} />
      )}
    </div>
  );
}
