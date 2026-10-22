// 공유 보관함 (가이드 §9.2-4-1): 다른 선생님이 공유한 자료·지도안 열람, 과목 필터, 내 보관함으로 복제
import { useState } from "react";
import { KindTabs, RecordList } from "./LibraryPage";

export default function SharedPage() {
  const [kind, setKind] = useState<"materials" | "lessonPlans">("lessonPlans");
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">공유 보관함</h1>
        <p className="mt-1 text-sm text-stone-600">
          선생님들이 공유한 자료입니다. 열어 보고 마음에 들면 내 보관함으로
          복제해 고쳐 쓰세요. 원본은 바뀌지 않습니다.
        </p>
      </div>
      <KindTabs kind={kind} onChange={setKind} />
      <RecordList key={kind} kind={kind} scope="shared" />
    </section>
  );
}
