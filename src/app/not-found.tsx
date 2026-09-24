import Link from "next/link";

import styles from "./system.module.css";

export default function NotFound() {
  return (
    <div className={`wrap ${styles.screen}`}>
      <p className={styles.code}>Error 404</p>
      <h1 className={styles.title}>Esta página no existe</h1>
      <p className={styles.text}>
        El enlace está roto o la grabación que buscas nunca llegó a guardarse. Puede que el webhook
        de Fathom todavía no la haya enviado.
      </p>
      <div className={styles.actions}>
        <Link href="/meetings" className={styles.link}>
          Ver todas las reuniones
        </Link>
        <Link href="/" className={styles.link}>
          Ir al panel
        </Link>
      </div>
    </div>
  );
}
