import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/primitives";
import { getCorpusScope } from "@/lib/queries/chat";

import { ChatConversation } from "./ChatConversation";
import styles from "./chat.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chat",
  description:
    "Preguntas sobre las llamadas archivadas, respondidas con lo que consta en sus briefs y compromisos.",
};

export default async function ChatPage() {
  const scope = await getCorpusScope();

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <PageHeader
          kicker={`${String(scope.meetings)} llamadas · ${String(scope.withTranscript)} con transcripción · fuente Fathom`}
          title="Asistente de llamadas"
          lede="Tu analista de llamadas: pregunta por escrito o por voz sobre objeciones, pagos, objetivos, riesgos y compromisos. Cada respuesta cita de qué reunión y de qué fecha sale."
        />
      </div>

      <ChatConversation scope={scope} />
    </div>
  );
}
