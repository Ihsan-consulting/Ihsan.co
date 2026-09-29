import type { ReactNode } from "react";

import type { MeetingBrief, MeetingObjection, MeetingPayment } from "@/lib/queries/meetings";

import { PAYMENT_LABELS, formatMoney, scoreTone, scoreVerdict } from "./money";
import styles from "./insights.module.css";

/** Estado para briefs generados antes del análisis ampliado (aún sin re-analizar). */
export function PendingAnalysis({ what }: { what: string }) {
  return (
    <div className={styles.pending}>
      <span className={styles.pendingPulse} aria-hidden="true" />
      <div>
        <p className={styles.pendingTitle}>Análisis ampliado pendiente</p>
        <p className={styles.pendingBody}>
          Este brief es anterior a la extracción de {what}. Aparecerá aquí en cuanto se vuelva a
          analizar la llamada.
        </p>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 id={id} className={styles.sectionTitle}>
          {title}
        </h2>
        {count ? <span className={`num ${styles.sectionCount}`}>{count}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** Medidor semicircular 0-100. */
export function ScoreGauge({ score }: { score: number }) {
  const arc = Math.PI * 52;
  const filled = (score / 100) * arc;

  return (
    <div className={styles.gauge} data-tone={scoreTone(score)}>
      <svg viewBox="0 0 120 68" role="img" aria-label={`Puntuación ${score} de 100`}>
        <path d="M8 62 A52 52 0 0 1 112 62" className={styles.gaugeTrack} />
        <path
          d="M8 62 A52 52 0 0 1 112 62"
          className={styles.gaugeFill}
          strokeDasharray={`${filled} ${arc}`}
        />
      </svg>
      <span className={`num ${styles.gaugeValue}`}>{score}</span>
    </div>
  );
}

export function CallScorePanel({ score }: { score: number | null }) {
  return (
    <Section id="puntuacion" title="Puntuación de la llamada" count={score === null ? undefined : "sobre 100"}>
      {score === null ? (
        <PendingAnalysis what="la puntuación" />
      ) : (
        <div className={styles.scoreRow}>
          <ScoreGauge score={score} />
          <div>
            <p className={styles.scoreVerdict} data-tone={scoreTone(score)}>
              {scoreVerdict(score)}
            </p>
            <p className={styles.scoreHint}>
              Valoración de la IA sobre claridad, avance comercial y compromisos cerrados.
            </p>
          </div>
        </div>
      )}
    </Section>
  );
}

export function ObjectionList({ objections }: { objections: MeetingObjection[] | null }) {
  const resolved = objections?.filter((item) => item.resolved).length ?? 0;
  return (
    <Section
      id="objeciones"
      title="Objeciones"
      count={objections && objections.length > 0 ? `${resolved} de ${objections.length} resueltas` : undefined}
    >
      {objections === null ? (
        <PendingAnalysis what="objeciones" />
      ) : objections.length === 0 ? (
        <p className={styles.empty}>No se plantearon objeciones en esta llamada.</p>
      ) : (
        <ul className={styles.objections}>
          {objections.map((item, index) => (
            <li
              key={`objecion-${String(index)}`}
              className={styles.objection}
              data-resolved={item.resolved ? "true" : "false"}
            >
              <div className={styles.objectionHead}>
                <p className={styles.objectionText}>«{item.objection}»</p>
                <span className={styles.pill} data-tone={item.resolved ? "ok" : "danger"}>
                  {item.resolved ? "Resuelta" : "Sin resolver"}
                </span>
              </div>
              <p className={styles.objectionAnswer}>
                <span className={styles.answerLabel}>Cómo se respondió</span>
                {item.response ?? "No hubo una respuesta clara en la llamada."}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export const PAYMENT_TONES: Record<MeetingPayment["status"], string> = {
  pagado: "ok",
  acordado: "accent",
  pendiente: "warn",
  mencionado: "neutral",
};

export function PaymentList({ payments }: { payments: MeetingPayment[] | null }) {
  return (
    <Section id="pagos" title="Pagos" count={payments && payments.length > 0 ? String(payments.length) : undefined}>
      {payments === null ? (
        <PendingAnalysis what="pagos" />
      ) : payments.length === 0 ? (
        <p className={styles.empty}>No se habló de dinero en esta llamada.</p>
      ) : (
        <ul className={styles.payments}>
          {payments.map((item, index) => (
            <li key={`pago-${String(index)}`} className={styles.payment}>
              <span className={styles.paymentConcept}>{item.concept}</span>
              <span className={`num ${styles.paymentAmount}`}>
                {formatMoney(item.amount, item.currency)}
              </span>
              <span className={styles.pill} data-tone={PAYMENT_TONES[item.status]}>
                {PAYMENT_LABELS[item.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function GoalList({ goals }: { goals: string[] | null }) {
  return (
    <Section id="objetivos" title="Objetivos" count={goals && goals.length > 0 ? String(goals.length) : undefined}>
      {goals === null ? (
        <PendingAnalysis what="objetivos" />
      ) : goals.length === 0 ? (
        <p className={styles.empty}>El cliente no expresó objetivos concretos.</p>
      ) : (
        <ol className={styles.goals}>
          {goals.map((goal, index) => (
            <li key={`objetivo-${String(index)}`} className={styles.goal}>
              <span className={`num ${styles.goalIndex}`}>{String(index + 1).padStart(2, "0")}</span>
              <span>{goal}</span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

export function TodoList({ tasks }: { tasks: string[] }) {
  return (
    <Section id="todo" title="To-do" count={tasks.length > 0 ? String(tasks.length) : undefined}>
      {tasks.length === 0 ? (
        <p className={styles.empty}>El brief no extrajo tareas de esta llamada.</p>
      ) : (
        <ul className={styles.todos}>
          {tasks.map((task, index) => (
            <li key={`todo-${String(index)}`} className={styles.todo}>
              <span className={styles.todoBox} aria-hidden="true" />
              <span>{task}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Bloque del análisis ampliado, en el orden en que se lee una llamada comercial. */
export function ExtendedInsights({ brief }: { brief: MeetingBrief | null }) {
  if (!brief) return null;
  return (
    <div className={styles.grid}>
      <div className={styles.gridWide}>
        <CallScorePanel score={brief.callScore} />
      </div>
      <div className={styles.gridWide}>
        <ObjectionList objections={brief.objections} />
      </div>
      <PaymentList payments={brief.payments} />
      <GoalList goals={brief.goals} />
      <div className={styles.gridWide}>
        <TodoList tasks={brief.tasks} />
      </div>
    </div>
  );
}
