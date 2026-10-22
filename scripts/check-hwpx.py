"""HWPX 구조 점검 (선택): python-hwpx로 열어 스키마 검사와 본문 추출을 해 본다.

사용:  pip install python-hwpx
       npm test            # test-output/export/지도안.hwpx 생성
       python scripts/check-hwpx.py test-output/export/지도안.hwpx

최종 확인은 반드시 한글(2014 이후)에서 직접 열어 표·글꼴을 본다.
"""
import sys
import warnings

warnings.filterwarnings("ignore")
from hwpx import HwpxDocument  # noqa: E402

path = sys.argv[1] if len(sys.argv) > 1 else "test-output/export/지도안.hwpx"
doc = HwpxDocument.open(path)
report = doc.validate()
print("검사한 파일:", ", ".join(report.validated_parts))
if report.issues:
    print("문제:", *report.issues, sep="\n- ")
    sys.exit(1)
print("스키마 문제 없음")
print(doc.export_text()[:500])
