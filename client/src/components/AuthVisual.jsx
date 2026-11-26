import React from 'react';

/**
 * Decorative brand panel shown beside the Login / Register forms.
 * Purely visual: hidden from screen readers, contains no controls.
 */
export function AuthVisual() {
  return (
    <aside className="ms-auth-visual" aria-hidden="true">
      <div className="ms-auth-visual__orb" />
      <span className="ms-auth-visual__strip ms-auth-visual__strip--1" />
      <span className="ms-auth-visual__strip ms-auth-visual__strip--2" />
      <span className="ms-auth-visual__strip ms-auth-visual__strip--3" />
      <span className="ms-auth-visual__name">MedSync</span>
      <span className="ms-auth-visual__chip ms-auth-visual__chip--a">Secure storage</span>
      <span className="ms-auth-visual__chip ms-auth-visual__chip--b">AI summaries</span>
      <span className="ms-auth-visual__chip ms-auth-visual__chip--c">Share with doctors</span>
    </aside>
  );
}
