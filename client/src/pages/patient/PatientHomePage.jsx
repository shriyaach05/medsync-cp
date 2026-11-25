import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { EmptyState } from '../../components/EmptyState';
import { PdfViewerModal } from '../../components/PdfViewerModal';
import { AddDocumentModal } from './AddDocumentModal';
import { SummaryModal } from './SummaryModal';
import './PatientPortal.css';

export function PatientHomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const doctorFilter = searchParams.get('doctor') || '';

  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    <div>
      <div className="ms-page-header">
        <div>
          <h1>My Medical Reports</h1>
          <p className="ms-page-subtitle">
            All your reports, prescriptions, and lab results encrypted in one place.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="lg">
          <span aria-hidden="true">＋</span> Add document
        </Button>
      </div>

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
        <div className="ms-alert ms-alert--error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading your medical timeline..." />
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
                {group.reports.map((report) => (
                  <Card key={report._id} className="ms-report-card">
                    <div className="ms-report-card__top">
                      <div>
                        <h3 className="ms-report-card__title">{report.reason}</h3>
                        <div className="ms-report-card__meta">
                          <span>🩺 {report.doctorName}</span>
                          <span>📅 {formatDate(report.visitDate)}</span>
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
                ))}
              </div>
            </section>
          ))}
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
