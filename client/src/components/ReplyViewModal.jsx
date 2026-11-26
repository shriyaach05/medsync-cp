import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { ReplyDocument } from './ReplyDocument';

/**
 * Shows one or more doctor reply files in a modal (read-only).
 */
export function ReplyViewModal({ isOpen, onClose, replies = [], title = 'Doctor Reply' }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="780px"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="ms-reply-stack">
        {replies.map((reply) => (
          <ReplyDocument key={reply._id} reply={reply} />
        ))}
      </div>
    </Modal>
  );
}
