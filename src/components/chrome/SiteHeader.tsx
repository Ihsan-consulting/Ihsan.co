"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./SiteHeader.module.css";

const NAV = [
  { href: "/", label: "Panel" },
  { href: "/meetings", label: "Reuniones" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";

  // La pantalla de acceso no tiene sesión: cabecera reducida, sin navegación.
  const bare = pathname.startsWith("/login");

  return (
    <header className={styles.header}>
      <div className={`wrap ${styles.inner}`}>
        <Link href="/" className={styles.mark} aria-label="ihsan.co — ir al panel">
          <span className={styles.markName}>ihsan</span>
          <span className={styles.markDot} aria-hidden="true" />
          <span className={styles.markSuffix}>co</span>
        </Link>

        {bare ? (
          <p className={styles.bareNote}>Panel interno</p>
        ) : (
          <>
            <nav className={styles.nav} aria-label="Secciones del panel">
              <ul className={styles.navList}>
                {NAV.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={styles.navLink}
                        aria-current={active ? "page" : undefined}
                        data-active={active ? "true" : undefined}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <form className={styles.session} action="/api/auth/logout" method="post">
              <button type="submit" className={styles.signOut}>
                Cerrar sesión
              </button>
            </form>
          </>
        )}
      </div>
    </header>
  );
}
