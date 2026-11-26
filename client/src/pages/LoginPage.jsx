import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AuthVisual } from '../components/AuthVisual';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import './AuthPages.css';

export function LoginPage() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const errors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = 'Please enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Please enter your password.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!validate()) return;

    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      navigate(user.role === 'doctor' ? '/doctor' : '/patient', { replace: true });
    } catch (err) {
      setFormError(err.message || 'Invalid email or password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ms-auth-page">
      <div className="ms-auth-shell">
        <div className="ms-auth-panel">
          <div className="ms-auth-topbar">
            <div className="ms-auth-brand">
              <img src="/logo.png" className="ms-auth-brand__logo" alt="" aria-hidden="true" />
              <span>MedSync</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
          </div>

          <div className="ms-auth-card">
            <div className="ms-auth-header">
              <h1>Welcome to MedSync</h1>
              <p>Patients and doctors, sign in to reach your medical reports or your doctor inbox.</p>
            </div>

            <form className="ms-auth-form" onSubmit={handleSubmit} noValidate>
              {formError && (
                <div className="ms-auth-error" role="alert">
                  {formError}
                </div>
              )}

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
                autoComplete="current-password"
                placeholder="Enter your password"
                showPasswordToggle
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
              />

              <Button type="submit" fullWidth size="lg" loading={submitting}>
                Sign in
              </Button>
            </form>

            <div className="ms-auth-divider">
              New to MedSync? <Link to="/register">Create an account</Link>
            </div>
          </div>
        </div>
        <AuthVisual />
      </div>
    </div>
  );
}
