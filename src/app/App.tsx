import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import AccountPage from '../features/account/AccountPage';
import AdminHome from '../features/admin/AdminHome';
import LoginPage from '../features/auth/LoginPage';
import PendingPage from '../features/auth/PendingPage';
import SignupPage from '../features/auth/SignupPage';
import TeacherHome from '../features/home/TeacherHome';
import { AuthProvider, useAuth } from './AuthContext';
import { RequireActive, RequireSignedIn } from './guards';
import Layout from './Layout';

function Routed() {
  const { loading } = useAuth();
  if (loading) return <p className="p-8 text-sm text-stone-500">불러오는 중…</p>;
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/pending" element={<RequireSignedIn><PendingPage /></RequireSignedIn>} />
      <Route element={<RequireActive><Layout /></RequireActive>}>
        <Route path="/teacher" element={<TeacherHome />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/admin" element={<RequireActive role="admin"><AdminHome /></RequireActive>} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

// GitHub Pages는 새로고침 시 404가 나므로 HashRouter(/#/경로)를 사용한다 (가이드 §2)
export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routed />
      </HashRouter>
    </AuthProvider>
  );
}
