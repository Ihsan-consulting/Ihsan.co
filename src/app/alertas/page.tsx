import type { Metadata } from "next";
import Link from "next/link";

import { AlertCard } from "@/components/alerts/AlertCard";
import styles from "@/components/alerts/alerts.module.css";
import { EmptyState, PageHeader, type Tone } from "@/components/ui/primitives";
import {
  ALERT_KIND_LABELS,
  ALERT_KINDS,
  ALERT_SEVERITIES,
  ALERT_SEVERITY_LABELS,
  getAlertsBoard,
  type AlertKind,
  type AlertSeverity,
  type OperationalAlert,
} from "@/lib/queries/alerts";

export const dynamic = "force-dynamic";

const CARD_LIMIT = 40;

export const metadata: Metadata = {
  title: "Alertas",
  description:
    "Entregas fallidas, briefs pendientes, pagos por cobrar, llamadas flojas, objeciones y compromisos abiertos, ordenados por gravedad.",
};

const BAR_TONES: Record<AlertKind, Tone> = {
  entrega: "danger",
  brief: "warn",
  pago: "warn",
  puntuacion: "warn",
  objecion: "accent",
  compromiso: "accent",
};

const SEVERITY_NOTES: Record<AlertSeverity, string> = {
  critica: "El pipeline falló: el resumen no llegó a su destino.",
  alta: "Falta información o hay dinero y calidad en juego.",
  abierta: "Seguimiento con cliente pendiente.",
};

type PageProps = {
  searchParams: Promise<{ gravedad?: string | string[]; tipo?: string | string[] }>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pickSeverity(value: string | undefined): AlertSeverity | null {
  return (ALERT_SEVERITIES as ReadonlyArray<string>).includes(value ?? "")
    ? (value as AlertSeverity)
    : null;
}

function pickKind(value: string | undefined): AlertKind | null {
  return (ALERT_KINDS as ReadonlyArray<string>).includes(value ?? "") ? (value as AlertKind) : null;
}

function hrefFor(severity: AlertSeverity | null, kind: AlertKind | null): string {
  const params = new URLSearchParams();
  if (severity) params.set("gravedad", severity);
  if (kind) params.set("tipo", kind);
  const query = params.toString();
  return query ? `/alertas?${query}` : "/alertas";
}

export default async function AlertasPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const severity = pickSeverity(firstValue(params.gravedad));
  const kind = pickKind(firstValue(params.tipo));

  const { alerts, counts } = await getAlertsBoard();

  const filtered = alerts.filter(
    (alert) => (!severity || alert.severity === severity) && (!kind || alert.kind === kind),
  );
  const shown = filtered.slice(0, CARD_LIMIT);
  const groups = ALERT_SEVERITIES.map((level) => ({
    level,
    items: shown.filter((alert) => alert.severity === level),
  })).filter((group) => group.items.length > 0);

  const kinds = ALERT_KINDS.map((entry) => ({ kind: entry, count: counts[entry] }));
  const peak = Math.max(...kinds.map((entry) => entry.count), 1);
  const isFiltered = severity !== null || kind !== null;

  return (
    <div className="wrap">
      <PageHeader
        kicker="Pipeline, pagos, calidad de llamada, objeciones y compromisos"
        title="Alertas"
        lede={
          counts.total === 0
            ? "Nada pendiente: todas las grabaciones tienen brief, todas las entregas salieron y no queda ningún pago, objeción ni compromiso abierto."
            : `${String(counts.total)} alertas abiertas: ${String(counts.bySeverity.critica)} críticas, ${String(counts.bySeverity.alta)} altas y ${String(counts.bySeverity.abierta)} de seguimiento. Cada una abre su llamada.`
        }
      />

      <nav className={styles.chips} aria-label="Filtrar por gravedad">
        <Link
          href={hrefFor(null, kind)}
          className={styles.chip}
          aria-current={severity === null ? "true" : undefined}
        >
          Todas <span className="num">{counts.total}</span>
        </Link>
        {ALERT_SEVERITIES.map((level) => (
          <Link
            key={level}
            href={hrefFor(level, kind)}
            className={styles.chip}
            data-severity={level}
            aria-current={severity === level ? "true" : undefined}
          >
            {ALERT_SEVERITY_LABELS[level]} <span className="num">{counts.bySeverity[level]}</span>
          </Link>
        ))}
        {kind ? (
          <Link href={hrefFor(severity, null)} className={styles.chipClear}>
            {ALERT_KIND_LABELS[kind]} <span aria-hidden="true">×</span>
            <span className="srOnly">Quitar filtro de tipo</span>
          </Link>
        ) : null}
      </nav>

      <div className={styles.board}>
        <div className={styles.column}>
          {groups.length === 0 ? (
            <EmptyState
              size="block"
              title={isFiltered ? "Nada con este filtro" : "Ninguna alerta abierta"}
              body={
                isFiltered
                  ? "No hay alertas que cumplan la gravedad o el tipo elegidos."
                  : "No hay entregas fallidas, briefs pendientes, pagos por cobrar, objeciones ni compromisos sin cerrar."
              }
              hint={
                isFiltered
                  ? "Quita el filtro para ver el resto."
                  : "Esta pantalla se rellena sola en cuanto algo quede pendiente."
              }
            />
          ) : (
            groups.map((group) => (
              <SeverityGroup key={group.level} level={group.level} items={group.items} />
            ))
          )}

          {filtered.length > shown.length ? (
            <p className={`num ${styles.more}`}>
              Se muestran las {shown.length} más graves de {filtered.length}. Filtra por tipo para
              ver el resto.
            </p>
          ) : null}
        </div>

        <aside className={styles.aside} aria-labelledby="alertas-tipo">
          <h2 id="alertas-tipo" className={styles.asideTitle}>
            Alertas por tipo
          </h2>
          <p className={styles.asideNote}>Todo el archivo · pulsa para filtrar</p>

          <div className={styles.bars}>
            {kinds.map((entry) => (
              <Link
                key={entry.kind}
                href={hrefFor(severity, kind === entry.kind ? null : entry.kind)}
                className={styles.barLink}
                aria-current={kind === entry.kind ? "true" : undefined}
              >
                <p className={styles.barHead}>
                  <span className={styles.barLabel}>{ALERT_KIND_LABELS[entry.kind]}</span>
                  <span className={`num ${styles.barValue}`}>{entry.count}</span>
                </p>
                <span className={styles.barTrack}>
                  <span
                    className={styles.barFill}
                    data-tone={BAR_TONES[entry.kind]}
                    style={{ width: `${String(Math.round((entry.count / peak) * 100))}%` }}
                  />
                </span>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function SeverityGroup({
  level,
  items,
}: {
  level: AlertSeverity;
  items: ReadonlyArray<OperationalAlert>;
}) {
  return (
    <section className={styles.group} aria-labelledby={`gravedad-${level}`}>
      <header className={styles.groupHead}>
        <h2 id={`gravedad-${level}`} className={styles.groupTitle} data-severity={level}>
          {ALERT_SEVERITY_LABELS[level]}
          <span className={`num ${styles.groupCount}`}>{items.length}</span>
        </h2>
        <p className={styles.groupNote}>{SEVERITY_NOTES[level]}</p>
      </header>
      {items.map((alert) => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
    </section>
  );
}
