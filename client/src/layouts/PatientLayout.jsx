import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AppLayout.css';

const PATIENT_NAV = [
  { to: '/patient', label: 'Home', end: true },
  { to: '/patient/doctors', label: 'Doctors visited' },
  { to: '/patient/replies', label: 'Replies' },
  { to: '/patient/profile', label: 'Profile' },
  { to: '/patient/settings', label: 'Settings' },
];

export function PatientLayout() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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
          <span className="ms-sidebar__role">Patient Portal</span>
        </div>

        <nav className="ms-nav" aria-label="Patient navigation">
          {PATIENT_NAV.map((item) => (
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
          <p className="ms-sidebar__user">{user?.name}</p>
          <p>{user?.email}</p>
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
