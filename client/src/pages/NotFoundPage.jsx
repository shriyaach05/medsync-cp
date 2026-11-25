import React from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/Button';

export function NotFoundPage() {
  return (
    <div style={{ maxWidth: '520px', margin: '80px auto', padding: '0 16px' }}>
      <EmptyState
        icon="🔍"
        title="Page not found"
        description="The page you are looking for doesn't exist or has been moved."
        action={
          <Link to="/">
            <Button>Go to Home</Button>
          </Link>
        }
      />
    </div>
  );
}
