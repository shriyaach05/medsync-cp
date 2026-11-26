import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { SkeletonCard } from '../../components/SkeletonCard';
import { EmptyState } from '../../components/EmptyState';
import { PdfViewerModal } from '../../components/PdfViewerModal';
import { ReplyViewModal } from '../../components/ReplyViewModal';
import { REPLY_SECTIONS, formatReplyDate } from '../../components/ReplyDocument';
import { ReplyEditorModal } from './ReplyEditorModal';
import '../patient/PatientPortal.css';

export function DoctorRepliesPage() {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const [viewTarget, setViewTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [recordTarget, setRecordTarget] = useState(null);

  const fetchReplies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/replies/sent');
      setReplies(data.replies || []);
    } catch (err) {
      setError(err.message || 'Could not load your replies.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  // Re-check record access every 15 seconds so "active" flips to "ended" on its own
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="ms-page-header">
        <div>
          <h1>Replies</h1>
          <p className="ms-page-subtitle">
            Replies you have sent to patients. You can edit them at any time. Once a patient&apos;s
            access time is up, you can no longer open their record file.
          </p>
        </div>
        <Button variant="secondary" onClick={fetchReplies}>
          ↻ Refresh
        </Button>
      </div>

      {error && (
        <div className="ms-alert ms-alert--error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <SkeletonCard count={3} />
      ) : replies.length === 0 ? (
        <EmptyState
          title="No replies sent yet"
          description="Open a shared record in your Inbox and tap Reply to send the patient a comment, prescription, follow-up and advice."
        />
      ) : (
        <div className="ms-reply-grid">
          {replies.map((reply) => {
            const accessActive = new Date(reply.shareExpiresAt).getTime() > now;
            const filled = REPLY_SECTIONS.filter(({ key }) => reply[key]);

            return (
              <Card key={reply._id} className="ms-reply-card">
                <div className="ms-reply-card__top">
                  <div>
                    <h3 className="ms-reply-card__title">{reply.patient?.name}</h3>
                    <span className="ms-reply-card__sub">{reply.patient?.email}</span>
                  </div>
                  <Badge variant={accessActive ? 'success' : 'neutral'}>
                    {accessActive ? 'Record access active' : 'Record access ended'}
                  </Badge>
                </div>

                <p className="ms-reply-card__record">
                  Record: <strong>{reply.reportReason || 'Medical record'}</strong>
                  {reply.reportType ? ` (${reply.reportType})` : ''}
                </p>

                <div className="ms-reply-card__chips">
                  {filled.map(({ key, label }) => (
                    <span key={key}>{label}</span>
                  ))}
                </div>

                <p className="ms-reply-card__meta">Last updated {formatReplyDate(reply.updatedAt)}</p>

                <div className="ms-reply-card__actions">
                  <Button variant="secondary" size="sm" onClick={() => setViewTarget(reply)}>
                    View Reply
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditTarget(reply)}>
                    Edit Reply
                  </Button>
                  {accessActive ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="ms-btn--wide"
                      onClick={() => setRecordTarget(reply)}
                    >
                      View Patient Record
                    </Button>
                  ) : (
                    <p className="ms-reply-card__ended">
                      The patient&apos;s record is no longer accessible.
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ReplyViewModal
        isOpen={Boolean(viewTarget)}
        onClose={() => setViewTarget(null)}
        replies={viewTarget ? [viewTarget] : []}
        title="Your Reply"
      />

      <ReplyEditorModal
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        reply={editTarget}
        onSaved={() => fetchReplies()}
      />

      <PdfViewerModal
        isOpen={Boolean(recordTarget)}
        onClose={() => setRecordTarget(null)}
        title={recordTarget?.reportReason}
        allowDownload={false}
        endpoint={
          recordTarget
            ? `/shares/${recordTarget.share}/reports/${recordTarget.report}/file`
            : ''
        }
      />
    </div>
  );
}
