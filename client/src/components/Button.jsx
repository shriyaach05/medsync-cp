import React from 'react';
import './Button.css';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  ...props
}) {
  const classes = [
    'ms-btn',
    `ms-btn--${variant}`,
    `ms-btn--${size}`,
    fullWidth ? 'ms-btn--full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="ms-btn__spinner" aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}
