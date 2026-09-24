import type { Metadata } from "next";

import styles from "./login.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Acceso",
  description: "Acceso al panel interno de ihsan.co.",
};

type PageProps = {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Mismo criterio que la ruta de login: solo rutas internas.
 *
 * Comprobar el prefijo no basta. El parser de URL trata la barra invertida como barra
 * normal, así que `/\evil.com` empieza por una sola "/" y aun así resuelve a
 * `https://evil.com/`. Resolver contra un origen desechable y exigir que no se haya
 * movido es la única comprobación que coincide con lo que hará el redirect real.
 */
function safeNext(value: string | undefined): string {
  if (!value) return "/";
  try {
    const probe = new URL(value, "https://x.invalid");
    return probe.origin === "https://x.invalid" ? probe.pathname + probe.search : "/";
  } catch {
    return "/";
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  credentials: "Contraseña incorrecta. Inténtalo de nuevo.",
  rate: "Demasiados intentos fallidos. Espera unos minutos antes de volver a probar.",
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = safeNext(firstValue(params.next));
  const errorCode = firstValue(params.error);
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? "No se pudo acceder.") : null;

  return (
    <div className={styles.screen}>
      <div className={styles.panel}>
        <p className="kicker">Acceso restringido</p>
        <h1 className={styles.title}>Panel interno</h1>
        <p className={styles.lede}>
          Llamadas, briefs y entregas del equipo. Solo para Omar, Mehdi y Yousef.
        </p>

        {/*
          Envío nativo: /api/auth/login lee `request.formData()` y responde con un
          303. Con fetch el navegador seguiría la redirección y se perdería el
          mensaje de error, así que el formulario se envía sin JavaScript.
        */}
        <form className={styles.form} action="/api/auth/login" method="post">
          <input type="hidden" name="next" value={next} />

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className={styles.input}
              autoComplete="current-password"
              required
              aria-describedby={errorMessage ? "login-error" : undefined}
              aria-invalid={errorMessage ? true : undefined}
            />
          </div>

          {errorMessage ? (
            <p id="login-error" className={styles.error} role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button type="submit" className={styles.submit}>
            Entrar
          </button>
        </form>

        <p className={styles.footnote}>
          Esta pantalla no indexa nada ni guarda datos en el navegador más allá de la sesión.
        </p>
      </div>

      <p className={styles.mark} aria-hidden="true">
        ihsan<span>.co</span>
      </p>
    </div>
  );
}
