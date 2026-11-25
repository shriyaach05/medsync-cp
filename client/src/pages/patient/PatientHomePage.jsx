import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { SkeletonCard } from '../../components/SkeletonCard';
import { EmptyState } from '../../components/EmptyState';
import { PdfViewerModal } from '../../components/PdfViewerModal';
import { AddDocumentModal } from './AddDocumentModal';
import { SummaryModal } from './SummaryModal';
import { ShareModal } from './ShareModal';
import './PatientPortal.css';

export function PatientHomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const doctorFilter = searchParams.get('doctor') || '';

  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareSuccess, setShareSuccess] = useState('');

  const [selectedIds, setSelectedIds] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [pdfReport, setPdfReport] = useState(null);
  const [summaryReport, setSummaryReport] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/reports');
      setTimeline(data.timeline || []);
    } catch (err) {
      setError(err.message || 'Could not load your medical reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const filteredTimeline = useMemo(() => {
    if (!doctorFilter) return timeline;
    return timeline
      .map((group) => ({
        ...group,
        reports: group.reports.filter(
          (r) => r.doctorName?.toLowerCase() === doctorFilter.toLowerCase()
        ),
      }))
      .filter((group) => group.reports.length > 0);
  }, [timeline, doctorFilter]);

  const allVisibleReports = useMemo(
    () => filteredTimeline.flatMap((group) => group.reports),
    [filteredTimeline]
  );

  const selectedReports = useMemo(
    () => allVisibleReports.filter((r) => selectedIds.includes(r._id)),
    [allVisibleReports, selectedIds]
  );

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSummaryGenerated = (reportId, summary) => {
    setTimeline((prev) =>
      prev.map((group) => ({
        ...group,
        reports: group.reports.map((r) =>
          r._id === reportId ? { ...r, summary, summaryStatus: 'completed' } : r
        ),
      }))
    );
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/reports/${deleteTarget._id}`);
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget._id));
      setDeleteTarget(null);
      await fetchReports();
    } catch (err) {
      setError(err.message || 'Could not delete the report.');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div style={{ paddingBottom: selectedIds.length > 0 ? '84px' : '0' }}>
      <div className="ms-page-header">
        <div>
          <h1>My Medical Reports</h1>
          <p className="ms-page-subtitle">
            Select one or more reports to send them securely to a doctor.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {allVisibleReports.length > 0 && (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                if (selectedIds.length === 0) {
                  setError('Please select at least one report using its checkbox, then click "Send to doctor".');
                } else {
                  setError('');
                  setShareOpen(true);
                }
              }}
            >
              📤 Send to doctor {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
            </Button>
          )}
          <Button onClick={() => setAddOpen(true)} size="lg">
            <span aria-hidden="true">＋</span> Add document
          </Button>
        </div>
      </div>

      {shareSuccess && (
        <div className="ms-alert ms-alert--success" role="status">
          {shareSuccess}
        </div>
      )}

      {doctorFilter && (
        <div className="ms-filter-bar">
          <span>
            Showing reports for <strong>{doctorFilter}</strong>
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSearchParams({})}
          >
            Clear filter
          </Button>
        </div>
      )}

      {error && (
        <div
          className="ms-alert ms-alert--error"
          role="alert"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
        >
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={fetchReports}>
            Try again
          </Button>
        </div>
      )}

      {loading ? (
        <SkeletonCard count={3} />
      ) : filteredTimeline.length === 0 ? (
        <EmptyState
          icon="📋"
          title={doctorFilter ? 'No reports for this doctor' : 'No medical documents yet'}
          description={
            doctorFilter
              ? `We couldn't find any reports for ${doctorFilter}.`
              : 'Tap "Add document" to upload your first lab report, prescription, or scan.'
          }
          action={
            doctorFilter ? (
              <Button variant="secondary" onClick={() => setSearchParams({})}>
                Show all reports
              </Button>
            ) : (
              <Button onClick={() => setAddOpen(true)}>＋ Add document</Button>
            )
          }
        />
      ) : (
        <div className="ms-timeline">
          {filteredTimeline.map((group) => (
            <section key={group.month}>
              <h2 className="ms-month-group__title">{group.displayMonth}</h2>
              <div className="ms-report-list">
                {group.reports.map((report) => {
                  const isSelected = selectedIds.includes(report._id);
                  return (
                    <Card
                      key={report._id}
                      className={`ms-report-card ${
                        isSelected ? 'ms-report-card--selected' : ''
                      }`}
                    >
                      <div className="ms-report-card__top">
                        <div className="ms-report-card__select-row">
                          <input
                            type="checkbox"
                            className="ms-checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(report._id)}
                            aria-label={`Select ${report.reason} to share`}
                          />
                          <div>
                            <h3 className="ms-report-card__title">{report.reason}</h3>
                            <div className="ms-report-card__meta">
                              <span>🩺 {report.doctorName}</span>
                              <span>📅 {formatDate(report.visitDate)}</span>
                            </div>
                          </div>
                        </div>
                        <Badge>{report.type}</Badge>
                      </div>

                      <div className="ms-report-card__actions">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setPdfReport(report)}
                        >
                          📄 View PDF
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSummaryReport(report)}
                        >
                          ✨ {report.summaryStatus === 'completed' ? 'View Summary' : 'Summary'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(report)}
                          style={{ color: 'var(--color-error)' }}
                        >
                          🗑 Delete
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Floating Share Action Bar */}
      {selectedIds.length > 0 && (
        <div className="ms-floating-bar" role="region" aria-label="Share selected reports">
          <span className="ms-floating-bar__count">
            {selectedIds.length} {selectedIds.length === 1 ? 'report' : 'reports'} selected
          </span>
          <div className="ms-floating-bar__actions">
            <Button
              size="sm"
              variant="ghost"
              style={{ color: 'var(--color-surface)' }}
              onClick={() => setSelectedIds([])}
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShareOpen(true)}
            >
              Send to doctor
            </Button>
          </div>
        </div>
      )}

      <AddDocumentModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => fetchReports()}
      />

      <PdfViewerModal
        isOpen={Boolean(pdfReport)}
        onClose={() => setPdfReport(null)}
        title={pdfReport?.reason}
        endpoint={pdfReport ? `/reports/${pdfReport._id}/file` : ''}
      />

      <SummaryModal
        isOpen={Boolean(summaryReport)}
        onClose={() => setSummaryReport(null)}
        report={summaryReport}
        onSummaryGenerated={handleSummaryGenerated}
      />

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        selectedReports={selectedReports}
        onShared={(doctor, count) => {
          setSelectedIds([]);
          setShareSuccess(
            `Sent ${count} ${count === 1 ? 'report' : 'reports'} to Dr. ${doctor.name}.`
          );
        }}
      />

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete document?"
        maxWidth="440px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p>
          Are you sure you want to permanently delete{' '}
          <strong>{deleteTarget?.reason}</strong>? This will also remove it from any active
          doctor shares.
        </p>
      </Modal>
    </div>
  );
}
