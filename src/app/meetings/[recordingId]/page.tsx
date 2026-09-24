import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  formatDuration,
  formatLanguage,
  formatLongDate,
  formatSentiment,
  formatTime,
  initials,
} from "@/components/formatting";
import { BriefPanel, SourceSummary } from "@/components/meetings/Brief";
import { ActionItemList } from "@/components/meetings/Commitments";
import { RecordingPlayer, SendChecklist } from "@/components/meetings/Detail";
import { DeliveryTrail, GoogleDocPanel, InviteeList } from "@/components/meetings/Sidebar";
import { StatusBadge } from "@/components/ui/primitives";
import { getMeetingDetail } from "@/lib/queries/meetings";

import styles from "../meetings.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ recordingId: string }>;
};

function parseRecordingId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isSafeInteger(value) ? value : null;
}

function secondsBetween(startIso: string | null, endIso: string | null): number | null {
  if (!startIso || !endIso) return null;
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.round((end - start) / 1000);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { recordingId } = await params;
  const id = parseRecordingId(recordingId);
  if (id === null) return { title: "Llamada no encontrada" };

  const meeting = await getMeetingDetail(id);
  if (!meeting) return { title: "Llamada no encontrada" };

  return {
    title: meeting.title,
    description: meeting.brief?.headline ?? "Detalle de la llamada grabada con Fathom.",
  };
}

export default async function MeetingDetailPage({ params }: PageProps) {
  const { recordingId } = await params;
  const id = parseRecordingId(recordingId);
  if (id === null) notFound();

  const meeting = await getMeetingDetail(id);
  if (!meeting) notFound();

  const startedAt = meeting.recordingStartTime ?? meeting.scheduledStartTime;
  const endedAt = meeting.recordingEndTime ?? meeting.scheduledEndTime;
  const duration = formatDuration(startedAt, endedAt);
  const language = formatLanguage(meeting.transcriptLanguage);
  const sentiment = formatSentiment(meeting.brief?.sentiment ?? null);

  // El estado que se muestra arriba es el peor de todos los intentos.
  const worstDelivery =
    meeting.deliveries.find((delivery) => delivery.status === "failed") ??
    meeting.deliveries.find((delivery) => delivery.status === "pending") ??
    meeting.deliveries[0];

  return (
    <div className={`wrap ${styles.detail}`}>
      <div className={styles.topBar}>
        <Link href="/meetings" className={styles.back}>
          <span aria-hidden="true">←</span> Todas las llamadas
        </Link>
        <span className={styles.topSpacer} />
        {meeting.shareUrl ? (
          <a className={styles.topLink} href={meeting.shareUrl} target="_blank" rel="noreferrer">
            Grabación <span aria-hidden="true">↗</span>
          </a>
        ) : null}
        {meeting.meetingUrl ? (
          <a className={styles.topLink} href={meeting.meetingUrl} target="_blank" rel="noreferrer">
            Reunión <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>

      <header className={styles.detailHeader}>
        <h1 className={styles.detailTitle}>{meeting.title}</h1>

        <p className={styles.detailMeta}>
          <span>{formatLongDate(startedAt)}</span>
          <span className={styles.dot} aria-hidden="true">
            ·
          </span>
          <span className="num">{formatTime(startedAt)}</span>
          {duration ? (
            <>
              <span className={styles.dot} aria-hidden="true">
                ·
              </span>
              <span className="num">{duration}</span>
            </>
          ) : null}
          <span className={styles.dot} aria-hidden="true">
            ·
          </span>
          <span className={styles.recordedBy}>
            <span className={styles.recordedByAvatar} aria-hidden="true">
              {initials(meeting.recordedByName, meeting.recordedByEmail)}
            </span>
            {meeting.recordedByName ?? meeting.recordedByEmail ?? "Sin identificar"}
          </span>
        </p>

        <div className={styles.detailBadges}>
          <StatusBadge status={worstDelivery?.status ?? null} emptyLabel="Sin enviar" />
          {sentiment ? <span className={styles.detailNote}>Tono: {sentiment}</span> : null}
          <span className={styles.detailNote}>
            {language ? `Transcripción en ${language}` : "Idioma desconocido"}
            {meeting.hasTranscript ? "" : " · no recibida"}
          </span>
          {meeting.recordedByTeam ? (
            <span className={styles.detailNote}>Equipo {meeting.recordedByTeam}</span>
          ) : null}
        </div>
      </header>

      <div className={styles.detailColumns}>
        <div className={styles.detailMain}>
          <RecordingPlayer
            shareUrl={meeting.shareUrl}
            durationLabel={duration}
            totalSeconds={secondsBetween(startedAt, endedAt)}
            actionItems={meeting.actionItems}
          />
          <BriefPanel brief={meeting.brief} />
          <ActionItemList items={meeting.actionItems} />
          <SourceSummary
            markdown={meeting.fathomSummaryMarkdown}
            template={meeting.fathomSummaryTemplate}
          />
        </div>

        <aside className={styles.detailRail} aria-label="Recorrido, documento, asistentes y entregas">
          <SendChecklist
            hasTranscript={meeting.hasTranscript}
            hasBrief={meeting.brief !== null}
            deliveries={meeting.deliveries}
          />
          <GoogleDocPanel
            docUrl={meeting.googleDocUrl}
            syncedAt={meeting.googleDocSyncedAt}
          />
          <InviteeList invitees={meeting.invitees} />
          <DeliveryTrail deliveries={meeting.deliveries} />
        </aside>
      </div>
    </div>
  );
}
