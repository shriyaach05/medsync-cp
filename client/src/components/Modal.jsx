import React, { useEffect } from 'react';
import './Modal.css';

export function Modal({
  isOpen,
  onClose,
  title,
  headerAction,
  children,
  footer,
  maxWidth = '560px',
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="ms-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="ms-modal" style={{ maxWidth }}>
        <div className="ms-modal__header">
          <div className="ms-modal__header-left">
            {headerAction}
            {title && <h2 className="ms-modal__title">{title}</h2>}
          </div>
          <button
            type="button"
            className="ms-modal__close"
            onClick={onClose}
            aria-label="Close popup"
          >
            ✕
          </button>
        </div>
        <div className="ms-modal__body">{children}</div>
        {footer && <div className="ms-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
