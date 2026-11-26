import React, { useRef, useState } from 'react';
import { api } from '../../api/client';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';

const ALLOWED_EXTENSIONS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 10 MB
const GEMINI_NOTICE_KEY = 'medsync_gemini_notice_seen';

export function AddDocumentModal({ isOpen, onClose, onSaved }) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [reason, setReason] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [type, setType] = useState('Lab report');

  const [autofilling, setAutofilling] = useState(false);
  const [autofillNotice, setAutofillNotice] = useState('');
  const [showGeminiConfirm, setShowGeminiConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setFiles([]);
    setReason('');
    setDoctorName('');
    setVisitDate('');
    setType('Lab report');
    setAutofillNotice('');
    setShowGeminiConfirm(false);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFilesSelected = (selectedList, appendImages = false) => {
    setError('');
    const incoming = Array.from(selectedList || []);
    if (incoming.length === 0) return;

    for (const f of incoming) {
      if (!ALLOWED_EXTENSIONS.includes(f.type)) {
        setError('Only JPG, PNG, WEBP images and PDF files are accepted.');
        return;
      }
    }

    const nextFiles = appendImages ? [...files, ...incoming] : incoming;
    const totalSize = nextFiles.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL_BYTES) {
      setError('Total file size cannot exceed 10 MB.');
      return;
    }

    setFiles(nextFiles);
  };

  const removeFileAt = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const runAutofill = async () => {
    setShowGeminiConfirm(false);
    if (files.length === 0) {
      setError('Please upload a file or take a photo first, then tap Autofill.');
      return;
    }

    setError('');
    setAutofillNotice('');
    setAutofilling(true);

    try {
      localStorage.setItem(GEMINI_NOTICE_KEY, 'true');
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));

      const data = await api.upload('/reports/autofill', formData);
      const af = data?.autofill;
      if (af && data.message) {
        if (af.reason) setReason(af.reason.slice(0, 120));
        if (af.doctorName && af.doctorName !== 'Unknown') setDoctorName(af.doctorName);
        if (af.visitDate) {
          const parsed = new Date(af.visitDate);
          if (!Number.isNaN(parsed.getTime())) {
            setVisitDate(parsed.toISOString().split('T')[0]);
          }
        }
        if (['Lab report', 'Prescription', 'Imaging', 'Other'].includes(af.type)) {
          setType(af.type);
        }
        setAutofillNotice(data.message);
      }
    } catch {
      // Per brief: If autofill fails, leave the form empty with no error popup.
    } finally {
      setAutofilling(false);
    }
  };

  const handleAutofillClick = () => {
    if (files.length === 0) {
      setError('Please upload a file or take a photo first, then tap Autofill.');
      return;
    }

    const seenNotice = localStorage.getItem(GEMINI_NOTICE_KEY) === 'true';
    if (!seenNotice) {
      setShowGeminiConfirm(true);
    } else {
      runAutofill();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (files.length === 0) {
      setError('Please attach a PDF or at least one photo.');
      return;
    }
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
      const formData = new FormData();
      formData.append('reason', reason.trim());
      formData.append('doctorName', doctorName.trim());
      formData.append('visitDate', visitDate);
      formData.append('type', type);
      files.forEach((f) => formData.append('files', f));

      const data = await api.upload('/reports', formData);
      onSaved?.(data.report);
      handleClose();
    } catch (err) {
      setError(err.message || 'Could not save document. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const autofillButton = (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleAutofillClick}
      loading={autofilling}
      title="Autofill fields from uploaded file using Gemini AI"
    >
      Autofill
    </Button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Document"
      headerAction={autofillButton}
      maxWidth="560px"
    >
      <form className="ms-form-stack" onSubmit={handleSubmit} noValidate>
        {showGeminiConfirm && (
          <div className="ms-alert ms-alert--info">
            <p style={{ marginBottom: '8px' }}>
              Your report is sent to Google's Gemini API to create this.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button size="sm" onClick={runAutofill}>
                Continue Autofill
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowGeminiConfirm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {autofillNotice && (
          <div className="ms-alert ms-alert--success" role="status">
            {autofillNotice}
          </div>
        )}

        {error && (
          <div className="ms-alert ms-alert--error" role="alert">
            {error}
          </div>
        )}

        <div>
          <label className="ms-field__label" style={{ display: 'block', marginBottom: '6px' }}>
            Upload file or take photos (JPG, PNG, WEBP, PDF — max 10 MB)
          </label>
          <div className="ms-file-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              multiple
              hidden
              onChange={(e) => {
                handleFilesSelected(e.target.files, false);
                e.target.value = '';
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              hidden
              onChange={(e) => {
                handleFilesSelected(e.target.files, true);
                e.target.value = '';
              }}
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload File
            </Button>
            <Button
              variant="secondary"
              onClick={() => cameraInputRef.current?.click()}
            >
              Camera / Add Photo
            </Button>
          </div>

          {files.length > 0 && (
            <div className="ms-file-list">
              {files.map((f, idx) => (
                <div className="ms-file-chip" key={`${f.name}-${idx}`}>
                  <span>
                    {f.name} ({(f.size / 1024).toFixed(0)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFileAt(idx)}
                    aria-label={`Remove ${f.name}`}
                    style={{ color: 'var(--color-error)', fontWeight: 700 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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
            <label htmlFor="report-type" className="ms-field__label">
              Type of report
            </label>
            <select
              id="report-type"
              className="ms-select"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="Lab report">Lab report</option>
              <option value="Prescription">Prescription</option>
              <option value="Imaging">Imaging</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save Document
          </Button>
        </div>
      </form>
    </Modal>
  );
}
