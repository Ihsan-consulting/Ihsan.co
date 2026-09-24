import Link from "next/link";

import {
  formatDateTime,
  formatDayMonth,
  formatDuration,
  formatSentiment,
  initials,
  isoAttribute,
} from "@/components/formatting";
import { EmptyState, StatTile, StatusBadge, Tag, type Tone } from "@/components/ui/primitives";
import type { ClientAccount, ClientCall } from "@/lib/queries/clients";

import styles from "./clients.module.css";

/**
 * Ficha del cliente. Todo lo que se dibuja sale de sus grabaciones: no hay etapa de
 * pipeline ni datos de pago en la base, así que esos bloques se quedan en el estado
 * vacío que el diseño les reserva en lugar de rellenarse con cifras inventadas.
 */

const STAGES = ["Lead", "Onboarding", "Activo", "Renovación", "En riesgo"] as const;

function toneOf(sentiment: string | null): Tone {
  const raw = sentiment?.trim().toLowerCase() ?? "";
  if (raw === "positive" || raw === "positivo") return "ok";
  if (raw === "mixed" || raw === "mixto") return "warn";
  if (raw === "negative" || raw === "negativo") return "danger";
  return "neutral";
}

function callSummary(call: ClientCall): string {
  return call.headline ?? "Sin resumen de IA todavía: la grabación aún no tiene brief.";
}

export function ClientFicha({ account }: { account: ClientAccount }) {
  const analysed = account.calls.filter((call) => call.hasBrief);
  const openCommitments = account.commitments.filter((item) => !item.completed);
  const lastCall = account.calls[0];
  const people = account.contacts.length;

  return (
    <section className={styles.ficha} aria-label={`Ficha de ${account.domain}`}>
      <div className={styles.fichaHead}>
        <span className={styles.fichaAvatar} aria-hidden="true">
          {initials(account.domain, null)}
        </span>

        <div className={styles.fichaTitle}>
          <h2 className={styles.fichaName}>{account.domain}</h2>
          <p className={styles.fichaMeta}>
            <span className="num">{people}</span> {people === 1 ? "persona" : "personas"} ·{" "}
            <span className="num">{account.calls.length}</span>{" "}
            {account.calls.length === 1 ? "llamada" : "llamadas"} · última el{" "}
            {formatDateTime(account.lastCallAt)}
          </p>
        </div>

        <div className={styles.fichaActions}>
          <Tag tone={account.openCommitments > 0 ? "warn" : "ok"}>
            {account.openCommitments > 0
              ? `${String(account.openCommitments)} sin cerrar`
              : "Sin compromisos abiertos"}
          </Tag>
          {lastCall ? (
            <Link href={`/meetings/${String(lastCall.recordingId)}`} className={styles.primary}>
              Abrir última llamada
            </Link>
          ) : null}
          <Link href="/chat" className={styles.ghost}>
            Preguntar al chat
          </Link>
        </div>
      </div>

      <div className={styles.stage}>
        <div className={styles.stageHead}>
          <span className={styles.stageTitle}>Etapa</span>
          <span className={styles.stageNote}>
            Sin etapa registrada: no hay ningún CRM conectado a este panel.
          </span>
        </div>
        <div className={styles.stageBars}>
          {STAGES.map((stage) => (
            <span key={stage} className={styles.stageStep}>
              <span className={styles.stageBar} aria-hidden="true" />
              <span className={styles.stageLabel}>{stage}</span>
            </span>
          ))}
        </div>
      </div>

      <div className={styles.stats}>
        <StatTile
          label="Llamadas"
          value={account.calls.length}
          note="Grabadas con Fathom"
          href={lastCall ? `/meetings/${String(lastCall.recordingId)}` : undefined}
        />
        <StatTile label="Personas" value={people} note="Asistentes de este dominio" />
        <StatTile
          label="Compromisos abiertos"
          value={account.openCommitments}
          tone={account.openCommitments > 0 ? "accent" : "ok"}
          note={`${String(account.commitments.length)} en total`}
        />
        <StatTile
          label="Última llamada"
          value={formatDayMonth(account.lastCallAt)}
          note={account.lastCallAt ? formatDateTime(account.lastCallAt) : "Sin fecha"}
        />
      </div>

      <div className={styles.columns}>
        <div className={styles.column}>
          <section aria-labelledby={`historial-${account.domain}`}>
            <div className={styles.blockHead}>
              <h3 id={`historial-${account.domain}`} className={styles.blockTitle}>
                <span className={styles.blockMark} data-tone="accent" aria-hidden="true" />
                Historial de llamadas
              </h3>
            </div>
            <div className={styles.panel}>
              {account.calls.length === 0 ? (
                <EmptyState
                  title="Sin llamadas"
                  body="Este dominio aparece entre los asistentes, pero todavía no hay ninguna grabación asociada."
                />
              ) : (
                account.calls.map((call) => (
                  <Link
                    key={call.recordingId}
                    href={`/meetings/${String(call.recordingId)}`}
                    className={styles.call}
                  >
                    <span className={styles.callTop}>
                      <time
                        className={`num ${styles.callDate}`}
                        dateTime={isoAttribute(call.startedAt)}
                      >
                        {formatDateTime(call.startedAt)}
                      </time>
                      <span className={`num ${styles.callDuration}`}>
                        {formatDuration(call.startedAt, call.endedAt) ?? "Duración desconocida"}
                      </span>
                      <StatusBadge status={call.deliveryStatus} emptyLabel="Sin envío" />
                      <span className={styles.callSpacer} />
                      <span
                        className={`num ${styles.callNote}`}
                        data-alert={call.openItems > 0 ? "true" : undefined}
                      >
                        {call.openItems} sin cerrar
                      </span>
                    </span>
                    <span className={styles.callSummary}>{callSummary(call)}</span>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section aria-labelledby={`acordado-${account.domain}`}>
            <div className={styles.blockHead}>
              <h3 id={`acordado-${account.domain}`} className={styles.blockTitle}>
                <span className={styles.blockMark} aria-hidden="true" />
                Lo acordado
              </h3>
              <span className={`num ${styles.blockNote}`}>{account.commitments.length}</span>
            </div>
            <div className={`${styles.panel} ${styles.panelPad}`}>
              {account.commitments.length === 0 ? (
                <EmptyState
                  title="Nada acordado todavía"
                  body="Fathom no ha extraído ningún compromiso de las llamadas con este cliente."
                />
              ) : (
                <div className={styles.notes}>
                  {account.commitments.map((item) => (
                    <p key={item.id} className={styles.note}>
                      <time
                        className={`num ${styles.noteDate}`}
                        dateTime={isoAttribute(item.meetingStartedAt)}
                      >
                        {formatDayMonth(item.meetingStartedAt)}
                      </time>
                      <span
                        className={styles.noteText}
                        data-done={item.completed ? "true" : undefined}
                      >
                        {item.description}
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className={styles.column}>
          <section aria-labelledby={`tono-${account.domain}`}>
            <div className={styles.blockHead}>
              <h3 id={`tono-${account.domain}`} className={styles.blockTitle}>
                <span className={styles.blockMark} data-tone="warn" aria-hidden="true" />
                Evolución del tono
              </h3>
            </div>
            <div className={styles.toneCard}>
              {analysed.length > 0 ? (
                <div className={styles.toneStrip} aria-hidden="true">
                  {analysed.map((call) => (
                    <span
                      key={call.recordingId}
                      className={styles.toneBar}
                      data-tone={toneOf(call.sentiment)}
                      title={`${formatDayMonth(call.startedAt)} · ${formatSentiment(call.sentiment) ?? "Sin tono"}`}
                    />
                  ))}
                </div>
              ) : (
                <Tag>Sin tono analizado</Tag>
              )}
              <p className={styles.toneText}>
                {analysed.length > 0
                  ? `Tono detectado en ${String(analysed.length)} de ${String(account.calls.length)} llamadas.`
                  : "Ninguna de sus llamadas tiene brief, así que no hay tono que comparar: el análisis de IA todavía no ha corrido."}
              </p>
            </div>
          </section>

          <section aria-labelledby={`abiertos-${account.domain}`}>
            <div className={styles.blockHead}>
              <h3 id={`abiertos-${account.domain}`} className={styles.blockTitle}>
                <span className={styles.blockMark} data-tone="danger" aria-hidden="true" />
                Compromisos abiertos
              </h3>
              <span className={`num ${styles.blockNote}`}>
                {openCommitments.length} de {account.commitments.length}
              </span>
            </div>
            <div className={styles.panel}>
              {openCommitments.length === 0 ? (
                <EmptyState
                  title="Sin compromisos pendientes"
                  body="No queda nada abierto con este cliente."
                />
              ) : (
                openCommitments.map((item) => (
                  <Link
                    key={item.id}
                    href={`/meetings/${String(item.recordingId)}`}
                    className={styles.commit}
                  >
                    <span className={styles.commitMark} aria-hidden="true" />
                    <span className={styles.commitBody}>
                      <span className={styles.commitText}>{item.description}</span>
                      <span className={styles.commitMeta}>
                        <span className={styles.commitAvatar} aria-hidden="true">
                          {initials(item.assigneeName, item.assigneeEmail)}
                        </span>
                        {item.assigneeName ?? item.assigneeEmail ?? "Sin responsable"} · de la
                        llamada del {formatDayMonth(item.meetingStartedAt)}
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
