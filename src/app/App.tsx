import { lazy } from 'react';
import { HashRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { config } from '../lib/config';
import AccountPage from '../features/account/AccountPage';
import AdminHome from '../features/admin/AdminHome';
import AdminLayout from '../features/admin/AdminLayout';
// 관리자 화면(TTL 처리 등 무거운 코드)은 들어갈 때만 불러온다
const CurriculumLinksPage = lazy(() => import('../features/admin/CurriculumLinksPage'));
const OntologyPage = lazy(() => import('../features/admin/OntologyPage'));
const PromptsPage = lazy(() => import('../features/admin/PromptsPage'));
const StrategiesPage = lazy(() => import('../features/admin/StrategiesPage'));
const UsagePage = lazy(() => import('../features/admin/UsagePage'));
import LoginPage from '../features/auth/LoginPage';
import PendingPage from '../features/auth/PendingPage';
import SignupPage from '../features/auth/SignupPage';
import ExplorerPage from '../features/curriculum/ExplorerPage';
import LibraryPage from '../features/library/LibraryPage';
import MaterialDetailPage from '../features/library/MaterialDetailPage';
import PlanDetailPage from '../features/library/PlanDetailPage';
import SharedPage from '../features/library/SharedPage';
import WizardPage from '../features/wizard/WizardPage';
import TeacherHome from '../features/home/TeacherHome';
import { CatalogGate, CatalogProvider } from './CatalogContext';
import { DraftProvider } from './DraftContext';
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
      <Route element={<RequireActive><CatalogProvider><DraftProvider><Layout /></DraftProvider></CatalogProvider></RequireActive>}>
        <Route path="/teacher" element={<TeacherHome />} />
        <Route path="/explore" element={<CatalogGate><ExplorerPage /></CatalogGate>} />
        <Route path="/lesson" element={<CatalogGate><WizardPage /></CatalogGate>} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/library/material/:id" element={<MaterialDetailPage />} />
        <Route path="/library/plan/:id" element={<CatalogGate><PlanDetailPage /></CatalogGate>} />
        <Route path="/shared" element={<SharedPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/admin" element={<RequireActive role="admin"><AdminLayout /></RequireActive>}>
          <Route index element={<AdminHome />} />
          <Route path="curriculum" element={<CatalogGate><CurriculumLinksPage /></CatalogGate>} />
          <Route path="strategies" element={<CatalogGate><StrategiesPage /></CatalogGate>} />
          <Route path="ontology" element={<CatalogGate><OntologyPage /></CatalogGate>} />
          <Route path="prompts" element={<CatalogGate><PromptsPage /></CatalogGate>} />
          <Route path="usage" element={<UsagePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

// GitHub Pages는 새로고침 시 404가 나므로 HashRouter(/#/경로)를 사용한다 (가이드 §2).
// 체험판(웹 페이지 한 장으로 공유)은 주소를 쓰지 않는 MemoryRouter를 쓴다.
export default function App() {
  const Router = config.memoryRouter ? MemoryRouter : HashRouter;
  return (
    <AuthProvider>
      <Router>
        <Routed />
      </Router>
    </AuthProvider>
  );
}
