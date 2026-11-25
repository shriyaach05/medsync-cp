import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingSpinner } from './components/LoadingSpinner';
import { PatientLayout } from './layouts/PatientLayout';
import { DoctorLayout } from './layouts/DoctorLayout';

import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { NotFoundPage } from './pages/NotFoundPage';

import { PatientHomePage } from './pages/patient/PatientHomePage';
import { DoctorsVisitedPage } from './pages/patient/DoctorsVisitedPage';
import { PatientProfilePage } from './pages/patient/PatientProfilePage';
import { PatientSettingsPage } from './pages/patient/PatientSettingsPage';

import { DoctorInboxPage } from './pages/doctor/DoctorInboxPage';
import { DoctorProfilePage } from './pages/doctor/DoctorProfilePage';

/**
 * Redirects "/" to the user's role home if logged in, or to /login otherwise.
 */
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return <LoadingSpinner fullScreen message="Loading MedSync..." />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={user.role === 'doctor' ? '/doctor' : '/patient'} replace />;
}

/**
 * Prevents already-logged-in users from seeing /login or /register.
 */
function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <LoadingSpinner fullScreen message="Loading MedSync..." />;
  }
  if (user) {
    return <Navigate to={user.role === 'doctor' ? '/doctor' : '/patient'} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      {/* Public auth routes */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />

      {/* Patient Portal routes */}
      <Route element={<ProtectedRoute allowedRole="patient" />}>
        <Route path="/patient" element={<PatientLayout />}>
          <Route index element={<PatientHomePage />} />
          <Route path="doctors" element={<DoctorsVisitedPage />} />
          <Route path="profile" element={<PatientProfilePage />} />
          <Route path="settings" element={<PatientSettingsPage />} />
        </Route>
      </Route>

      {/* Doctor Portal routes */}
      <Route element={<ProtectedRoute allowedRole="doctor" />}>
        <Route path="/doctor" element={<DoctorLayout />}>
          <Route index element={<DoctorInboxPage />} />
          <Route path="profile" element={<DoctorProfilePage />} />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
