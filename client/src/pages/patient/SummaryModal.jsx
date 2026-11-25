import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { LoadingSpinner } from '../../components/LoadingSpinner';

const GEMINI_NOTICE_KEY = 'medsync_gemini_notice_seen';

const STATUS_BADGE_MAP = {
  normal: 'success',
  high: 'danger',
  low: 'warning',
};

export function SummaryModal({ isOpen, onClose, report, onSummaryGenerated }) {
  const [summary, setSummary] = useState(null);
  const [disclaimer, setDisclaimer] = useState(
    'AI summary, not medical advice. Check the original with your doctor.'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsNoticeConfirm, setNeedsNoticeConfirm] = useState(false);

  const fetchSummary = async () => {
    if (!report) return;
    setLoading(true);
    setError('');
    setNeedsNoticeConfirm(false);

    try {
      localStorage.setItem(GEMINI_NOTICE_KEY, 'true');
      const data = await api.post(`/reports/${report._id}/summary`);
      setSummary(data.summary);
      if (data.disclaimer) setDisclaimer(data.disclaimer);
      onSummaryGenerated?.(report._id, data.summary);
    } catch (err) {
      setError(
        err.message ||
          'Unable to generate AI summary right now. Please check the original PDF.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !report) return;
    setError('');

    // Already cached on report
    if (report.summary && report.summaryStatus === 'completed') {
      setSummary(report.summary);
      setNeedsNoticeConfirm(false);
      return;
    }

    setSummary(null);
    const seenNotice = localStorage.getItem(GEMINI_NOTICE_KEY) === 'true';
    if (!seenNotice) {
      setNeedsNoticeConfirm(true);
    } else {
      fetchSummary();
    }
  }, [isOpen, report]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Summary: ${report?.reason || 'Medical Report'}`}
      maxWidth="700px"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {needsNoticeConfirm && !loading && (
        <div className="ms-form-stack">
          <div className="ms-alert ms-alert--info">
            <strong>Before we continue:</strong> Your report is sent to Google's Gemini API to
            create this.
          </div>
          <Button onClick={fetchSummary}>Understand & Generate Summary</Button>
        </div>
      )}

      {loading && <LoadingSpinner message="Creating simple-language summary with Gemini..." />}

      {error && (
        <div className="ms-form-stack">
          <div className="ms-alert ms-alert--error" role="alert">
            {error}
          </div>
          <Button variant="secondary" onClick={fetchSummary}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && summary && (
        <div>
          <div className="ms-summary-meta">
            <div className="ms-summary-meta__item">
              <span className="ms-summary-meta__label">Report type</span>
              <span className="ms-summary-meta__value">{summary.reportType || 'Not mentioned'}</span>
            </div>
            <div className="ms-summary-meta__item">
              <span className="ms-summary-meta__label">Date</span>
              <span className="ms-summary-meta__value">{summary.date || 'Not mentioned'}</span>
            </div>
            <div className="ms-summary-meta__item">
              <span className="ms-summary-meta__label">Doctor</span>
              <span className="ms-summary-meta__value">{summary.doctor || 'Not mentioned'}</span>
            </div>
          </div>

          <div className="ms-summary-section">
            <h3>Key Findings</h3>
            {summary.keyFindings && summary.keyFindings.length > 0 ? (
              <div className="ms-table-wrap">
                <table className="ms-table">
                  <thead>
                    <tr>
                      <th>Test / Finding</th>
                      <th>Value</th>
                      <th>Normal Range</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.keyFindings.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.test}</td>
                        <td>{item.value}</td>
                        <td>{item.normalRange}</td>
                        <td>
                          <Badge variant={STATUS_BADGE_MAP[item.status] || 'neutral'}>
                            {item.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ms-page-subtitle">No lab values or test findings mentioned.</p>
            )}
          </div>

          <div className="ms-summary-section">
            <h3>Medicines</h3>
            {summary.medicines && summary.medicines.length > 0 ? (
              <div className="ms-table-wrap">
                <table className="ms-table">
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th>Dose</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.medicines.map((med, idx) => (
                      <tr key={idx}>
                        <td>{med.name}</td>
                        <td>{med.dose}</td>
                        <td>{med.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ms-page-subtitle">No medicines mentioned.</p>
            )}
          </div>

          {summary.advice && summary.advice.length > 0 && (
            <div className="ms-summary-section">
              <h3>Advice</h3>
              <ul className="ms-advice-list">
                {summary.advice.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="ms-summary-section">
            <h3>Follow-up</h3>
            <p className="ms-page-subtitle">{summary.followUp || 'Not mentioned'}</p>
          </div>

          <div className="ms-alert ms-alert--warning" style={{ marginBottom: 0 }}>
            {disclaimer}
          </div>
        </div>
      )}
    </Modal>
  );
}
