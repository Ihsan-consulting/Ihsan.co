import type { ReactNode } from "react";

import type { DeliveryStatus } from "@/lib/queries/meetings";
import styles from "./primitives.module.css";

type PageHeaderProps = {
  kicker: string;
  title: string;
  lede?: string | null;
  aside?: ReactNode;
};

/** Cabecera editorial: antetítulo en mono, titular serif grande, entradilla medida. */
export function PageHeader({ kicker, title, lede, aside }: PageHeaderProps) {
  return (
    <div className={styles.pageHeader}>
      <p className="kicker">{kicker}</p>
      <div className={styles.pageHeaderBody}>
        <h1 className={styles.pageTitle}>{title}</h1>
        {aside ? <div className={styles.pageAside}>{aside}</div> : null}
      </div>
      {lede ? <p className={styles.lede}>{lede}</p> : null}
    </div>
  );
}

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";

type StatTileProps = {
  label: string;
  value: number | string;
  note?: string;
  tone?: Tone;
  emphasis?: boolean;
};

export function StatTile({ label, value, note, tone = "neutral", emphasis }: StatTileProps) {
  return (
    <div className={styles.stat} data-tone={tone} data-emphasis={emphasis ? "true" : undefined}>
      <p className={styles.statLabel}>{label}</p>
      <p className={`num ${styles.statValue}`}>{value}</p>
      {note ? <p className={styles.statNote}>{note}</p> : null}
    </div>
  );
}

const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  sent: "Entregada",
  pending: "En cola",
  failed: "Fallida",
};

const DELIVERY_TONES: Record<DeliveryStatus, Tone> = {
  sent: "ok",
  pending: "warn",
  failed: "danger",
};

type StatusBadgeProps = {
  status: DeliveryStatus | null;
  /** Etiqueta para el caso «todavía no hay fila de entrega». */
  emptyLabel?: string;
};

export function StatusBadge({ status, emptyLabel = "Sin entrega" }: StatusBadgeProps) {
  if (!status) {
    return (
      <span className={styles.badge} data-tone="neutral">
        <span className={styles.badgeDot} aria-hidden="true" />
        {emptyLabel}
      </span>
    );
  }

  return (
    <span className={styles.badge} data-tone={DELIVERY_TONES[status]}>
      <span className={styles.badgeDot} aria-hidden="true" />
      {DELIVERY_LABELS[status]}
    </span>
  );
}

type TagProps = {
  children: ReactNode;
  tone?: Tone;
};

export function Tag({ children, tone = "neutral" }: TagProps) {
  return (
    <span className={styles.tag} data-tone={tone}>
      {children}
    </span>
  );
}

type SectionHeadProps = {
  id: string;
  title: string;
  count?: number;
  action?: ReactNode;
};

export function SectionHead({ id, title, count, action }: SectionHeadProps) {
  return (
    <div className={styles.sectionHead}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
        {typeof count === "number" ? (
          <span className={`num ${styles.sectionCount}`}>{count}</span>
        ) : null}
      </h2>
      {action ? <div className={styles.sectionAction}>{action}</div> : null}
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  body: string;
  hint?: string;
  size?: "inline" | "block";
};

/**
 * Estado vacío con diseño propio: las tablas están vacías hasta que Fathom
 * dispare el primer webhook, así que este es el estado inicial real del panel.
 */
export function EmptyState({ title, body, hint, size = "inline" }: EmptyStateProps) {
  return (
    <div className={styles.empty} data-size={size}>
      <span className={styles.emptyGlyph} aria-hidden="true">
        —
      </span>
      <div className={styles.emptyBody}>
        <p className={styles.emptyTitle}>{title}</p>
        <p className={styles.emptyText}>{body}</p>
        {hint ? <p className={styles.emptyHint}>{hint}</p> : null}
      </div>
    </div>
  );
}
