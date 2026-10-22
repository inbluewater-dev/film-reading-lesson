// 로컬 모드 산출물 저장소 — 모든 읽기·쓰기를 policy.ts(= firestore.rules)로 검사한다
import type { OwnedBase, OwnedFields, OwnedStore, Visibility } from '../../library/types';
import * as policy from '../policy';
import { AppError, type UserProfile } from '../types';
import type { KeyValueStorage } from './storage';

export class LocalOwnedStore<T extends OwnedBase> implements OwnedStore<T> {
  constructor(
    private storage: KeyValueStorage,
    private key: string,
    private me: () => (UserProfile & { active: boolean }) | null,
    private now: () => string,
    private newId: () => string,
  ) {}

  private all(): Record<string, T> {
    try {
      return JSON.parse(this.storage.get(this.key) ?? '{}') as Record<string, T>;
    } catch {
      return {};
    }
  }
  private save(all: Record<string, T>) {
    this.storage.set(this.key, JSON.stringify(all));
  }
  private actor(): policy.Actor {
    const u = this.me();
    return u ? { uid: u.uid, role: u.role, active: u.active } : null;
  }
  private requireMe() {
    const u = this.me();
    if (!u || !u.active) throw new AppError('permission-denied', '승인된 계정으로 로그인하세요.');
    return u;
  }
  private byNewest = (a: T, b: T) => b.updatedAt.localeCompare(a.updatedAt);

  async listMine() {
    const a = this.actor();
    return Object.values(this.all()).filter((d) => d.ownerUid === a?.uid && policy.canReadOwned(a, d)).sort(this.byNewest);
  }
  async listShared() {
    const a = this.actor();
    if (!policy.isActive(a)) throw new AppError('permission-denied', '승인된 계정으로 로그인하세요.');
    return Object.values(this.all()).filter((d) => d.visibility === 'shared' && policy.canReadOwned(a, d)).sort((x, y) => (y.sharedAt ?? '').localeCompare(x.sharedAt ?? ''));
  }
  async get(id: string) {
    const d = this.all()[id];
    if (!d) throw new AppError('not-found', '찾을 수 없습니다. 삭제되었거나 공유가 취소되었을 수 있습니다.');
    if (!policy.canReadOwned(this.actor(), d)) throw new AppError('permission-denied', '볼 수 있는 권한이 없습니다.');
    return d;
  }
  async create(data: Omit<T, OwnedFields> & { ontologyVersion: string }) {
    const me = this.requireMe();
    const t = this.now();
    const doc = { ...data, id: this.newId(), ownerUid: me.uid, ownerDisplayName: me.displayName, visibility: 'private', createdAt: t, updatedAt: t } as unknown as T;
    if (!policy.canCreateOwned(this.actor(), doc)) throw new AppError('permission-denied', '저장할 권한이 없습니다.');
    const all = this.all();
    all[doc.id] = doc;
    this.save(all);
    return doc;
  }
  async update(id: string, patch: Partial<Omit<T, OwnedFields>>) {
    return this.write(id, (d) => ({ ...d, ...patch, updatedAt: this.now() }));
  }
  async setVisibility(id: string, visibility: Visibility) {
    return this.write(id, (d) => ({ ...d, visibility, sharedAt: visibility === 'shared' ? this.now() : undefined, updatedAt: this.now() }));
  }
  private write(id: string, fn: (d: T) => T) {
    const all = this.all();
    const before = all[id];
    if (!before) throw new AppError('not-found', '찾을 수 없습니다.');
    const after = fn(before);
    if (!policy.canUpdateOwned(this.actor(), before, after)) throw new AppError('permission-denied', '자기 것만 고칠 수 있습니다.');
    all[id] = after;
    this.save(all);
    return after;
  }
  async remove(id: string) {
    const all = this.all();
    const d = all[id];
    if (!d) return;
    if (!policy.canDeleteOwned(this.actor(), d)) throw new AppError('permission-denied', '자기 것만 지울 수 있습니다.');
    delete all[id];
    this.save(all);
  }
  async copy(id: string) {
    const src = await this.get(id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ownerUid, ownerDisplayName, visibility, sharedAt, copiedFrom, createdAt, updatedAt, ...rest } = src;
    const created = await this.create({ ...(rest as unknown as Omit<T, OwnedFields>), ontologyVersion: src.ontologyVersion });
    return this.write(created.id, (d) => ({ ...d, copiedFrom: src.id }));
  }
}
