import React, { useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import './PatientPortal.css';

export function PatientProfilePage() {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [guardianPhone, setGuardianPhone] = useState(user?.guardianPhone || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters long.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setSaving(true);
    try {
      const data = await api.patch('/users/me', {
        name: name.trim(),
        email: email.trim(),
        guardianPhone: guardianPhone.trim(),
      });
      updateUser(data.user);
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(err.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="ms-page-header">
        <div>
          <h1>Profile</h1>
          <p className="ms-page-subtitle">Manage your personal and guardian contact details.</p>
        </div>
      </div>

      <Card>
        <form className="ms-form-stack" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="ms-alert ms-alert--error" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="ms-alert ms-alert--success" role="status">
              {success}
            </div>
          )}

          <Input
            label="Full name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Guardian's phone number"
            type="tel"
            placeholder="+91 98765 43210"
            value={guardianPhone}
            onChange={(e) => setGuardianPhone(e.target.value)}
          />

          <div>
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
