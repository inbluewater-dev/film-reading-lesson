// AI 호출 전에 사용 횟수를 기록하고 하루 한도를 확인한다 (가이드 §9.3-7)
import type { UsageService } from '../data/types';
import type { AiProvider } from './types';

export function trackedAi(ai: AiProvider, usage: UsageService): AiProvider {
  return {
    get model() {
      return ai.model;
    },
    generateMaterial: async (i) => (await usage.record('material'), ai.generateMaterial(i)),
    suggestFilms: async (i) => (await usage.record('films'), ai.suggestFilms(i)),
    explainStrategies: async (i) => (await usage.record('strategies'), ai.explainStrategies(i)),
    generateLessonPlan: async (i) => (await usage.record('lessonPlan'), ai.generateLessonPlan(i)),
  };
}
