// Firebase 모드 산출물 저장소 (materials / lessonPlans). 권한은 firestore.rules가 강제한다.
// ⚠ Phase 9~10에서 실제 Firebase로 검증 예정
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, updateDoc, where, type Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { OwnedBase, OwnedFields, OwnedStore, Visibility } from '../../library/types';
import { AppError, type UserProfile } from '../types';

export function createFirebaseOwnedStore<T extends OwnedBase>(db: Firestore, auth: Auth, coll: string, me: () => UserProfile | null): OwnedStore<T> {
  const fail = (e: unknown): never => {
    const code = (e as { code?: string }).code;
    if (code === 'permission-denied') throw new AppError('permission-denied', '권한이 없습니다.');
    if (code === 'not-found') throw new AppError('not-found', '찾을 수 없습니다.');
    throw new AppError('unavailable', '서버와 통신하지 못했습니다. 잠시 후 다시 시도하세요.');
  };
  const uid = () => auth.currentUser?.uid ?? fail({ code: 'permission-denied' });
  const now = () => new Date().toISOString();
  // Firestore는 undefined 값을 저장하지 못하므로 지운다
  const clean = <X extends object>(o: X) => JSON.parse(JSON.stringify(o)) as X;
  const read = async (id: string) => {
    const snap = await getDoc(doc(db, coll, id)).catch(fail);
    if (!snap.exists()) throw new AppError('not-found', '찾을 수 없습니다. 삭제되었거나 공유가 취소되었을 수 있습니다.');
    return { ...(snap.data() as T), id: snap.id };
  };
  const store: OwnedStore<T> = {
    async listMine() {
      const snap = await getDocs(query(collection(db, coll), where('ownerUid', '==', uid()), orderBy('updatedAt', 'desc'))).catch(fail);
      return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
    },
    async listShared() {
      const snap = await getDocs(query(collection(db, coll), where('visibility', '==', 'shared'), orderBy('sharedAt', 'desc'))).catch(fail);
      return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
    },
    get: read,
    async create(data) {
      const t = now();
      const body = clean({ ...data, ownerUid: uid(), ownerDisplayName: me()?.displayName ?? '', visibility: 'private' as Visibility, createdAt: t, updatedAt: t });
      const ref = await addDoc(collection(db, coll), body).catch(fail);
      return { ...(body as unknown as T), id: ref.id };
    },
    async update(id, patch) {
      await updateDoc(doc(db, coll, id), clean({ ...patch, updatedAt: now() }) as { [k: string]: string | number | boolean | object | null }).catch(fail);
      return read(id);
    },
    async setVisibility(id, visibility) {
      await updateDoc(doc(db, coll, id), visibility === 'shared' ? { visibility, sharedAt: now(), updatedAt: now() } : { visibility, updatedAt: now() }).catch(fail);
      return read(id);
    },
    async remove(id) {
      await deleteDoc(doc(db, coll, id)).catch(fail);
    },
    async copy(id) {
      const src = await read(id);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, ownerUid, ownerDisplayName, visibility, sharedAt, copiedFrom, createdAt, updatedAt, ...rest } = src;
      const created = await store.create({ ...(rest as unknown as Omit<T, OwnedFields>), ontologyVersion: src.ontologyVersion });
      await updateDoc(doc(db, coll, created.id), { copiedFrom: src.id }).catch(fail);
      return { ...created, copiedFrom: src.id };
    },
  };
  return store;
}
