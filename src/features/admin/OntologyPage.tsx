// 관리자 › TTL 버전 (가이드 §9.3-2, §4): TTL 업로드 → 검증 리포트 → 변경 미리보기 → 새 버전 게시 / 이전 버전으로 되돌리기 / TTL 내보내기
import { strToU8, zipSync } from 'fflate';
import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../app/AuthContext';
import { useCatalog, useCatalogState } from '../../app/CatalogContext';
import { Alert, Badge, Button, errorMessage } from '../../components/ui';
import type { CatalogSource } from '../../lib/catalog/catalog';
import type { OntologyVersionMeta } from '../../lib/data/types';
import { saveFile } from '../../lib/export/save';
import { compileSources, type CompileReport } from '../../lib/ontology/compileAll';
import { diffSources, orphanedOverrides, type Change } from '../../lib/ontology/diff';
import { exportOverridesJson, exportTtl, parseOverridesJson } from '../../lib/ontology/exportTtl';
import { SOURCE_FILES, SOURCE_KEYS, SOURCE_LABEL, type SourceFiles, type SourceKey } from '../../lib/ttl/sourceFiles';

const fmt = (iso: string) => new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
const KIND_LABEL = { added: '추가', removed: '삭제', changed: '수정' } as const;
const KIND_TONE = { added: 'green', removed: 'red', changed: 'amber' } as const;

interface Check {
  files: SourceFiles;
  report: CompileReport;
  source: CatalogSource | null;
  changes: Change[];
  orphans: string[];
}

export default function OntologyPage() {
  const catalog = useCatalog();
  const { reload } = useCatalogState();
  const { catalog: service } = useServices();
  const [versions, setVersions] = useState<OntologyVersionMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Partial<Record<SourceKey, { name: string; text: string }>>>({});
  const [check, setCheck] = useState<Check | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [confirmUse, setConfirmUse] = useState<string | null | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      setVersions(await service.listVersions());
      setActiveId(await service.getActiveVersionId());
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  }, [service]);
  useEffect(() => {
    void load();
  }, [load]);

  async function runCheck() {
    setBusy(true);
    setMsg(null);
    try {
      const current = await service.getVersionFiles(activeId);
      const files = { ...current } as SourceFiles;
      for (const k of SOURCE_KEYS) if (uploads[k]) files[k] = uploads[k]!.text;
      const { source, report } = await compileSources(files);
      setCheck({ files, report, source, changes: source ? diffSources(catalog.source, source) : [], orphans: source ? orphanedOverrides(source, catalog.overrides) : [] });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!check?.source) return;
    setBusy(true);
    try {
      const meta = await service.publishVersion({ files: check.files, note });
      await reload();
      await load();
      setCheck(null);
      setUploads({});
      setNote('');
      setMsg({ tone: 'success', text: `새 버전(${meta.ontologyVersion})을 게시했습니다. 교사 화면에 바로 반영됩니다.` });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function use(id: string | null) {
    try {
      await service.setActiveVersion(id);
      await reload();
      await load();
      setConfirmUse(undefined);
      setMsg({ tone: 'success', text: id ? '선택한 버전으로 되돌렸습니다.' : '기본(앱에 묶인) 데이터로 되돌렸습니다.' });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  }

  async function exportZip(id: string | null, label: string) {
    try {
      const files = await service.getVersionFiles(id);
      const entries: Record<string, Uint8Array> = {};
      // 지금 쓰는 버전이면 관리자 입력(연결 정보·전략 보완)을 넣어 내보낸다
      const withOverrides = id === activeId;
      for (const k of SOURCE_KEYS) entries[SOURCE_FILES[k]] = strToU8(withOverrides ? exportTtl(k, files[k], catalog.overrides, catalog.gagne.events) : files[k]);
      if (withOverrides) entries['관리자설정.json'] = strToU8(exportOverridesJson(catalog.overrides, catalog.ontologyVersion));
      await saveFile(`영화교과-TTL-${label}.zip`, new Blob([zipSync(entries) as BlobPart], { type: 'application/zip' }));
      setMsg({ tone: 'success', text: 'TTL 묶음(zip)을 저장했습니다.' });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  }

  const grouped = (check?.changes ?? []).reduce<Record<string, Change[]>>((acc, c) => ((acc[c.group] ??= []).push(c), acc), {});
  const counts = (check?.changes ?? []).reduce((acc, c) => ((acc[c.kind] += 1), acc), { added: 0, removed: 0, changed: 0 });

  return (
    <div className="space-y-10">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">지금 쓰는 데이터</h2>
        <p className="text-sm">
          {activeId ? (
            <>
              게시 버전 <code className="rounded bg-stone-100 px-1">{catalog.ontologyVersion}</code> — {versions.find((v) => v.id === activeId)?.note}
            </>
          ) : (
            <>
              기본 데이터(앱에 함께 묶인 TTL) <code className="rounded bg-stone-100 px-1">{catalog.ontologyVersion}</code>
            </>
          )}
        </p>
        <p className="text-xs text-stone-500">새로 만드는 읽기자료·지도안에는 이 버전 번호가 함께 저장됩니다.</p>
      </section>

      <section className="space-y-4" aria-labelledby="upload-h">
        <h2 id="upload-h" className="text-lg font-semibold">TTL 올리기</h2>
        <p className="text-sm text-stone-600">바꿀 파일만 고르세요. 고르지 않은 파일은 지금 쓰는 버전 그대로 씁니다. 검증과 변경 미리보기를 거친 뒤 게시합니다.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOURCE_KEYS.map((k) => (
            <label key={k} className="space-y-1 rounded-md border border-stone-200 bg-white p-3 text-sm">
              <span className="block font-medium">{SOURCE_LABEL[k]}</span>
              <input
                type="file"
                accept=".ttl,text/turtle,text/plain"
                aria-label={`${SOURCE_LABEL[k]} 파일`}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  setCheck(null);
                  if (!f) {
                    setUploads((u) => {
                      const next = { ...u };
                      delete next[k];
                      return next;
                    });
                    return;
                  }
                  const text = await f.text();
                  setUploads((u) => ({ ...u, [k]: { name: f.name, text } }));
                }}
                className="block w-full text-xs"
              />
              {uploads[k] && <span className="block text-xs text-emerald-800">{uploads[k]!.name} 준비됨</span>}
            </label>
          ))}
        </div>
        <Button onClick={runCheck} disabled={busy || Object.keys(uploads).length === 0}>
          {busy ? '검사하는 중…' : '검증하고 변경 미리보기'}
        </Button>

        {check && (
          <div className="space-y-4 rounded-md border border-stone-200 bg-white p-4" aria-label="검증 결과">
            <h3 className="font-semibold">검증 리포트</h3>
            <ul className="space-y-1 text-sm">
              {check.report.files.map((f) => (
                <li key={f.key} className={f.error ? 'text-red-700' : ''}>
                  {f.file}: {f.error ? f.error : `${f.triples} triples`}
                </li>
              ))}
            </ul>
            {check.report.issues.map((i) => (
              <Alert key={i}>{i}</Alert>
            ))}
            {check.report.warnings.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer">확인할 점 {check.report.warnings.length}개</summary>
                <ul className="mt-1 list-disc pl-5 text-stone-700">
                  {check.report.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
            {check.report.stats && (
              <p className="text-sm text-stone-600">
                과목 {check.report.stats.subjects} · 영역 {check.report.stats.areas} · 내용 요소 {check.report.stats.elements} · 성취기준 {check.report.stats.standards} · 독서 기능 {check.report.stats.functions} · 전략 {check.report.stats.strategies} · 가네 사태 {check.report.stats.gagneEvents}
              </p>
            )}

            {check.source && (
              <>
                <h3 className="font-semibold">
                  변경 미리보기 <Badge tone="green">추가 {counts.added}</Badge> <Badge tone="amber">수정 {counts.changed}</Badge> <Badge tone="red">삭제 {counts.removed}</Badge>
                </h3>
                {check.changes.length === 0 ? (
                  <p className="text-sm text-stone-600">지금 쓰는 데이터와 달라진 점이 없습니다.</p>
                ) : (
                  <div className="max-h-[50vh] space-y-3 overflow-y-auto">
                    {Object.entries(grouped).map(([group, cs]) => (
                      <div key={group}>
                        <p className="text-sm font-medium">
                          {group} ({cs.length})
                        </p>
                        <ul className="mt-1 space-y-1 text-sm">
                          {cs.map((c) => (
                            <li key={c.group + c.id} className="rounded border border-stone-100 px-2 py-1">
                              <Badge tone={KIND_TONE[c.kind]}>{KIND_LABEL[c.kind]}</Badge> {c.label}
                              {c.fields.length > 0 && (
                                <ul className="mt-1 space-y-0.5 pl-4 text-xs text-stone-600">
                                  {c.fields.map((f) => (
                                    <li key={f.field}>
                                      {f.field}: <del className="text-red-700">{f.before}</del> → <ins className="text-emerald-800 no-underline">{f.after}</ins>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
                {check.orphans.length > 0 && (
                  <Alert tone="info">
                    새 버전에 없는 항목을 가리키는 관리자 입력이 {check.orphans.length}개 있습니다. 게시해도 되지만 해당 연결은 쓰이지 않습니다.
                    <span className="mt-1 block text-xs">{check.orphans.slice(0, 5).join(' / ')}</span>
                  </Alert>
                )}
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex-1 text-sm">
                    <span className="font-medium">버전 메모</span>
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 영화와 삶 해설 오탈자 수정" className="mt-1 block w-full rounded-md border border-stone-300 px-3 py-2" />
                  </label>
                  <Button onClick={publish} disabled={busy || check.changes.length === 0}>
                    새 버전으로 게시
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="versions-h">
        <h2 id="versions-h" className="text-lg font-semibold">버전 이력</h2>
        <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
          {[...versions.map((v) => ({ id: v.id as string | null, v })), { id: null, v: null }].map(({ id, v }) => (
            <li key={id ?? 'bundled'} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm" data-testid="ontology-version">
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {v ? v.note : '기본 데이터 (앱에 함께 묶인 TTL)'} {id === activeId && <Badge tone="green">사용 중</Badge>}
                </div>
                <div className="text-xs text-stone-500">{v ? `${fmt(v.createdAt)} · ${v.createdByName} · 버전 ${v.ontologyVersion} · 성취기준 ${v.stats?.standards ?? '—'}개` : '처음 상태'}</div>
              </div>
              <Button variant="ghost" onClick={() => exportZip(id, v ? v.ontologyVersion : '기본')}>
                TTL 내려받기
              </Button>
              {id !== activeId &&
                (confirmUse === id ? (
                  <span className="flex items-center gap-2">
                    이 버전으로 바꿀까요?
                    <Button onClick={() => use(id)}>바꾸기</Button>
                    <Button variant="ghost" onClick={() => setConfirmUse(undefined)}>
                      취소
                    </Button>
                  </span>
                ) : (
                  <Button variant="secondary" onClick={() => setConfirmUse(id)}>
                    이 버전으로 되돌리기
                  </Button>
                ))}
            </li>
          ))}
        </ul>
        <p className="text-xs text-stone-500">‘사용 중’ 버전을 내려받으면 관리자가 앱에서 입력한 독서 기능·내용 요소 연결과 전략 보완이 TTL에 들어가고, 동사 매핑·읽기 단계는 관리자설정.json에 담깁니다.</p>
      </section>

      <section className="space-y-3" aria-labelledby="backup-h">
        <h2 id="backup-h" className="text-lg font-semibold">관리자 설정 백업·복원</h2>
        <p className="text-sm text-stone-600">독서 기능 연결·내용 요소 연결·동사 매핑·전략 보완·읽기 단계를 JSON 한 파일로 저장하거나 되살립니다.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await saveFile('관리자설정.json', new Blob([exportOverridesJson(catalog.overrides, catalog.ontologyVersion)], { type: 'application/json' }));
                setMsg({ tone: 'success', text: '관리자 설정을 저장했습니다.' });
              } catch (e) {
                setMsg({ tone: 'error', text: errorMessage(e) });
              }
            }}
          >
            설정 JSON 받기
          </Button>
          <label className="text-sm">
            <span className="mr-2">설정 JSON 불러오기</span>
            <input
              type="file"
              accept=".json,application/json"
              aria-label="설정 JSON 불러오기"
              className="text-xs"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  await service.replaceOverrides(parseOverridesJson(await f.text()));
                  await reload();
                  setMsg({ tone: 'success', text: '관리자 설정을 되살렸습니다.' });
                } catch (err) {
                  setMsg({ tone: 'error', text: errorMessage(err) });
                }
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
