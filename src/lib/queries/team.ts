import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";

import { unwrap } from "./meetings";

/**
 * Equipo. No hay tabla de personas: cada nombre sale de las propias grabaciones,
 * o bien de quién grabó (`meetings.recorded_by_*`) o bien de a quién quedó asignado
 * un compromiso (`action_items.assignee_*`). Nunca se escribe un nombre a mano.
 */

export type TeamRange = "semana" | "mes" | "todo";

export type TeamStats = {
  meetingsRecorded: number;
  openCommitments: number;
  failedDeliveries: number;
};

export type TeamCommitment = {
  id: string;
  description: string;
  recordingId: number;
  meetingTitle: string;
  meetingStartedAt: string | null;
};

export type TeamMember = {
  key: string;
  name: string;
  email: string | null;
  team: string | null;
  lastActivityAt: string | null;
  stats: Record<TeamRange, TeamStats>;
  /** Compromisos abiertos de la persona, de la llamada más reciente a la más antigua. */
  commitments: TeamCommitment[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function timeOf(iso: string | null): number {
  if (!iso) return 0;
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
}

/** Rangos a los que pertenece una fecha: «todo» siempre, los demás por ventana. */
function rangesFor(iso: string | null, now: number): TeamRange[] {
  const ranges: TeamRange[] = ["todo"];
  const time = timeOf(iso);
  if (time === 0) return ranges;
  if (now - time <= 30 * DAY_MS) ranges.push("mes");
  if (now - time <= 7 * DAY_MS) ranges.push("semana");
  return ranges;
}

function emptyStats(): Record<TeamRange, TeamStats> {
  return {
    semana: { meetingsRecorded: 0, openCommitments: 0, failedDeliveries: 0 },
    mes: { meetingsRecorded: 0, openCommitments: 0, failedDeliveries: 0 },
    todo: { meetingsRecorded: 0, openCommitments: 0, failedDeliveries: 0 },
  };
}

function personKey(name: string | null, email: string | null): string | null {
  const cleanEmail = email?.trim().toLowerCase();
  if (cleanEmail) return cleanEmail;
  const cleanName = name?.trim().toLowerCase();
  return cleanName || null;
}

function ensure(
  people: Map<string, TeamMember>,
  key: string,
  name: string | null,
  email: string | null,
): TeamMember {
  const current = people.get(key);
  if (current) {
    if (!current.email && email) current.email = email.trim().toLowerCase();
    return current;
  }

  const draft: TeamMember = {
    key,
    name: name?.trim() || email?.trim() || "Sin identificar",
    email: email?.trim().toLowerCase() ?? null,
    team: null,
    lastActivityAt: null,
    stats: emptyStats(),
    commitments: [],
  };
  people.set(key, draft);
  return draft;
}

function touch(person: TeamMember, iso: string | null): void {
  if (timeOf(iso) > timeOf(person.lastActivityAt)) person.lastActivityAt = iso;
}

export async function listTeamBoard(): Promise<TeamMember[]> {
  const db = getAdminClient();
  const now = Date.now();

  const [meetingRows, actionRows, deliveryRows] = await Promise.all([
    db
      .from("meetings")
      .select(
        "recording_id, title, recording_start_time, scheduled_start_time, recorded_by_name, recorded_by_email, recorded_by_team",
      ),
    db
      .from("action_items")
      .select("id, recording_id, description, completed, assignee_name, assignee_email")
      .eq("completed", false),
    db.from("deliveries").select("recording_id, status").eq("status", "failed"),
  ]);

  const meetings = unwrap(meetingRows, "las reuniones del equipo");
  const actions = unwrap(actionRows, "los compromisos del equipo");
  const failed = unwrap(deliveryRows, "las entregas fallidas");

  const startedAt = new Map<number, string | null>();
  const titles = new Map<number, string>();

  const failedByMeeting = new Map<number, number>();
  for (const row of failed) {
    failedByMeeting.set(row.recording_id, (failedByMeeting.get(row.recording_id) ?? 0) + 1);
  }

  const people = new Map<string, TeamMember>();

  for (const meeting of meetings) {
    const date = meeting.recording_start_time ?? meeting.scheduled_start_time;
    startedAt.set(meeting.recording_id, date);
    titles.set(meeting.recording_id, meeting.title);

    const key = personKey(meeting.recorded_by_name, meeting.recorded_by_email);
    if (!key) continue;

    const person = ensure(people, key, meeting.recorded_by_name, meeting.recorded_by_email);
    if (!person.team && meeting.recorded_by_team) person.team = meeting.recorded_by_team;
    touch(person, date);

    const failures = failedByMeeting.get(meeting.recording_id) ?? 0;
    for (const range of rangesFor(date, now)) {
      person.stats[range].meetingsRecorded += 1;
      person.stats[range].failedDeliveries += failures;
    }
  }

  for (const item of actions) {
    const key = personKey(item.assignee_name, item.assignee_email);
    if (!key) continue;

    const person = ensure(people, key, item.assignee_name, item.assignee_email);
    const date = startedAt.get(item.recording_id) ?? null;
    touch(person, date);

    for (const range of rangesFor(date, now)) {
      person.stats[range].openCommitments += 1;
    }

    person.commitments.push({
      id: item.id,
      description: item.description,
      recordingId: item.recording_id,
      meetingTitle: titles.get(item.recording_id) ?? `Grabación ${String(item.recording_id)}`,
      meetingStartedAt: date,
    });
  }

  for (const person of people.values()) {
    person.commitments.sort((a, b) => timeOf(b.meetingStartedAt) - timeOf(a.meetingStartedAt));
  }

  return Array.from(people.values()).sort((a, b) => {
    const byCommitments = b.stats.todo.openCommitments - a.stats.todo.openCommitments;
    if (byCommitments !== 0) return byCommitments;
    return b.stats.todo.meetingsRecorded - a.stats.todo.meetingsRecorded;
  });
}
