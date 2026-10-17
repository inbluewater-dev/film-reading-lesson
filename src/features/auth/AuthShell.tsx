import type { ReactNode } from 'react';
import { config } from '../../lib/config';

/** 로그인·가입·승인 대기 화면의 공통 틀 */
export default function AuthShell({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="text-sm font-medium text-amber-700 tracking-wide">고등학교 영화 교과</p>
        <h1 className="mt-1 text-2xl font-bold">{title}</h1>
        {lead && <p className="mt-2 text-sm text-stone-600">{lead}</p>}
        <div className="mt-8">{children}</div>
        {config.dataMode === 'local' && (
          <p className="mt-6 text-xs text-stone-400">로컬 모드 · AI {config.aiMode === 'mock' ? '샘플(Mock)' : 'Gemini'}</p>
        )}
      </div>
    </main>
  );
}
