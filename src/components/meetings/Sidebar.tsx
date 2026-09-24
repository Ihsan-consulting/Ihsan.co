import { formatDateTime, initials } from "@/components/formatting";
import { EmptyState, StatusBadge } from "@/components/ui/primitives";
import type { MeetingDelivery, MeetingInvitee } from "@/lib/queries/meetings";

import styles from "./rail.module.css";

export function InviteeList({ invitees }: { invitees: MeetingInvitee[] }) {
  const external = invitees.filter((person) => person.isExternal).length;

  return (
    <section aria-labelledby="asistentes" className={styles.railPanel}>
      <div className={styles.railHead}>
        <h2 id="asistentes" className={styles.railTitle}>
          Asistentes
        </h2>
        <span className={`num ${styles.railCount}`}>
          {invitees.length}
          {external > 0 ? ` · ${external} externos` : ""}
        </span>
      </div>

      {invitees.length === 0 ? (
        <p className={styles.railEmpty}>
          El webhook no incluyó la lista de participantes de esta grabación.
        </p>
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

type GoogleDocPanelProps = {
  docUrl: string | null;
  syncedAt: string | null;
};

/**
 * Espejo de la reunión en Google Drive. Sin documento no hay botón: el pipeline
 * solo lo crea cuando Google está configurado, y un enlace muerto sería peor que
 * decirlo claro.
 */
export function GoogleDocPanel({ docUrl, syncedAt }: GoogleDocPanelProps) {
  return (
    <section aria-labelledby="documento" className={styles.railPanel}>
      <div className={styles.railHead}>
        <h2 id="documento" className={styles.railTitle}>
          Documento
        </h2>
        <span className={styles.railCount}>Google Docs</span>
      </div>

      {docUrl ? (
        <>
          <a className={styles.docLink} href={docUrl} target="_blank" rel="noreferrer">
            Abrir en Google Docs
            <span aria-hidden="true">↗</span>
          </a>
          <p className={styles.docMeta}>
            Sincronizado el <span className="num">{formatDateTime(syncedAt)}</span>
          </p>
        </>
      ) : (
        <p className={styles.railEmpty}>
          Esta llamada todavía no tiene documento en Drive. Se crea solo, cuando el pipeline
          procesa la grabación con Google configurado.
        </p>
      )}
    </section>
  );
}

export function DeliveryTrail({ deliveries }: { deliveries: MeetingDelivery[] }) {
  return (
    <section aria-labelledby="entregas" className={styles.railPanel}>
      <div className={styles.railHead}>
        <h2 id="entregas" className={styles.railTitle}>
          Entregas
        </h2>
        <span className={`num ${styles.railCount}`}>{deliveries.length}</span>
      </div>

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
                <span className="num">
                  {delivery.attempts} intento{delivery.attempts === 1 ? "" : "s"}
                </span>
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
