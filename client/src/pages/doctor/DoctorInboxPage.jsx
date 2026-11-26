import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { SkeletonCard } from '../../components/SkeletonCard';
import { EmptyState } from '../../components/EmptyState';
import { PdfViewerModal } from '../../components/PdfViewerModal';
import { Input } from '../../components/Input';
import { ReplyEditorModal } from './ReplyEditorModal';
import '../patient/PatientPortal.css';
import './DoctorPortal.css';

function formatCountdown(msRemaining) {
  if (msRemaining <= 0) return 'Expired';
  const totalSeconds = Math.floor(msRemaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, '0');
  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function DoctorInboxPage() {
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [activeViewer, setActiveViewer] = useState(null); // { shareId, report }
  const [query, setQuery] = useState('');
  const [sentReplies, setSentReplies] = useState([]);
  const [replyTarget, setReplyTarget] = useState(null); // { share, report, patient, reply }

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/shares/inbox');
      setInbox(data.inbox || []);
    } catch (err) {
      setError(err.message || 'Could not load your inbox.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  // Replies this doctor already sent (so the button can say "Edit Reply")
  const fetchReplies = useCallback(async () => {
    try {
      const data = await api.get('/replies/sent');
      setSentReplies(data.replies || []);
    } catch {
      // Replies are optional on this page; the inbox still works without them
    }
  }, []);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  const replyByRecord = useMemo(() => {
    const map = {};
    for (const reply of sentReplies) {
      map[`${reply.share}:${reply.report}`] = reply;
    }
    return map;
  }, [sentReplies]);

  // Live 1-second countdown ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter out shares that just expired locally so access disappears automatically
  const activeInbox = inbox
    .map((group) => ({
      ...group,
      shares: (group.shares || []).filter(
        (s) => new Date(s.expiresAt).getTime() > now
      ),
    }))
    .filter((group) => group.shares.length > 0);

  // Search patients by name or email
  const normalizedQuery = query.trim().toLowerCase();
  const visibleInbox = normalizedQuery
    ? activeInbox.filter(
        (group) =>
          group.patient.name?.toLowerCase().includes(normalizedQuery) ||
          group.patient.email?.toLowerCase().includes(normalizedQuery)
      )
    : activeInbox;

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="ms-page-header">
        <div>
          <h1>Inbox</h1>
          <p className="ms-page-subtitle">
            Patient reports shared with you for a limited time. Access disappears automatically
            when the timer runs out.
          </p>
        </div>
        <Button variant="secondary" onClick={fetchInbox}>
          ↻ Refresh
        </Button>
      </div>

      {error && (
        <div
          className="ms-alert ms-alert--error"
          role="alert"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
        >
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={fetchInbox}>
            Try again
          </Button>
        </div>
      )}

      {!loading && activeInbox.length > 0 && (
        <div className="ms-search-bar">
          <Input
            type="search"
            label="Search patients"
            placeholder="Search by patient name or email"
            aria-label="Search patients by name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <SkeletonCard count={3} />
      ) : activeInbox.length === 0 ? (
        <EmptyState
          title="No active shared reports"
          description="When a patient sends you their medical reports, they will appear here with a live countdown."
        />
      ) : visibleInbox.length === 0 ? (
        <EmptyState
          title="No matching patients"
          description="No patient name or email matches your search. Try a different spelling."
          action={<Button onClick={() => setQuery('')}>Clear search</Button>}
        />
      ) : (
        <div className="ms-inbox-groups">
          {visibleInbox.map((group) => (
            <section key={group.patient._id}>
              <div className="ms-patient-group__header">
                <h2 className="ms-patient-group__name">
                  {group.patient.name}
                </h2>
                <span className="ms-patient-group__email">{group.patient.email}</span>
              </div>

              <div className="ms-share-list">
                {group.shares.map((share) => {
                  const remainingMs = Math.max(
                    0,
                    new Date(share.expiresAt).getTime() - now
                  );
                  const isUrgent = remainingMs < 60 * 60 * 1000; // < 1 hour left

                  return (
                    <Card key={share._id}>
                      <div className="ms-share-card__header">
                        <span className="ms-share-card__received">
                          Received {formatDateTime(share.createdAt)}
                        </span>
                        <span
                          className={`ms-countdown ${
                            isUrgent ? 'ms-countdown--urgent' : ''
                          }`}
                          title="Time remaining before access expires"
                        >
                          {formatCountdown(remainingMs)} left
                        </span>
                      </div>

                      <div className="ms-shared-reports">
                        {share.reports.map((report) => (
                          <div className="ms-shared-report-row" key={report._id}>
                            <div className="ms-shared-report-row__info">
                              <span className="ms-shared-report-row__title">
                                {report.reason}
                              </span>
                              <div className="ms-shared-report-row__meta">
                                <Badge>{report.type}</Badge>
                                <span>
                                  {new Date(report.visitDate).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="ms-shared-report-row__actions">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  setActiveViewer({ shareId: share._id, report })
                                }
                              >
                                View PDF
                              </Button>
                              <Button
                                size="sm"
                                onClick={() =>
                                  setReplyTarget({
                                    share,
                                    report,
                                    patient: group.patient,
                                    reply: replyByRecord[`${share._id}:${report._id}`] || null,
                                  })
                                }
                              >
                                {replyByRecord[`${share._id}:${report._id}`]
                                  ? 'Edit Reply'
                                  : 'Reply'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <ReplyEditorModal
        isOpen={Boolean(replyTarget)}
        onClose={() => setReplyTarget(null)}
        reply={replyTarget?.reply || null}
        context={
          replyTarget
            ? {
                shareId: replyTarget.share._id,
                reportId: replyTarget.report._id,
                patientName: replyTarget.patient.name,
                reportReason: replyTarget.report.reason,
              }
            : null
        }
        onSaved={() => fetchReplies()}
      />

      <PdfViewerModal
        isOpen={Boolean(activeViewer)}
        onClose={() => setActiveViewer(null)}
        title={activeViewer?.report?.reason}
        allowDownload={false}
        endpoint={
          activeViewer
            ? `/shares/${activeViewer.shareId}/reports/${activeViewer.report._id}/file`
            : ''
        }
      />
    </div>
  );
}
