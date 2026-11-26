import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/Button';
import './AppLayout.css';

const DOCTOR_NAV = [
  { to: '/doctor', label: 'Inbox', end: true },
  { to: '/doctor/replies', label: 'Replies' },
  { to: '/doctor/profile', label: 'Profile' },
];

export function DoctorLayout() {
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);

  const handleThemeToggle = async () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
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

  return (
    <div className="ms-layout">
      <a href="#main-content" className="ms-skip-link">
        Skip to main content
      </a>
      <header className="ms-mobile-header">
        <div className="ms-brand">
          <img src="/logo.png" className="ms-brand__logo" alt="" aria-hidden="true" />
          <span>MedSync</span>
        </div>
        <button
          type="button"
          className="ms-menu-btn"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          ☰
        </button>
      </header>

      {menuOpen && (
        <div
          className="ms-sidebar__backdrop"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`ms-sidebar ${menuOpen ? 'ms-sidebar--open' : ''}`}>
        <div className="ms-sidebar__brand">
          <div className="ms-brand">
            <img src="/logo.png" className="ms-brand__logo" alt="" aria-hidden="true" />
            <span>MedSync</span>
          </div>
          <span className="ms-sidebar__role">Doctor Portal</span>
        </div>

        <nav className="ms-nav" aria-label="Doctor navigation">
          {DOCTOR_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `ms-nav__link ${isActive ? 'ms-nav__link--active' : ''}`
              }
              onClick={() => setMenuOpen(false)}
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="ms-sidebar__footer">
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            disabled={themeSaving}
            onClick={handleThemeToggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{ marginBottom: 'var(--space-md)' }}
          >
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </Button>
          <p className="ms-sidebar__user">Dr. {user?.name}</p>
          <p>{user?.department || user?.email}</p>
        </div>
      </aside>

      <main id="main-content" className="ms-main" tabIndex={-1}>
        <div className="ms-main__inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
