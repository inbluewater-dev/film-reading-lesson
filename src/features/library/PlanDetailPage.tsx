// 수업지도안 상세: 내 것이면 편집·저장·공유, 공유받은 것이면 보기·복제
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth, useServices } from "../../app/AuthContext";
import { useCatalog } from "../../app/CatalogContext";
import { Alert, Button, errorMessage } from "../../components/ui";
import type { LessonPlanRecord } from "../../lib/library/types";
import { PlanEditor } from "../lessonplan/PlanEditor";

export default function PlanDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { library } = useServices();
  const catalog = useCatalog();
  const navigate = useNavigate();
  const [p, setP] = useState<LessonPlanRecord | null>(null);
  const [msg, setMsg] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);

  useEffect(() => {
    library.lessonPlans
      .get(id!)
      .then(setP, (e) => setMsg({ tone: "error", text: errorMessage(e) }));
  }, [id, library]);
  if (!p)
    return msg ? (
      <Alert>{msg.text}</Alert>
    ) : (
      <p className="text-sm text-stone-500">불러오는 중…</p>
    );
  const mine = p.ownerUid === user?.uid;

  const run = (fn: () => Promise<LessonPlanRecord>, ok: string) => async () => {
    try {
      setP(await fn());
      setMsg({ tone: "success", text: ok });
    } catch (e) {
      setMsg({ tone: "error", text: errorMessage(e) });
    }
  };
  const {
    title,
    objectives,
    overview,
    events,
    rubric,
    worksheet,
    lessonMinutes,
    reviewedByTeacher,
  } = p;

  return (
    <section className="space-y-6">
      <Link
        to={mine ? "/library" : "/shared"}
        className="text-sm text-stone-600 underline"
      >
        ← {mine ? "내 보관함" : "공유 보관함"}
      </Link>
      {!mine && (
        <p className="text-sm text-stone-600">
          {p.ownerDisplayName}님이 공유한 지도안입니다. 고치려면 내 보관함으로
          복제하세요.
        </p>
      )}
      <PlanEditor
        value={p}
        onChange={(v) => setP({ ...p, ...v })}
        catalog={catalog}
        readOnly={!mine}
      />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {mine ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={p.reviewedByTeacher}
              onChange={() =>
                setP({ ...p, reviewedByTeacher: !p.reviewedByTeacher })
              }
            />
            지도안을 검토했습니다
          </label>
          <Button
            onClick={run(
              () =>
                library.lessonPlans.update(p.id, {
                  title,
                  objectives,
                  overview,
                  events,
                  rubric,
                  worksheet,
                  lessonMinutes,
                  reviewedByTeacher,
                }),
              "저장했습니다.",
            )}
          >
            저장
          </Button>
          <Button
            variant="secondary"
            onClick={run(
              () =>
                library.lessonPlans.setVisibility(
                  p.id,
                  p.visibility === "shared" ? "private" : "shared",
                ),
              p.visibility === "shared"
                ? "공유를 취소했습니다."
                : "공유 보관함에 올렸습니다.",
            )}
          >
            {p.visibility === "shared" ? "공유 취소" : "공유 보관함에 올리기"}
          </Button>
        </div>
      ) : (
        <Button
          onClick={async () => {
            try {
              const c = await library.lessonPlans.copy(p.id);
              navigate(`/library/plan/${c.id}`);
            } catch (e) {
              setMsg({ tone: "error", text: errorMessage(e) });
            }
          }}
        >
          내 보관함으로 복제
        </Button>
      )}
    </section>
  );
}
