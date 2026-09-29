"use client";

import { useOptimistic, useState, useTransition } from "react";

import { setCommitmentDone } from "@/app/actions/commitments";

import styles from "./toggle.module.css";

type Props = {
  id: string;
  done: boolean;
  /** `box` es la casilla del detalle; `button` es el botón de la cola de decisiones. */
  variant: "box" | "button";
  label: string;
};

function Check({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 10 10"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.5 5.2L3.8 7.5L8.5 2.6" />
    </svg>
  );
}

/** Cierra o reabre un compromiso. El cambio se ve al instante y se deshace si falla. */
export function CommitmentToggle({ id, done, variant, label }: Props) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !optimisticDone;
    setError(null);
    startTransition(async () => {
      setOptimisticDone(next);
      const result = await setCommitmentDone(id, next);
      if (!result.ok) setError(result.message);
    });
  }

  const errorLine = error ? (
    <span className={styles.error} role="alert">
      {error}
    </span>
  ) : null;

  if (variant === "box") {
    return (
      <span className={styles.boxWrap}>
        <button
          type="button"
          role="checkbox"
          aria-checked={optimisticDone}
          aria-label={`${optimisticDone ? "Reabrir" : "Marcar como hecho"}: ${label}`}
          className={styles.box}
          data-done={optimisticDone || undefined}
          data-pending={pending || undefined}
          onClick={toggle}
          disabled={pending}
        >
          {optimisticDone ? <Check size={9} /> : null}
        </button>
        {errorLine}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className={styles.button}
        data-done={optimisticDone || undefined}
        onClick={toggle}
        disabled={pending}
        aria-label={`${optimisticDone ? "Reabrir" : "Marcar como resuelto"}: ${label}`}
      >
        <Check size={10} />
        {pending ? "Guardando…" : optimisticDone ? "Resuelto" : "Marcar resuelto"}
      </button>
      {errorLine}
    </>
  );
}
