"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Dictado por voz con la Web Speech API del navegador (Chrome, Edge, Safari).
 * Sin dependencias ni servidor: el audio lo procesa el propio navegador. Los tipos
 * se declaran aquí porque `webkitSpeechRecognition` no está en lib.dom.
 */

type RecognitionAlternative = { transcript: string };
type RecognitionResult = {
  isFinal: boolean;
  0: RecognitionAlternative;
  length: number;
};
type RecognitionEvent = {
  results: { length: number; [index: number]: RecognitionResult };
};
type RecognitionErrorEvent = { error: string };

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "El navegador bloqueó el micrófono. Dale permiso en la barra de direcciones.",
  "service-not-allowed":
    "El navegador bloqueó el micrófono. Dale permiso en la barra de direcciones.",
  "no-speech": "No se oyó nada. Vuelve a pulsar el micrófono y habla.",
  "audio-capture": "No se encontró ningún micrófono conectado.",
  network: "El dictado necesita conexión a internet.",
};

export const UNSUPPORTED_MESSAGE =
  "Este navegador no permite dictar por voz. Prueba con Chrome, Edge o Safari.";

const noSubscribe = () => () => undefined;

export function useSpeechInput(onText: (text: string) => void) {
  // En el servidor no hay API de voz: false allí, el valor real en el navegador.
  const supported = useSyncExternalStore(
    noSubscribe,
    () => getRecognitionCtor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  /** `base` es lo que ya había escrito: el dictado se añade detrás, no lo pisa. */
  const start = useCallback((base: string) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError(UNSUPPORTED_MESSAGE);
      return;
    }
    recognitionRef.current?.abort();

    const recognition = new Ctor();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = true;
    const prefix = base.trim() === "" ? "" : `${base.trimEnd()} `;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i]?.[0].transcript ?? "";
      }
      onTextRef.current(prefix + transcript.trimStart());
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      setError(ERROR_MESSAGES[event.error] ?? "El dictado falló. Inténtalo de nuevo.");
    };
    recognition.onend = () => {
      setListening(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setError(null);
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("No se pudo iniciar el micrófono. Inténtalo de nuevo.");
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { supported, listening, error, start, stop, clearError };
}
