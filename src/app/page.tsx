import Link from "next/link";

import { DeliveryLog, PendingDeliveries } from "@/components/dashboard/Deliveries";
import { DecisionQueue, TodayList } from "@/components/dashboard/DecisionQueue";
import { TeamLoadList, ToneBars, TrendChart } from "@/components/dashboard/Signals";
import { formatLongDate, madridHour } from "@/components/formatting";
import {
  WEEKS,
  teamLoad,
  todaysMeetings,
  toneBreakdown,
  weekTrend,
  weeklySeries,
} from "@/components/meetings/aggregate";
import { Card, PageHeader, StatTile } from "@/components/ui/primitives";
import {
  getDashboardTotals,
  listMeetings,
  listOpenActionItems,
  listProblemDeliveries,
} from "@/lib/queries/meetings";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function greeting(hour: number): string {
  if (hour < 12) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

export default async function DashboardPage() {
  const [totals, meetings, openItems, problemDeliveries] = await Promise.all([
    getDashboardTotals(),
    listMeetings(200),
    listOpenActionItems(6),
    listProblemDeliveries(4),
  ]);

  const series = weeklySeries(meetings);
  const today = todaysMeetings(meetings);
  const tone = toneBreakdown(meetings);
  const team = teamLoad(meetings).slice(0, 5);

  const hasMeetings = totals.meetingsTotal > 0;
  const callsThisWeek = series.meetings[WEEKS - 1] ?? 0;
  const tenseThisWeek = series.tense[WEEKS - 1] ?? 0;
  const todayLabel = formatLongDate(new Date().toISOString());

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
            ? "Cada llamada grabada con Fathom se resume en español, deja sus compromisos con cliente y se publica en Discord. Aquí está el recorrido completo."
            : "En cuanto Fathom envíe la primera reunión verás aquí el brief, los compromisos con cliente y si el resumen llegó a Discord. No hay nada que configurar desde esta pantalla."
        }
        actions={
          <>
            <Link href="/meetings" className={styles.cta}>
              Ver todas las llamadas <span aria-hidden="true">→</span>
            </Link>
            <a href="#cola" className={styles.ctaGhost}>
              Ir a la cola de decisiones
            </a>
          </>
        }
      />

      <section aria-labelledby="cifras" className={styles.stats}>
        <h2 id="cifras" className="srOnly">
          Cifras del panel
        </h2>
        <StatTile
          label="Llamadas registradas"
          value={totals.meetingsTotal}
          trend={weekTrend(series.meetings)}
          trendLabel="Diferencia con la semana anterior"
          note={`${totals.meetingsLastWeek} en los últimos 7 días`}
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
          label="Briefs pendientes"
          value={totals.briefsPending}
          tone={totals.briefsPending > 0 ? "warn" : "ok"}
          trend={weekTrend(series.withoutBrief)}
          trendLabel="Diferencia con la semana anterior"
          note="Grabaciones sin resumen de IA"
          series={series.withoutBrief}
        />
        <StatTile
          label="Entregas fallidas"
          value={totals.deliveriesFailed}
          tone={totals.deliveriesFailed > 0 ? "danger" : "ok"}
          trend={weekTrend(series.failed)}
          trendLabel="Diferencia con la semana anterior"
          note={
            totals.deliveriesPending > 0 ? `${totals.deliveriesPending} más en cola` : "Nada en cola"
          }
          series={series.failed}
        />
      </section>

      <div className={styles.split} id="cola">
        <Card
          id="cola-decisiones"
          title="Cola de decisiones"
          meta={`${openItems.length} sin cerrar`}
          aside="De lo más reciente a lo más antiguo"
        >
          <DecisionQueue items={openItems} />
        </Card>

        <div className={styles.rail}>
          <Card id="tension" title="Llamadas y tensión" aside={`Últimas ${WEEKS} semanas`}>
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

          <Card id="equipo" title="Carga del equipo" aside="Por quién grabó">
            <TeamLoadList rows={team} />
          </Card>
        </div>
      </div>

      <div className={styles.trio}>
        <Card id="hoy" title="Hoy" meta={`${today.length} llamadas`} flush>
          <TodayList meetings={today} />
        </Card>

        <Card
          id="envios"
          title="Pendientes de envío"
          meta={`${problemDeliveries.length} con incidencia`}
          flush
        >
          <PendingDeliveries deliveries={problemDeliveries} />
        </Card>

        <Card id="log" title="Envíos registrados" meta="Log" flush>
          <DeliveryLog />
        </Card>
      </div>
    </div>
  );
}
