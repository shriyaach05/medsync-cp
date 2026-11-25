import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Modal } from './Modal';
import { Button } from './Button';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * Displays a decrypted PDF from a protected backend endpoint inside a modal iframe.
 */
export function PdfViewerModal({ isOpen, onClose, title, endpoint }) {
  const [blobUrl, setBlobUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !endpoint) return;

    let active = true;
    let createdUrl = '';

    setLoading(true);
    setError('');
    setBlobUrl('');

    api
      .fetchBlobUrl(endpoint)
      .then((url) => {
        createdUrl = url;
        if (active) {
          setBlobUrl(url);
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Could not load the PDF document.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [isOpen, endpoint]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || 'View Report PDF'}
      maxWidth="820px"
      footer={
        <>
          {blobUrl && (
            <a href={blobUrl} download={`${title || 'report'}.pdf`}>
              <Button variant="secondary">Download PDF</Button>
            </a>
          )}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      {loading && <LoadingSpinner message="Decrypting and loading PDF..." />}
      {error && (
        <div className="ms-alert ms-alert--error" role="alert">
          {error}
        </div>
      )}
      {!loading && !error && blobUrl && (
        <iframe
          src={blobUrl}
          title={title || 'PDF document'}
          style={{
            width: '100%',
            height: '65vh',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        />
      )}
    </Modal>
  );
}
