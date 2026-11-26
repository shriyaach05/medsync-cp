import React from 'react';
import './ReplyDocument.css';

export const REPLY_SECTIONS = [
  { key: 'comment', label: 'Comment' },
  { key: 'prescription', label: 'Prescription' },
  { key: 'followUp', label: 'Follow-up' },
  { key: 'advice', label: 'Advice' },
];

/** Adds "Dr." in front of a doctor's name unless it is already there. */
export function formatDoctorName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Doctor';
  return /^dr\.?\s/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
}

export function formatReplyDate(dateStr) {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Read-only "reply file" from a doctor: comment, prescription, follow-up and advice.
 * Works for both sides: patients get replies with a populated `doctor`,
 * doctors get replies with a populated `patient`.
 */
export function ReplyDocument({ reply }) {
  const doctorName =
    reply.doctor && typeof reply.doctor === 'object' && reply.doctor.name
      ? formatDoctorName(reply.doctor.name)
      : '';
  const doctorDept =
    reply.doctor && typeof reply.doctor === 'object' ? reply.doctor.department : '';
  const patientName =
    reply.patient && typeof reply.patient === 'object' ? reply.patient.name : '';

  const wasEdited =
    reply.updatedAt &&
    reply.createdAt &&
    new Date(reply.updatedAt).getTime() - new Date(reply.createdAt).getTime() > 2000;

  return (
    <article className="ms-reply-doc">
      <header className="ms-reply-doc__header">
        <h3 className="ms-reply-doc__title">Doctor&apos;s Reply</h3>
        <dl className="ms-reply-doc__meta">
          {doctorName && (
            <div>
              <dt>From</dt>
              <dd>
                {doctorName}
                {doctorDept ? ` (${doctorDept})` : ''}
              </dd>
            </div>
          )}
          {patientName && (
            <div>
              <dt>To</dt>
              <dd>{patientName}</dd>
            </div>
          )}
          <div>
            <dt>Record</dt>
            <dd>
              {reply.reportReason || 'Medical record'}
              {reply.reportType ? ` (${reply.reportType})` : ''}
            </dd>
          </div>
          <div>
            <dt>Sent</dt>
            <dd>{formatReplyDate(reply.createdAt)}</dd>
          </div>
          {wasEdited && (
            <div>
              <dt>Last edited</dt>
              <dd>{formatReplyDate(reply.updatedAt)}</dd>
            </div>
          )}
        </dl>
      </header>

      {REPLY_SECTIONS.map(({ key, label }) => (
        <section className="ms-reply-doc__section" key={key}>
          <h4>{label}</h4>
          {reply[key] ? (
            <p className="ms-reply-doc__text">{reply[key]}</p>
          ) : (
            <p className="ms-reply-doc__empty">Nothing added.</p>
          )}
        </section>
      ))}
    </article>
  );
}
