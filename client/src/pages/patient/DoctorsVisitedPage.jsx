import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Card } from '../../components/Card';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import './PatientPortal.css';

export function DoctorsVisitedPage() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .get('/doctors/visited')
      .then((data) => {
        if (active) setDoctors(data.doctors || []);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load doctors visited.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
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
          <h1>Doctors Visited</h1>
          <p className="ms-page-subtitle">
            Built automatically from your uploaded reports. Tap a doctor to filter your timeline.
          </p>
        </div>
      </div>

      {error && (
        <div className="ms-alert ms-alert--error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading your doctors..." />
      ) : doctors.length === 0 ? (
        <EmptyState
          icon="🩺"
          title="No doctors recorded yet"
          description="Once you upload a medical report, the doctor you visited will appear here."
          action={<Button onClick={() => navigate('/patient')}>Go to Home</Button>}
        />
      ) : (
        <div className="ms-doctors-grid">
          {doctors.map((doc) => (
            <Card
              key={doc.doctorName}
              hoverable
              className="ms-doctor-card"
              role="button"
              tabIndex={0}
              onClick={() =>
                navigate(`/patient?doctor=${encodeURIComponent(doc.doctorName)}`)
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/patient?doctor=${encodeURIComponent(doc.doctorName)}`);
                }
              }}
            >
              <h3>🩺 {doc.doctorName}</h3>
              <p className="ms-page-subtitle">
                {doc.visitCount} {doc.visitCount === 1 ? 'visit' : 'visits'}
              </p>
              <p className="ms-page-subtitle">
                Last visit: <strong>{formatDate(doc.lastVisitDate)}</strong>
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
