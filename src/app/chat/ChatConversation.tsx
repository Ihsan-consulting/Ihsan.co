"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import styles from "./chat.module.css";

/**
 * Composer real sobre el archivo de llamadas.
 *
 * La conversación vive sólo aquí, en estado de componente: al recargar se pierde.
 * No hay tabla de historial a propósito —guardar preguntas sobre llamadas con
 * clientes sería otra copia de material sensible y nadie la ha pedido—.
 *
 * El tope de turnos se repite aquí en vez de importarlo de `@/lib/ai/chat`: ese
 * módulo arrastra `@/lib/env`, que es `server-only`, y traerlo a un componente de
 * cliente rompería el build. El servidor vuelve a recortar de todos modos.
 */
const MAX_HISTORY = 10;

type Role = "user" | "assistant";

type Message = { id: number; role: Role; content: string };

type ChatResponse = { ok: true; answer: string } | { ok: false; reason: string };

const UNREADABLE =
  "No se pudo leer la respuesta del servidor. Puede que tu sesión haya caducado: recarga la página.";

async function ask(question: string, history: readonly Message[]): Promise<ChatResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question,
      history: history.slice(-MAX_HISTORY).map((turn) => ({
        role: turn.role,
        content: turn.content,
      })),
    }),
  });

  try {
    // La puerta de sesión responde con el HTML de /login, no con JSON: eso no es un
    // fallo del modelo y no debe presentarse como tal.
    return (await response.json()) as ChatResponse;
  } catch {
    return { ok: false, reason: UNREADABLE };
  }
}

export function ChatConversation() {
  const [messages, setMessages] = useState<readonly Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0 && !busy) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "end" });
  }, [messages, busy]);

  async function send() {
    const question = draft.trim();
    if (!question || busy) return;

    const history = messages;
    lastId.current += 1;
    setMessages([...history, { id: lastId.current, role: "user", content: question }]);
    setDraft("");
    setError(null);
    setBusy(true);

    let result: ChatResponse;
    try {
      result = await ask(question, history);
    } catch {
      result = { ok: false, reason: "No se pudo conectar con el servidor." };
    }

    if (result.ok) {
      lastId.current += 1;
      const answer: Message = { id: lastId.current, role: "assistant", content: result.answer };
      setMessages((current) => [...current, answer]);
    } else {
      setError(result.reason);
    }
    setBusy(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // El acento español pasa por composición: enviar a media tecla se comería la tilde.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void send();
  }

  return (
    <>
      <div className={styles.threadWrap}>
        <ol className={styles.thread} aria-label="Conversación" aria-live="polite">
          {messages.map((message) => (
            <li key={message.id} className={styles.turn} data-role={message.role}>
              <span className={styles.turnRole}>
                {message.role === "user" ? "Tú" : "Asistente"}
              </span>
              <p className={styles.turnBody}>{message.content}</p>
            </li>
          ))}
          {busy ? (
            <li className={styles.turn} data-role="assistant">
              <span className={styles.turnRole}>Asistente</span>
              <p className={styles.pending} role="status">
                Buscando en las llamadas…
              </p>
            </li>
          ) : null}
        </ol>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div ref={endRef} />
      </div>

      <div className={styles.dock}>
        <form className={styles.composer} onSubmit={handleSubmit}>
          <label className="srOnly" htmlFor="chat-question">
            Pregunta sobre las llamadas archivadas
          </label>
          <textarea
            id="chat-question"
            className={styles.textarea}
            rows={2}
            value={draft}
            disabled={busy}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="¿Qué le prometimos a Marwane?"
            aria-describedby="chat-hint"
          />
          <button type="submit" className={styles.send} disabled={busy || draft.trim() === ""}>
            {busy ? "Consultando…" : "Preguntar"}
          </button>
          <p id="chat-hint" className={styles.hint}>
            Intro envía · Mayús+Intro salta de línea. Responde sólo con lo que consta en las
            llamadas archivadas y cita de cuál sale. Nada de esto se guarda.
          </p>
        </form>
      </div>
    </>
  );
}
