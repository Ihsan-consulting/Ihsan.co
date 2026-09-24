"use client";

import { useId, useMemo, useState } from "react";

import { initials } from "@/components/formatting";
import type { ClientAccount } from "@/lib/queries/clients";

import { ClientFicha } from "./ClientFicha";
import styles from "./clients.module.css";

type Filter = "todos" | "pendientes" | "aldia";

const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "pendientes", label: "Con compromisos" },
  { value: "aldia", label: "Al día" },
];

function matchesFilter(account: ClientAccount, filter: Filter): boolean {
  if (filter === "todos") return true;
  if (filter === "pendientes") return account.openCommitments > 0;
  return account.openCommitments === 0;
}

function matchesQuery(account: ClientAccount, query: string): boolean {
  if (!query) return true;
  const haystack = [
    account.domain,
    ...account.contacts.map((contact) => `${contact.name ?? ""} ${contact.email}`),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function ClientsExplorer({ accounts }: { accounts: ClientAccount[] }) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [selected, setSelected] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return accounts.filter(
      (account) => matchesFilter(account, filter) && matchesQuery(account, needle),
    );
  }, [accounts, filter, query]);

  const counts = useMemo(() => {
    const map = new Map<Filter, number>();
    for (const option of FILTERS) {
      map.set(option.value, accounts.filter((a) => matchesFilter(a, option.value)).length);
    }
    return map;
  }, [accounts]);

  const active = visible.find((account) => account.domain === selected) ?? visible[0] ?? accounts[0];

  return (
    <div className={`wrap ${styles.layout}`}>
      <aside className={styles.listCard} aria-label="Lista de clientes">
        <div className={styles.listHead}>
          <div className={styles.filters} role="group" aria-label="Filtrar por compromisos">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={styles.filter}
                data-active={filter === option.value ? "true" : undefined}
                aria-pressed={filter === option.value}
                onClick={() => {
                  setFilter(option.value);
                }}
              >
                {option.label}
                <span className={`num ${styles.filterCount}`}>{counts.get(option.value) ?? 0}</span>
              </button>
            ))}
          </div>

          <div className={styles.search}>
            <label htmlFor={searchId} className="srOnly">
              Filtrar clientes por dominio o persona
            </label>
            <svg
              viewBox="0 0 16 16"
              width="13"
              height="13"
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
              placeholder="Filtrar clientes"
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <p className={styles.listEmpty}>Ningún cliente coincide con este filtro.</p>
        ) : (
          <ul className={styles.list}>
            {visible.map((account) => {
              const pending = account.openCommitments > 0;
              const isActive = active.domain === account.domain;
              return (
                <li key={account.domain}>
                  <button
                    type="button"
                    className={styles.row}
                    data-active={isActive ? "true" : undefined}
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => {
                      setSelected(account.domain);
                    }}
                  >
                    <span className={styles.avatar} aria-hidden="true">
                      {initials(account.domain, null)}
                    </span>
                    <span className={styles.rowBody}>
                      <span className={styles.rowName}>{account.domain}</span>
                      <span className={styles.rowMeta}>
                        <span
                          className={styles.dot}
                          data-tone={pending ? "warn" : "ok"}
                          aria-hidden="true"
                        />
                        <span className={styles.rowState} data-tone={pending ? "warn" : "ok"}>
                          {pending ? `${String(account.openCommitments)} sin cerrar` : "Al día"}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="num">
                          {account.calls.length}{" "}
                          {account.calls.length === 1 ? "llamada" : "llamadas"}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <ClientFicha account={active} />
    </div>
  );
}
