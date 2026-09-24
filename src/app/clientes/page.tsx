import type { Metadata } from "next";

import { ClientsExplorer } from "@/components/clients/ClientsExplorer";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { listClientAccounts } from "@/lib/queries/clients";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clientes",
  description:
    "Cada dominio externo que ha participado en una llamada, con sus grabaciones y sus compromisos abiertos.",
};

export default async function ClientesPage() {
  const accounts = await listClientAccounts();

  return (
    <>
      <div className="wrap">
        <PageHeader
          kicker={accounts.length === 1 ? "1 cliente" : `${String(accounts.length)} clientes`}
          title="Clientes"
          lede="Cada ficha reúne las llamadas de ese dominio, lo que se acordó en ellas y lo que sigue abierto. La empresa se deduce del correo de los asistentes: no hay ningún CRM detrás."
        />
      </div>

      {accounts.length === 0 ? (
        <div className="wrap">
          <EmptyState
            size="block"
            title="Todavía no hay ningún cliente"
            body="Fathom no ha registrado a ningún asistente externo: en las grabaciones sincronizadas solo aparece el buzón que graba, así que no hay dominio de cliente del que construir una ficha."
            hint="En cuanto una llamada traiga a un invitado de otro dominio, su ficha aparecerá aquí sola."
          />
        </div>
      ) : (
        <ClientsExplorer accounts={accounts} />
      )}
    </>
  );
}
