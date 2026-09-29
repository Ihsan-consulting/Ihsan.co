import styles from "./clients.module.css";

/** Fathom titula casi todo "Impromptu Google Meet Meeting": el cliente dice mucho más. */
export function meetingDisplayTitle(meeting: { title: string; clientName: string | null }): string {
  return meeting.clientName ?? meeting.title;
}

type Props = {
  clientName: string | null;
  endCustomerName: string | null;
  size?: "sm" | "md";
};

/** Cliente de ihsan.co → cliente de ese cliente, cuando la IA los detectó. */
export function ClientNames({ clientName, endCustomerName, size = "md" }: Props) {
  if (!clientName && !endCustomerName) return null;

  return (
    <p className={styles.chain} data-size={size}>
      <span className={styles.pill} data-kind="client">
        <span className={styles.pillLabel}>Cliente</span>
        {clientName ?? "Sin identificar"}
      </span>
      {endCustomerName ? (
        <>
          <span className={styles.arrow} aria-hidden="true">
            →
          </span>
          <span className={styles.pill} data-kind="end">
            <span className={styles.pillLabel}>Su cliente</span>
            {endCustomerName}
          </span>
        </>
      ) : null}
    </p>
  );
}
