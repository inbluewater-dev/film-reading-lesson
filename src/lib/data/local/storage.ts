// 로컬 모드 저장소. 브라우저에서는 localStorage, 사용할 수 없으면(사생활 보호 모드 등) 메모리에 보관한다.
export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  get(key: string) {
    return this.map.get(key) ?? null;
  }
  set(key: string, value: string) {
    this.map.set(key, value);
  }
  remove(key: string) {
    this.map.delete(key);
  }
}

export function browserStorage(): KeyValueStorage {
  const memory = new MemoryStorage();
  const ls = (() => {
    try {
      const s = window.localStorage;
      const probe = '__frl_probe__';
      s.setItem(probe, '1');
      s.removeItem(probe);
      return s;
    } catch {
      return null;
    }
  })();
  if (!ls) return memory;
  return {
    get: (k) => {
      try {
        return ls.getItem(k);
      } catch {
        return memory.get(k);
      }
    },
    set: (k, v) => {
      try {
        ls.setItem(k, v);
      } catch {
        memory.set(k, v);
      }
    },
    remove: (k) => {
      try {
        ls.removeItem(k);
      } catch {
        memory.remove(k);
      }
    },
  };
}
