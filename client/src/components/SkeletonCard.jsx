import React from 'react';
import { Card } from './Card';
import './SkeletonCard.css';

export function SkeletonCard({ count = 3 }) {
  return (
    <div className="ms-skeleton-list" role="status" aria-label="Loading content">
      {Array.from({ length: count }).map((_, idx) => (
        <Card key={idx} className="ms-skeleton-card" aria-hidden="true">
          <div className="ms-skeleton-line ms-skeleton-line--title" />
          <div className="ms-skeleton-line ms-skeleton-line--meta" />
          <div className="ms-skeleton-actions">
            <div className="ms-skeleton-pill" />
            <div className="ms-skeleton-pill" />
          </div>
        </Card>
      ))}
    </div>
  );
}
