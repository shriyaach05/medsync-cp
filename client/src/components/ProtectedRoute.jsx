import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * Protects routes by authentication state and optional role ('patient' or 'doctor').
 * - While auth session is restoring, shows a full-screen spinner.
 * - If not logged in, redirects to /login.
 * - If logged in with a different role, redirects to that user's own home portal.
 */
export function ProtectedRoute({ allowedRole }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen message="Checking your session..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    const fallback = user.role === 'doctor' ? '/doctor' : '/patient';
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
