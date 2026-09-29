import Link from "next/link";

import { formatDayMonth } from "@/components/formatting";
import { EmptyState } from "@/components/ui/primitives";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
  formatMoney,
  type GoalEntry,
  type ObjectionGroup,
  type PaymentEntry,
  type PaymentStatus,
  type PaymentTotal,
} from "@/lib/queries/insights";

import styles from "./insights.module.css";

/**
 * Bloques de negocio del Inicio: objeciones, pagos y objetivos del cliente. Todo sale
 * de las fichas de IA; si ninguna ficha está analizada todavía se dice tal cual.
 */

function NotAnalyzed({ what, pending }: { what: string; pending: number }) {
  return (
    <EmptyState
      title="Todavía sin analizar"
      body={`Ninguna llamada tiene ${what} extraídos aún.`}
      hint={
        pending > 0
          ? `${String(pending)} fichas esperan el re-análisis que rellena estos datos.`
          : "Aparecerán en cuanto se analice la próxima llamada."
      }
    />
  );
}

function MeetingLink({ recordingId, title }: { recordingId: number; title: string }) {
  return (
    <Link href={`/meetings/${String(recordingId)}`} className={styles.meetingLink}>
      {title}
    </Link>
  );
}

type ObjectionsProps = {
  groups: ReadonlyArray<ObjectionGroup>;
  analyzed: number;
  pending: number;
};

export function ObjectionsPanel({ groups, analyzed, pending }: ObjectionsProps) {
  if (analyzed === 0) return <NotAnalyzed what="objeciones" pending={pending} />;
  if (groups.length === 0) {
    return (
      <EmptyState
        title="Sin objeciones registradas"
        body={`En las ${String(analyzed)} llamadas analizadas el cliente no planteó objeciones.`}
      />
    );
  }

  const peak = Math.max(...groups.map((group) => group.count), 1);

  return (
    <ol className={styles.objections}>
      {groups.map((group, index) => (
        <li key={group.key} className={styles.objection}>
          <span className={`num ${styles.rank}`}>{String(index + 1).padStart(2, "0")}</span>
          <div className={styles.objectionBody}>
            <p className={styles.objectionText}>{group.text}</p>
            <span className={styles.track} aria-hidden="true">
              <span
                className={styles.fill}
                style={{ width: `${String(Math.round((group.count / peak) * 100))}%` }}
              />
              <span
                className={styles.fillResolved}
                style={{
                  width: `${String(Math.round((group.resolvedCount / peak) * 100))}%`,
                }}
              />
            </span>
            {group.latestResponse ? (
              <p className={styles.response}>Respuesta: {group.latestResponse}</p>
            ) : null}
            <p className={styles.objectionMeta}>
              Última vez en{" "}
              <MeetingLink recordingId={group.latest.recordingId} title={group.latest.title} />
              {group.latest.startedAt ? ` · ${formatDayMonth(group.latest.startedAt)}` : ""}
            </p>
          </div>
          <div className={styles.objectionStats}>
            <span className={`num ${styles.count}`}>×{group.count}</span>
            <span
              className={`num ${styles.resolved}`}
              data-tone={group.resolvedPct >= 50 ? "ok" : "warn"}
            >
              {group.resolvedPct}% resuelta
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

const STATUS_TONE: Record<PaymentStatus, string> = {
  pagado: "ok",
  acordado: "accent",
  pendiente: "warn",
  mencionado: "neutral",
};

type PaymentsProps = {
  totals: ReadonlyArray<PaymentTotal>;
  latest: ReadonlyArray<PaymentEntry>;
  analyzed: number;
  pending: number;
};

export function PaymentsPanel({ totals, latest, analyzed, pending }: PaymentsProps) {
  if (analyzed === 0) return <NotAnalyzed what="pagos" pending={pending} />;
  if (totals.length === 0) {
    return (
      <EmptyState
        title="Sin pagos mencionados"
        body={`Ninguna de las ${String(analyzed)} llamadas analizadas habló de importes o pagos.`}
      />
    );
  }

  const byStatus = PAYMENT_STATUSES.map((status) => ({
    status,
    rows: totals.filter((total) => total.status === status),
  })).filter((entry) => entry.rows.length > 0);

  return (
    <div className={styles.payments}>
      <ul className={styles.statusGrid}>
        {byStatus.map(({ status, rows }) => {
          const count = rows.reduce((sum, row) => sum + row.count, 0);
          const withAmount = rows.filter((row) => row.total > 0);
          return (
            <li key={status} className={styles.statusCell} data-tone={STATUS_TONE[status]}>
              <span className={styles.statusLabel}>{PAYMENT_STATUS_LABELS[status]}</span>
              <span className={`num ${styles.statusValue}`}>
                {withAmount.length > 0
                  ? withAmount.map((row) => formatMoney(row.total, row.currency)).join(" + ")
                  : "Sin importe"}
              </span>
              <span className={`num ${styles.statusNote}`}>
                {count} {count === 1 ? "mención" : "menciones"}
              </span>
            </li>
          );
        })}
      </ul>

      <ul className={styles.list}>
        {latest.map((payment, index) => (
          <li key={`${String(payment.meeting.recordingId)}-${String(index)}`} className={styles.row}>
            <span className={styles.dot} data-tone={STATUS_TONE[payment.status]} aria-hidden="true" />
            <span className={styles.rowBody}>
              <span className={styles.rowTitle}>{payment.concept}</span>
              <span className={styles.rowMeta}>
                {PAYMENT_STATUS_LABELS[payment.status]} ·{" "}
                <MeetingLink
                  recordingId={payment.meeting.recordingId}
                  title={payment.meeting.title}
                />
              </span>
            </span>
            <span className={`num ${styles.rowValue}`}>
              {payment.amount === null ? "—" : formatMoney(payment.amount, payment.currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type GoalsProps = { goals: ReadonlyArray<GoalEntry>; analyzed: number; pending: number };

export function GoalsList({ goals, analyzed, pending }: GoalsProps) {
  if (analyzed === 0) return <NotAnalyzed what="objetivos del cliente" pending={pending} />;
  if (goals.length === 0) {
    return (
      <EmptyState
        title="Sin objetivos declarados"
        body="Los clientes todavía no han dicho en llamada qué quieren conseguir."
      />
    );
  }

  return (
    <ul className={styles.list}>
      {goals.map((entry, index) => (
        <li key={`${String(entry.meeting.recordingId)}-${String(index)}`} className={styles.row}>
          <span className={styles.goalMark} aria-hidden="true">
            ◎
          </span>
          <span className={styles.rowBody}>
            <span className={styles.rowTitle}>{entry.goal}</span>
            <span className={styles.rowMeta}>
              <MeetingLink recordingId={entry.meeting.recordingId} title={entry.meeting.title} />
              {entry.meeting.startedAt ? ` · ${formatDayMonth(entry.meeting.startedAt)}` : ""}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
