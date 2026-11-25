import React from 'react';
import { Card } from '../components/Card';

export function LoginPage() {
  return (
    <div style={{ maxWidth: '440px', margin: '64px auto', padding: '0 16px' }}>
      <Card>
        <h1>Sign in to MedSync</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
          Login form will be implemented in Phase 9.
        </p>
      </Card>
    </div>
  );
}
