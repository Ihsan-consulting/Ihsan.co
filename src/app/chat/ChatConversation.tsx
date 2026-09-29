"use client";

import Link from "next/link";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import type { CorpusScope } from "@/lib/queries/chat";

import { citedSources, parseAnswer, type Inline, type Source } from "./answer-format";
import styles from "./chat.module.css";
import { UNSUPPORTED_MESSAGE, useSpeechInput } from "./useSpeechInput";

/**
 * Asistente sobre el archivo de llamadas.
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
const MAX_QUESTION = 2_000;

const SUGGESTIONS = [
  "¿Qué objeciones se repiten y cómo las respondimos?",
  "Resume los pagos acordados este mes",
  "¿Qué compromisos siguen abiertos y de quién son?",
  "¿Qué clientes están en riesgo y por qué?",
  "¿Cuáles fueron las llamadas con mejor y peor puntuación?",
  "¿Qué objetivos tienen los clientes de esta semana?",
] as const;

type Role = "user" | "assistant";

type Message = {
  id: number;
  role: Role;
  content: string;
  streaming?: boolean;
  sources?: Source[];
};

const UNREADABLE =
  "No se pudo leer la respuesta del servidor. Puede que tu sesión haya caducado: recarga la página.";

function readSources(response: Response): Source[] {
  const raw = response.headers.get("x-chat-sources");
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(parsed) ? (parsed as Source[]) : [];
  } catch {
    return [];
  }
}

function renderInline(parts: Inline[]): ReactNode {
  return parts.map((part, index) =>
    part.bold ? (
      <strong key={index}>{part.text}</strong>
    ) : (
      <Fragment key={index}>{part.text}</Fragment>
    ),
  );
}

function AnswerBody({ text }: { text: string }) {
  return (
    <div className={styles.answer}>
      {parseAnswer(text).map((block, index) => {
        switch (block.kind) {
          case "heading":
            return <h3 key={index}>{renderInline(block.content)}</h3>;
          case "paragraph":
            return <p key={index}>{renderInline(block.content)}</p>;
          case "ul":
            return (
              <ul key={index}>
                {block.items.map((item, i) => (
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={index}>
                {block.items.map((item, i) => (
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </ol>
            );
        }
      })}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.ghostButton}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => {
            setCopied(false);
          }, 1600);
        });
      }}
    >
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function formatSourceDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        timeZone: "Europe/Madrid",
      });
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Welcome({
  scope,
  busy,
  onPick,
}: {
  scope: CorpusScope;
  busy: boolean;
  onPick: (question: string) => void;
}) {
  return (
    <div className={styles.welcome}>
      <span className={styles.mark} aria-hidden="true">
        ✦
      </span>
      <h2 className={styles.welcomeTitle}>¿Qué quieres saber de tus llamadas?</h2>
      <p className={styles.welcomeLede}>
        Pregunta por escrito o por voz. El asistente analiza briefs, objeciones, pagos, objetivos y
        compromisos, y cita de qué llamada sale cada dato.
      </p>
      <ul className={styles.scope} aria-label="Material disponible">
        <li>
          <span className="num">{scope.meetings}</span> llamadas
        </li>
        <li>
          <span className="num">{scope.briefs}</span> briefs
        </li>
        <li>
          <span className="num">{scope.openCommitments}</span> compromisos abiertos
        </li>
        <li>
          <span className="num">{scope.withTranscript}</span> transcripciones
        </li>
      </ul>
      {scope.briefs === 0 ? (
        <p className={styles.warn}>
          Todavía no hay briefs generados: las respuestas serán pobres hasta que corra el análisis.
        </p>
      ) : null}
      <div className={styles.suggestions}>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className={styles.suggestion}
            disabled={busy}
            onClick={() => {
              onPick(suggestion);
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function AssistantTurn({ message }: { message: Message }) {
  return (
    <li className={styles.turn} data-role="assistant">
      <span className={styles.avatar} aria-hidden="true">
        ✦
      </span>
      <div className={styles.assistantCard}>
        {message.content === "" && message.streaming ? (
          <p className={styles.pending} role="status">
            <span className={styles.dots} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            Analizando las llamadas…
          </p>
        ) : (
          <AnswerBody text={message.content} />
        )}
        {message.streaming ? null : (
          <div className={styles.answerFooter}>
            {message.sources && message.sources.length > 0 ? (
              <div className={styles.sources}>
                <span className={styles.sourcesLabel}>Fuentes</span>
                {message.sources.map((source) => (
                  <Link
                    key={source.id}
                    href={`/meetings/${String(source.id)}`}
                    className={styles.sourceChip}
                  >
                    {source.title}
                    {source.date ? (
                      <span className={styles.sourceDate}>{formatSourceDate(source.date)}</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : (
              <span />
            )}
            <CopyButton text={message.content} />
          </div>
        )}
      </div>
    </li>
  );
}

/** Lee el cuerpo de un error: JSON de la ruta, o el HTML de /login si caducó la sesión. */
async function failureReason(response: Response, type: string): Promise<string> {
  if (!type.includes("application/json")) return UNREADABLE;
  try {
    const data = (await response.json()) as { reason?: string };
    return data.reason ?? UNREADABLE;
  } catch {
    return UNREADABLE;
  }
}

export function ChatConversation({ scope }: { scope: CorpusScope }) {
  const [messages, setMessages] = useState<readonly Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const speech = useSpeechInput(setDraft);

  useEffect(() => {
    if (messages.length === 0 && !busy) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, busy]);

  // El campo crece con el texto (también con el dictado) hasta un tope razonable.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${String(Math.min(el.scrollHeight, 220))}px`;
  }, [draft]);

  function patchMessage(id: number, patch: Partial<Message>) {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...patch } : message)),
    );
  }

  async function send(text?: string) {
    const question = (text ?? draft).trim().slice(0, MAX_QUESTION);
    if (!question || busy) return;
    if (speech.listening) speech.stop();

    const history = messages
      .filter((m) => m.content.trim() !== "")
      .slice(-MAX_HISTORY)
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, MAX_QUESTION),
      }));

    lastId.current += 1;
    const userId = lastId.current;
    lastId.current += 1;
    const answerId = lastId.current;

    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: question },
      { id: answerId, role: "assistant", content: "", streaming: true },
    ]);
    setDraft("");
    setError(null);
    setBusy(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const type = response.headers.get("content-type") ?? "";
      if (!type.includes("text/plain") || !response.body) {
        throw new Error(await failureReason(response, type));
      }

      const sources = readSources(response);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        patchMessage(answerId, { content: answer });
      }
      answer += decoder.decode();
      patchMessage(answerId, {
        content: answer,
        streaming: false,
        sources: citedSources(answer, sources),
      });
    } catch (caught) {
      const reason =
        caught instanceof Error && caught.message !== "Failed to fetch"
          ? caught.message
          : "No se pudo conectar con el servidor.";
      // Se quita la pregunta fallida para que el histórico enviado siga alternando bien.
      setMessages((current) => current.filter((m) => m.id !== answerId && m.id !== userId));
      setDraft(question);
      setError(reason);
    } finally {
      setBusy(false);
    }
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

  function toggleMic() {
    if (speech.listening) {
      speech.stop();
      return;
    }
    speech.start(draft);
    textareaRef.current?.focus();
  }

  return (
    <>
      <div className={styles.threadWrap}>
        {messages.length === 0 ? (
          <Welcome
            scope={scope}
            busy={busy}
            onPick={(question) => {
              void send(question);
            }}
          />
        ) : (
          <ol className={styles.thread} aria-label="Conversación" aria-live="polite">
            {messages.map((message) =>
              message.role === "user" ? (
                <li key={message.id} className={styles.turn} data-role="user">
                  <p className={styles.userBubble}>{message.content}</p>
                </li>
              ) : (
                <AssistantTurn key={message.id} message={message} />
              ),
            )}
          </ol>
        )}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div ref={endRef} />
      </div>

      <div className={styles.dock}>
        <form
          className={styles.composer}
          data-listening={speech.listening || undefined}
          onSubmit={handleSubmit}
        >
          <label className="srOnly" htmlFor="chat-question">
            Pregunta sobre las llamadas archivadas
          </label>
          <textarea
            ref={textareaRef}
            id="chat-question"
            className={styles.textarea}
            rows={2}
            maxLength={MAX_QUESTION}
            value={draft}
            disabled={busy}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              speech.listening
                ? "Habla, te escucho…"
                : "Pregunta sobre tus llamadas… o pulsa el micrófono"
            }
            aria-describedby="chat-hint"
          />
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.mic}
              data-active={speech.listening || undefined}
              onClick={toggleMic}
              disabled={busy}
              aria-pressed={speech.listening}
              aria-label={speech.listening ? "Detener dictado" : "Dictar por voz"}
              title={speech.supported ? "Dictar por voz (español)" : UNSUPPORTED_MESSAGE}
            >
              <MicIcon />
            </button>
            {speech.listening ? (
              <span className={styles.listening} role="status">
                <span className={styles.recDot} aria-hidden="true" />
                Escuchando… pulsa de nuevo para parar
              </span>
            ) : (
              <p id="chat-hint" className={styles.hint}>
                Intro envía · Mayús+Intro salta de línea · Nada se guarda
              </p>
            )}
            <button type="submit" className={styles.send} disabled={busy || draft.trim() === ""}>
              {busy ? "Analizando…" : "Preguntar"}
            </button>
          </div>
          {speech.error ? (
            <p className={styles.micError} role="alert">
              {speech.error}
            </p>
          ) : null}
        </form>
      </div>
    </>
  );
}
