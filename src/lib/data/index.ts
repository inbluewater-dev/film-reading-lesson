// 서비스 진입점 — 설정(VITE_DATA_MODE)에 따라 로컬 모드 또는 Firebase 모드 구현을 돌려준다.
// Firebase SDK는 Firebase 모드일 때만 불러온다(로컬 모드 번들에 포함되지 않음).
import { config } from '../config';
import { LocalBackend } from './local/localBackend';
import { browserStorage } from './local/storage';
import type { Services } from './types';

let cached: Promise<Services> | null = null;

export function getServices(): Promise<Services> {
  if (!cached) {
    cached =
      config.dataMode === 'firebase'
        ? import('./firebase/firebaseBackend').then((m) => m.createFirebaseServices())
        : (async () => {
            const b = new LocalBackend({ storage: browserStorage() });
            await b.whenReady();
            return b;
          })();
  }
  return cached;
}
