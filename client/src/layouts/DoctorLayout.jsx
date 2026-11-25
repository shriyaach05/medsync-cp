import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AppLayout.css';

const DOCTOR_NAV = [
  { to: '/doctor', label: 'Inbox', icon: '📥', end: true },
  { to: '/doctor/profile', label: 'Profile', icon: '👤' },
];

export function DoctorLayout() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="ms-layout">
      <header className="ms-mobile-header">
        <div className="ms-brand">
          <span className="ms-brand__logo" aria-hidden="true">+</span>
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
            <span className="ms-brand__logo" aria-hidden="true">+</span>
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
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="ms-sidebar__footer">
          <p className="ms-sidebar__user">Dr. {user?.name}</p>
          <p>{user?.department || user?.email}</p>
        </div>
      </aside>

      <main className="ms-main">
        <div className="ms-main__inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
