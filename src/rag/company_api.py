"""Internal-company endpoints: SYNTHETIC Goldman Stanley data (company.duckdb from company.py) vs the job market (rag.duckdb).

In serve.py:  from company_api import router; app.include_router(router)
Env: COMPANY_DB (default company.duckdb), RAG_DB (default rag.duckdb). Both opened read-only.
`function` = FN_* code, function name / job_family (case-insensitive), or a fragment of it ('Risk').
"Active" = hired on or before _meta.as_of (last date in the data) and not exited before it.
"""
import os
from typing import Optional

import duckdb
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()
co = duckdb.connect(os.environ.get("COMPANY_DB", "company.duckdb"), read_only=True,
                    config={"enable_external_access": False})
rag = duckdb.connect(os.environ.get("RAG_DB", "rag.duckdb"), read_only=True)
SOURCE, AS_OF = co.execute("SELECT source, as_of FROM _meta").fetchall()[0]

EMP = """SELECT e.employee_id, e.job_id, e.country, e.grade, e.fte FROM employees e
    JOIN job_architecture j ON j.job_id = e.job_id
    WHERE list_contains($fns::VARCHAR[], j.department_id) AND e.hire_date <= $as_of
      AND (e.exit_date IS NULL OR e.exit_date >= $as_of)
      AND ($title::VARCHAR IS NULL OR lower(j.job_title) = lower($title) OR lower(j.base_title) = lower($title))"""


class ProfileReq(BaseModel):
    function: Optional[str] = None


class GapReq(BaseModel):
    function: Optional[str] = None
    job_title: Optional[str] = None
    k: int = Field(15, ge=1, le=100)


def resolve(c, function):
    """[(FN code, name)] for the requested function; all functions when omitted."""
    base = "SELECT department_id, name FROM departments WHERE org_level = 2"
    if not function:
        return c.execute(base + " ORDER BY 1").fetchall()
    f = function.strip().lower()
    exact = c.execute(base + """ AND (lower(department_id) IN ($f, 'fn_' || $f) OR lower(name) = $f
        OR department_id IN (SELECT department_id FROM job_architecture WHERE lower(job_family) = $f))
        ORDER BY 1""", {"f": f}).fetchall()
    return exact or c.execute(base + " AND contains(lower(name), $f) ORDER BY 1", {"f": f}).fetchall()


def rows(res, cols):
    return [dict(zip(cols, r)) for r in res]


@router.post("/company_profile")
def company_profile(r: ProfileReq):
    with co.cursor() as c:
        fns = resolve(c, r.function)
        if not fns:
            return {"synthetic": True, "error": f"unknown function: {r.function}"}
        p = {"fns": [f for f, _ in fns], "as_of": AS_OF, "title": None}
        q = lambda sql: c.execute(f"WITH emp AS ({EMP}) {sql}", p).fetchall()
        n, fte = q("SELECT count(*), round(sum(fte), 1) FROM emp")[0]
        if not n:
            return {"synthetic": True, "error": "no active employees match"}
        by_country = q("SELECT country, count(*) FROM emp GROUP BY 1 ORDER BY 2 DESC")
        by_grade = q("SELECT grade, count(*) FROM emp GROUP BY 1 ORDER BY 1")
        ai = """FROM ai_usage_logs WHERE date > $as_of - INTERVAL 90 DAY AND department_id IN
                (SELECT department_id FROM departments WHERE list_contains($fns::VARCHAR[], parent))"""
        ai_tot = q(f"SELECT sum(requests), round(sum(cost_eur), 2), sum(input_tokens + output_tokens) {ai}")[0]
        ai_tool = q(f"""SELECT tool, sum(requests), round(sum(active_users) / 90, 1), round(sum(cost_eur), 2)
                        {ai} GROUP BY 1 ORDER BY 2 DESC""")
        ai_uc = q(f"""SELECT tool, use_case, sum(requests), round(sum(active_users) / 90, 1),
                      round(sum(cost_eur), 2) {ai} GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 10""")
        ai_course = """FROM learning_records l JOIN courses k ON k.course_id = l.course_id
            WHERE k.is_ai_related AND l.status = 'completed' AND l.employee_id IN (SELECT employee_id FROM emp)"""
        trained = q(f"SELECT count(DISTINCT l.employee_id) {ai_course}")[0][0]
        courses = q(f"""SELECT k.course_title, count(DISTINCT l.employee_id) {ai_course}
                        GROUP BY 1 ORDER BY 2 DESC LIMIT 8""")
        req = """FROM recruiting_records r JOIN job_architecture j ON j.job_id = r.job_id
                 WHERE list_contains($fns::VARCHAR[], j.department_id)"""
        req_status = q(f"SELECT status, count(*), sum(positions) {req} GROUP BY 1 ORDER BY 2 DESC")
        req_open = q(f"""SELECT j.job_title, r.country, r.opened_date, r.positions {req} AND r.status = 'open'
                         ORDER BY r.opened_date""")
    return {
        "synthetic": True, "source": SOURCE, "as_of": AS_OF,
        "functions": rows(fns, ["function_code", "function"]),
        "active_headcount": n, "active_fte": fte,
        "by_country": rows(by_country, ["country", "headcount"]),
        "by_grade": rows(by_grade, ["grade", "headcount"]),
        "ai_usage_last_90d": {
            "requests": ai_tot[0], "cost_eur": ai_tot[1], "tokens": ai_tot[2],
            "note": "avg_daily_active_users sums per-row unique users (can double-count people using several tools/models)",
            "by_tool": rows(ai_tool, ["tool", "requests", "avg_daily_active_users", "cost_eur"]),
            "top_use_cases": rows(ai_uc, ["tool", "use_case", "requests", "avg_daily_active_users", "cost_eur"]),
        },
        "learning": {
            "ai_course_completed_share": round(trained / n, 3),
            "ai_courses": rows(courses, ["course_title", "active_employees_completed"]),
        },
        "recruiting": {
            "requisitions_by_status": rows(req_status, ["status", "n", "positions"]),
            "open_requisitions": rows(req_open, ["job_title", "country", "opened_date", "positions"]),
        },
    }


@router.post("/skill_gap")
def skill_gap(r: GapReq):
    with co.cursor() as c:
        fns = resolve(c, r.function)
        if not fns:
            return {"synthetic": True, "error": f"unknown function: {r.function}"}
        p = {"fns": [f for f, _ in fns], "as_of": AS_OF, "title": r.job_title}
        q = lambda sql: c.execute(f"WITH emp AS ({EMP}) {sql}", p).fetchall()
        n_emp = q("SELECT count(*) FROM emp")[0][0]
        if not n_emp:
            return {"synthetic": True, "error": "no active employees match"}
        internal = dict(q("""SELECT s.skill, count(DISTINCT emp.employee_id) FROM emp
            JOIN job_skill_esco s ON s.job_id = emp.job_id WHERE s.skill IS NOT NULL GROUP BY 1"""))
        # market skill -> active employees whose job has an equivalent internal skill (exact, mapped or skill_equiv)
        equiv = dict(q("""SELECT x.market_skill, count(DISTINCT emp.employee_id) FROM emp
            JOIN job_skills j ON j.job_id = emp.job_id
            JOIN (SELECT market_skill, internal_skill FROM skill_equiv UNION
                  SELECT skill, skill_name FROM job_skill_esco WHERE skill IS NOT NULL) x
              ON x.internal_skill = j.skill_name GROUP BY 1"""))
        tmap = q("""SELECT job_title, market_title_norm, n_postings, round(score, 3) FROM title_map
            WHERE job_title IN (SELECT base_title FROM job_architecture WHERE job_id IN (SELECT job_id FROM emp))
            ORDER BY job_title, score DESC""")
    norms = sorted({m for _, m, _, _ in tmap})
    seg = "SELECT vacancy_id FROM postings WHERE list_contains(?::VARCHAR[], title_norm)"
    with rag.cursor() as c:
        n_post = c.execute(f"SELECT count(*) FROM ({seg})", [norms]).fetchall()[0][0]
        market = c.execute(f"""SELECT skill, count(DISTINCT vacancy_id), arg_max(vacancy_id, score),
            arg_max(evidence, score) FROM posting_skills WHERE vacancy_id IN ({seg}) GROUP BY 1""",
                           [norms]).fetchall()
    out = {s: {"skill": s, "market_share": round(n / n_post, 3) if n_post else 0.0, "market_n_postings": n,
               "example_vacancy_id": v, "evidence": e} for s, n, v, e in market}
    for s, d in out.items():
        if s in equiv:
            d["internal_share"] = round(equiv[s] / n_emp, 3)
    for s, k in internal.items():
        out.setdefault(s, {"skill": s, "market_share": 0.0, "market_n_postings": 0,
                           "internal_share": round(k / n_emp, 3)})
    for d in out.values():
        d.setdefault("internal_share", 0.0)
        d["gap"] = round(d["market_share"] - d["internal_share"], 3)
    items = sorted(out.values(), key=lambda d: -d["gap"])
    return {
        "synthetic": True, "source": SOURCE, "as_of": AS_OF,
        "functions": rows(fns, ["function_code", "function"]), "job_title": r.job_title,
        "n_active_employees": n_emp, "market_n_postings": n_post,
        "market_titles": rows(tmap, ["base_title", "market_title_norm", "n_postings", "score"]),
        "gaps": [d for d in items if d["gap"] > 0][:r.k],
        "strengths": [d for d in reversed(items) if d["gap"] < 0][:r.k],
    }
