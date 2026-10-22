// MockProvider — 인터넷 없이 같은 형식의 결과를 돌려준다 (가이드 §8.2).
// 내용은 고른 교육과정 문구로만 만든 ‘샘플’이며, 실존 영화·인물·연도 같은 사실은 절대 만들지 않는다.
import type { AiProvider, CurriculumContext, LessonPlanRequest, MaterialRequest } from './types';
import { FilmSuggestionResult, LessonPlanResult, MaterialResult, StrategyReasonResult } from './types';

const SAMPLE_NOTE = 'AI 샘플(Mock) 모드에서 만든 예시입니다. 실제 AI가 연결되면 같은 형식으로 새 글이 만들어집니다. 사용 전 교사 검토가 필요합니다.';
const LEVEL_TONE = { 쉬움: '짧은 문장과 쉬운 낱말로', 보통: '고등학생 수준의 문장으로', 도전: '개념 사이의 관계를 따져 보는 문장으로' } as const;

function focusLabel(ctx: CurriculumContext): string {
  return ctx.areas[0]?.label ?? ctx.elements[0]?.label ?? ctx.subjectLabel;
}

export class MockProvider implements AiProvider {
  readonly model = 'mock';

  async generateMaterial(req: MaterialRequest) {
    const { context: ctx, params, textTypeLabels } = req;
    const focus = focusLabel(ctx);
    const blocks: MaterialResult['blocks'] = [];
    blocks.push({
      kind: 'paragraph',
      text: `(샘플 읽기자료) 이 글은 <${ctx.subjectLabel}>의 ‘${focus}’ 수업을 위한 예시입니다. ${LEVEL_TONE[params.level]} 약 ${params.length}자 분량의 ${textTypeLabels.content} 글이 이 자리에 들어갑니다.`,
    });
    for (const idea of ctx.coreIdeas.slice(0, 2)) blocks.push({ kind: 'paragraph', text: `이 수업이 바라보는 큰 생각은 “${idea}”입니다.` });
    for (const s of ctx.standards.slice(0, 3)) {
      blocks.push({ kind: 'paragraph', text: `${s.code} 성취기준에 따라 학생은 다음을 배웁니다. “${s.text}” 글은 이 범위 안에서만 개념을 다룹니다.` });
    }
    const films = params.films.filter((f) => f.confirmed);
    if (films.length) {
      blocks.push({ kind: 'paragraph', text: `함께 다룰 영화: ${films.map((f) => `「${f.title}」`).join(', ')}. 영화의 줄거리·감독·연도 등은 교사가 확인한 내용만 덧붙입니다.` });
    }
    const knowledge = ctx.elements.filter((e) => e.kind === 'knowledge');
    if (params.textType.format !== 'tx:ContinuousText' && knowledge.length) {
      blocks.push({
        kind: 'table',
        caption: '(샘플 표) 이 수업에서 다루는 내용 요소',
        columns: ['내용 요소', '글에서 살펴볼 점'],
        rows: knowledge.slice(0, 5).map((e) => [e.label, '(샘플) 교사가 수업에 맞게 채웁니다.']),
      });
    }
    const terms = (knowledge.length ? knowledge.map((e) => e.label) : [focus]).slice(0, 4);
    const verb = ctx.standards[0]?.targetVerb.replace(/하다$/, '') ?? '정리';
    const result = {
      title: `(샘플) ${focus} 읽기자료`,
      blocks,
      glossary: terms.map((term) => ({ term, meaning: '(샘플) 뜻풀이가 이 자리에 들어갑니다.' })),
      comprehensionQuestions: [
        { level: '기본' as const, question: `글에서 ‘${focus}’와 관련해 설명한 내용을 찾아 정리해 봅시다.` },
        { level: '중간' as const, question: `글의 내용을 바탕으로 ${terms[0]}의 의미를 자신의 말로 설명해 봅시다.` },
        { level: '심화' as const, question: `글에서 배운 내용을 활용해 영화 한 편을 골라 ${verb}해 봅시다.` },
      ],
      sourceNote: SAMPLE_NOTE,
      alignment: { nodeIds: ctx.nodeIds, standardCodes: ctx.standards.map((s) => s.code) },
    };
    return MaterialResult.parse(result);
  }

  async suggestFilms({ count }: { context: CurriculumContext; count: number }) {
    return FilmSuggestionResult.parse({
      suggestions: Array.from({ length: Math.min(Math.max(count, 1), 6) }, (_, i) => ({
        title: `(샘플) 예시 영화 ${i + 1}`,
        reason: '체험판(Mock) 추천입니다. Gemini가 연결되면 성취기준과 어울리는 실제 영화가 장르·국가·시대를 고르게 섞어 제안됩니다.',
        caution: '실제 영화가 아닙니다. 실제 추천도 제목·감독·연도를 반드시 확인한 뒤 쓰세요.',
      })),
    });
  }

  async explainStrategies(req: Parameters<AiProvider['explainStrategies']>[0]) {
    const reasons: Record<string, string> = {};
    for (const c of req.candidates) reasons[c.id] = c.matched.length ? `${c.matched.join(', ')}에 맞는 전략입니다.` : `${c.functionLabels.join(', ')} 기능의 전략입니다.`;
    return StrategyReasonResult.parse({ reasons });
  }

  async generateLessonPlan(req: LessonPlanRequest) {
    const st = (labels: string[]) => (labels.length ? ` ${labels.map((l) => `‘${l}’`).join(', ')} 전략을 적용한다.` : '');
    const T = req.materialTitle;
    const text: Record<number, [string, string, string, string]> = {
      1: [`읽기자료 「${T}」의 주제와 관련된 질문이나 짧은 영상 장면으로 관심을 모은다.`, '질문에 대한 자기 생각을 짧게 말한다.', '도입 질문 화면', '참여 태도 관찰'],
      2: [`학습목표를 함께 읽고 오늘 활동의 흐름을 안내한다.`, '학습목표를 소리 내어 읽고 활동 순서를 확인한다.', '학습목표 화면', ''],
      3: ['지난 시간에 배운 개념을 떠올리는 질문을 한다.', '배운 개념을 떠올려 답한다.', '', '구두 확인'],
      4: [`읽기자료를 나누어 주고 읽는 방법을 안내한다.${st(req.events[3].strategyLabels)}`, '읽기자료를 읽으며 중요한 부분에 표시한다.', `읽기자료 「${T}」`, ''],
      5: [`활동지의 작성 방법을 시범으로 보여 주고 힌트를 준다.${st(req.events[4].strategyLabels)}`, '안내에 따라 활동지를 작성한다.', '활동지', ''],
      6: [`모둠별로 활동을 수행하게 하고 순회하며 돕는다.${st(req.events[5].strategyLabels)}`, '모둠별로 활동하고 결과를 정리해 발표한다.', '활동지, 발표 자료', '활동 결과물'],
      7: ['발표 내용에 대해 구체적인 피드백을 준다.', '피드백을 바탕으로 활동지를 고친다.', '', '동료 평가'],
      8: ['새로운 짧은 사례로 개별 평가를 한다.', '개별 평가지를 작성한다.', '평가지', '평가 준거에 따른 수행평가'],
      9: ['배운 내용을 다른 영화에 적용해 보는 과제를 안내한다.', '배운 내용을 정리하고 적용 과제를 확인한다.', '정리 화면', ''],
    };
    return LessonPlanResult.parse({
      overview: `(샘플) ${req.context.subjectLabel} 수업 ${req.minutes}분. 읽기자료 「${T}」를 활용해 ${req.objectives[0] ?? '학습목표를 달성한다.'}`,
      events: req.events.map((e) => {
        const [teacherActivity, studentActivity, material, assessment] = text[e.seq];
        return { seq: e.seq, teacherActivity, studentActivity, material, assessment };
      }),
      rubric: (req.context.standards.length ? req.context.standards : [{ code: '학습목표', text: req.objectives[0] ?? '' }]).slice(0, 3).map((s) => ({
        criterion: `${s.code} 도달 정도`,
        high: '(샘플) 성취기준의 내용을 정확히 이해하고 자기 말로 설명하며 다른 사례에 적용한다.',
        mid: '(샘플) 성취기준의 내용을 대체로 이해하고 설명한다.',
        low: '(샘플) 교사의 도움을 받아 성취기준의 내용을 부분적으로 설명한다.',
      })),
      worksheet: ['(샘플) 읽기자료에서 핵심 낱말 3개를 찾아 쓰세요.', '(샘플) 글의 내용을 한 문장으로 요약하세요.', '(샘플) 배운 내용을 적용할 영화 한 편과 그 이유를 쓰세요.'],
    });
  }
}
