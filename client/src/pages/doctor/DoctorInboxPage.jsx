import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { SkeletonCard } from '../../components/SkeletonCard';
import { EmptyState } from '../../components/EmptyState';
import { PdfViewerModal } from '../../components/PdfViewerModal';
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

      {loading ? (
        <SkeletonCard count={3} />
      ) : activeInbox.length === 0 ? (
        <EmptyState
          icon="📥"
          title="No active shared reports"
          description="When a patient sends you their medical reports, they will appear here with a live countdown."
        />
      ) : (
        <div className="ms-inbox-groups">
          {activeInbox.map((group) => (
            <section key={group.patient._id}>
              <div className="ms-patient-group__header">
                <h2 className="ms-patient-group__name">
                  🧑 {group.patient.name}
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
                          ⏳ {formatCountdown(remainingMs)} left
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
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setActiveViewer({ shareId: share._id, report })
                              }
                            >
                              📄 View PDF
                            </Button>
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

      <PdfViewerModal
        isOpen={Boolean(activeViewer)}
        onClose={() => setActiveViewer(null)}
        title={activeViewer?.report?.reason}
        endpoint={
          activeViewer
            ? `/shares/${activeViewer.shareId}/reports/${activeViewer.report._id}/file`
            : ''
        }
      />
    </div>
  );
}
