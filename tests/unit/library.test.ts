import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/lib/data/local/localBackend';
import { MemoryStorage } from '../../src/lib/data/local/storage';
import type { MaterialRecord, OwnedFields } from '../../src/lib/library/types';
import { DEFAULT_PARAMS } from '../../src/lib/lesson/context';

let b: LocalBackend;
const data = (title: string): Omit<MaterialRecord, OwnedFields> & { ontologyVersion: string } => ({
  subjectId: 'cur:FilmUnderstanding', nodeIds: [], params: DEFAULT_PARAMS, title, blocks: [{ kind: 'paragraph', text: '본문' }], glossary: [],
  questions: [{ level: '기본', question: 'q' }, { level: '중간', question: 'q' }, { level: '심화', question: 'q' }], sourceNote: '', standardCodes: [], reviewedByTeacher: false, model: 'mock', promptVersion: 'v1', ontologyVersion: 'x',
});
const err = (p: Promise<unknown>) => p.then(() => 'ok', (e: { code: string }) => e.code);

beforeEach(async () => {
  b = new LocalBackend({ storage: new MemoryStorage() });
  await b.whenReady();
  // 두 번째 교사 준비
  await b.auth.signUp({ inviteCode: 'film2026', loginId: 'other01', displayName: '다른 교사', password: 'password1' });
  await b.auth.signIn('admin01', 'admin1234');
  const other = (await b.admin.listUsers()).find((u) => u.loginId === 'other01')!;
  await b.admin.approve(other.uid);
});

describe('보관함 권한과 공유', () => {
  it('내 자료는 나만, 공유하면 다른 교사도 보고 복제할 수 있다', async () => {
    await b.auth.signIn('teacher01', 'teacher1234');
    const m = await b.library.materials.create(data('비공개 자료'));
    expect(m.visibility).toBe('private');
    expect((await b.library.materials.listMine()).map((x) => x.title)).toEqual(['비공개 자료']);

    await b.auth.signIn('other01', 'password1');
    expect(await err(b.library.materials.get(m.id))).toBe('permission-denied');
    expect(await b.library.materials.listShared()).toHaveLength(0);

    await b.auth.signIn('teacher01', 'teacher1234');
    await b.library.materials.setVisibility(m.id, 'shared');

    await b.auth.signIn('other01', 'password1');
    expect((await b.library.materials.listShared()).map((x) => x.title)).toEqual(['비공개 자료']);
    expect(await err(b.library.materials.update(m.id, { title: '고침' }))).toBe('permission-denied');
    expect(await err(b.library.materials.remove(m.id))).toBe('permission-denied');
    const c = await b.library.materials.copy(m.id);
    expect(c).toMatchObject({ title: '비공개 자료', copiedFrom: m.id, visibility: 'private', ownerDisplayName: '다른 교사' });
    expect((await b.library.materials.listMine()).map((x) => x.id)).toEqual([c.id]);
  });
  it('공유를 취소하면 다른 교사는 다시 볼 수 없다', async () => {
    await b.auth.signIn('teacher01', 'teacher1234');
    const m = await b.library.materials.create(data('공유 취소'));
    await b.library.materials.setVisibility(m.id, 'shared');
    await b.library.materials.setVisibility(m.id, 'private');
    await b.auth.signIn('other01', 'password1');
    expect(await err(b.library.materials.get(m.id))).toBe('permission-denied');
  });
  it('관리자는 모든 자료를 읽을 수 있다', async () => {
    await b.auth.signIn('teacher01', 'teacher1234');
    const m = await b.library.materials.create(data('관리자 확인'));
    await b.auth.signIn('admin01', 'admin1234');
    expect((await b.library.materials.get(m.id)).title).toBe('관리자 확인');
  });
});
