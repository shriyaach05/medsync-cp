import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import '../patient/PatientPortal.css';

export function DoctorProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [yearsOfExperience, setYearsOfExperience] = useState(
    user?.yearsOfExperience ?? ''
  );
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Delete account state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

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
    const yrs = yearsOfExperience === '' ? 0 : Number(yearsOfExperience);
    if (Number.isNaN(yrs) || yrs < 0) {
      setError('Years of experience cannot be negative.');
      return;
    }

    setSaving(true);
    try {
      const data = await api.patch('/users/me', {
        name: name.trim(),
        department: department.trim(),
        yearsOfExperience: yrs,
        email: email.trim(),
        phone: phone.trim(),
      });
      updateUser(data.user);
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(err.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError('Please enter your password to confirm.');
      return;
    }

    setDeleting(true);
    try {
      await api.delete('/users/me', { password: deletePassword });
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setDeleteError(err.message || 'Incorrect password. Account deletion aborted.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="ms-page-header">
        <div>
          <h1>Doctor Profile</h1>
          <p className="ms-page-subtitle">
            Patients see your name, department, and email when sending reports.
          </p>
        </div>
      </div>

      <div className="ms-settings-stack">
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
              label="Department"
              type="text"
              placeholder="e.g. Cardiology, General Medicine"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />

            <div className="ms-auth-row">
              <Input
                label="Years of experience"
                type="number"
                min="0"
                value={yearsOfExperience}
                onChange={(e) => setYearsOfExperience(e.target.value)}
              />
              <Input
                label="Phone number"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <div>
              <Button type="submit" loading={saving}>
                Save changes
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: '4px' }}>Session</h2>
          <p className="ms-page-subtitle" style={{ marginBottom: '16px' }}>
            Sign out of MedSync on this device.
          </p>
          <Button variant="secondary" onClick={handleLogout}>
            Log out
          </Button>
        </Card>

        <Card className="ms-danger-card">
          <h2
            style={{
              fontSize: 'var(--font-size-lg)',
              color: 'var(--color-error)',
              marginBottom: '4px',
            }}
          >
            Delete account
          </h2>
          <p className="ms-page-subtitle" style={{ marginBottom: '16px' }}>
            Permanently removes your doctor account and clears all shared links sent to you.
          </p>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            Delete my account
          </Button>
        </Card>
      </div>

      <Modal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeletePassword('');
          setDeleteError('');
        }}
        title="Confirm account deletion"
        maxWidth="460px"
      >
        <form className="ms-form-stack" onSubmit={handleDeleteAccount}>
          <div className="ms-alert ms-alert--error">
            Warning: This will permanently delete your doctor account.
          </div>

          {deleteError && (
            <div className="ms-alert ms-alert--error" role="alert">
              {deleteError}
            </div>
          )}

          <Input
            label="Enter your password to confirm"
            type="password"
            showPasswordToggle
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={deleting}>
              Permanently delete
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
