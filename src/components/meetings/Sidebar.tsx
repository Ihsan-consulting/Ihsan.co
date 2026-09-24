import Link from "next/link";

import { formatDateTime, formatRelative, initials } from "@/components/formatting";
import { EmptyState, SectionHead, StatusBadge } from "@/components/ui/primitives";
import type { MeetingDelivery, MeetingInvitee, ProblemDelivery } from "@/lib/queries/meetings";

import styles from "./meetings.module.css";

export function InviteeList({ invitees }: { invitees: MeetingInvitee[] }) {
  const external = invitees.filter((person) => person.isExternal).length;

  return (
    <section aria-labelledby="asistentes" className={styles.railPanel}>
      <SectionHead
        id="asistentes"
        title="Asistentes"
        count={invitees.length}
        action={
          external > 0 ? <span className={styles.briefStamp}>{external} externos</span> : undefined
        }
      />

      {invitees.length === 0 ? (
        <EmptyState
          title="Sin asistentes"
          body="El webhook no incluyó la lista de participantes de esta grabación."
        />
      ) : (
        <ul className={styles.people}>
          {invitees.map((person) => (
            <li
              key={person.id}
              className={styles.person}
              data-external={person.isExternal || undefined}
            >
              <span className={styles.avatar} aria-hidden="true">
                {initials(person.name, person.email)}
              </span>
              <span className={styles.personBody}>
                <span className={styles.personName}>
                  {person.name ?? person.email ?? "Sin nombre"}
                </span>
                {person.email && person.name ? (
                  <span className={styles.personEmail}>{person.email}</span>
                ) : null}
              </span>
              {person.isExternal ? <span className={styles.personFlag}>Externo</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DeliveryTrail({ deliveries }: { deliveries: MeetingDelivery[] }) {
  return (
    <section aria-labelledby="entregas" className={styles.railPanel}>
      <SectionHead id="entregas" title="Entregas" count={deliveries.length} />

      {deliveries.length === 0 ? (
        <EmptyState
          title="Todavía sin enviar"
          body="No hay ningún intento de publicación en Discord para esta reunión."
        />
      ) : (
        <ul className={styles.deliveries}>
          {deliveries.map((delivery) => (
            <li key={delivery.id} className={styles.delivery} data-status={delivery.status}>
              <div className={styles.deliveryHead}>
                <StatusBadge status={delivery.status} />
                <span className={styles.deliveryChannel}>{delivery.channel}</span>
              </div>
              {delivery.target ? <p className={styles.deliveryTarget}>{delivery.target}</p> : null}
              <p className={styles.deliveryMeta}>
                <span className="num">{delivery.attempts} intentos</span>
                <span className="num">{formatDateTime(delivery.sentAt ?? delivery.updatedAt)}</span>
              </p>
              {delivery.error ? <p className={styles.deliveryError}>{delivery.error}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Salud de las entregas en el panel: solo lo que está roto o esperando. */
export function DeliveryHealth({ deliveries }: { deliveries: ProblemDelivery[] }) {
  if (deliveries.length === 0) {
    return (
      <EmptyState
        title="Todo entregado"
        body="Ninguna publicación a Discord está fallando ni esperando en cola."
      />
    );
  }

  return (
    <ul className={styles.healthList}>
      {deliveries.map((delivery) => (
        <li key={delivery.id} className={styles.healthItem} data-status={delivery.status}>
          <div className={styles.healthHead}>
            <StatusBadge status={delivery.status} />
            <span className={`num ${styles.healthWhen}`}>{formatRelative(delivery.updatedAt)}</span>
          </div>
          <Link href={`/meetings/${delivery.recordingId}`} className={styles.healthLink}>
            {delivery.meetingTitle}
          </Link>
          {delivery.error ? <p className={styles.deliveryError}>{delivery.error}</p> : null}
        </li>
      ))}
    </ul>
  );
}
