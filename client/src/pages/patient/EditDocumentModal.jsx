import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';

const REPORT_TYPES = ['Lab report', 'Prescription', 'Imaging', 'Other'];

const toDateInputValue = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
};

export function EditDocumentModal({ isOpen, onClose, report, onSaved }) {
  const [reason, setReason] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [type, setType] = useState('Lab report');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill the form each time a report is opened for editing
  useEffect(() => {
    if (isOpen && report) {
      setReason(report.reason || '');
      setDoctorName(report.doctorName || '');
      setVisitDate(toDateInputValue(report.visitDate));
      setType(REPORT_TYPES.includes(report.type) ? report.type : 'Other');
      setError('');
    }
  }, [isOpen, report]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!reason.trim()) {
      setError('Please enter a one-line reason for the visit.');
      return;
    }
    if (reason.trim().length > 120) {
      setError('Reason cannot exceed 120 characters.');
      return;
    }
    if (!doctorName.trim()) {
      setError('Please enter the doctor name.');
      return;
    }
    if (!visitDate) {
      setError('Please choose the visit date.');
      return;
    }

    setSaving(true);
    try {
      const data = await api.patch(`/reports/${report._id}`, {
        reason: reason.trim(),
        doctorName: doctorName.trim(),
        visitDate,
        type,
      });
      onSaved?.(data.report);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not update document. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Document" maxWidth="560px">
      <form className="ms-form-stack" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="ms-alert ms-alert--error" role="alert">
            {error}
          </div>
        )}

        <Input
          label="Reason for the visit"
          type="text"
          maxLength={120}
          placeholder="e.g. Annual blood test & cholesterol check"
          helperText={`${reason.length}/120 characters`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <Input
          label="Doctor name"
          type="text"
          placeholder="e.g. Dr. Priya Sharma"
          value={doctorName}
          onChange={(e) => setDoctorName(e.target.value)}
        />

        <div className="ms-auth-row">
          <Input
            label="Visit date"
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
          />

          <div className="ms-field">
            <label htmlFor="edit-report-type" className="ms-field__label">
              Type of report
            </label>
            <select
              id="edit-report-type"
              className="ms-select"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
