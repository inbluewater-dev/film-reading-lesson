// Firebase 모드 카탈로그 — 번들 데이터 + Firestore에 저장된 관리자 입력
// 저장 위치: verbMappings/{동사}, curriculumNodes/{성취기준ID}, readingStrategies/{전략ID}, readingFunctions/{기능ID}
// ⚠ Phase 9~10에서 실제 Firebase로 검증 예정
import { collection, doc, getDocs, writeBatch, type Firestore } from 'firebase/firestore';
import { BUNDLED_SOURCE } from '../../catalog/bundled';
import { Catalog, EMPTY_OVERRIDES, type CatalogOverrides, type ReadingPhase, type StrategyExtension } from '../../catalog/catalog';
import { AppError, type CatalogService } from '../types';

export function createFirebaseCatalog(db: Firestore): CatalogService {
  return {
    async load() {
      try {
        const [verbs, nodes, strategies, functions] = await Promise.all(
          ['verbMappings', 'curriculumNodes', 'readingStrategies', 'readingFunctions'].map((c) => getDocs(collection(db, c))),
        );
        const o: CatalogOverrides = structuredClone(EMPTY_OVERRIDES);
        verbs.forEach((d) => (o.verbMappings[d.id] = (d.data().functionIds as string[]) ?? []));
        nodes.forEach((d) => {
          const v = d.data();
          if (v.targetFunctionIds) o.standardFunctions[d.id] = v.targetFunctionIds;
          if (v.coversElementIds) o.standardElements[d.id] = v.coversElementIds;
        });
        strategies.forEach((d) => (o.strategies[d.id] = d.data() as Partial<StrategyExtension>));
        functions.forEach((d) => (o.readingPhases[d.id] = d.data().phase as ReadingPhase));
        return new Catalog(BUNDLED_SOURCE, o);
      } catch {
        throw new AppError('permission-denied', '교육과정을 불러오지 못했습니다. 승인된 계정인지 확인하세요.');
      }
    },
    async saveOverrides(patch) {
      const batch = writeBatch(db);
      for (const [verb, ids] of Object.entries(patch.verbMappings ?? {})) {
        if (ids.length) batch.set(doc(db, 'verbMappings', verb), { functionIds: ids });
        else batch.delete(doc(db, 'verbMappings', verb));
      }
      for (const [id, ids] of Object.entries(patch.standardFunctions ?? {})) batch.set(doc(db, 'curriculumNodes', id), { targetFunctionIds: ids }, { merge: true });
      for (const [id, ids] of Object.entries(patch.standardElements ?? {})) batch.set(doc(db, 'curriculumNodes', id), { coversElementIds: ids }, { merge: true });
      for (const [id, v] of Object.entries(patch.strategies ?? {})) batch.set(doc(db, 'readingStrategies', id), v, { merge: true });
      for (const [id, phase] of Object.entries(patch.readingPhases ?? {})) batch.set(doc(db, 'readingFunctions', id), { phase }, { merge: true });
      await batch.commit().catch(() => {
        throw new AppError('permission-denied', '저장하지 못했습니다. 관리자 권한을 확인하세요.');
      });
    },
  };
}
