import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import './AuthPages.css';

export function RegisterPage() {
  const { register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [role, setRole] = useState('patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [phone, setPhone] = useState('');

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const errors = {};
    if (name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters long.';
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = 'Please enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    }

    if (role === 'doctor' && yearsOfExperience !== '') {
      const yrs = Number(yearsOfExperience);
      if (Number.isNaN(yrs) || yrs < 0) {
        errors.yearsOfExperience = 'Years of experience cannot be negative.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!validate()) return;

    const payload = {
      role,
      name: name.trim(),
      email: email.trim(),
      password,
    };

    if (role === 'patient') {
      payload.guardianPhone = guardianPhone.trim();
    } else {
      payload.department = department.trim();
      payload.yearsOfExperience = yearsOfExperience === '' ? 0 : Number(yearsOfExperience);
      payload.phone = phone.trim();
    }

    setSubmitting(true);
    try {
      const user = await register(payload);
      navigate(user.role === 'doctor' ? '/doctor' : '/patient', { replace: true });
    } catch (err) {
      setFormError(err.message || 'Could not create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ms-auth-page">
      <div className="ms-auth-topbar">
        <div className="ms-auth-brand">
          <span className="ms-auth-brand__logo" aria-hidden="true">+</span>
          <span>MedSync</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </Button>
      </div>

      <Card className="ms-auth-card">
        <div className="ms-auth-header">
          <h1>Create your account</h1>
          <p>Store medical records securely and share them on your terms.</p>
        </div>

        <form className="ms-auth-form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="ms-auth-error" role="alert">
              {formError}
            </div>
          )}

          <div className="ms-role-group">
            <span className="ms-role-group__label">I am registering as a</span>
            <div className="ms-role-options" role="radiogroup" aria-label="Account role">
              <button
                type="button"
                role="radio"
                aria-checked={role === 'patient'}
                className={`ms-role-btn ${role === 'patient' ? 'ms-role-btn--active' : ''}`}
                onClick={() => setRole('patient')}
              >
                <span aria-hidden="true">🧑</span>
                <span>Patient / Guardian</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={role === 'doctor'}
                className={`ms-role-btn ${role === 'doctor' ? 'ms-role-btn--active' : ''}`}
                onClick={() => setRole('doctor')}
              >
                <span aria-hidden="true">🩺</span>
                <span>Doctor</span>
              </button>
            </div>
          </div>

          <Input
            label="Full name"
            type="text"
            name="name"
            autoComplete="name"
            placeholder={role === 'doctor' ? 'Dr. Priya Sharma' : 'Aarav Patel'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
          />

          <Input
            label="Email address"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />

          <Input
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            helperText="Minimum 8 characters"
            showPasswordToggle
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
          />

          {role === 'patient' ? (
            <Input
              label="Guardian phone number (optional)"
              type="tel"
              name="guardianPhone"
              placeholder="+91 98765 43210"
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
            />
          ) : (
            <>
              <Input
                label="Department / Specialty (optional)"
                type="text"
                name="department"
                placeholder="e.g. Cardiology, General Medicine"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
              <div className="ms-auth-row">
                <Input
                  label="Years of experience (optional)"
                  type="number"
                  min="0"
                  name="yearsOfExperience"
                  placeholder="e.g. 5"
                  value={yearsOfExperience}
                  onChange={(e) => setYearsOfExperience(e.target.value)}
                  error={fieldErrors.yearsOfExperience}
                />
                <Input
                  label="Phone number (optional)"
                  type="tel"
                  name="phone"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </>
          )}

          <Button type="submit" fullWidth size="lg" loading={submitting}>
            Create account
          </Button>
        </form>

        <div className="ms-auth-divider">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </Card>
    </div>
  );
}
