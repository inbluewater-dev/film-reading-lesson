// 로컬 모드 카탈로그 — 번들 데이터(또는 관리자가 게시한 TTL 버전) + 브라우저에 저장된 관리자 입력
import { BUNDLED_SOURCE } from '../../catalog/bundled';
import { bundledFiles } from '../../catalog/bundledFiles';
import { Catalog, EMPTY_OVERRIDES, type CatalogOverrides, type CatalogSource } from '../../catalog/catalog';
import type { SourceFiles } from '../../ttl/sourceFiles';
import * as policy from '../policy';
import { AppError, type CatalogService, type OntologyVersionMeta, type UserProfile } from '../types';
import type { KeyValueStorage } from './storage';

const KEY = 'frl:local:catalog:v1';
const ONTOLOGY_KEY = 'frl:local:ontology:v1';

interface OntologyState {
  activeId: string | null;
  versions: { meta: OntologyVersionMeta; files: SourceFiles }[];
}

export class LocalCatalog implements CatalogService {
  private compiled = new Map<string, CatalogSource>();

  constructor(
    private storage: KeyValueStorage,
    private actor: () => policy.Actor,
    private me: () => UserProfile | null,
    private now: () => string,
    private newId: () => string,
  ) {}

  private read(): CatalogOverrides {
    try {
      const raw = this.storage.get(KEY);
      return raw ? { ...EMPTY_OVERRIDES, ...(JSON.parse(raw) as CatalogOverrides) } : structuredClone(EMPTY_OVERRIDES);
    } catch {
      return structuredClone(EMPTY_OVERRIDES);
    }
  }
  private readOntology(): OntologyState {
    try {
      return JSON.parse(this.storage.get(ONTOLOGY_KEY) ?? '') as OntologyState;
    } catch {
      return { activeId: null, versions: [] };
    }
  }
  private requireRead() {
    if (!policy.canReadShared(this.actor(), 'curriculumNodes')) throw new AppError('permission-denied', '승인된 계정만 교육과정을 볼 수 있습니다.');
  }
  private requireAdmin(coll = 'curriculumNodes') {
    if (!policy.canWriteShared(this.actor(), coll)) throw new AppError('permission-denied', '관리자만 바꿀 수 있습니다.');
  }

  async load(): Promise<Catalog> {
    this.requireRead();
    const o = this.readOntology();
    const v = o.activeId ? o.versions.find((x) => x.meta.id === o.activeId) : undefined;
    if (!v) return new Catalog(BUNDLED_SOURCE, this.read());
    let source = this.compiled.get(v.meta.id);
    if (!source) {
      const r = await (await import('../../ontology/compileAll')).compileSources(v.files, v.meta.createdAt);
      if (!r.source) throw new AppError('unavailable', '게시된 교육과정 데이터를 읽지 못했습니다. 관리자에게 알려 주세요.');
      source = r.source;
      this.compiled.set(v.meta.id, source);
    }
    return new Catalog(source, this.read());
  }

  async saveOverrides(patch: Partial<CatalogOverrides>): Promise<void> {
    this.requireAdmin();
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

  async replaceOverrides(o: CatalogOverrides): Promise<void> {
    this.requireAdmin();
    this.storage.set(KEY, JSON.stringify({ ...EMPTY_OVERRIDES, ...o }));
  }

  async listVersions(): Promise<OntologyVersionMeta[]> {
    this.requireRead();
    return this.readOntology()
      .versions.map((v) => v.meta)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getVersionFiles(id: string | null): Promise<SourceFiles> {
    this.requireRead();
    if (id === null) return bundledFiles();
    const v = this.readOntology().versions.find((x) => x.meta.id === id);
    if (!v) throw new AppError('not-found', '버전을 찾을 수 없습니다.');
    return v.files;
  }

  async publishVersion(input: { files: SourceFiles; note: string }): Promise<OntologyVersionMeta> {
    this.requireAdmin('ontologyVersions');
    const createdAt = this.now();
    const { source, report } = await (await import('../../ontology/compileAll')).compileSources(input.files, createdAt);
    if (!source) throw new AppError('invalid-input', '검증을 통과하지 못한 TTL은 게시할 수 없습니다.');
    const me = this.me()!;
    const meta: OntologyVersionMeta = { id: this.newId(), note: input.note.trim() || '메모 없음', createdAt, createdBy: me.uid, createdByName: me.displayName, ontologyVersion: source.manifest.ontologyVersion, stats: report.stats };
    const o = this.readOntology();
    o.versions.push({ meta, files: input.files });
    o.activeId = meta.id;
    try {
      this.storage.set(ONTOLOGY_KEY, JSON.stringify(o));
    } catch {
      throw new AppError('unavailable', '브라우저 저장 공간이 부족합니다. 오래된 버전을 지운 뒤 다시 시도하세요.');
    }
    this.compiled.set(meta.id, source);
    return meta;
  }

  async getActiveVersionId(): Promise<string | null> {
    this.requireRead();
    return this.readOntology().activeId;
  }

  async setActiveVersion(id: string | null): Promise<void> {
    this.requireAdmin('ontologyVersions');
    const o = this.readOntology();
    if (id !== null && !o.versions.some((v) => v.meta.id === id)) throw new AppError('not-found', '버전을 찾을 수 없습니다.');
    o.activeId = id;
    this.storage.set(ONTOLOGY_KEY, JSON.stringify(o));
  }
}
