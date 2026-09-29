"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import type { MeetingDetail } from "@/lib/queries/meetings";

import { PAYMENT_LABELS, formatMoney } from "./money";
import styles from "./drawer.module.css";

const TABS = [
  { id: "brief", label: "Brief" },
  { id: "analisis", label: "Análisis" },
  { id: "tareas", label: "Tareas" },
  { id: "personas", label: "Asistentes" },
  { id: "entregas", label: "Entregas" },
  { id: "transcripcion", label: "Transcripción" },
  { id: "meta", label: "Metadatos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(date);
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.block}>
      <h3 className={styles.blockTitle}>{title}</h3>
      {children}
    </div>
  );
}

const PENDING = "Análisis ampliado pendiente.";

function Bullets({ items, empty }: { items: string[] | null; empty: string }) {
  if (items === null) return <p className={styles.muted}>{PENDING}</p>;
  if (items.length === 0) return <p className={styles.muted}>{empty}</p>;
  return (
    <ul className={styles.list}>
      {items.map((item, index) => (
        <li key={`${String(index)}-${item.slice(0, 16)}`}>{item}</li>
      ))}
    </ul>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) return <span className={styles.muted}>—</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={styles.link}>
      {children} <span aria-hidden="true">↗</span>
    </a>
  );
}

function BriefTab({ meeting }: { meeting: MeetingDetail }) {
  const brief = meeting.brief;
  if (!brief) return <p className={styles.muted}>Esta llamada todavía no tiene brief.</p>;
  return (
    <>
      <p className={styles.headline}>{brief.headline ?? "Sin titular"}</p>
      <p className={styles.prose}>{brief.executiveSummary ?? "Sin resumen."}</p>
      <Block title="Decisiones clave">
        <Bullets items={brief.keyDecisions} empty="Sin decisiones registradas." />
      </Block>
      <Block title="Riesgos">
        <Bullets items={brief.risks} empty="Sin riesgos detectados." />
      </Block>
      <Block title="Próximos pasos">
        <Bullets items={brief.nextSteps} empty="Sin próximos pasos." />
      </Block>
      <Block title="Tono">
        <p>{brief.sentiment ?? "—"}</p>
      </Block>
    </>
  );
}

function AnalysisTab({ meeting }: { meeting: MeetingDetail }) {
  const brief = meeting.brief;
  if (!brief) return <p className={styles.muted}>Sin brief, no hay análisis.</p>;
  return (
    <>
      <Block title="Puntuación">
        {brief.callScore === null ? (
          <p className={styles.muted}>{PENDING}</p>
        ) : (
          <p className={styles.score}>
            <span className="num">{brief.callScore}</span>
            <span className={styles.muted}> / 100</span>
          </p>
        )}
      </Block>
      <Block title="Objeciones">
        {brief.objections === null ? (
          <p className={styles.muted}>{PENDING}</p>
        ) : brief.objections.length === 0 ? (
          <p className={styles.muted}>Sin objeciones.</p>
        ) : (
          <ul className={styles.cards}>
            {brief.objections.map((item, index) => (
              <li key={`obj-${String(index)}`} className={styles.card}>
                <p>
                  <strong>«{item.objection}»</strong>{" "}
                  <span className={styles.pill} data-tone={item.resolved ? "ok" : "danger"}>
                    {item.resolved ? "Resuelta" : "Sin resolver"}
                  </span>
                </p>
                <p className={styles.muted}>{item.response ?? "Sin respuesta clara."}</p>
              </li>
            ))}
          </ul>
        )}
      </Block>
      <Block title="Pagos">
        {brief.payments === null ? (
          <p className={styles.muted}>{PENDING}</p>
        ) : brief.payments.length === 0 ? (
          <p className={styles.muted}>Sin pagos mencionados.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Concepto</th>
                <th scope="col">Importe</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {brief.payments.map((item, index) => (
                <tr key={`pay-${String(index)}`}>
                  <td>{item.concept}</td>
                  <td className="num">{formatMoney(item.amount, item.currency)}</td>
                  <td>{PAYMENT_LABELS[item.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Block>
      <Block title="Objetivos">
        <Bullets items={brief.goals} empty="Sin objetivos expresados." />
      </Block>
    </>
  );
}

function TasksTab({ meeting }: { meeting: MeetingDetail }) {
  return (
    <>
      <Block title="To-do del brief">
        <Bullets items={meeting.brief?.tasks ?? []} empty="Sin tareas en el brief." />
      </Block>
      <Block title={`Compromisos de Fathom (${meeting.actionItems.length})`}>
        {meeting.actionItems.length === 0 ? (
          <p className={styles.muted}>Sin compromisos.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Tarea</th>
                <th scope="col">Responsable</th>
                <th scope="col">Minuto</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {meeting.actionItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>{item.assigneeName ?? item.assigneeEmail ?? "—"}</td>
                  <td className="num">
                    {item.playbackUrl && item.timestamp ? (
                      <a href={item.playbackUrl} target="_blank" rel="noreferrer" className={styles.link}>
                        {item.timestamp}
                      </a>
                    ) : (
                      (item.timestamp ?? "—")
                    )}
                  </td>
                  <td>{item.completed ? "Cerrada" : "Abierta"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Block>
    </>
  );
}

function PeopleTab({ meeting }: { meeting: MeetingDetail }) {
  const internal = meeting.invitees.filter((person) => !person.isExternal);
  const external = meeting.invitees.filter((person) => person.isExternal);
  const renderList = (list: MeetingDetail["invitees"]) =>
    list.length === 0 ? (
      <p className={styles.muted}>Nadie.</p>
    ) : (
      <ul className={styles.list}>
        {list.map((person) => (
          <li key={person.id}>
            {person.name ?? "Sin nombre"}
            {person.email ? <span className={styles.muted}> · {person.email}</span> : null}
          </li>
        ))}
      </ul>
    );
  return (
    <>
      <Block title={`Equipo interno (${internal.length})`}>{renderList(internal)}</Block>
      <Block title={`Externos (${external.length})`}>{renderList(external)}</Block>
      <Block title="Grabada por">
        <p>
          {meeting.recordedByName ?? "—"}
          {meeting.recordedByEmail ? <span className={styles.muted}> · {meeting.recordedByEmail}</span> : null}
          {meeting.recordedByTeam ? <span className={styles.muted}> · equipo {meeting.recordedByTeam}</span> : null}
        </p>
      </Block>
    </>
  );
}

const DELIVERY_LABEL = { sent: "Enviado", failed: "Fallido", pending: "En cola" } as const;
const DELIVERY_TONE = { sent: "ok", failed: "danger", pending: "warn" } as const;

function DeliveriesTab({ meeting }: { meeting: MeetingDetail }) {
  if (meeting.deliveries.length === 0) return <p className={styles.muted}>Sin intentos de entrega.</p>;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Canal</th>
          <th scope="col">Estado</th>
          <th scope="col">Intentos</th>
          <th scope="col">Última vez</th>
        </tr>
      </thead>
      <tbody>
        {meeting.deliveries.map((delivery) => (
          <tr key={delivery.id}>
            <td>
              {delivery.channel}
              {delivery.error ? <span className={styles.error}>{delivery.error}</span> : null}
            </td>
            <td>
              <span className={styles.pill} data-tone={DELIVERY_TONE[delivery.status]}>
                {DELIVERY_LABEL[delivery.status]}
              </span>
            </td>
            <td className="num">{delivery.attempts}</td>
            <td className="num">{fmt(delivery.sentAt ?? delivery.updatedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TranscriptTab({ meeting }: { meeting: MeetingDetail }) {
  if (meeting.transcript.length === 0) {
    return (
      <p className={styles.muted}>
        {meeting.hasTranscript
          ? "La transcripción está guardada, pero en un formato que no se puede mostrar."
          : "El webhook no incluyó transcripción para esta llamada."}
      </p>
    );
  }
  return (
    <ol className={styles.transcript}>
      {meeting.transcript.map((line, index) => (
        <li key={`t-${String(index)}`}>
          <span className={`num ${styles.tStamp}`}>{line.timestamp ?? ""}</span>
          <span>
            {line.speaker ? <strong className={styles.tSpeaker}>{line.speaker}</strong> : null}
            {line.text}
          </span>
        </li>
      ))}
    </ol>
  );
}

function MetaTab({ meeting }: { meeting: MeetingDetail }) {
  const brief = meeting.brief;
  return (
    <dl className={styles.meta}>
      <Row label="ID de grabación">
        <span className="num">{meeting.recordingId}</span>
      </Row>
      <Row label="Grabación en Fathom">
        <ExternalLink href={meeting.shareUrl}>Abrir</ExternalLink>
      </Row>
      <Row label="Enlace de la reunión">
        <ExternalLink href={meeting.meetingUrl}>Abrir</ExternalLink>
      </Row>
      <Row label="Google Doc">
        <ExternalLink href={meeting.googleDocUrl}>Abrir en Google Docs</ExternalLink>
      </Row>
      <Row label="Doc sincronizado">{fmt(meeting.googleDocSyncedAt)}</Row>
      <Row label="Programada">
        {fmt(meeting.scheduledStartTime)} → {fmt(meeting.scheduledEndTime)}
      </Row>
      <Row label="Grabada">
        {fmt(meeting.recordingStartTime)} → {fmt(meeting.recordingEndTime)}
      </Row>
      <Row label="Idioma">{meeting.transcriptLanguage ?? "—"}</Row>
      <Row label="Compartida con">{meeting.sharedWith ?? "—"}</Row>
      <Row label="Plantilla Fathom">{meeting.fathomSummaryTemplate ?? "—"}</Row>
      <Row label="Brief generado">{brief ? `${fmt(brief.createdAt)} · ${brief.model}` : "—"}</Row>
      <Row label="Creada">{fmt(meeting.createdAt)}</Row>
      <Row label="Actualizada">{fmt(meeting.updatedAt)}</Row>
    </dl>
  );
}

const TAB_BODIES: Record<TabId, (props: { meeting: MeetingDetail }) => ReactNode> = {
  brief: BriefTab,
  analisis: AnalysisTab,
  tareas: TasksTab,
  personas: PeopleTab,
  entregas: DeliveriesTab,
  transcripcion: TranscriptTab,
  meta: MetaTab,
};

/** Botón «Ver toda la data» + cajón modal con todo lo que guardamos de la llamada. */
export function DataDrawer({ meeting }: { meeting: MeetingDetail }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<TabId>("brief");
  const baseId = useId();
  const Body = TAB_BODIES[tab];

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = TABS[(index + delta + TABS.length) % TABS.length];
    setTab(next.id);
    document.getElementById(`${baseId}-tab-${next.id}`)?.focus();
  }

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => dialogRef.current?.showModal()}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <rect x="2" y="2.5" width="12" height="11" rx="2" />
          <path d="M5 6h6M5 8.5h6M5 11h3.5" strokeLinecap="round" />
        </svg>
        Ver toda la data
      </button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={`${baseId}-title`}
        onClick={(event) => {
          // Clic en el fondo (fuera del panel) cierra.
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className={styles.panel}>
          <header className={styles.head}>
            <div>
              <p className={styles.kicker}>Toda la data de la llamada</p>
              <h2 id={`${baseId}-title`} className={styles.title}>
                {meeting.title}
              </h2>
            </div>
            <button
              type="button"
              className={styles.close}
              onClick={() => dialogRef.current?.close()}
              aria-label="Cerrar"
            >
              ×
            </button>
          </header>

          <div role="tablist" aria-label="Secciones" className={styles.tabs}>
            {TABS.map((item, index) => (
              <button
                key={item.id}
                id={`${baseId}-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                aria-controls={`${baseId}-panel`}
                tabIndex={tab === item.id ? 0 : -1}
                className={styles.tab}
                onClick={() => setTab(item.id)}
                onKeyDown={(event) => onTabKey(event, index)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div
            id={`${baseId}-panel`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${tab}`}
            className={styles.body}
            tabIndex={0}
          >
            <Body meeting={meeting} />
          </div>
        </div>
      </dialog>
    </>
  );
}
