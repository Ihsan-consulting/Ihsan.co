import type { Metadata } from "next";

import { MeetingsExplorer } from "@/components/meetings/MeetingsExplorer";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { listMeetings } from "@/lib/queries/meetings";

import styles from "./meetings.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Llamadas",
  description: "Todas las llamadas grabadas con Fathom y su estado de entrega.",
};

export default async function MeetingsPage() {
  const meetings = await listMeetings(200);

  if (meetings.length === 0) {
    return (
      <div className={`wrap ${styles.emptyArchive}`}>
        <PageHeader
          kicker="Archivo"
          title="Llamadas"
          lede="Aquí aparecerán todas las grabaciones, de la más reciente a la más antigua, con su brief, sus compromisos y el estado de la publicación en Discord."
        />
        <EmptyState
          size="block"
          title="El archivo está vacío"
          body="Todavía no se ha registrado ninguna grabación. La primera llamada que envíe Fathom aparecerá aquí automáticamente."
          hint="No hace falta importar nada a mano."
        />
      </div>
    );
  }

  return <MeetingsExplorer meetings={meetings} />;
}
