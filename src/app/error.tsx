"use client";

import Link from "next/link";

import styles from "./system.module.css";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Frontera de error del panel. Se muestra el `digest` para localizar la traza en
 * los logs, nunca el mensaje: podría filtrar detalles de la conexión a Supabase.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className={`wrap ${styles.screen}`}>
      <p className={styles.code}>Error del servidor</p>
      <h1 className={styles.title}>No se pudieron cargar los datos</h1>
      <p className={styles.text}>
        La consulta a Supabase falló. Suele deberse a una credencial caducada o a un corte
        momentáneo del servicio. Vuelve a intentarlo; si sigue igual, revisa los logs del despliegue.
      </p>

      <div className={styles.actions}>
        <button type="button" className={styles.link} onClick={reset}>
          Reintentar
        </button>
        <Link href="/" className={styles.link}>
          Ir al panel
        </Link>
      </div>

      {error.digest ? (
        <p className={styles.detail}>Referencia para los logs: {error.digest}</p>
      ) : null}
    </div>
  );
}
