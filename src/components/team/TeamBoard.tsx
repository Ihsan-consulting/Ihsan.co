"use client";

import Link from "next/link";
import { useState } from "react";

import { formatDateTime, formatDayMonth, initials, isoAttribute } from "@/components/formatting";
import type { TeamMember, TeamRange } from "@/lib/queries/team";

import styles from "./team.module.css";

/**
 * Tablero del equipo. Las cifras llegan ya calculadas desde servidor para los tres
 * rangos, así que cambiar de pestaña solo elige cuál se enseña: no se recalcula nada
 * en el navegador ni se pide otra lectura.
 */

const RANGES: ReadonlyArray<{ value: TeamRange; label: string }> = [
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "todo", label: "Todo" },
];

const FOCUS_LIMIT = 4;

export function TeamBoard({ members }: { members: TeamMember[] }) {
  const [range, setRange] = useState<TeamRange>("todo");

  return (
    <div className={styles.board}>
      <div className={styles.ranges} role="group" aria-label="Periodo de las cifras">
        {RANGES.map((option) => (
          <button
            key={option.value}
            type="button"
            className={styles.range}
            data-active={range === option.value ? "true" : undefined}
            aria-pressed={range === option.value}
            onClick={() => {
              setRange(option.value);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section className={styles.table} aria-label="Cifras por persona">
        <div className={styles.head}>
          <span>Persona</span>
          <span className={styles.right}>Llamadas</span>
          <span className={styles.right}>Compromisos</span>
          <span className={styles.right}>Entregas fallidas</span>
          <span className={styles.right}>Última actividad</span>
        </div>

        {members.map((member) => {
          const stats = member.stats[range];
          return (
            <div key={member.key} className={styles.row}>
              <span className={styles.person}>
                <span className={styles.avatar} aria-hidden="true">
                  {initials(member.name, member.email)}
                </span>
                <span className={styles.personBody}>
                  <span className={styles.personName}>{member.name}</span>
                  <span className={styles.personNote}>
                    {member.email ?? member.team ?? "Sin correo en las grabaciones"}
                  </span>
                </span>
              </span>

              <span className={`num ${styles.right}`}>
                <span className={styles.metric}>{stats.meetingsRecorded}</span>
                <span className={styles.metricNote}>grabadas</span>
              </span>

              <span className={`num ${styles.right}`}>
                <span
                  className={styles.metric}
                  data-tone={stats.openCommitments > 0 ? "warn" : undefined}
                >
                  {stats.openCommitments}
                </span>
                <span className={styles.metricNote}>sin cerrar</span>
              </span>

              <span className={`num ${styles.right}`}>
                <span
                  className={styles.metric}
                  data-tone={stats.failedDeliveries > 0 ? "danger" : undefined}
                >
                  {stats.failedDeliveries}
                </span>
                <span className={styles.metricNote}>sin publicar</span>
              </span>

              <span className={styles.right}>
                <time
                  className={`num ${styles.metricNote}`}
                  dateTime={isoAttribute(member.lastActivityAt)}
                >
                  {formatDateTime(member.lastActivityAt)}
                </time>
              </span>
            </div>
          );
        })}
      </section>

      <div className={styles.cards}>
        {members.map((member) => {
          const focus = member.commitments.slice(0, FOCUS_LIMIT);
          return (
            <article key={member.key} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardAvatar} aria-hidden="true">
                  {initials(member.name, member.email)}
                </span>
                <span className={styles.cardTitle}>
                  <span className={styles.cardName}>Resumen de {member.name}</span>
                  <span className={`num ${styles.cardNote}`}>
                    {member.commitments.length} compromisos abiertos en total
                  </span>
                </span>
              </div>

              <p className={styles.summary}>
                Sin resumen semanal: los briefs se generan con IA y todavía no hay ninguno en el
                archivo, así que no hay nada que resumir de sus llamadas.
              </p>

              <p className={styles.focusTitle}>Lo que tiene abierto</p>

              {focus.length === 0 ? (
                <p className={styles.focusEmpty}>Sin pendientes abiertos.</p>
              ) : (
                <div className={styles.focus}>
                  {focus.map((item) => (
                    <Link
                      key={item.id}
                      href={`/meetings/${String(item.recordingId)}`}
                      className={styles.focusItem}
                    >
                      <span className={styles.focusDot} aria-hidden="true" />
                      <span className={styles.focusBody}>
                        {item.description}
                        <span className={styles.focusMeta}>
                          {item.meetingTitle} · {formatDayMonth(item.meetingStartedAt)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {member.commitments.length > focus.length ? (
                <p className={`num ${styles.focusEmpty}`}>
                  Y {member.commitments.length - focus.length} más.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
