import React from 'react';
import './Card.css';

export function Card({ children, className = '', hoverable = false, ...props }) {
  return (
    <div
      className={`ms-card ${hoverable ? 'ms-card--hoverable' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
