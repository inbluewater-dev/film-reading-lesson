// SHA-256 (브라우저·Node 공용). 보안 컨텍스트가 아니어서 crypto.subtle이 없으면 순수 JS 구현을 쓴다.
import { sha256Fallback } from './sha256Fallback';

export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(text);
}

/** 네 TTL 파일 해시를 이어 붙여 만든 12자리 버전 (scripts/ttl-to-json.ts와 같은 방식) */
export async function ontologyVersionOf(fileHashes: string[]): Promise<string> {
  return (await sha256Hex(fileHashes.join(''))).slice(0, 12);
}
