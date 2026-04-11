import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Setup from './pages/Setup';
import SelectAcademy from './pages/SelectAcademy';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Classrooms from './pages/Classrooms';
import Schedules from './pages/Schedules';
import Attendance from './pages/Attendance';
import Payments from './pages/Payments';
import Grades from './pages/Grades';
import Counseling from './pages/Counseling';
import Documents from './pages/Documents';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import ParentView from './pages/ParentView';
import LoginCallback from './pages/LoginCallback';
import JoinAcademy from './pages/JoinAcademy';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, academyId } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (!academyId) return <Navigate to="/select-academy" />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/login/callback" element={<LoginCallback />} />
          <Route path="/select-academy" element={<SelectAcademy />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/parent" element={<ParentView />} />
          <Route path="/join/:code" element={<JoinAcademy />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/students" element={<Students />} />
            <Route path="/classrooms" element={<Classrooms />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/grades" element={<Grades />} />
            <Route path="/counseling" element={<Counseling />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
