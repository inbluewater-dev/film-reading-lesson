// 교사 산출물(읽기자료·수업지도안) 레코드 (가이드 §7)
import type { MaterialBlock, MaterialParams, MaterialResult } from '../ai/types';

export type Visibility = 'private' | 'shared';

export interface OwnedBase {
  id: string;
  ownerUid: string;
  ownerDisplayName: string;
  visibility: Visibility;
  sharedAt?: string;
  /** 공유 보관함에서 복제했으면 원본 ID */
  copiedFrom?: string;
  createdAt: string;
  updatedAt: string;
  /** 어떤 교육과정 데이터 버전으로 만들었는지 */
  ontologyVersion: string;
}
export type OwnedFields = keyof OwnedBase;

export interface MaterialRecord extends OwnedBase {
  subjectId: string;
  nodeIds: string[];
  params: MaterialParams;
  title: string;
  blocks: MaterialBlock[];
  glossary: MaterialResult['glossary'];
  questions: MaterialResult['comprehensionQuestions'];
  sourceNote: string;
  standardCodes: string[];
  reviewedByTeacher: boolean;
  model: string;
  promptVersion: string;
}

export type EditableCell = 'teacherActivity' | 'studentActivity' | 'material' | 'assessment' | 'minutes';

export interface LessonEventRow {
  seq: number;
  label: string;
  phase: '도입' | '전개' | '정리';
  minutes: number;
  teacherActivity: string;
  studentActivity: string;
  material: string;
  assessment: string;
  strategyIds: string[];
  /** 잠근 칸은 다시 만들기 때 바뀌지 않는다 (가이드 §8.5) */
  locked: Partial<Record<EditableCell, boolean>>;
}

export interface LessonPlanRecord extends OwnedBase {
  subjectId: string;
  nodeIds: string[];
  standardCodes: string[];
  materialId: string | null;
  materialTitle: string;
  strategyIds: string[];
  lessonMinutes: 50 | 100;
  grade: 1 | 2 | 3 | null;
  title: string;
  objectives: string[];
  overview: string;
  events: LessonEventRow[];
  rubric: { criterion: string; high: string; mid: string; low: string }[];
  worksheet: string[];
  reviewedByTeacher: boolean;
  model: string;
}

/** 내 것·공유된 것 저장소 (자료·지도안 공통) */
export interface OwnedStore<T extends OwnedBase> {
  listMine(): Promise<T[]>;
  listShared(): Promise<T[]>;
  get(id: string): Promise<T>;
  create(data: Omit<T, OwnedFields> & { ontologyVersion: string }): Promise<T>;
  update(id: string, patch: Partial<Omit<T, OwnedFields>>): Promise<T>;
  setVisibility(id: string, visibility: Visibility): Promise<T>;
  remove(id: string): Promise<void>;
  /** 공유된 것을 내 보관함으로 복제 (원본은 그대로) */
  copy(id: string): Promise<T>;
}

export interface LibraryService {
  materials: OwnedStore<MaterialRecord>;
  lessonPlans: OwnedStore<LessonPlanRecord>;
}
