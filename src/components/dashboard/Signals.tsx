import { formatDayMonth, initials } from "@/components/formatting";
import { WEEKS, type TeamLoad, type ToneSlice } from "@/components/meetings/aggregate";

import styles from "./dashboard.module.css";

const CHART_W = 300;
const CHART_H = 120;
const CHART_TOP = 10;
const CHART_BOTTOM = 110;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function toPoints(series: ReadonlyArray<number>, peak: number): string {
  if (series.length < 2) return "";
  const step = CHART_W / (series.length - 1);

  return series
    .map((value, index) => {
      const x = index * step;
      const y = CHART_BOTTOM - (value / peak) * (CHART_BOTTOM - CHART_TOP);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function weekLabels(): string[] {
  const now = Date.now();
  return Array.from({ length: WEEKS }, (unused, index) =>
    formatDayMonth(new Date(now - (WEEKS - 1 - index) * WEEK_MS).toISOString()),
  );
}

type TrendChartProps = {
  calls: ReadonlyArray<number>;
  tense: ReadonlyArray<number>;
  callsThisWeek: number;
  tenseThisWeek: number;
};

/**
 * Llamadas por semana y cuántas traían tono tenso o negativo. Ambas series salen
 * de las grabaciones ya leídas: sin filas, las dos líneas descansan en la base.
 */
export function TrendChart({ calls, tense, callsThisWeek, tenseThisWeek }: TrendChartProps) {
  const peak = Math.max(...calls, ...tense, 1);
  const line = toPoints(calls, peak);
  const line2 = toPoints(tense, peak);
  const area = line ? `M0,${CHART_H} L${line.split(" ").join(" L")} L${CHART_W},${CHART_H} Z` : "";
  const labels = weekLabels();

  return (
    <div>
      <div className={styles.chartLegend}>
        <div>
          <p className={`num ${styles.chartValue}`}>{callsThisWeek}</p>
          <p className={styles.chartCaption}>
            <span className={styles.chartKeyLine} aria-hidden="true" />
            llamadas esta semana
          </p>
        </div>
        <div>
          <p className={`num ${styles.chartValue}`} data-tone="danger">
            {tenseThisWeek}
          </p>
          <p className={styles.chartCaption}>
            <span className={styles.chartKeyLine} data-tone="danger" aria-hidden="true" />
            con tono tenso o negativo
          </p>
        </div>
      </div>

      <svg
        className={styles.chart}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Llamadas por semana en las últimas ${WEEKS} semanas: ${calls.join(", ")}. Con tono tenso o negativo: ${tense.join(", ")}.`}
      >
        <line className={styles.chartGrid} x1="0" y1="30" x2={CHART_W} y2="30" />
        <line className={styles.chartGrid} x1="0" y1="60" x2={CHART_W} y2="60" />
        <line className={styles.chartGrid} x1="0" y1="90" x2={CHART_W} y2="90" />
        {area ? <path className={styles.chartArea} d={area} /> : null}
        <polyline className={styles.chartLine} points={line} vectorEffect="non-scaling-stroke" />
        <polyline
          className={styles.chartLineTense}
          points={line2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className={styles.chartAxis} aria-hidden="true">
        {labels.map((label, index) => (
          <span key={`${label}-${String(index)}`} className="num">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Reparto de tono detectado por el brief, con la misma barra del diseño. */
export function ToneBars({ slices }: { slices: ReadonlyArray<ToneSlice> }) {
  return (
    <ul className={styles.bars}>
      {slices.map((slice) => (
        <li key={slice.label}>
          <p className={styles.barHead}>
            <span className={styles.barLabel}>{slice.label}</span>
            <span className={`num ${styles.barValue}`} data-tone={slice.tone}>
              {slice.count} · {slice.percent}%
            </span>
          </p>
          <span className={styles.barTrack}>
            <span
              className={styles.barFill}
              data-tone={slice.tone}
              style={{ width: `${slice.percent}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Carga por persona que grabó la llamada. */
export function TeamLoadList({ rows }: { rows: ReadonlyArray<TeamLoad> }) {
  if (rows.length === 0) {
    return <p className={styles.emptyLine}>Sin grabaciones asignadas todavía.</p>;
  }

  return (
    <ul className={styles.team}>
      {rows.map((row) => (
        <li key={row.name} className={styles.teamRow}>
          <span className={styles.teamAvatar} aria-hidden="true">
            {initials(row.name, null)}
          </span>
          <span className={styles.teamBody}>
            <span className={styles.teamName}>{row.name}</span>
            <span className={styles.teamNote} data-alert={row.failed > 0 ? "true" : undefined}>
              {row.failed > 0
                ? `${row.failed} entrega${row.failed === 1 ? "" : "s"} sin publicar`
                : `${row.openItems} compromiso${row.openItems === 1 ? "" : "s"} abierto${row.openItems === 1 ? "" : "s"}`}
            </span>
          </span>
          <span className={`num ${styles.teamCount}`}>
            {row.meetings} llamada{row.meetings === 1 ? "" : "s"}
          </span>
        </li>
      ))}
    </ul>
  );
}
