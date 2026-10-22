// 파일 저장: 보통 웹에서는 내려받기 링크, claude.ai 체험판 페이지 안에서는 downloads 기능으로 저장 확인 창을 띄운다
type Downloads = { save(req: { filename: string; data: Blob }): Promise<unknown> };
type ClaudeHost = { use(name: 'downloads'): Promise<Downloads | null> };

export class SaveError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function hostDownloads(): Promise<Downloads | null> | null {
  const c = (window as unknown as { claude?: ClaudeHost }).claude;
  return c && typeof c.use === 'function' ? c.use('downloads') : null;
}

/** 체험판(claude.ai) 페이지 안인지 */
export const inClaudeHost = () => hostDownloads() !== null;

export async function saveFile(filename: string, data: Blob): Promise<void> {
  const host = hostDownloads();
  if (host) {
    const d = await host;
    if (!d) throw new SaveError('unavailable', '이 화면에서는 파일 저장이 지원되지 않습니다.');
    try {
      await d.save({ filename, data });
      return;
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'unavailable';
      if (code === 'declined') throw new SaveError(code, '저장을 취소했습니다.');
      if (code === 'rejected_extension') throw new SaveError(code, '체험판 화면에서는 이 형식을 저장할 수 없습니다.');
      throw new SaveError(code, '파일을 저장하지 못했습니다. 잠시 뒤 다시 시도하세요.');
    }
  }
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
