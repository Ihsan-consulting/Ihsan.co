import { formatDateTime, formatSentiment } from "@/components/formatting";
import { EmptyState, SectionHead, Tag } from "@/components/ui/primitives";
import type { MeetingBrief } from "@/lib/queries/meetings";

import styles from "./meetings.module.css";

type BriefPanelProps = {
  brief: MeetingBrief | null;
};

type ListBlockProps = {
  title: string;
  items: string[];
  tone: "decision" | "risk" | "step";
};

function ListBlock({ title, items, tone }: ListBlockProps) {
  if (items.length === 0) return null;

  return (
    <section className={styles.briefBlock} data-tone={tone}>
      <h3 className={styles.briefBlockTitle}>{title}</h3>
      <ul className={styles.briefList}>
        {items.map((item, index) => (
          <li key={`${tone}-${index}`} className={styles.briefListItem}>
            <span className={`num ${styles.briefListIndex}`} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** El brief generado por IA. Cuando aún no existe, el panel lo dice sin romperse. */
export function BriefPanel({ brief }: BriefPanelProps) {
  if (!brief) {
    return (
      <section aria-labelledby="brief" className={styles.panel}>
        <SectionHead id="brief" title="Brief de IA" />
        <EmptyState
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
      <SectionHead
        id="brief"
        title="Brief de IA"
        action={
          <span className={styles.briefStamp}>
            {formatDateTime(brief.createdAt)} · {brief.model}
          </span>
        }
      />

      {brief.headline ? <p className={styles.briefHeadline}>{brief.headline}</p> : null}

      {sentiment ? (
        <p className={styles.briefTags}>
          <Tag tone={brief.sentiment === "negative" ? "danger" : "neutral"}>Tono: {sentiment}</Tag>
          <Tag>{brief.language}</Tag>
        </p>
      ) : null}

      {brief.executiveSummary ? (
        <p className={styles.briefSummary}>{brief.executiveSummary}</p>
      ) : null}

      {isEmpty ? (
        <EmptyState
          title="Brief sin contenido"
          body="El modelo devolvió una respuesta vacía para esta reunión. Conviene revisar la transcripción o relanzar la generación."
        />
      ) : null}

      <div className={styles.briefBlocks}>
        <ListBlock title="Decisiones" items={brief.keyDecisions} tone="decision" />
        <ListBlock title="Riesgos" items={brief.risks} tone="risk" />
        <ListBlock title="Próximos pasos" items={brief.nextSteps} tone="step" />
      </div>
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
      <SectionHead
        id="fathom"
        title="Resumen original de Fathom"
        action={template ? <span className={styles.briefStamp}>{template}</span> : undefined}
      />
      <details className={styles.disclosure}>
        <summary className={styles.disclosureSummary}>
          Ver el texto tal cual lo envió Fathom
        </summary>
        <pre className={styles.rawText}>{markdown}</pre>
      </details>
    </section>
  );
}
