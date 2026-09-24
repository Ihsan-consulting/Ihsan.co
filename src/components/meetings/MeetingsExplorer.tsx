"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

import type { DeliveryStatus, MeetingSummary } from "@/lib/queries/meetings";

import { dateGroup } from "./aggregate";
import { MeetingCard } from "./MeetingCard";
import styles from "./meetings.module.css";

type Filter = "todas" | DeliveryStatus | "sin-brief";
type Sort = "recientes" | "antiguas";

const PAGE_SIZE = 20;

const FILTERS: ReadonlyArray<{ value: Filter; label: string; dot?: string }> = [
  { value: "todas", label: "Todas" },
  { value: "failed", label: "Entrega fallida", dot: "danger" },
  { value: "pending", label: "En cola", dot: "warn" },
  { value: "sent", label: "Entregadas", dot: "ok" },
  { value: "sin-brief", label: "Sin brief" },
];

function matchesFilter(meeting: MeetingSummary, filter: Filter): boolean {
  if (filter === "todas") return true;
  if (filter === "sin-brief") return !meeting.hasBrief;
  return meeting.deliveryStatus === filter;
}

function matchesQuery(meeting: MeetingSummary, query: string): boolean {
  if (!query) return true;
  const haystack = [meeting.title, meeting.headline, meeting.recordedByName]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function timeOf(meeting: MeetingSummary): number {
  const value = Date.parse(meeting.startedAt ?? meeting.createdAt);
  return Number.isNaN(value) ? 0 : value;
}

export function MeetingsExplorer({ meetings }: { meetings: MeetingSummary[] }) {
  const router = useRouter();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");
  const [sort, setSort] = useState<Sort>("recientes");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [active, setActive] = useState(-1);

  const matched = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = meetings.filter(
      (meeting) => matchesFilter(meeting, filter) && matchesQuery(meeting, needle),
    );
    return rows.sort((a, b) =>
      sort === "recientes" ? timeOf(b) - timeOf(a) : timeOf(a) - timeOf(b),
    );
  }, [meetings, filter, query, sort]);

  const processing = useMemo(() => matched.filter((meeting) => !meeting.hasBrief), [matched]);
  const analysed = useMemo(() => matched.filter((meeting) => meeting.hasBrief), [matched]);
  const visible = useMemo(() => analysed.slice(0, limit), [analysed, limit]);

  const counts = useMemo(() => {
    const map = new Map<Filter, number>();
    for (const option of FILTERS) {
      map.set(
        option.value,
        meetings.filter((meeting) => matchesFilter(meeting, option.value)).length,
      );
    }
    return map;
  }, [meetings]);

  /** El encabezado solo se dibuja cuando cambia el grupo respecto a la fila anterior. */
  const rows = useMemo(
    () =>
      visible.map((meeting, index) => {
        const group = dateGroup(meeting.startedAt);
        const previous = index === 0 ? "" : dateGroup(visible[index - 1].startedAt);
        return { meeting, group, heading: group === previous ? null : group };
      }),
    [visible],
  );

  const groupCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const meeting of analysed) {
      const key = dateGroup(meeting.startedAt);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [analysed]);

  // J y K recorren la lista; ↵ abre la llamada marcada.
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      if (visible.length === 0) return;

      if (event.key === "j" || event.key === "k") {
        event.preventDefault();
        setActive((current) =>
          event.key === "j"
            ? Math.min(current + 1, visible.length - 1)
            : Math.max(current - 1, 0),
        );
        return;
      }

      if (event.key === "Enter" && active >= 0 && active < visible.length) {
        event.preventDefault();
        router.push(`/meetings/${visible[active].recordingId}`);
      }
    },
    [active, router, visible],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  useEffect(() => {
    if (active < 0 || active >= visible.length) return;
    const node = document.getElementById(`llamada-${visible[active].recordingId}`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active, visible]);

  const isFiltered = filter !== "todas" || query.trim() !== "";

  return (
    <div className={styles.explorer}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerTitle}>
            <h1 className={styles.title}>Llamadas</h1>
            <p className={styles.count}>
              <span className="num">{matched.length}</span>
              {matched.length === 1 ? " llamada" : " llamadas"}
              {isFiltered ? (
                <>
                  {" de "}
                  <span className="num">{meetings.length}</span>
                </>
              ) : (
                " grabadas con Fathom"
              )}
            </p>
          </div>

          <div className={styles.tools}>
            <div className={styles.search}>
              <label htmlFor={searchId} className="srOnly">
                Buscar por título, titular del brief o persona que grabó
              </label>
              <svg
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L14 14" strokeLinecap="round" />
              </svg>
              <input
                id={searchId}
                type="search"
                className={styles.searchInput}
                placeholder="Buscar llamada, titular o persona"
                value={query}
                autoComplete="off"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setLimit(PAGE_SIZE);
                  setActive(-1);
                }}
              />
            </div>

            <button
              type="button"
              className={styles.sort}
              onClick={() =>
                setSort((current) => (current === "recientes" ? "antiguas" : "recientes"))
              }
            >
              {sort === "recientes" ? "Más recientes" : "Más antiguas"}
            </button>
          </div>
        </div>

        <div className={styles.filterRow}>
          <div className={styles.filters} role="group" aria-label="Filtrar por estado de entrega">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={styles.filter}
                data-active={filter === option.value ? "true" : undefined}
                aria-pressed={filter === option.value}
                onClick={() => {
                  setFilter(option.value);
                  setLimit(PAGE_SIZE);
                  setActive(-1);
                }}
              >
                {option.dot ? (
                  <span className={styles.filterDot} data-tone={option.dot} aria-hidden="true" />
                ) : null}
                {option.label}
                <span className={`num ${styles.filterCount}`}>{counts.get(option.value) ?? 0}</span>
              </button>
            ))}
          </div>

          <p className={styles.hint} aria-hidden="true">
            <span className={styles.key}>J</span>
            <span className={styles.key}>K</span>
            navegar
            <span className={styles.key}>↵</span>
            abrir
          </p>
        </div>
      </header>

      <div className={styles.results}>
        {processing.length > 0 ? (
          <>
            <p className={styles.groupHead}>
              <span className={styles.groupName}>Procesando</span>
              <span className={styles.groupNote}>Fathom → análisis IA</span>
            </p>
            <ol className={styles.list}>
              {processing.map((meeting) => (
                <li key={meeting.recordingId} id={`llamada-${meeting.recordingId}`}>
                  <MeetingCard meeting={meeting} />
                </li>
              ))}
            </ol>
          </>
        ) : null}

        {visible.length === 0 && processing.length === 0 ? (
          <div className={styles.noResults}>
            <p className={styles.noResultsText}>No hay llamadas que coincidan con este filtro.</p>
            <button
              type="button"
              className={styles.reset}
              onClick={() => {
                setQuery("");
                setFilter("todas");
                setLimit(PAGE_SIZE);
              }}
            >
              Quitar filtros
            </button>
          </div>
        ) : null}

        <ol className={styles.list}>
          {rows.map(({ meeting, group, heading }, index) => (
            <li key={meeting.recordingId} id={`llamada-${meeting.recordingId}`}>
              {heading ? (
                <p className={styles.groupHead}>
                  <span className={styles.groupName}>{heading}</span>
                  <span className={`num ${styles.groupNote}`}>{groupCounts.get(group) ?? 0}</span>
                </p>
              ) : null}
              <MeetingCard meeting={meeting} active={index === active} />
            </li>
          ))}
        </ol>

        {analysed.length > visible.length ? (
          <div className={styles.more}>
            <button
              type="button"
              className={styles.moreButton}
              onClick={() => setLimit((current) => current + PAGE_SIZE)}
            >
              Cargar {Math.min(PAGE_SIZE, analysed.length - visible.length)} anteriores
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
