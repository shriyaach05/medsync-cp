import React from 'react';
import './Badge.css';

const TYPE_VARIANTS = {
  'Lab report': 'info',
  Prescription: 'success',
  Imaging: 'warning',
  Other: 'neutral',
};

export function Badge({ children, variant }) {
  const resolved = variant || TYPE_VARIANTS[children] || 'neutral';
  return <span className={`ms-badge ms-badge--${resolved}`}>{children}</span>;
}
