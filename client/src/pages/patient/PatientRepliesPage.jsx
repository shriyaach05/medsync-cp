import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { SkeletonCard } from '../../components/SkeletonCard';
import { EmptyState } from '../../components/EmptyState';
import { ReplyViewModal } from '../../components/ReplyViewModal';
import {
  REPLY_SECTIONS,
  formatDoctorName,
  formatReplyDate,
} from '../../components/ReplyDocument';
import './PatientPortal.css';

export function PatientRepliesPage() {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [viewTarget, setViewTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchReplies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/replies');
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

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/replies/${deleteTarget._id}`);
      setReplies((prev) => prev.filter((r) => r._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message || 'Could not delete the reply.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const previewOf = (reply) => {
    const first = REPLY_SECTIONS.find(({ key }) => reply[key]);
    if (!first) return '';
    const text = reply[first.key];
    return `${first.label}: ${text.length > 140 ? `${text.slice(0, 140)}...` : text}`;
  };

  return (
    <div>
      <div className="ms-page-header">
        <div>
          <h1>Replies</h1>
          <p className="ms-page-subtitle">
            Comments, prescriptions, follow-ups and advice your doctors have sent about the records
            you shared. You can delete a reply at any time.
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
          title="No replies yet"
          description="When a doctor replies to a record you shared, their comment, prescription, follow-up and advice will appear here."
        />
      ) : (
        <div className="ms-reply-grid">
          {replies.map((reply) => (
            <Card key={reply._id} className="ms-reply-card">
              <div className="ms-reply-card__top">
                <div>
                  <h3 className="ms-reply-card__title">{formatDoctorName(reply.doctor?.name)}</h3>
                  {reply.doctor?.department && (
                    <span className="ms-reply-card__sub">{reply.doctor.department}</span>
                  )}
                </div>
              </div>

              <p className="ms-reply-card__record">
                About: <strong>{reply.reportReason || 'Medical record'}</strong>
                {reply.reportType ? ` (${reply.reportType})` : ''}
              </p>

              {previewOf(reply) && <p className="ms-reply-card__preview">{previewOf(reply)}</p>}

              <p className="ms-reply-card__meta">Received {formatReplyDate(reply.createdAt)}</p>

              <div className="ms-reply-card__actions">
                <Button variant="secondary" size="sm" onClick={() => setViewTarget(reply)}>
                  View Reply
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(reply)}
                  style={{ color: 'var(--color-error)' }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ReplyViewModal
        isOpen={Boolean(viewTarget)}
        onClose={() => setViewTarget(null)}
        replies={viewTarget ? [viewTarget] : []}
        title="Doctor Reply"
      />

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete reply?"
        maxWidth="440px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p>
          Are you sure you want to permanently delete the reply from{' '}
          <strong>{formatDoctorName(deleteTarget?.doctor?.name)}</strong>? The doctor will no longer
          see it in their sent replies either.
        </p>
      </Modal>
    </div>
  );
}
