import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, isLoading } = useAuthStore();

  if (isLoading) return null;

  if (isAuthenticated && user) {
    return <Navigate to={user.role === 'doctor' ? '/doctor-dashboard' : '/dashboard'} replace />;
  }

  return <>{children}</>;
};
