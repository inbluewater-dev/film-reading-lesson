// 로컬 모드 카탈로그 — 번들 데이터 + 브라우저에 저장된 관리자 입력
import { BUNDLED_SOURCE } from '../../catalog/bundled';
import { Catalog, EMPTY_OVERRIDES, type CatalogOverrides } from '../../catalog/catalog';
import * as policy from '../policy';
import { AppError, type CatalogService } from '../types';
import type { KeyValueStorage } from './storage';

const KEY = 'frl:local:catalog:v1';

export class LocalCatalog implements CatalogService {
  constructor(
    private storage: KeyValueStorage,
    private actor: () => policy.Actor,
  ) {}

  private read(): CatalogOverrides {
    try {
      const raw = this.storage.get(KEY);
      return raw ? { ...EMPTY_OVERRIDES, ...(JSON.parse(raw) as CatalogOverrides) } : { ...EMPTY_OVERRIDES };
    } catch {
      return { ...EMPTY_OVERRIDES };
    }
  }

  async load(): Promise<Catalog> {
    if (!policy.canReadShared(this.actor(), 'curriculumNodes')) throw new AppError('permission-denied', '승인된 계정만 교육과정을 볼 수 있습니다.');
    return new Catalog(BUNDLED_SOURCE, this.read());
  }

  async saveOverrides(patch: Partial<CatalogOverrides>): Promise<void> {
    if (!policy.canWriteShared(this.actor(), 'curriculumNodes')) throw new AppError('permission-denied', '관리자만 바꿀 수 있습니다.');
    const cur = this.read();
    const next: CatalogOverrides = {
      standardFunctions: { ...cur.standardFunctions, ...patch.standardFunctions },
      standardElements: { ...cur.standardElements, ...patch.standardElements },
      verbMappings: { ...cur.verbMappings, ...patch.verbMappings },
      strategies: { ...cur.strategies, ...patch.strategies },
      readingPhases: { ...cur.readingPhases, ...patch.readingPhases },
    };
    // 빈 배열 = 지정 해제 → 키를 지운다
    for (const k of ['standardFunctions', 'standardElements', 'verbMappings'] as const) {
      for (const [id, v] of Object.entries(next[k])) if (!v || v.length === 0) delete next[k][id];
    }
    this.storage.set(KEY, JSON.stringify(next));
  }
}
