import styles from "./system.module.css";

export default function Loading() {
  return (
    <div className={`wrap ${styles.skeleton}`} aria-busy="true" aria-live="polite">
      <span className="srOnly">Cargando datos del panel…</span>
      <span className={styles.skelLine} aria-hidden="true" />
      <span className={styles.skelBlock} aria-hidden="true" />
      <span className={styles.skelBlock} aria-hidden="true" />
    </div>
  );
}
