// Firebase 모드: 프롬프트 템플릿·AI 사용 기록
// ⚠ Phase 9~10에서 실제 Firebase로 검증 예정
import type { Auth } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, runTransaction, setDoc, type Firestore } from 'firebase/firestore';
import { DEFAULT_PROMPTS } from '../../ai/prompts';
import { AppError, DEFAULT_DAILY_QUOTA, type AiSettings, type PromptKind, type PromptService, type PromptTemplate, type UsageRecord, type UsageService } from '../types';

const KINDS = Object.keys(DEFAULT_PROMPTS) as PromptKind[];
const kstDay = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

export function createFirebasePrompts(db: Firestore, auth: Auth): PromptService {
  return {
    async list() {
      const snap = await getDocs(collection(db, 'promptTemplates'));
      const saved = new Map(snap.docs.map((d) => [d.id, d.data() as PromptTemplate]));
      return KINDS.map((kind) => saved.get(kind) ?? { kind, version: 1, body: DEFAULT_PROMPTS[kind], updatedAt: null, updatedBy: null, history: [] });
    },
    async save(kind, body) {
      if (!body.trim()) throw new AppError('invalid-input', '프롬프트가 비어 있습니다.');
      const cur = (await this.list()).find((t) => t.kind === kind)!;
      if (cur.body === body) return cur;
      const next: PromptTemplate = {
        kind,
        version: cur.version + 1,
        body,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser?.uid ?? null,
        history: [{ version: cur.version, body: cur.body, updatedAt: cur.updatedAt }, ...cur.history].slice(0, 10),
      };
      await setDoc(doc(db, 'promptTemplates', kind), next).catch(() => {
        throw new AppError('permission-denied', '관리자만 바꿀 수 있습니다.');
      });
      return next;
    },
  };
}

export async function readAiSettings(db: Firestore): Promise<AiSettings> {
  const snap = await getDoc(doc(db, 'appConfig', 'ai'));
  const d = snap.data() ?? {};
  // 필드가 없으면 기본 한도, null로 저장했으면 제한 없음
  const q = 'dailyQuotaPerTeacher' in d ? (typeof d.dailyQuotaPerTeacher === 'number' ? d.dailyQuotaPerTeacher : null) : DEFAULT_DAILY_QUOTA;
  return { dailyQuotaPerTeacher: q, model: typeof d.model === 'string' ? d.model : null };
}

export function createFirebaseUsage(db: Firestore, auth: Auth): UsageService {
  const ref = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new AppError('permission-denied', '로그인이 필요합니다.');
    return { uid, day: kstDay(), r: doc(db, 'usage', `${uid}_${kstDay()}`) };
  };
  return {
    async today() {
      const { r } = ref();
      const [snap, s] = await Promise.all([getDoc(r), readAiSettings(db)]);
      return { total: (snap.data()?.total as number | undefined) ?? 0, quota: s.dailyQuotaPerTeacher };
    },
    async record(kind) {
      const { uid, day, r } = ref();
      const { dailyQuotaPerTeacher: quota } = await readAiSettings(db);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(r);
        const before = (snap.data() as UsageRecord | undefined) ?? { uid, day, counts: {}, total: 0 };
        if (quota !== null && before.total >= quota) throw new AppError('quota-exceeded', `오늘 AI 생성 한도(${quota}회)를 모두 썼습니다. 내일 다시 이용하거나 관리자에게 문의하세요.`);
        tx.set(r, { uid, day, counts: { ...before.counts, [kind]: (before.counts[kind] ?? 0) + 1 }, total: before.total + 1 });
      }).catch((e) => {
        if (e instanceof AppError) throw e;
        throw new AppError('unavailable', '사용 기록을 남기지 못했습니다. 잠시 후 다시 시도하세요.');
      });
    },
  };
}
