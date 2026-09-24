import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";

import { listMeetings, unwrap, type DeliveryStatus, type MeetingSummary } from "./meetings";

/**
 * Ficha de cliente. No existe tabla de clientes: la empresa se deduce del dominio
 * del correo de los asistentes externos de `meeting_invitees`, y todo lo demás
 * (llamadas, compromisos, entregas) cuelga de los `recording_id` en los que aparece.
 *
 * Se lee en servidor con la clave de servicio, igual que el resto del panel.
 */

export type ClientContact = {
  name: string | null;
  email: string;
};

export type ClientCall = {
  recordingId: number;
  title: string;
  startedAt: string | null;
  endedAt: string | null;
  headline: string | null;
  sentiment: string | null;
  hasBrief: boolean;
  deliveryStatus: DeliveryStatus | null;
  openItems: number;
};

export type ClientCommitment = {
  id: string;
  description: string;
  completed: boolean;
  assigneeName: string | null;
  assigneeEmail: string | null;
  recordingId: number;
  meetingStartedAt: string | null;
};

export type ClientAccount = {
  /** Dominio del correo: es el identificador real de la empresa. */
  domain: string;
  contacts: ClientContact[];
  calls: ClientCall[];
  commitments: ClientCommitment[];
  openCommitments: number;
  lastCallAt: string | null;
};

function domainOf(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

function timeOf(iso: string | null): number {
  if (!iso) return 0;
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
}

/**
 * Un asistente cuenta como externo si Fathom lo marcó así o si su dominio no es el
 * del buzón que graba. El segundo caso cubre las reuniones cuyo webhook llegó sin
 * la bandera `is_external` puesta, que hoy son todas.
 */
function isExternal(
  invitee: { email: string | null; is_external: boolean | null },
  ownDomains: ReadonlySet<string>,
): boolean {
  if (invitee.is_external === true) return true;
  const domain = domainOf(invitee.email);
  if (!domain) return false;
  return !ownDomains.has(domain);
}

export async function listClientAccounts(): Promise<ClientAccount[]> {
  const db = getAdminClient();

  const [meetings, hostRows, inviteeRows] = await Promise.all([
    listMeetings(200),
    db.from("meetings").select("recording_id, recorded_by_email"),
    db.from("meeting_invitees").select("recording_id, name, email, is_external"),
  ]);

  const hosts = unwrap(hostRows, "los buzones que graban");
  const invitees = unwrap(inviteeRows, "los asistentes");

  const ownDomains = new Set<string>();
  for (const host of hosts) {
    const domain = domainOf(host.recorded_by_email);
    if (domain) ownDomains.add(domain);
  }

  const byDomain = new Map<string, { contacts: Map<string, ClientContact>; ids: Set<number> }>();

  for (const invitee of invitees) {
    if (!isExternal(invitee, ownDomains)) continue;
    const domain = domainOf(invitee.email);
    const email = invitee.email?.trim().toLowerCase();
    if (!domain || !email) continue;

    const bucket = byDomain.get(domain) ?? { contacts: new Map(), ids: new Set() };
    if (!bucket.contacts.has(email)) {
      bucket.contacts.set(email, { name: invitee.name?.trim() || null, email });
    }
    bucket.ids.add(invitee.recording_id);
    byDomain.set(domain, bucket);
  }

  if (byDomain.size === 0) return [];

  const recordingIds = Array.from(
    new Set(Array.from(byDomain.values()).flatMap((bucket) => Array.from(bucket.ids))),
  );

  const actionRows = unwrap(
    await db
      .from("action_items")
      .select("id, recording_id, description, completed, assignee_name, assignee_email")
      .in("recording_id", recordingIds),
    "los compromisos de los clientes",
  );

  const meetingById = new Map<number, MeetingSummary>();
  for (const meeting of meetings) meetingById.set(meeting.recordingId, meeting);

  const itemsByMeeting = new Map<number, ClientCommitment[]>();
  for (const row of actionRows) {
    const list = itemsByMeeting.get(row.recording_id) ?? [];
    list.push({
      id: row.id,
      description: row.description,
      completed: row.completed,
      assigneeName: row.assignee_name,
      assigneeEmail: row.assignee_email,
      recordingId: row.recording_id,
      meetingStartedAt: meetingById.get(row.recording_id)?.startedAt ?? null,
    });
    itemsByMeeting.set(row.recording_id, list);
  }

  const accounts: ClientAccount[] = [];

  for (const [domain, bucket] of byDomain) {
    const calls: ClientCall[] = [];
    const commitments: ClientCommitment[] = [];

    for (const id of bucket.ids) {
      const meeting = meetingById.get(id);
      if (meeting) {
        calls.push({
          recordingId: meeting.recordingId,
          title: meeting.title,
          startedAt: meeting.startedAt,
          endedAt: meeting.endedAt,
          headline: meeting.headline,
          sentiment: meeting.sentiment,
          hasBrief: meeting.hasBrief,
          deliveryStatus: meeting.deliveryStatus,
          openItems: meeting.actionItemsOpen,
        });
      }
      commitments.push(...(itemsByMeeting.get(id) ?? []));
    }

    calls.sort((a, b) => timeOf(b.startedAt) - timeOf(a.startedAt));
    commitments.sort((a, b) => timeOf(b.meetingStartedAt) - timeOf(a.meetingStartedAt));

    accounts.push({
      domain,
      contacts: Array.from(bucket.contacts.values()).sort((a, b) => a.email.localeCompare(b.email)),
      calls,
      commitments,
      openCommitments: commitments.filter((item) => !item.completed).length,
      lastCallAt: calls[0]?.startedAt ?? null,
    });
  }

  return accounts.sort((a, b) => timeOf(b.lastCallAt) - timeOf(a.lastCallAt));
}
