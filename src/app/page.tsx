import Link from "next/link";

import { formatLongDate } from "@/components/formatting";
import { MeetingCard } from "@/components/meetings/MeetingCard";
import { OpenActionItemList } from "@/components/meetings/Commitments";
import { DeliveryHealth } from "@/components/meetings/Sidebar";
import { EmptyState, PageHeader, SectionHead, StatTile } from "@/components/ui/primitives";
import {
  getDashboardTotals,
  listMeetings,
  listOpenActionItems,
  listProblemDeliveries,
} from "@/lib/queries/meetings";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const totals = await getDashboardTotals();
  const today = formatLongDate(new Date().toISOString());

  // Estado inicial real: las tablas están vacías hasta el primer webhook.
  if (totals.meetingsTotal === 0) {
    return (
      <div className="wrap">
        <PageHeader
          kicker="Panel interno"
          title="Aún no ha entrado ninguna grabación"
          lede="El panel está conectado y esperando. En cuanto Fathom envíe la primera reunión verás aquí el brief, los compromisos con el cliente y si el resumen llegó a Discord."
          aside={<span>{today}</span>}
        />

        <div className={styles.onboarding}>
          <EmptyState
            size="block"
            title="Esperando el primer webhook"
            body="Cada grabación recorre el mismo camino: Fathom la envía, se guarda en Supabase, se genera un brief en español y se publica en Discord. Este panel muestra ese recorrido de principio a fin."
            hint="No hay nada que configurar desde esta pantalla."
          />

          <ol className={styles.pipeline}>
            <li>
              <span className={`num ${styles.pipelineStep}`}>01</span>
              <p className={styles.pipelineTitle}>Fathom graba</p>
              <p className={styles.pipelineText}>
                La llamada termina y Fathom dispara el webhook con transcripción, asistentes y
                tareas detectadas.
              </p>
            </li>
            <li>
              <span className={`num ${styles.pipelineStep}`}>02</span>
              <p className={styles.pipelineTitle}>Se genera el brief</p>
              <p className={styles.pipelineText}>
                Titular, resumen ejecutivo, decisiones, riesgos y próximos pasos, en español.
              </p>
            </li>
            <li>
              <span className={`num ${styles.pipelineStep}`}>03</span>
              <p className={styles.pipelineTitle}>Llega a Discord</p>
              <p className={styles.pipelineText}>
                Si una publicación falla, aparecerá marcada en rojo en esta misma pantalla.
              </p>
            </li>
          </ol>
        </div>
      </div>
    );
  }

  const [recent, openItems, problemDeliveries] = await Promise.all([
    listMeetings(6),
    listOpenActionItems(6),
    listProblemDeliveries(5),
  ]);

  return (
    <div className="wrap">
      <PageHeader
        kicker="Panel interno"
        title="Lo que pasó en las llamadas"
        lede="Un vistazo a las reuniones grabadas, lo que quedó comprometido con cliente y si los resúmenes llegaron a Discord."
        aside={<span>{today}</span>}
      />

      <section aria-labelledby="cifras" className={styles.stats}>
        <h2 id="cifras" className="srOnly">
          Cifras del negocio
        </h2>
        <StatTile
          label="Reuniones registradas"
          value={totals.meetingsTotal}
          note={`${totals.meetingsLastWeek} en los últimos 7 días`}
        />
        <StatTile
          label="Compromisos abiertos"
          value={totals.actionItemsOpen}
          tone={totals.actionItemsOpen > 0 ? "accent" : "ok"}
          note="Pendientes con cliente"
        />
        <StatTile
          label="Briefs pendientes"
          value={totals.briefsPending}
          tone={totals.briefsPending > 0 ? "warn" : "ok"}
          note="Grabaciones sin resumen de IA"
        />
        <StatTile
          label="Entregas fallidas"
          value={totals.deliveriesFailed}
          tone={totals.deliveriesFailed > 0 ? "danger" : "ok"}
          emphasis={totals.deliveriesFailed > 0}
          note={
            totals.deliveriesPending > 0 ? `${totals.deliveriesPending} más en cola` : "Nada en cola"
          }
        />
      </section>

      <div className={styles.columns}>
        <section aria-labelledby="ultimas" className={styles.main}>
          <SectionHead
            id="ultimas"
            title="Últimas reuniones"
            action={
              <Link href="/meetings" className={styles.more}>
                Ver todas
              </Link>
            }
          />
          <ol className={styles.recent}>
            {recent.map((meeting) => (
              <li key={meeting.recordingId}>
                <MeetingCard meeting={meeting} />
              </li>
            ))}
          </ol>
        </section>

        <aside className={styles.rail} aria-label="Pendientes y entregas">
          <section aria-labelledby="pendientes">
            <SectionHead id="pendientes" title="Pendiente con cliente" />
            <OpenActionItemList items={openItems} />
          </section>

          <section aria-labelledby="salud">
            <SectionHead id="salud" title="Salud de entregas" />
            <DeliveryHealth deliveries={problemDeliveries} />
          </section>
        </aside>
      </div>
    </div>
  );
}
