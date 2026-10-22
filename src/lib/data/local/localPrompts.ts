// 로컬 모드 프롬프트 템플릿 저장소
import { DEFAULT_PROMPTS } from '../../ai/prompts';
import * as policy from '../policy';
import { AppError, type PromptKind, type PromptService, type PromptTemplate } from '../types';
import type { KeyValueStorage } from './storage';

const KEY = 'frl:local:prompts:v1';
const KINDS = Object.keys(DEFAULT_PROMPTS) as PromptKind[];

export class LocalPrompts implements PromptService {
  constructor(
    private storage: KeyValueStorage,
    private actor: () => policy.Actor,
    private now: () => string,
  ) {}
  private read(): Partial<Record<PromptKind, PromptTemplate>> {
    try {
      return JSON.parse(this.storage.get(KEY) ?? '{}');
    } catch {
      return {};
    }
  }
  async list(): Promise<PromptTemplate[]> {
    if (!policy.canReadShared(this.actor(), 'promptTemplates')) throw new AppError('permission-denied', '승인된 계정만 볼 수 있습니다.');
    const saved = this.read();
    return KINDS.map((kind) => saved[kind] ?? { kind, version: 1, body: DEFAULT_PROMPTS[kind], updatedAt: null, updatedBy: null, history: [] });
  }
  async save(kind: PromptKind, body: string): Promise<PromptTemplate> {
    const a = this.actor();
    if (!policy.canWriteShared(a, 'promptTemplates')) throw new AppError('permission-denied', '관리자만 바꿀 수 있습니다.');
    if (!body.trim()) throw new AppError('invalid-input', '프롬프트가 비어 있습니다.');
    const cur = (await this.list()).find((t) => t.kind === kind)!;
    if (cur.body === body) return cur;
    const next: PromptTemplate = {
      kind,
      version: cur.version + 1,
      body,
      updatedAt: this.now(),
      updatedBy: a!.uid,
      history: [{ version: cur.version, body: cur.body, updatedAt: cur.updatedAt }, ...cur.history].slice(0, 10),
    };
    this.storage.set(KEY, JSON.stringify({ ...this.read(), [kind]: next }));
    return next;
  }
}
