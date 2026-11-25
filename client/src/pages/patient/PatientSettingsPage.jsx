import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import './PatientPortal.css';

export function PatientSettingsPage() {
  const { user, logout, refreshUser, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // Theme state
  const [themeSaving, setThemeSaving] = useState(false);

  // Delete account state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!currentPassword) {
      setPwError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters long.');
      return;
    }

    setPwSaving(true);
    try {
      await api.patch('/users/me/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPwSuccess('Password changed successfully.');
      await refreshUser();
    } catch (err) {
      setPwError(err.message || 'Could not change password.');
    } finally {
      setPwSaving(false);
    }
  };

  const handleThemeSelect = async (nextTheme) => {
    setTheme(nextTheme);
    setThemeSaving(true);
    try {
      const data = await api.patch('/users/me', { theme: nextTheme });
      updateUser(data.user);
    } catch {
      // Theme is already saved locally in ThemeContext
    } finally {
      setThemeSaving(false);
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

  const passwordChangedText = user?.passwordChangedAt
    ? new Date(user.passwordChangedAt).toLocaleString()
    : 'Never changed since registration';

  return (
    <div>
      <div className="ms-page-header">
        <div>
          <h1>Settings</h1>
          <p className="ms-page-subtitle">Security, appearance, and account controls.</p>
        </div>
      </div>

      <div className="ms-settings-stack">
        {/* Security */}
        <Card>
          <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: '4px' }}>Security</h2>
          <p className="ms-page-subtitle" style={{ marginBottom: '16px' }}>
            Password last changed: <strong>{passwordChangedText}</strong>
          </p>

          <form className="ms-form-stack" onSubmit={handlePasswordChange} noValidate>
            {pwError && (
              <div className="ms-alert ms-alert--error" role="alert">
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="ms-alert ms-alert--success" role="status">
                {pwSuccess}
              </div>
            )}

            <Input
              label="Current password"
              type="password"
              showPasswordToggle
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />

            <Input
              label="New password"
              type="password"
              helperText="Minimum 8 characters"
              showPasswordToggle
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <div>
              <Button type="submit" loading={pwSaving}>
                Update password
              </Button>
            </div>
          </form>
        </Card>

        {/* Theme */}
        <Card>
          <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: '4px' }}>Theme</h2>
          <p className="ms-page-subtitle" style={{ marginBottom: '16px' }}>
            Choose light or dark mode. Your preference is remembered across sessions.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Button
              variant={theme === 'light' ? 'primary' : 'secondary'}
              disabled={themeSaving}
              onClick={() => handleThemeSelect('light')}
            >
              ☀️ Light mode
            </Button>
            <Button
              variant={theme === 'dark' ? 'primary' : 'secondary'}
              disabled={themeSaving}
              onClick={() => handleThemeSelect('dark')}
            >
              🌙 Dark mode
            </Button>
          </div>
        </Card>

        {/* Session */}
        <Card>
          <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: '4px' }}>Session</h2>
          <p className="ms-page-subtitle" style={{ marginBottom: '16px' }}>
            Sign out of MedSync on this device.
          </p>
          <Button variant="secondary" onClick={handleLogout}>
            Log out
          </Button>
        </Card>

        {/* Delete account */}
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
            Permanently deletes your account, all uploaded medical reports, encrypted PDFs, and
            active shares. This cannot be undone.
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
            Warning: This will permanently delete all your reports, encrypted files, and doctor
            shares.
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
