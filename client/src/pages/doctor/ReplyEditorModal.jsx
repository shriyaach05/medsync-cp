import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { REPLY_SECTIONS } from '../../components/ReplyDocument';

const MAX_LENGTH = 5000;

const PLACEHOLDERS = {
  comment: 'Your observations about this record...',
  prescription: 'Medicines, dose, and how long to take them (one per line)...',
  followUp: 'When to come back, tests to repeat...',
  advice: 'Diet, rest, and warning signs to watch for...',
};

const EMPTY = { comment: '', prescription: '', followUp: '', advice: '' };

/**
 * Doctor writes (or edits) the reply file for a shared record.
 *  - New reply:  pass `context` = { shareId, reportId, patientName, reportReason }
 *  - Edit reply: pass `reply` (the existing reply)
 */
export function ReplyEditorModal({ isOpen, onClose, reply, context, onSaved }) {
  const [values, setValues] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEditing = Boolean(reply);
  const patientName = reply?.patient?.name || context?.patientName || '';
  const reportReason = reply?.reportReason || context?.reportReason || '';

  // Pre-fill the form each time the editor is opened
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setValues(
      reply
        ? {
            comment: reply.comment || '',
            prescription: reply.prescription || '',
            followUp: reply.followUp || '',
            advice: reply.advice || '',
          }
        : EMPTY
    );
  }, [isOpen, reply]);

  const handleChange = (key) => (e) => {
    setValues((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!REPLY_SECTIONS.some(({ key }) => values[key].trim().length > 0)) {
      setError('Please write something in at least one section before sending.');
      return;
    }

    setSaving(true);
    try {
      const sections = {
        comment: values.comment.trim(),
        prescription: values.prescription.trim(),
        followUp: values.followUp.trim(),
        advice: values.advice.trim(),
      };

      const data = isEditing
        ? await api.patch(`/replies/${reply._id}`, sections)
        : await api.post('/replies', {
            shareId: context.shareId,
            reportId: context.reportId,
            ...sections,
          });

      onSaved?.(data.reply);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save the reply. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Reply' : 'Reply to Patient'}
      maxWidth="700px"
    >
      <form className="ms-form-stack" onSubmit={handleSubmit} noValidate>
        {(patientName || reportReason) && (
          <p className="ms-reply-editor__context">
            {patientName && <strong>{patientName}</strong>}
            {patientName && reportReason ? ' - ' : ''}
            {reportReason}
          </p>
        )}

        {error && (
          <div className="ms-alert ms-alert--error" role="alert">
            {error}
          </div>
        )}

        {REPLY_SECTIONS.map(({ key, label }) => (
          <div className="ms-field" key={key}>
            <label htmlFor={`reply-${key}`} className="ms-field__label">
              {label}
            </label>
            <textarea
              id={`reply-${key}`}
              className="ms-textarea"
              rows={4}
              maxLength={MAX_LENGTH}
              placeholder={PLACEHOLDERS[key]}
              value={values[key]}
              onChange={handleChange(key)}
            />
            <p className="ms-field__helper">
              {values[key].length}/{MAX_LENGTH} characters
            </p>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {isEditing ? 'Save Changes' : 'Send Reply'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
