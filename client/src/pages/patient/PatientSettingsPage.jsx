import React from 'react';
import { Card } from '../../components/Card';

export function PatientSettingsPage() {
  return (
    <Card>
      <h1>Settings</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
        Security, theme, logout, and delete account will be built in Phase 10.
      </p>
    </Card>
  );
}
