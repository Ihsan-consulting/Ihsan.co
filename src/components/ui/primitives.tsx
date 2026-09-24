import Link from "next/link";
import type { ReactNode } from "react";

import type { DeliveryStatus } from "@/lib/queries/meetings";
import styles from "./primitives.module.css";

export type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";

type PageHeaderProps = {
  kicker: ReactNode;
  title: string;
  muted?: string;
  lede?: string | null;
  aside?: ReactNode;
  actions?: ReactNode;
};

/** Cabecera de sección: línea de contexto, titular grande y entradilla medida. */
export function PageHeader({ kicker, title, muted, lede, aside, actions }: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div className="kicker">{kicker}</div>
      <div className={styles.pageHeaderBody}>
        <h1 className={styles.pageTitle}>
          {title}
          {muted ? <span className={styles.pageTitleMuted}> {muted}</span> : null}
        </h1>
        {aside ? <div className={styles.pageAside}>{aside}</div> : null}
      </div>
      {lede ? <p className={styles.lede}>{lede}</p> : null}
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
    </header>
  );
}

const SPARK_WIDTH = 120;
const SPARK_HEIGHT = 32;

type SparkShape = { line: string; area: string };

/**
 * Serie semanal real. Cuando todavía no ha entrado ninguna grabación todos los
 * valores son cero y la línea queda plana sobre la base: ese es el estado vacío
 * del gráfico, no un relleno inventado.
 */
function buildSpark(series: ReadonlyArray<number>): SparkShape | null {
  if (series.length < 2) return null;

  const peak = Math.max(...series, 1);
  const step = SPARK_WIDTH / (series.length - 1);
  const points = series.map((value, index) => {
    const x = index * step;
    const y = SPARK_HEIGHT - 2 - (value / peak) * (SPARK_HEIGHT - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return {
    line: points.join(" "),
    area: `M0,${SPARK_HEIGHT} L${points.join(" L")} L${SPARK_WIDTH},${SPARK_HEIGHT} Z`,
  };
}

type StatTileProps = {
  label: string;
  value: number | string;
  note?: string;
  tone?: Tone;
  trend?: string;
  trendLabel?: string;
  series?: ReadonlyArray<number>;
  href?: string;
};

export function StatTile({
  label,
  value,
  note,
  tone = "neutral",
  trend,
  trendLabel,
  series,
  href,
}: StatTileProps) {
  const spark = series ? buildSpark(series) : null;

  const body = (
    <>
      <span className={styles.statTop}>
        <span className={styles.statLabel}>{label}</span>
        {trend ? (
          <span className={`num ${styles.statTrend}`} title={trendLabel}>
            {trend}
          </span>
        ) : null}
      </span>
      <span className={`num ${styles.statValue}`}>{value}</span>
      {note ? <span className={styles.statNote}>{note}</span> : null}
      {spark ? (
        <svg
          className={styles.spark}
          viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path className={styles.sparkArea} d={spark.area} />
          <polyline
            className={styles.sparkLine}
            points={spark.line}
            fill="none"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={styles.stat} data-tone={tone}>
        {body}
      </Link>
    );
  }

  return (
    <div className={styles.stat} data-tone={tone}>
      {body}
    </div>
  );
}

type CardProps = {
  id: string;
  title: string;
  meta?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  /** El contenido llega hasta el borde inferior (listas con filete). */
  flush?: boolean;
};

/** Tarjeta de panel: filete de 1px, radio de 16 y cabecera a tres partes. */
export function Card({ id, title, meta, aside, children, flush }: CardProps) {
  return (
    <section aria-labelledby={id} className={styles.card} data-flush={flush ? "true" : undefined}>
      <div className={styles.cardHead}>
        <h2 id={id} className={styles.cardTitle}>
          {title}
        </h2>
        {meta ? <span className={styles.cardMeta}>{meta}</span> : null}
        <span className={styles.cardSpacer} />
        {aside ? <span className={styles.cardAside}>{aside}</span> : null}
      </div>
      <div className={styles.cardBody}>{children}</div>
    </section>
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
  const tone = status ? DELIVERY_TONES[status] : "neutral";
  const label = status ? DELIVERY_LABELS[status] : emptyLabel;

  return (
    <span className={styles.badge} data-tone={tone}>
      <span className={styles.badgeDot} aria-hidden="true" />
      {label}
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
  tone?: Tone;
};

/**
 * Estado vacío. Las seis tablas están vacías hasta que Fathom dispare el primer
 * webhook, así que este es el estado real del panel hoy y está diseñado como tal.
 */
export function EmptyState({ title, body, hint, size = "inline", tone = "ok" }: EmptyStateProps) {
  if (size === "inline") {
    return (
      <div className={styles.emptyInline}>
        <p className={styles.emptyInlineTitle}>{title}</p>
        <p className={styles.emptyInlineText}>{body}</p>
        {hint ? <p className={styles.emptyHint}>{hint}</p> : null}
      </div>
    );
  }

  return (
    <div className={styles.emptyBlock} data-tone={tone}>
      <span className={styles.emptyGlyph} aria-hidden="true">
        <svg
          viewBox="0 0 10 10"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1.5 5.2L3.8 7.5L8.5 2.6" />
        </svg>
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyText}>{body}</p>
      {hint ? <p className={styles.emptyHint}>{hint}</p> : null}
    </div>
  );
}
