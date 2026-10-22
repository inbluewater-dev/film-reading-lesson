// Phase 8 관리자 기능 (로컬 모드): 계정 발급·비밀번호 재설정, TTL 버전 게시·되돌리기, 동사 매핑 반영, 프롬프트, 사용 한도
import { beforeEach, describe, expect, it } from 'vitest';
import sourcesJson from '../../data/compiled/sources.json';
import { parseUserCsv } from '../../src/features/admin/CreateUsers';
import { renderPrompt, unknownVariables } from '../../src/lib/ai/prompts';
import { LocalBackend } from '../../src/lib/data/local/localBackend';
import { MemoryStorage } from '../../src/lib/data/local/storage';
import type { SourceFiles } from '../../src/lib/ttl/sourceFiles';

let b: LocalBackend;
const files = sourcesJson as SourceFiles;
const err = (p: Promise<unknown>) => p.then(() => 'ok', (e: { code: string }) => e.code);

beforeEach(async () => {
  b = new LocalBackend({ storage: new MemoryStorage() });
  await b.whenReady();
});

describe('계정 직접 발급·비밀번호 재설정', () => {
  it('관리자가 만든 계정은 바로 로그인된다', async () => {
    await b.auth.signIn('admin01', 'admin1234');
    const u = await b.admin.createUser({ loginId: 'leefilm', displayName: '이영화', password: 'temp12345' });
    expect(u).toMatchObject({ role: 'teacher', active: true, status: 'approved' });
    expect(await err(b.admin.createUser({ loginId: 'leefilm', displayName: 'x', password: 'temp12345' }))).toBe('login-id-taken');
    expect(await err(b.admin.createUser({ loginId: 'AB', displayName: 'x', password: 'temp12345' }))).toBe('invalid-login-id');
    await b.admin.resetPassword(u.uid, 'newpass99');
    await b.auth.signIn('leefilm', 'newpass99');
    expect(b.auth.currentUser()?.loginId).toBe('leefilm');
  });
  it('교사는 계정을 만들거나 비밀번호를 바꿀 수 없다', async () => {
    await b.auth.signIn('teacher01', 'teacher1234');
    expect(await err(b.admin.createUser({ loginId: 'zzzz', displayName: 'x', password: 'temp12345' }))).toBe('permission-denied');
    expect(await err(b.admin.resetPassword(b.auth.currentUser()!.uid, 'whatever1'))).toBe('permission-denied');
  });
  it('CSV 읽기: 머리글 건너뛰기, 빈 칸 오류', () => {
    const r = parseUserCsv('﻿아이디,표시 이름,임시 비밀번호\nkimfilm,김 선생님,pass12345\n\nbad,only\n');
    expect(r.rows).toEqual([{ loginId: 'kimfilm', displayName: '김 선생님', password: 'pass12345' }]);
    expect(r.errors).toHaveLength(1);
  });
});

describe('TTL 버전', () => {
  it('게시하면 교사 카탈로그에 바로 반영되고, 되돌리면 이전 데이터로 돌아간다', async () => {
    await b.auth.signIn('admin01', 'admin1234');
    const before = await b.catalog.load();
    const std = before.standards().find((s) => s.standardCode === '[12영감01-01]')!;
    const edited = { ...files, curriculum: files.curriculum.replace(std.standardText, '수정된 성취기준 원문이다.') };
    const v1 = await b.catalog.publishVersion({ files: edited, note: '시험 수정' });
    expect(await b.catalog.getActiveVersionId()).toBe(v1.id);
    await b.auth.signIn('teacher01', 'teacher1234');
    const after = await b.catalog.load();
    expect(after.node(std.id)).toMatchObject({ standardText: '수정된 성취기준 원문이다.' });
    expect(after.ontologyVersion).toBe(v1.ontologyVersion);
    expect(after.ontologyVersion).not.toBe(before.ontologyVersion);
    // 교사는 게시·되돌리기 불가
    expect(await err(b.catalog.publishVersion({ files, note: 'x' }))).toBe('permission-denied');
    expect(await err(b.catalog.setActiveVersion(null))).toBe('permission-denied');
    await b.auth.signIn('admin01', 'admin1234');
    await b.catalog.setActiveVersion(null);
    expect((await b.catalog.load()).node(std.id)).toMatchObject({ standardText: std.standardText });
    expect((await b.catalog.listVersions()).map((v) => v.note)).toEqual(['시험 수정']);
  });
  it('검증을 통과하지 못한 TTL은 게시할 수 없다', async () => {
    await b.auth.signIn('admin01', 'admin1234');
    expect(await err(b.catalog.publishVersion({ files: { ...files, gagne: '@@ 깨진 파일' }, note: 'x' }))).toBe('invalid-input');
  });
});

describe('동사 매핑 → 독서 기능 반영 (Phase 8 완료 기준)', () => {
  it('“탐구하다” 매핑을 넣으면 해당 성취기준들이 매핑으로 정해진다', async () => {
    await b.auth.signIn('admin01', 'admin1234');
    const cat0 = await b.catalog.load();
    const targets = cat0.standards().filter((s) => s.targetVerb === '탐구하다');
    expect(targets.length).toBe(18);
    expect(targets.every((s) => cat0.functionsFor(s).source === 'none')).toBe(true);
    await b.catalog.saveOverrides({ verbMappings: { 탐구하다: ['rs:Func_Exploration'] } });
    const cat1 = await b.catalog.load();
    for (const s of targets) expect(cat1.functionsFor(cat1.node(s.id) as typeof s)).toEqual({ functionIds: ['rs:Func_Exploration'], source: 'mapping' });
    // 지우면 원래대로
    await b.catalog.saveOverrides({ verbMappings: { 탐구하다: [] } });
    expect((await b.catalog.load()).overrides.verbMappings).toEqual({});
  });
  it('설정 전체 바꾸기(복원)', async () => {
    await b.auth.signIn('admin01', 'admin1234');
    await b.catalog.saveOverrides({ verbMappings: { 탐색하다: ['rs:Func_Exploration'] } });
    await b.catalog.replaceOverrides({ standardFunctions: {}, standardElements: {}, verbMappings: { 제작하다: ['rs:Func_Application'] }, strategies: {}, readingPhases: {} });
    expect((await b.catalog.load()).overrides.verbMappings).toEqual({ 제작하다: ['rs:Func_Application'] });
  });
});

describe('프롬프트 템플릿', () => {
  it('기본값 → 저장하면 버전이 오르고 이전 내용이 남는다', async () => {
    await b.auth.signIn('admin01', 'admin1234');
    const [m] = await b.prompts.list();
    expect(m).toMatchObject({ kind: 'material', version: 1, updatedAt: null });
    const v2 = await b.prompts.save('material', m.body + '\n[추가] 테스트');
    expect(v2.version).toBe(2);
    expect(v2.history[0]).toMatchObject({ version: 1, body: m.body });
    await b.auth.signIn('teacher01', 'teacher1234');
    expect((await b.prompts.list())[0].version).toBe(2); // 교사도 읽기 가능(Phase 9 AI 호출용)
    expect(await err(b.prompts.save('material', 'x'))).toBe('permission-denied');
  });
  it('자리 채우기와 모르는 자리 찾기', () => {
    expect(renderPrompt('{과목} / {영화} / {모름}', { 과목: '영화의 이해', 영화: '' })).toBe('영화의 이해 / 없음 / {모름}');
    expect(unknownVariables('films', '{과목} {오타}')).toEqual(['오타']);
  });
});

describe('AI 사용 기록·하루 한도', () => {
  it('설정이 없으면 하루 20회, 비우면 제한 없음, 모델 이름 검사', async () => {
    await b.auth.signIn('teacher01', 'teacher1234');
    expect(await b.usage.today()).toEqual({ total: 0, quota: 20 });
    await b.auth.signIn('admin01', 'admin1234');
    expect(await b.admin.getAiSettings()).toEqual({ dailyQuotaPerTeacher: 20, model: null });
    await b.admin.setAiSettings({ dailyQuotaPerTeacher: null, model: 'gemini-3.5-flash-lite' });
    expect(await b.admin.getAiSettings()).toEqual({ dailyQuotaPerTeacher: null, model: 'gemini-3.5-flash-lite' });
    expect((await b.usage.today()).quota).toBeNull();
    expect(await err(b.admin.setAiSettings({ dailyQuotaPerTeacher: 5, model: 'gpt-4' }))).toBe('invalid-input');
  });
  it('한도를 넘으면 막고, 관리자는 교사별 기록을 본다', async () => {
    await b.auth.signIn('admin01', 'admin1234');
    await b.admin.setAiSettings({ dailyQuotaPerTeacher: 2 });
    expect(await err(b.admin.setAiSettings({ dailyQuotaPerTeacher: 0 }))).toBe('invalid-input');
    await b.auth.signIn('teacher01', 'teacher1234');
    await b.usage.record('material');
    await b.usage.record('lessonPlan');
    expect(await err(b.usage.record('material'))).toBe('quota-exceeded');
    expect(await b.usage.today()).toEqual({ total: 2, quota: 2 });
    expect(await err(b.admin.listUsage())).toBe('permission-denied');
    await b.auth.signIn('admin01', 'admin1234');
    const rows = await b.admin.listUsage();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ counts: { material: 1, lessonPlan: 1 }, total: 2 });
  });
});
