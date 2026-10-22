// 내보내기 (가이드 §12 Phase 7): 인쇄·PDF, DOCX(워드), HWPX(한글). 읽기자료·활동지 포함 여부 선택, 미리보기
import { useEffect, useMemo, useRef, useState } from 'react';
import { useServices } from '../../app/AuthContext';
import { useCatalog } from '../../app/CatalogContext';
import { Alert, Button } from '../../components/ui';
import { toDocx } from '../../lib/export/docx';
import { toHtml } from '../../lib/export/html';
import { toHwpx } from '../../lib/export/hwpx';
import { buildExportDoc, safeFileName } from '../../lib/export/model';
import { inClaudeHost, saveFile, SaveError } from '../../lib/export/save';
import type { LessonPlanRecord, MaterialRecord } from '../../lib/library/types';

type Msg = { tone: 'error' | 'success' | 'info'; text: string; zipFallback?: boolean };

export function ExportPanel({ plan }: { plan: LessonPlanRecord }) {
  const catalog = useCatalog();
  const { library } = useServices();
  const [material, setMaterial] = useState<MaterialRecord | null>(null);
  const [materialMissing, setMaterialMissing] = useState(false);
  const [includeMaterial, setIncludeMaterial] = useState(true);
  const [includeWorksheet, setIncludeWorksheet] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const host = useMemo(() => inClaudeHost(), []);

  useEffect(() => {
    if (!plan.materialId) return setMaterialMissing(true);
    library.materials.get(plan.materialId).then(setMaterial, () => setMaterialMissing(true));
  }, [plan.materialId, library]);

  const doc = useMemo(() => buildExportDoc(catalog, plan, material, { includeMaterial: includeMaterial && !!material, includeWorksheet }), [catalog, plan, material, includeMaterial, includeWorksheet]);
  const html = useMemo(() => toHtml(doc), [doc]);
  const base = safeFileName(plan.title);

  async function run(kind: string, make: () => Promise<{ name: string; blob: Blob }>, done: string) {
    setBusy(kind);
    setMsg(null);
    try {
      const { name, blob } = await make();
      await saveFile(name, blob);
      setMsg({ tone: 'success', text: done });
    } catch (e) {
      const code = e instanceof SaveError ? e.code : '';
      setMsg({ tone: code === 'declined' ? 'info' : 'error', text: e instanceof Error ? e.message : '파일을 만들지 못했습니다.', zipFallback: kind === 'hwpx' && code === 'rejected_extension' });
    } finally {
      setBusy(null);
    }
  }
  const hwpxBlob = () => new Blob([toHwpx(doc) as BlobPart], { type: 'application/hwp+zip' });

  return (
    <div className="space-y-6">
      {!plan.reviewedByTeacher && <Alert tone="info">아직 ‘검토함’ 표시가 없는 지도안입니다. 내보내기 전에 내용을 한 번 더 확인하세요.</Alert>}
      <fieldset className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <legend className="mb-2 font-semibold">함께 담을 내용</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includeMaterial && !!material} disabled={!material} onChange={() => setIncludeMaterial(!includeMaterial)} />
          읽기자료{materialMissing && <span className="text-stone-500">(원본 읽기자료를 찾을 수 없음)</span>}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includeWorksheet} onChange={() => setIncludeWorksheet(!includeWorksheet)} />
          활동지
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        {host ? (
          <Button variant="secondary" disabled={!!busy} onClick={() => run('html', async () => ({ name: `${base}.html`, blob: new Blob([html], { type: 'text/html' }) }), '인쇄용 HTML을 저장했습니다. 브라우저로 열어 인쇄(Ctrl+P) → ‘PDF로 저장’을 고르세요.')}>
            인쇄용 HTML 받기 (PDF로 저장)
          </Button>
        ) : (
          <Button variant="secondary" disabled={!!busy} onClick={() => frame.current?.contentWindow?.print()}>
            인쇄 · PDF로 저장
          </Button>
        )}
        <Button disabled={!!busy} onClick={() => run('docx', async () => ({ name: `${base}.docx`, blob: await toDocx(doc) }), 'DOCX(워드) 파일을 저장했습니다.')}>
          {busy === 'docx' ? '만드는 중…' : 'DOCX(워드) 받기'}
        </Button>
        <Button disabled={!!busy} onClick={() => run('hwpx', async () => ({ name: `${base}.hwpx`, blob: hwpxBlob() }), 'HWPX(한글) 파일을 저장했습니다.')}>
          {busy === 'hwpx' ? '만드는 중…' : 'HWPX(한글) 받기'}
        </Button>
      </div>
      {msg && (
        <Alert tone={msg.tone}>
          {msg.text}
          {msg.zipFallback && (
            <span className="mt-2 block">
              실제 사이트에서는 바로 받을 수 있습니다. 지금 확인하려면 ZIP으로 받은 뒤 파일 이름 끝의 “.zip”을 지우면 한글에서 열립니다.{' '}
              <button type="button" className="font-medium underline" onClick={() => run('hwpx-zip', async () => ({ name: `${base}.hwpx.zip`, blob: hwpxBlob() }), 'ZIP으로 저장했습니다. 이름 끝의 “.zip”을 지운 뒤 한글에서 여세요.')}>
                ZIP으로 받기
              </button>
            </span>
          )}
        </Alert>
      )}
      <p className="text-xs text-stone-500">HWPX는 한글 2014 이후 버전에서 열립니다. 워드·한글에서 표와 글꼴이 바르게 보이는지 한 번 확인하세요. 구형 .hwp 형식은 만들지 않습니다.</p>

      <section className="space-y-2">
        <h2 className="font-semibold">미리보기 (A4)</h2>
        <iframe ref={frame} title="내보내기 미리보기" srcDoc={html} className="h-[70vh] w-full rounded-md border border-stone-300 bg-white" />
      </section>
    </div>
  );
}
