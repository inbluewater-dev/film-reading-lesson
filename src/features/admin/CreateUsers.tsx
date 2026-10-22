// 계정 직접 발급: 한 명씩 또는 CSV로 여러 명 (가이드 §6.2 A안 보조 기능)
import { useState, type FormEvent } from 'react';
import { useServices } from '../../app/AuthContext';
import { Alert, Button, Field, errorMessage } from '../../components/ui';
import type { CreateUserInput } from '../../lib/data/types';

/** "아이디,표시 이름,임시 비밀번호" 줄들을 읽는다. 첫 줄이 머리글이면 건너뛴다 */
export function parseUserCsv(text: string): { rows: CreateUserInput[]; errors: string[] } {
  const rows: CreateUserInput[] = [];
  const errors: string[] = [];
  text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (!line.trim()) return;
      const cells = line.split(',').map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
      if (i === 0 && /아이디|loginId|id/i.test(cells[0])) return;
      if (cells.length < 3 || !cells[0] || !cells[1] || !cells[2]) {
        errors.push(`${i + 1}번째 줄: 아이디, 표시 이름, 임시 비밀번호 세 칸이 필요합니다.`);
        return;
      }
      rows.push({ loginId: cells[0], displayName: cells[1], password: cells[2] });
    });
  return { rows, errors };
}

export function CreateUsers({ onCreated }: { onCreated: () => Promise<void> | void }) {
  const { admin } = useServices();
  const [one, setOne] = useState<CreateUserInput>({ loginId: '', displayName: '', password: '' });
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [results, setResults] = useState<{ loginId: string; ok: boolean; text: string }[]>([]);
  const parsed = parseUserCsv(csv);

  async function createOne(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const u = await admin.createUser(one);
      setMsg({ tone: 'success', text: `${u.displayName}(${u.loginId}) 계정을 만들었습니다. 임시 비밀번호를 직접 전달하고, 첫 로그인 뒤 ‘내 정보’에서 바꾸도록 안내하세요.` });
      setOne({ loginId: '', displayName: '', password: '' });
      await onCreated();
    } catch (err) {
      setMsg({ tone: 'error', text: errorMessage(err) });
    }
  }

  async function createMany() {
    setBusy(true);
    const out: typeof results = [];
    for (const r of parsed.rows) {
      try {
        await admin.createUser(r);
        out.push({ loginId: r.loginId, ok: true, text: '만듦' });
      } catch (err) {
        out.push({ loginId: r.loginId, ok: false, text: errorMessage(err) });
      }
    }
    setResults(out);
    setBusy(false);
    await onCreated();
  }

  return (
    <section aria-labelledby="create-h" className="space-y-6">
      <h2 id="create-h" className="text-lg font-semibold">계정 직접 만들기</h2>
      <p className="text-sm text-stone-600">가입 신청 없이 바로 쓸 수 있는 교사 계정을 만듭니다.</p>
      <form onSubmit={createOne} className="grid max-w-3xl gap-3 sm:grid-cols-3">
        <Field label="아이디" name="newLoginId" hint="영어 소문자·숫자 4~20자" value={one.loginId} onChange={(e) => setOne({ ...one, loginId: e.target.value })} />
        <Field label="표시 이름" name="newDisplayName" value={one.displayName} onChange={(e) => setOne({ ...one, displayName: e.target.value })} />
        <Field label="임시 비밀번호" name="newPassword" hint="8자 이상" value={one.password} onChange={(e) => setOne({ ...one, password: e.target.value })} />
        <div>
          <Button type="submit" disabled={!one.loginId || !one.displayName || !one.password}>
            계정 만들기
          </Button>
        </div>
      </form>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <div className="max-w-3xl space-y-2">
        <h3 className="font-semibold">CSV로 여러 명 만들기</h3>
        <label htmlFor="csv" className="block text-sm text-stone-600">
          한 줄에 한 명씩 <code className="rounded bg-stone-100 px-1">아이디,표시 이름,임시 비밀번호</code> 순서로 붙여 넣거나 CSV 파일을 고르세요.
        </label>
        <textarea id="csv" rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'아이디,표시 이름,임시 비밀번호\nleefilm,이영화 선생님,temp12345'} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-sm" />
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          aria-label="CSV 파일"
          className="text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setCsv(await f.text());
          }}
        />
        {parsed.errors.map((er) => (
          <Alert key={er}>{er}</Alert>
        ))}
        <Button onClick={createMany} disabled={busy || parsed.rows.length === 0 || parsed.errors.length > 0}>
          {busy ? '만드는 중…' : `${parsed.rows.length}명 만들기`}
        </Button>
        {results.length > 0 && (
          <ul className="space-y-1 text-sm" aria-label="CSV 결과">
            {results.map((r) => (
              <li key={r.loginId} className={r.ok ? 'text-emerald-800' : 'text-red-700'}>
                {r.loginId}: {r.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
