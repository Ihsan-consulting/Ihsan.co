"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import styles from "./AppShell.module.css";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

type NavGroup = {
  label: string;
  items: ReadonlyArray<NavItem>;
};

/** Trazos del diseño: 15×15, sin relleno, redondeados. */
const NAV_GROUPS: ReadonlyArray<NavGroup> = [
  {
    label: "Panel",
    items: [
      { href: "/", label: "Inicio", icon: "M2 6.2L7.5 2l5.5 4.2V13H9.3V9.4H5.7V13H2z" },
      { href: "/meetings", label: "Llamadas", icon: "M2 4h11M2 7.5h11M2 11h7" },
      { href: "/alertas", label: "Alertas", icon: "M7.5 2.2L13.4 12.8H1.6zM7.5 6v3M7.5 10.9v.1" },
    ],
  },
  {
    label: "Conocimiento",
    items: [
      {
        href: "/clientes",
        label: "Clientes",
        icon: "M5.6 7.2a2.3 2.3 0 100-4.6 2.3 2.3 0 000 4.6zM1.6 13c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6M10.6 9.6c1.6.2 2.8 1.5 2.8 3.4",
      },
      { href: "/chat", label: "Chat", icon: "M2 3.2h11v7H6.8L3.6 12.6V10.2H2z" },
      { href: "/equipo", label: "Equipo", icon: "M3 13V9.5M7.5 13V5M12 13V2" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 15 15"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

/**
 * Armazón del panel: barra lateral fija y contenido a la derecha.
 * La pantalla de acceso no tiene sesión, así que se dibuja sin navegación.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const bare = pathname.startsWith("/login");

  // ⌘K / Ctrl+K lleva al archivo de llamadas, que es donde vive el buscador real.
  useEffect(() => {
    if (bare) return undefined;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      router.push("/meetings");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bare, router]);

  if (bare) {
    return <main id="contenido">{children}</main>;
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Secciones del panel">
        <Link href="/" className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            i
          </span>
          <span className={styles.brandBody}>
            <span className={styles.brandName}>ihsan.co</span>
            <span className={styles.brandNote}>
              <span className={styles.brandDot} aria-hidden="true" />
              Panel interno
            </span>
          </span>
        </Link>

        <Link href="/meetings" className={styles.search}>
          <svg
            viewBox="0 0 16 16"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <span className={styles.searchLabel}>Buscar</span>
          <span className={styles.searchKey} aria-hidden="true">
            ⌘K
          </span>
        </Link>

        {NAV_GROUPS.map((group) => (
          <div key={group.label} className={styles.group}>
            <p className={styles.groupLabel}>{group.label}</p>
            <ul className={styles.items}>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={styles.item}
                      data-active={active ? "true" : undefined}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className={styles.itemBar} aria-hidden="true" />
                      <span className={styles.itemIcon}>
                        <NavIcon path={item.icon} />
                      </span>
                      <span className={styles.itemLabel}>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <form className={styles.session} action="/api/auth/logout" method="post">
          <button type="submit" className={styles.sessionButton}>
            <span className={styles.avatar} aria-hidden="true">
              ih
              <span className={styles.avatarDot} />
            </span>
            <span className={styles.sessionBody}>
              <span className={styles.sessionName}>Sesión abierta</span>
              <span className={styles.sessionRole}>Cerrar sesión</span>
            </span>
            <svg
              viewBox="0 0 12 12"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4.5 2H2.5v8h2M6 3.8L8.2 6 6 8.2M8.2 6H4.6" />
            </svg>
          </button>
        </form>
      </nav>

      <main id="contenido" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
