import { formatDateTime, formatSentiment } from "@/components/formatting";
import { EmptyState, Tag, type Tone } from "@/components/ui/primitives";
import type { MeetingBrief } from "@/lib/queries/meetings";

import styles from "./detail.module.css";

const SENTIMENT_TONES: Record<string, Tone> = {
  positive: "ok",
  positivo: "ok",
  neutral: "neutral",
  neutro: "neutral",
  mixed: "warn",
  mixto: "warn",
  negative: "danger",
  negativo: "danger",
};

function toneOf(value: string | null): Tone {
  if (!value) return "neutral";
  return SENTIMENT_TONES[value.trim().toLowerCase()] ?? "neutral";
}

/** Lista de puntos del resumen: decisiones y próximos pasos del brief. */
function Points({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className={styles.points}>
      <h3 className={styles.blockTitle}>{title}</h3>
      <ul className={styles.pointList}>
        {items.map((item, index) => (
          <li key={`${title}-${String(index)}`} className={styles.point}>
            <span className={styles.pointDot} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Riesgos detectados, con el tratamiento de cita del diseño. */
function Risks({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className={styles.risks}>
      <h3 className={styles.blockTitle}>Riesgos detectados</h3>
      <div className={styles.riskList}>
        {items.map((item, index) => (
          <article key={`riesgo-${String(index)}`} className={styles.risk}>
            <p className={styles.riskKind}>Riesgo</p>
            <p className={styles.riskText}>{item}</p>
          </article>
        ))}
      </div>
      <p className={styles.riskNote}>
        El brief señala el riesgo, no propone la respuesta: esa decisión sigue siendo del equipo.
      </p>
    </div>
  );
}

/** El brief generado por IA. Cuando aún no existe, el panel lo dice sin romperse. */
export function BriefPanel({ brief }: { brief: MeetingBrief | null }) {
  if (!brief) {
    return (
      <section aria-labelledby="brief" className={styles.panel}>
        <h2 id="brief" className={styles.panelTitle}>
          Resumen
        </h2>
        <EmptyState
          size="block"
          tone="warn"
          title="Todavía no hay brief"
          body="La grabación está guardada, pero el resumen en español aún no se ha generado. Aparecerá aquí en cuanto el pipeline lo publique."
          hint="Mientras tanto puedes leer el resumen original de Fathom más abajo."
        />
      </section>
    );
  }

  const sentiment = formatSentiment(brief.sentiment);
  const isEmpty =
    brief.keyDecisions.length === 0 &&
    brief.risks.length === 0 &&
    brief.nextSteps.length === 0 &&
    !brief.executiveSummary;

  return (
    <section aria-labelledby="brief" className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 id="brief" className={styles.panelTitle}>
          Resumen
        </h2>
        <span className={styles.stamp}>
          {formatDateTime(brief.createdAt)} · {brief.model}
        </span>
      </div>

      {brief.headline ? <p className={styles.headline}>{brief.headline}</p> : null}

      <p className={styles.tags}>
        {sentiment ? <Tag tone={toneOf(brief.sentiment)}>Tono: {sentiment}</Tag> : null}
        <Tag>{brief.language}</Tag>
      </p>

      {brief.executiveSummary ? <p className={styles.summary}>{brief.executiveSummary}</p> : null}

      {isEmpty ? (
        <EmptyState
          title="Brief sin contenido"
          body="El modelo devolvió una respuesta vacía para esta reunión. Conviene revisar la transcripción o relanzar la generación."
        />
      ) : null}

      <Points title="Decisiones" items={brief.keyDecisions} />
      <Risks items={brief.risks} />
      <Points title="Próximos pasos sugeridos" items={brief.nextSteps} />
    </section>
  );
}

type SourceSummaryProps = {
  markdown: string | null;
  template: string | null;
};

/**
 * Resumen original de Fathom. Es contenido de terceros y no confiable, así que
 * se imprime como texto plano dentro de <pre>; nunca se interpreta como HTML.
 */
export function SourceSummary({ markdown, template }: SourceSummaryProps) {
  if (!markdown || markdown.trim() === "") return null;

  return (
    <section aria-labelledby="fathom" className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 id="fathom" className={styles.panelTitle}>
          Resumen original de Fathom
        </h2>
        {template ? <span className={styles.stamp}>{template}</span> : null}
      </div>

      <details className={styles.disclosure}>
        <summary className={styles.disclosureSummary}>
          Ver el texto tal cual lo envió Fathom
        </summary>
        <pre className={styles.rawText}>{markdown}</pre>
      </details>
    </section>
  );
}
