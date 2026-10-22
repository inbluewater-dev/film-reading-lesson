// Firebase 모드 카탈로그 — 번들 데이터(또는 게시된 TTL 버전) + Firestore에 저장된 관리자 입력
// 저장 위치: verbMappings/{동사}, curriculumNodes/{성취기준ID}, readingStrategies/{전략ID}, readingFunctions/{기능ID},
//           ontologyVersions/{id}(메타), ontologyFiles/{id}(TTL 원문), ontologyState/active(사용 중인 버전)
// ⚠ Phase 9~10에서 실제 Firebase로 검증 예정
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch, type Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import { BUNDLED_SOURCE } from '../../catalog/bundled';
import { bundledFiles } from '../../catalog/bundledFiles';
import { Catalog, EMPTY_OVERRIDES, type CatalogOverrides, type CatalogSource, type ReadingPhase, type StrategyExtension } from '../../catalog/catalog';
import type { SourceFiles } from '../../ttl/sourceFiles';
import { AppError, type CatalogService, type OntologyVersionMeta, type UserProfile } from '../types';

const OVERRIDE_COLLECTIONS = ['verbMappings', 'curriculumNodes', 'readingStrategies', 'readingFunctions'] as const;

export function createFirebaseCatalog(db: Firestore, auth: Auth, me: () => UserProfile | null): CatalogService {
  const compiled = new Map<string, CatalogSource>();
  const denied = (): never => {
    throw new AppError('permission-denied', '저장하지 못했습니다. 관리자 권한을 확인하세요.');
  };

  async function readOverrides(): Promise<CatalogOverrides> {
    const [verbs, nodes, strategies, functions] = await Promise.all(OVERRIDE_COLLECTIONS.map((c) => getDocs(collection(db, c))));
    const o: CatalogOverrides = structuredClone(EMPTY_OVERRIDES);
    verbs.forEach((d) => (o.verbMappings[d.id] = (d.data().functionIds as string[]) ?? []));
    nodes.forEach((d) => {
      const v = d.data();
      if (v.targetFunctionIds?.length) o.standardFunctions[d.id] = v.targetFunctionIds;
      if (v.coversElementIds?.length) o.standardElements[d.id] = v.coversElementIds;
    });
    strategies.forEach((d) => (o.strategies[d.id] = d.data() as Partial<StrategyExtension>));
    functions.forEach((d) => (o.readingPhases[d.id] = d.data().phase as ReadingPhase));
    return o;
  }

  async function activeId(): Promise<string | null> {
    const snap = await getDoc(doc(db, 'ontologyState', 'active'));
    return (snap.data()?.versionId as string | undefined) ?? null;
  }

  async function filesOf(id: string): Promise<SourceFiles> {
    const snap = await getDoc(doc(db, 'ontologyFiles', id));
    if (!snap.exists()) throw new AppError('not-found', '버전을 찾을 수 없습니다.');
    return snap.data().files as SourceFiles;
  }

  async function writeOverrides(patch: Partial<CatalogOverrides>) {
    const batch = writeBatch(db);
    for (const [verb, ids] of Object.entries(patch.verbMappings ?? {})) {
      if (ids.length) batch.set(doc(db, 'verbMappings', verb), { functionIds: ids, updatedBy: auth.currentUser?.uid ?? null, updatedAt: new Date().toISOString() });
      else batch.delete(doc(db, 'verbMappings', verb));
    }
    for (const [id, ids] of Object.entries(patch.standardFunctions ?? {})) batch.set(doc(db, 'curriculumNodes', id), { targetFunctionIds: ids }, { merge: true });
    for (const [id, ids] of Object.entries(patch.standardElements ?? {})) batch.set(doc(db, 'curriculumNodes', id), { coversElementIds: ids }, { merge: true });
    for (const [id, v] of Object.entries(patch.strategies ?? {})) batch.set(doc(db, 'readingStrategies', id), v, { merge: true });
    for (const [id, phase] of Object.entries(patch.readingPhases ?? {})) batch.set(doc(db, 'readingFunctions', id), { phase }, { merge: true });
    await batch.commit().catch(denied);
  }

  return {
    async load() {
      try {
        const [o, id] = await Promise.all([readOverrides(), activeId()]);
        if (!id) return new Catalog(BUNDLED_SOURCE, o);
        let source = compiled.get(id);
        if (!source) {
          const r = await (await import('../../ontology/compileAll')).compileSources(await filesOf(id));
          if (!r.source) throw new AppError('unavailable', '게시된 교육과정 데이터를 읽지 못했습니다. 관리자에게 알려 주세요.');
          source = r.source;
          compiled.set(id, source);
        }
        return new Catalog(source, o);
      } catch (e) {
        if (e instanceof AppError) throw e;
        throw new AppError('permission-denied', '교육과정을 불러오지 못했습니다. 승인된 계정인지 확인하세요.');
      }
    },
    saveOverrides: writeOverrides,
    async replaceOverrides(o) {
      // 기존 문서를 모두 지운 뒤 새로 쓴다
      for (const c of OVERRIDE_COLLECTIONS) {
        const snap = await getDocs(collection(db, c)).catch(denied);
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref))).catch(denied);
      }
      await writeOverrides(o);
    },
    async listVersions() {
      const snap = await getDocs(collection(db, 'ontologyVersions')).catch(denied);
      return snap.docs.map((d) => ({ ...(d.data() as OntologyVersionMeta), id: d.id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async getVersionFiles(id) {
      return id === null ? bundledFiles() : filesOf(id);
    },
    async publishVersion({ files, note }) {
      const createdAt = new Date().toISOString();
      const { source, report } = await (await import('../../ontology/compileAll')).compileSources(files, createdAt);
      if (!source) throw new AppError('invalid-input', '검증을 통과하지 못한 TTL은 게시할 수 없습니다.');
      const u = me();
      const ref = doc(collection(db, 'ontologyVersions'));
      const meta: OntologyVersionMeta = { id: ref.id, note: note.trim() || '메모 없음', createdAt, createdBy: u?.uid ?? '', createdByName: u?.displayName ?? '', ontologyVersion: source.manifest.ontologyVersion, stats: report.stats };
      const batch = writeBatch(db);
      batch.set(doc(db, 'ontologyFiles', ref.id), { files });
      batch.set(ref, meta);
      batch.set(doc(db, 'ontologyState', 'active'), { versionId: ref.id, updatedAt: createdAt });
      await batch.commit().catch(denied);
      compiled.set(ref.id, source);
      return meta;
    },
    getActiveVersionId: activeId,
    async setActiveVersion(id) {
      await setDoc(doc(db, 'ontologyState', 'active'), { versionId: id, updatedAt: new Date().toISOString() }).catch(denied);
    },
  };
}
