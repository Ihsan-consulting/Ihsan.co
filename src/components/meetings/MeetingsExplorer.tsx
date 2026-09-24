"use client";

import { useId, useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/primitives";
import type { DeliveryStatus, MeetingSummary } from "@/lib/queries/meetings";

import { MeetingCard } from "./MeetingCard";
import styles from "./meetings.module.css";

type Filter = "todas" | DeliveryStatus | "sin-brief";

const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: "todas", label: "Todas" },
  { value: "failed", label: "Entrega fallida" },
  { value: "pending", label: "En cola" },
  { value: "sent", label: "Entregadas" },
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

export function MeetingsExplorer({ meetings }: { meetings: MeetingSummary[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");
  const searchId = useId();

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return meetings.filter(
      (meeting) => matchesFilter(meeting, filter) && matchesQuery(meeting, needle),
    );
  }, [meetings, filter, query]);

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

  const isFiltered = filter !== "todas" || query.trim() !== "";

  return (
    <div className={styles.explorer}>
      <div className={styles.controls}>
        <div className={styles.search}>
          <label htmlFor={searchId} className="srOnly">
            Buscar por título, titular del brief o persona que grabó
          </label>
          <input
            id={searchId}
            type="search"
            className={styles.searchInput}
            placeholder="Buscar reunión, cliente o persona…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </div>

        <div className={styles.filters} role="group" aria-label="Filtrar por estado">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.filter}
              data-active={filter === option.value ? "true" : undefined}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
              <span className={`num ${styles.filterCount}`}>{counts.get(option.value) ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <p className={styles.resultCount} aria-live="polite">
        <span className="num">{visible.length}</span>{" "}
        {visible.length === 1 ? "reunión" : "reuniones"}
        {isFiltered ? ` de ${meetings.length}` : ""}
      </p>

      {visible.length === 0 ? (
        <div className={styles.explorerEmpty}>
          <EmptyState
            title="Ningún resultado"
            body="Ninguna reunión coincide con la búsqueda o el filtro activo."
          />
          <button
            type="button"
            className={styles.reset}
            onClick={() => {
              setQuery("");
              setFilter("todas");
            }}
          >
            Quitar filtros
          </button>
        </div>
      ) : (
        <ol className={styles.list}>
          {visible.map((meeting) => (
            <li key={meeting.recordingId}>
              <MeetingCard meeting={meeting} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
