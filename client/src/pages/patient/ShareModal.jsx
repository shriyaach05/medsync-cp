import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { LoadingSpinner } from '../../components/LoadingSpinner';

const DURATION_OPTIONS = [
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '3d', label: '3 days' },
  { value: '7d', label: '7 days' },
  { value: 'custom', label: 'Custom (1–30 days)' },
];

export function ShareModal({ isOpen, onClose, selectedReports, onShared }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  const [durationPreset, setDurationPreset] = useState('24h');
  const [customDays, setCustomDays] = useState('14');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Reset state whenever modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setDoctors([]);
      setSearchError('');
      setSelectedDoctor(null);
      setDurationPreset('24h');
      setCustomDays('14');
      setSubmitError('');
    }
  }, [isOpen]);

  // Debounced doctor search
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setDoctors([]);
      setSearchError('');
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const data = await api.get(`/doctors/search?q=${encodeURIComponent(trimmed)}`);
        setDoctors(data.doctors || []);
      } catch (err) {
        setSearchError(err.message || 'Could not search doctors.');
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  const handleConfirmShare = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!selectedDoctor) {
      setSubmitError('Please search and select a doctor first.');
      return;
    }

    let durationPayload = durationPreset;
    if (durationPreset === 'custom') {
      const days = Number(customDays);
      if (Number.isNaN(days) || days < 1 || days > 30) {
        setSubmitError('Custom access time must be between 1 and 30 days.');
        return;
      }
      durationPayload = days * 24 * 60 * 60 * 1000;
    }

    setSubmitting(true);
    try {
      await api.post('/shares', {
        doctorId: selectedDoctor._id,
        reportIds: selectedReports.map((r) => r._id),
        duration: durationPayload,
      });
      onShared?.(selectedDoctor, selectedReports.length);
      onClose();
    } catch (err) {
      setSubmitError(err.message || 'Could not send reports to doctor.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Send ${selectedReports.length} ${
        selectedReports.length === 1 ? 'Report' : 'Reports'
      } to Doctor`}
      maxWidth="580px"
    >
      <form className="ms-form-stack" onSubmit={handleConfirmShare} noValidate>
        {submitError && (
          <div className="ms-alert ms-alert--error" role="alert">
            {submitError}
          </div>
        )}

        {/* Step 1: Search & Confirm Doctor */}
        <div>
          <Input
            label="Find doctor by name or email"
            type="search"
            placeholder="Type doctor name or email (e.g. Priya or dr@hospital.com)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {searching && <LoadingSpinner message="Searching registered doctors..." />}
          {searchError && (
            <p className="ms-field__error" style={{ marginTop: '6px' }}>
              {searchError}
            </p>
          )}

          {!searching && query.trim() && doctors.length === 0 && !searchError && (
            <div className="ms-alert ms-alert--warning" role="status" style={{ marginTop: '8px', marginBottom: 0 }}>
              This doctor is not registered.
            </div>
          )}

          {doctors.length > 0 && (
            <div className="ms-doctor-results" role="listbox" aria-label="Matching doctors">
              {doctors.map((doc) => {
                const isSelected = selectedDoctor?._id === doc._id;
                return (
                  <button
                    key={doc._id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`ms-doctor-result ${
                      isSelected ? 'ms-doctor-result--selected' : ''
                    }`}
                    onClick={() => setSelectedDoctor(doc)}
                  >
                    <div className="ms-doctor-result__name">Dr. {doc.name}</div>
                    <div className="ms-doctor-result__meta">
                      <span>{doc.department || 'General'}</span>
                      <span>•</span>
                      <span>{doc.email}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedDoctor && (
            <div className="ms-alert ms-alert--info" style={{ marginTop: '12px', marginBottom: 0 }}>
              <strong>Selected doctor:</strong> Dr. {selectedDoctor.name} (
              {selectedDoctor.department || 'General'}) — {selectedDoctor.email}
            </div>
          )}
        </div>

        {/* Step 2: Choose access time */}
        <div>
          <span className="ms-field__label" style={{ display: 'block', marginBottom: '8px' }}>
            Access time limit
          </span>
          <div className="ms-duration-grid" role="radiogroup" aria-label="Access duration">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={durationPreset === opt.value}
                className={`ms-duration-btn ${
                  durationPreset === opt.value ? 'ms-duration-btn--active' : ''
                }`}
                onClick={() => setDurationPreset(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {durationPreset === 'custom' && (
            <div style={{ marginTop: '12px' }}>
              <Input
                label="Number of days (maximum 30)"
                type="number"
                min="1"
                max="30"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={!selectedDoctor}>
            Confirm & Send
          </Button>
        </div>
      </form>
    </Modal>
  );
}
