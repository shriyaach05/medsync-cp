import React from 'react';
import './EmptyState.css';

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="ms-empty">
      {icon && (
        <div className="ms-empty__icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="ms-empty__title">{title}</h3>
      {description && <p className="ms-empty__desc">{description}</p>}
      {action && <div className="ms-empty__action">{action}</div>}
    </div>
  );
}
