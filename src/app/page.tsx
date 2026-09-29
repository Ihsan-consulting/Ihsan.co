import Link from "next/link";

import { BackfillButton } from "@/components/admin/BackfillButton";
import { DeliveryLog, PendingDeliveries } from "@/components/dashboard/Deliveries";
import { DecisionQueue, TodayList } from "@/components/dashboard/DecisionQueue";
import { GoalsList, ObjectionsPanel, PaymentsPanel } from "@/components/dashboard/Insights";
import { ToneBars, TrendChart } from "@/components/dashboard/Signals";
import { formatLongDate, madridHour } from "@/components/formatting";
import {
  WEEKS,
  todaysMeetings,
  toneBreakdown,
  weekTrend,
  weeklySeries,
} from "@/components/meetings/aggregate";
import { Card, PageHeader, StatTile } from "@/components/ui/primitives";
import { formatMoney, getInsightsOverview } from "@/lib/queries/insights";
import {
  getDashboardTotals,
  listMeetings,
  listOpenActionItems,
  listProblemDeliveries,
  listRecentDeliveries,
} from "@/lib/queries/meetings";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function greeting(hour: number): string {
  if (hour < 12) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

/** Diferencia de puntuación media entre los últimos 7 días y los 7 anteriores. */
function scoreTrend(last7: number | null, prev7: number | null): string | undefined {
  if (last7 === null || prev7 === null) return undefined;
  const diff = last7 - prev7;
  return diff === 0 ? "=" : `${diff > 0 ? "+" : "−"}${String(Math.abs(diff))}`;
}

function scoreTone(value: number | null): "neutral" | "ok" | "warn" | "danger" {
  if (value === null) return "neutral";
  if (value >= 70) return "ok";
  if (value >= 50) return "warn";
  return "danger";
}

export default async function DashboardPage() {
  const [totals, meetings, openItems, problemDeliveries, recentDeliveries, insights] =
    await Promise.all([
      getDashboardTotals(),
      listMeetings(200),
      listOpenActionItems(8),
      listProblemDeliveries(4),
      listRecentDeliveries(6),
      getInsightsOverview(),
    ]);

  const series = weeklySeries(meetings);
  const today = todaysMeetings(meetings);
  const tone = toneBreakdown(meetings);
  const { score } = insights;
  const hasAnalysis = insights.analyzed > 0;

  const hasMeetings = totals.meetingsTotal > 0;
  const callsThisWeek = series.meetings[WEEKS - 1] ?? 0;
  const tenseThisWeek = series.tense[WEEKS - 1] ?? 0;
  const todayLabel = formatLongDate(new Date().toISOString());
  const pendingTotal = insights.paymentTotals
    .filter((row) => row.status === "pendiente")
    .reduce((sum, row) => sum + row.count, 0);

  return (
    <div className={`wrap ${styles.page}`}>
      <PageHeader
        kicker={
          <>
            <span
              className={styles.heroDot}
              data-alert={totals.deliveriesFailed > 0 ? "true" : undefined}
              aria-hidden="true"
            />
            <span>{todayLabel}</span>
            <span className={styles.heroSep} aria-hidden="true">
              ·
            </span>
            <span>{greeting(madridHour())}</span>
          </>
        }
        title={hasMeetings ? "Lo que pasó en las llamadas" : "El panel está conectado"}
        muted={hasMeetings ? "y qué queda por cerrar." : "y esperando la primera grabación."}
        lede={
          hasMeetings
            ? "Objeciones, pagos, objetivos y compromisos de cada llamada grabada con Fathom, agregados en un solo sitio."
            : "En cuanto Fathom envíe la primera reunión verás aquí el brief, los compromisos con cliente y si el resumen llegó a Discord. No hay nada que configurar desde esta pantalla."
        }
        actions={
          <>
            <Link href="/meetings" className={styles.cta}>
              Ver todas las llamadas <span aria-hidden="true">→</span>
            </Link>
            <a href="#cola" className={styles.ctaGhost}>
              Ir al to-do
            </a>
            <BackfillButton />
          </>
        }
      />

      <section aria-labelledby="cifras" className={styles.kpis}>
        <h2 id="cifras" className="srOnly">
          Métricas clave
        </h2>
        <StatTile
          label="Llamadas"
          value={totals.meetingsTotal}
          trend={weekTrend(series.meetings)}
          trendLabel="Diferencia con la semana anterior"
          note={`${String(totals.meetingsLastWeek)} en los últimos 7 días`}
          series={series.meetings}
          href="/meetings"
        />
        <StatTile
          label="Compromisos abiertos"
          value={totals.actionItemsOpen}
          tone={totals.actionItemsOpen > 0 ? "accent" : "ok"}
          trend={weekTrend(series.openItems)}
          trendLabel="Diferencia con la semana anterior"
          note="Pendientes con cliente"
          series={series.openItems}
        />
        <StatTile
          label="Pagos acordados"
          value={hasAnalysis ? formatMoney(insights.agreedEur, "EUR") : "—"}
          tone={insights.agreedEur > 0 ? "ok" : "neutral"}
          note={
            !hasAnalysis
              ? "Sin llamadas analizadas todavía"
              : insights.agreedOtherCurrencies > 0
                ? `Acordado o pagado · ${String(insights.agreedOtherCurrencies)} en otra moneda aparte`
                : `Acordado o pagado · ${String(pendingTotal)} pendiente${pendingTotal === 1 ? "" : "s"}`
          }
        />
        <StatTile
          label="Puntuación media"
          value={score.average === null ? "—" : `${String(score.average)}/100`}
          tone={scoreTone(score.average)}
          trend={scoreTrend(score.last7, score.prev7)}
          trendLabel="Últimos 7 días frente a los 7 anteriores"
          note={
            score.scored > 0
              ? `${String(score.scored)} llamadas puntuadas${score.last7 !== null ? ` · ${String(score.last7)} esta semana` : ""}`
              : "Ninguna llamada puntuada aún"
          }
          series={score.scored > 1 ? score.weekly : undefined}
        />
      </section>

      <Link href="/alertas" className={styles.health} aria-label="Estado del pipeline: ver alertas">
        <span className={styles.healthItem} data-tone={totals.briefsPending > 0 ? "warn" : "ok"}>
          <span className="num">{totals.briefsPending}</span> briefs pendientes
        </span>
        <span
          className={styles.healthItem}
          data-tone={totals.deliveriesFailed > 0 ? "danger" : "ok"}
        >
          <span className="num">{totals.deliveriesFailed}</span> entregas fallidas
          {totals.deliveriesPending > 0 ? ` · ${String(totals.deliveriesPending)} en cola` : ""}
        </span>
        <span
          className={styles.healthItem}
          data-tone={insights.pendingAnalysis > 0 ? "warn" : "ok"}
        >
          <span className="num">{insights.analyzed}</span> fichas con métricas ·{" "}
          <span className="num">{insights.pendingAnalysis}</span> por re-analizar
        </span>
        <span className={styles.healthCta}>
          Ver alertas <span aria-hidden="true">→</span>
        </span>
      </Link>

      <div className={styles.focus} id="cola">
        <Card
          id="cola-decisiones"
          title="To-do"
          meta={`${String(totals.actionItemsOpen)} sin cerrar`}
          aside="Compromisos con cliente, lo más reciente primero"
        >
          <DecisionQueue items={openItems} />
        </Card>

        <div className={styles.rail}>
          <Card
            id="pagos"
            title="Pagos"
            meta={hasAnalysis ? `${String(insights.latestPayments.length)} recientes` : undefined}
            aside="Por estado"
          >
            <PaymentsPanel
              totals={insights.paymentTotals}
              latest={insights.latestPayments}
              analyzed={insights.analyzed}
              pending={insights.pendingAnalysis}
            />
          </Card>

          <Card id="objetivos" title="Objetivos de clientes" aside="Lo que dijeron querer">
            <GoalsList
              goals={insights.goals}
              analyzed={insights.analyzed}
              pending={insights.pendingAnalysis}
            />
          </Card>
        </div>
      </div>

      <div className={styles.focus}>
        <Card
          id="objeciones"
          title="Objeciones frecuentes"
          meta={
            hasAnalysis
              ? `${String(insights.objectionsTotal)} en ${String(insights.analyzed)} llamadas`
              : undefined
          }
          aside="Verde: resueltas en llamada"
        >
          <ObjectionsPanel
            groups={insights.objections}
            analyzed={insights.analyzed}
            pending={insights.pendingAnalysis}
          />
        </Card>

        <div className={styles.rail}>
          <Card id="tension" title="Llamadas y tensión" aside={`Últimas ${String(WEEKS)} semanas`}>
            <TrendChart
              calls={series.meetings}
              tense={series.tense}
              callsThisWeek={callsThisWeek}
              tenseThisWeek={tenseThisWeek}
            />
          </Card>

          <Card id="tono" title="Tono de las llamadas" aside="Todas las grabaciones">
            <ToneBars slices={tone} />
          </Card>
        </div>
      </div>

      <div className={styles.trio}>
        <Card id="hoy" title="Hoy" meta={`${String(today.length)} llamadas`} flush>
          <TodayList meetings={today} />
        </Card>

        <Card
          id="envios"
          title="Pendientes de envío"
          meta={`${String(problemDeliveries.length)} con incidencia`}
          flush
        >
          <PendingDeliveries deliveries={problemDeliveries} />
        </Card>

        <Card
          id="log"
          title="Envíos registrados"
          meta={`Últimos ${String(recentDeliveries.length)}`}
          flush
        >
          <DeliveryLog deliveries={recentDeliveries} />
        </Card>
      </div>
    </div>
  );
}
