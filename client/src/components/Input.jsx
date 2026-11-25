import React, { useState, useId } from 'react';
import './Input.css';

export function Input({
  label,
  error,
  helperText,
  type = 'text',
  showPasswordToggle = false,
  className = '',
  id,
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);

  const isPassword = type === 'password';
  const resolvedType = isPassword && showPasswordToggle && visible ? 'text' : type;

  return (
    <div className={`ms-field ${error ? 'ms-field--error' : ''} ${className}`}>
      {label && (
        <label htmlFor={inputId} className="ms-field__label">
          {label}
        </label>
      )}
      <div className="ms-field__control">
        <input
          id={inputId}
          type={resolvedType}
          className="ms-field__input"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {isPassword && showPasswordToggle && (
          <button
            type="button"
            className="ms-field__toggle"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {error && (
        <p id={`${inputId}-error`} className="ms-field__error" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && <p className="ms-field__helper">{helperText}</p>}
    </div>
  );
}
