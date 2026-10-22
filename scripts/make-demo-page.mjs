// 체험판 빌드(dist-demo/index.html)를 웹 페이지 한 장 형식으로 바꾼다 → dist-demo/영화수업설계도우미.html
// (doctype/html/head/body 태그 없이 title·style·본문·script만 남김)
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist-demo/index.html', 'utf-8');
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]);
// 번들 속 문자열 리터럴의 U+FFFD(대체 문자)는 \uFFFD 이스케이프로 바꾼다(게시 검사에서 깨진 글자로 오인되지 않게)
const scripts = [...html.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0].replace(/\uFFFD/g, '\\uFFFD'));
if (!styles.length || !scripts.length) throw new Error('style/script를 찾지 못했습니다');
const page = [
  '<title>영화 수업 설계 도우미</title>',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap">',
  ...styles,
  '<div id="root"></div>',
  ...scripts,
].join('\n');
writeFileSync('dist-demo/영화수업설계도우미.html', page);
console.log(`✓ dist-demo/영화수업설계도우미.html (${(page.length / 1024).toFixed(0)} KB)`);
