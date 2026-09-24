import type { Metadata } from "next";

import { AlertCard } from "@/components/alerts/AlertCard";
import styles from "@/components/alerts/alerts.module.css";
import { EmptyState, PageHeader, type Tone } from "@/components/ui/primitives";
import { ALERT_KIND_LABELS, getAlertsBoard, type AlertKind } from "@/lib/queries/alerts";

export const dynamic = "force-dynamic";

const CARD_LIMIT = 24;

export const metadata: Metadata = {
  title: "Alertas",
  description:
    "Entregas fallidas, grabaciones sin brief y compromisos abiertos, ordenados por gravedad.",
};

const BAR_TONES: Record<AlertKind, Tone> = {
  entrega: "danger",
  brief: "warn",
  compromiso: "accent",
};

export default async function AlertasPage() {
  const { alerts, counts } = await getAlertsBoard(CARD_LIMIT);

  const kinds: ReadonlyArray<{ kind: AlertKind; count: number }> = [
    { kind: "entrega", count: counts.entrega },
    { kind: "brief", count: counts.brief },
    { kind: "compromiso", count: counts.compromiso },
  ];
  const peak = Math.max(...kinds.map((entry) => entry.count), 1);

  return (
    <div className="wrap">
      <PageHeader
        kicker="Entregas fallidas, briefs pendientes y compromisos sin cerrar"
        title="Alertas"
        lede={
          counts.total === 0
            ? "Nada pendiente: todas las grabaciones tienen brief, todas las entregas salieron y no queda ningún compromiso abierto."
            : `${String(counts.total)} alertas abiertas en el archivo. Cada una apunta a su grabación para que puedas comprobarla.`
        }
      />

      <div className={styles.board}>
        <div className={styles.column}>
          {alerts.length === 0 ? (
            <EmptyState
              size="block"
              title="Ninguna alerta abierta"
              body="No hay entregas fallidas, ni grabaciones sin brief, ni compromisos sin cerrar."
              hint="Esta pantalla se rellena sola en cuanto el pipeline falle o deje algo pendiente."
            />
          ) : (
            alerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)
          )}

          {counts.total > alerts.length ? (
            <p className={`num ${styles.more}`}>
              Se muestran las {alerts.length} más graves de {counts.total}.
            </p>
          ) : null}
        </div>

        <aside className={styles.aside} aria-labelledby="alertas-tipo">
          <h2 id="alertas-tipo" className={styles.asideTitle}>
            Alertas por tipo
          </h2>
          <p className={styles.asideNote}>Todo el archivo, sin recortar</p>

          <div className={styles.bars}>
            {kinds.map((entry) => (
              <div key={entry.kind}>
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
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
