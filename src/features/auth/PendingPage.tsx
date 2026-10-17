import { Navigate, useNavigate } from 'react-router-dom';
import { homePathFor, useAuth, useServices } from '../../app/AuthContext';
import { Alert, Button } from '../../components/ui';
import AuthShell from './AuthShell';

/** 승인 대기·거절·비활성 계정이 보는 화면 */
export default function PendingPage() {
  const { user } = useAuth();
  const services = useServices();
  const navigate = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  if (user.active) return <Navigate to={homePathFor(user)} replace />;

  const message =
    user.status === 'pending'
      ? { title: '관리자 승인 대기 중', body: '가입 신청이 접수되었습니다. 관리자가 승인하면 다시 로그인해 사용할 수 있습니다.' }
      : user.status === 'rejected'
        ? { title: '가입이 승인되지 않았습니다', body: `사유: ${user.rejectReason ?? '없음'}. 자세한 내용은 관리자에게 문의하세요.` }
        : { title: '사용이 중지된 계정입니다', body: '관리자에게 문의하세요.' };

  return (
    <AuthShell title={message.title}>
      <div className="space-y-4">
        <Alert tone="info">{message.body}</Alert>
        <p className="text-sm text-stone-600">
          아이디: <strong>{user.loginId}</strong> · 표시 이름: {user.displayName}
        </p>
        <Button
          variant="secondary"
          className="w-full"
          onClick={async () => {
            await services.auth.signOut();
            navigate('/login', { replace: true });
          }}
        >
          로그아웃
        </Button>
      </div>
    </AuthShell>
  );
}
