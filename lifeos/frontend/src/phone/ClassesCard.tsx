// Your classes this year: teachers, grades, quizzes you've played, and what's coming up.
import React, { useEffect, useState } from "react";
import { ClassesView, phoneApi } from "./api";
import { cx } from "./kit";

export default function ClassesCard() {
  const [v, setV] = useState<ClassesView | null>(null);
  useEffect(() => {
    phoneApi.classes().then(setV).catch(() => setV(null));
  }, []);
  if (!v) return null;
  const next = v.upcoming[0];
  return (
    <>
      <div className="ph-section-t">Classes</div>
      <div className="ph-card cl-card">
        <div className="cl-top">
          <div><b>{v.gpa.toFixed(2)}</b><small>GPA</small></div>
          {next && (
            <div className="cl-next">
              <small>Next up</small>
              <b>{next.name}</b>
              <span>{next.in_days === 0 ? "today" : next.in_days === 1 ? "tomorrow" : `in ${next.in_days} days`}</span>
            </div>
          )}
        </div>
        <div className="cl-list">
          {v.classes.map((c) => (
            <div key={c.id} className="cl-row">
              <div className="cl-m">
                <b>{c.name}</b>
                <span>
                  {c.teacher}{c.quizzes ? ` · ${c.quizzes} quiz${c.quizzes === 1 ? "" : "zes"} played (${c.quiz_avg}%)` : ""}
                  {c.games ? ` · class games ${c.games_won}/${c.games}` : ""}
                </span>
              </div>
              <span className={cx("cl-grade", c.letter[0] === "A" ? "a" : c.letter[0] === "B" ? "b" : c.letter[0] === "C" ? "c" : "d")}>{c.letter}</span>
            </div>
          ))}
        </div>
        {v.electives && v.electives.length > 0 && (
          <div className="cl-elective">
            <span className="ph-dim small">Your elective</span>
            <select className="ph-input" value={v.elective || v.classes.find((c) => c.id === "elective")?.name || ""}
              onChange={(e) => phoneApi.pickElective(e.target.value).then(setV).catch(() => undefined)}>
              {v.electives.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
        <p className="ph-dim small" style={{ margin: "10px 0 0" }}>
          On quiz and test days you can take it yourself: a good round raises your score, and a bad one never drops it below
          what your studying earned. Most other days a teacher throws something quick at the class. Going for it nudges that grade a little.
          {v.parents_expect != null && ` Your parents hope for about a ${v.parents_expect.toFixed(1)}; they only ground you for a real drop or a GPA under 2.0.`}
        </p>
      </div>
      {v.college && (
        <>
          <div className="ph-section-t">Where you'd get in</div>
          <div className="ph-card cl-card">
            <p className="ph-dim small" style={{ marginTop: 0 }}>
              Your odds today: your GPA plus what's on your resume{v.college.resume.length ? ` (${v.college.resume.join(", ")}: worth about +${v.college.bonus.toFixed(2)})` : ""}.
              Senior spring, the letters come.
            </p>
            <div className="cl-list">
              {v.college.schools.map((r) => (
                <div key={r.name} className="cl-row">
                  <div className="cl-m"><b>{r.name}</b><span>looks for about a {r.bar.toFixed(1)}</span></div>
                  <span className={cx("cl-grade", r.odds >= 60 ? "a" : r.odds >= 30 ? "b" : r.odds >= 10 ? "c" : "d")}>{r.odds}%</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
