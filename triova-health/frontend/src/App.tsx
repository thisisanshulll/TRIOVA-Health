import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { Toaster } from '@/components/ui/toaster';

// Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import PatientDashboard from './pages/patient/PatientDashboard';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import TriageFlow from './pages/patient/TriageFlow';
import AppointmentsList from './pages/patient/AppointmentsList';
import MedicalRecords from './pages/patient/MedicalRecords';

function App() {
  const { checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    // Attempt session validation on mount
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading TRIOVA...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicOnlyRoute><Outlet /></PublicOnlyRoute>}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Route>

        {/* Protected Patient Routes */}
        <Route element={<ProtectedRoute allowedRoles={['patient', 'admin']} />}>
          <Route path="/dashboard" element={<PatientDashboard />} />
          <Route path="/triage" element={<TriageFlow />} />
          <Route path="/records" element={<MedicalRecords />} />
          <Route path="/appointments" element={<AppointmentsList />} />
        </Route>

        {/* Protected Doctor Routes */}
        <Route element={<ProtectedRoute allowedRoles={['doctor', 'admin']} />}>
          <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
          <Route path="/doctor/appointments" element={<div>Doctor Appointments</div>} />
          <Route path="/doctor/patients" element={<div>Doctor Patients</div>} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

// Temporary layout hack for Outlet in public route
import { Outlet } from 'react-router-dom';
export default App;
