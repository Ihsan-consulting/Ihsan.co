import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/primitives";
import { getCorpusScope } from "@/lib/queries/chat";

import styles from "./chat.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chat",
  description:
    "Qué material hay indexado de las llamadas y dónde ocurre de verdad la conversación sobre ellas.",
};

export default async function ChatPage() {
  const scope = await getCorpusScope();

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <PageHeader
          kicker={`${String(scope.meetings)} llamadas · ${String(scope.withTranscript)} con transcripción · fuente Fathom`}
          title="Chat"
          lede="La conversación sobre las llamadas ocurre en el bot de Discord. Este panel no guarda ningún hilo: aquí solo se ve qué material hay indexado para poder preguntar."
        />
      </div>

      <div className={styles.body}>
        <div className={styles.inner}>
          <p className={styles.statement}>
            Este panel no tiene chat propio. Lo que hay es el material sobre el que se puede
            preguntar.
          </p>
          <p className={styles.note}>
            El bot de Discord es quien responde sobre las llamadas y vive en otro repositorio. Para
            no fingir una conversación que no existe, esta pantalla no lleva campo de escritura: lo
            que se escribiera aquí no llegaría a ninguna parte.
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

      <div className={styles.dock}>
        <div className={styles.dockInner}>
          <span className={styles.dockIcon} aria-hidden="true">
            <svg
              viewBox="0 0 15 15"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3.2h11v7H6.8L3.6 12.6V10.2H2z" />
            </svg>
          </span>
          <span className={styles.dockBody}>
            <span className={styles.dockTitle}>Se pregunta desde Discord</span>
            <span className={styles.dockNote}>
              El bot publica cada resumen en el canal y responde ahí mismo sobre lo que se dijo. Si
              una llamada no aparece en Discord, su entrega estará en Alertas.
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
