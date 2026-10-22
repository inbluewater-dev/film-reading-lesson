// 앱에 함께 묶인 기본 데이터 (빌드 때 data/ttl → data/compiled 로 컴파일됨)
import curriculum from '../../../data/compiled/curriculum.json';
import gagne from '../../../data/compiled/gagne.json';
import manifest from '../../../data/compiled/manifest.json';
import reading from '../../../data/compiled/reading.json';
import textTypes from '../../../data/compiled/textTypes.json';
import type { CatalogSource } from './catalog';

export const BUNDLED_SOURCE = { manifest, curriculum, reading, gagne, textTypes } as unknown as CatalogSource;
