import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/chrome/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Panel interno — ihsan.co",
    template: "%s — ihsan.co",
  },
  description:
    "Panel interno de ihsan.co: reuniones grabadas con Fathom, briefs generados con IA, compromisos con cliente y estado de las entregas a Discord.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <a className="srOnly" href="#contenido">
          Saltar al contenido
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
