import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from '../features/auth/LoginPage';

// GitHub Pages는 새로고침 시 404가 나므로 HashRouter(/#/경로)를 사용한다 (가이드 §2)
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
}
