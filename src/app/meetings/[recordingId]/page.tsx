import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  formatDuration,
  formatLanguage,
  formatLongDate,
  formatTime,
} from "@/components/formatting";
import { BriefPanel, SourceSummary } from "@/components/meetings/Brief";
import { ActionItemList } from "@/components/meetings/Commitments";
import { DeliveryTrail, InviteeList } from "@/components/meetings/Sidebar";
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { recordingId } = await params;
  const id = parseRecordingId(recordingId);
  if (id === null) return { title: "Reunión no encontrada" };

  const meeting = await getMeetingDetail(id);
  if (!meeting) return { title: "Reunión no encontrada" };

  return {
    title: meeting.title,
    description: meeting.brief?.headline ?? "Detalle de la reunión grabada con Fathom.",
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

  // El estado que se muestra arriba es el peor de todos los intentos.
  const worstDelivery =
    meeting.deliveries.find((delivery) => delivery.status === "failed") ??
    meeting.deliveries.find((delivery) => delivery.status === "pending") ??
    meeting.deliveries[0];

  return (
    <div className="wrap">
      <Link href="/meetings" className={styles.back}>
        Todas las reuniones
      </Link>

      <header className={styles.detailHeader}>
        <p className={styles.detailKicker}>
          <span>{formatLongDate(startedAt)}</span>
          {startedAt ? <span className="num">{formatTime(startedAt)}</span> : null}
          {duration ? <span className="num">{duration}</span> : null}
        </p>

        <h1 className={styles.detailTitle}>{meeting.title}</h1>

        {meeting.brief?.headline ? (
          <p className={styles.detailLede}>{meeting.brief.headline}</p>
        ) : null}

        <div className={styles.detailMeta}>
          <p className={styles.detailMetaItem}>
            <span className={styles.detailMetaLabel}>Grabada por</span>
            {meeting.recordedByName ?? meeting.recordedByEmail ?? "Sin identificar"}
          </p>
          {meeting.recordedByTeam ? (
            <p className={styles.detailMetaItem}>
              <span className={styles.detailMetaLabel}>Equipo</span>
              {meeting.recordedByTeam}
            </p>
          ) : null}
          <p className={styles.detailMetaItem}>
            <span className={styles.detailMetaLabel}>Idioma</span>
            {language ?? "Desconocido"}
          </p>
          <p className={styles.detailMetaItem}>
            <span className={styles.detailMetaLabel}>Transcripción</span>
            {meeting.hasTranscript ? "Guardada" : "No recibida"}
          </p>
          <p className={styles.detailMetaItem}>
            <span className={styles.detailMetaLabel}>Entrega</span>
            <StatusBadge status={worstDelivery?.status ?? null} emptyLabel="Sin enviar" />
          </p>
        </div>

        {meeting.shareUrl || meeting.meetingUrl ? (
          <div className={styles.detailActions}>
            {meeting.shareUrl ? (
              <a
                className={styles.detailLink}
                href={meeting.shareUrl}
                target="_blank"
                rel="noreferrer"
              >
                Ver la grabación en Fathom
              </a>
            ) : null}
            {meeting.meetingUrl ? (
              <a
                className={styles.detailLink}
                href={meeting.meetingUrl}
                target="_blank"
                rel="noreferrer"
              >
                Enlace de la reunión
              </a>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className={styles.detailColumns}>
        <div className={styles.detailMain}>
          <BriefPanel brief={meeting.brief} />
          <ActionItemList items={meeting.actionItems} />
          <SourceSummary
            markdown={meeting.fathomSummaryMarkdown}
            template={meeting.fathomSummaryTemplate}
          />
        </div>

        <aside className={styles.detailRail} aria-label="Asistentes y entregas">
          <InviteeList invitees={meeting.invitees} />
          <DeliveryTrail deliveries={meeting.deliveries} />
        </aside>
      </div>
    </div>
  );
}
