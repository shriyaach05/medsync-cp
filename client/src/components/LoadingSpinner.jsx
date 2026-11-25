import React from 'react';
import './LoadingSpinner.css';

export function LoadingSpinner({ message = 'Loading...', fullScreen = false }) {
  return (
    <div
      className={`ms-loading ${fullScreen ? 'ms-loading--fullscreen' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="ms-loading__spinner" aria-hidden="true" />
      {message && <p className="ms-loading__text">{message}</p>}
    </div>
  );
}
