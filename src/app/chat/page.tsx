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
          title="Chat"
          lede="Pregunta sobre las llamadas archivadas. Las respuestas salen solo de sus briefs y compromisos, y citan de qué reunión y de qué fecha vienen."
        />
      </div>

      <div className={styles.body}>
        <div className={styles.inner}>
          <p className={styles.statement}>
            Pregunta lo que necesites sobre las llamadas archivadas.
          </p>
          <p className={styles.note}>
            Responde únicamente con el material indexado aquí abajo: el brief de cada llamada y sus
            compromisos abiertos, nunca la transcripción completa. Si algo no consta, lo dirá en vez
            de suponerlo. Ni las preguntas ni las respuestas se guardan: el hilo se pierde al
            recargar.
          </p>

          <div className={styles.cards}>
            <div className={styles.card}>
              <p className={styles.cardLabel}>
                <span className={styles.cardDot} aria-hidden="true" />
                Llamadas
              </p>
              <span className={`num ${styles.cardValue}`}>{scope.meetings}</span>
              <span className={styles.cardNote}>Grabaciones archivadas desde Fathom</span>
            </div>

            <div className={styles.card}>
              <p className={styles.cardLabel}>
                <span className={styles.cardDot} aria-hidden="true" />
                Transcripciones
              </p>
              <span className={`num ${styles.cardValue}`}>{scope.withTranscript}</span>
              <span className={styles.cardNote}>Grabaciones con el texto completo guardado</span>
            </div>

            <div className={styles.card}>
              <p className={styles.cardLabel}>
                <span className={styles.cardDot} aria-hidden="true" />
                Compromisos
              </p>
              <span className={`num ${styles.cardValue}`}>{scope.openCommitments}</span>
              <span className={styles.cardNote}>Pendientes extraídos de esas llamadas</span>
            </div>

            <div className={styles.card}>
              <p className={styles.cardLabel}>
                <span
                  className={styles.cardDot}
                  data-tone={scope.briefs === 0 ? "warn" : undefined}
                  aria-hidden="true"
                />
                Briefs
              </p>
              <span className={`num ${styles.cardValue}`}>{scope.briefs}</span>
              <span className={styles.cardNote}>
                {scope.briefs === 0
                  ? "Ninguno generado todavía: el análisis de IA no ha corrido"
                  : "Resúmenes de IA disponibles"}
              </span>
            </div>
          </div>

          <p className={styles.indexed}>
            <span className={styles.cardDot} aria-hidden="true" />
            <span className="num">
              Indexado: {scope.meetings} llamadas · {scope.withTranscript} transcripciones ·{" "}
              {scope.briefs} briefs
            </span>
          </p>
        </div>
      </div>

      <ChatConversation />
    </div>
  );
}
