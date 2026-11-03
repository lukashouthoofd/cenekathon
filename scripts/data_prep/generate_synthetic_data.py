"""Generate a fully SYNTHETIC internal dataset for a fictional bank: "Northwind Bank (synthetic)".

Everything written to data/synthetic/ is invented. Only two things are grounded in real public data:
  * job titles: frequent normalised vacancy titles at banking employers (data/processed/vacancies_text.parquet)
  * ESCO skill URIs / ESCO occupation URIs + ISCO-08 codes: exact label matches against local ESCO files
    (data/external/skills.csv, data/external/raw/esco/occupation_*.json.gz). No codes are invented.

Run:  py -I scripts/generate_synthetic_data.py      (seeded, re-runnable, ~1 min)
"""
from __future__ import annotations

import calendar
import glob
import gzip
import json
import math
import os
import random
import re
from datetime import date, timedelta

import duckdb
import numpy as np
import pandas as pd

SEED = 20260901
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "synthetic")
VAC = os.path.join(ROOT, "data", "processed", "vacancies_text.parquet")
ESCO_SKILLS = os.path.join(ROOT, "data", "external", "skills.csv")
ESCO_OCC_GLOB = os.path.join(ROOT, "data", "external", "raw", "esco", "occupation_*.json.gz")

START = date(2023, 1, 1)
END = date(2026, 9, 30)
COMPANY = "Northwind Bank (synthetic)"

rng = np.random.default_rng(SEED)
rnd = random.Random(SEED)


def months():
    y, m = START.year, START.month
    while (y, m) <= (END.year, END.month):
        yield y, m
        m += 1
        if m == 13:
            y, m = y + 1, 1


MONTHS = list(months())
NM = len(MONTHS)


def eom(y, m):
    return date(y, m, calendar.monthrange(y, m)[1])


def rand_day(y, m):
    return date(y, m, rnd.randint(1, calendar.monthrange(y, m)[1]))


def logistic(x):
    return 1.0 / (1.0 + math.exp(-x))


# --------------------------------------------------------------------------------------------
# 1. Organisation: divisions -> functions -> country teams
# --------------------------------------------------------------------------------------------
# function_key: (name, division, base_headcount_2023, monthly_exit_rate, trend_end_multiplier,
#                country_split, ai_adoption_cap, adoption_midpoint_month_index)
DIVISIONS = {
    "DIV_RET": "Retail Banking",
    "DIV_CWB": "Corporate, Commercial & Wealth",
    "DIV_TEC": "Technology & Data",
    "DIV_OPS": "Operations",
    "DIV_RSK": "Risk, Compliance & Audit",
    "DIV_COR": "Corporate Functions",
}
STD = {"GB": .45, "NL": .30, "BE": .15, "LU": .10}
FUNCTIONS = {
    "CSC": ("Customer Service & Contact Centre", "DIV_RET", 1350, .016, .82, {"GB": .5, "NL": .3, "BE": .2}, .85, 16),
    "BRM": ("Branch Network & Mortgages", "DIV_RET", 650, .010, .88, {"GB": .5, "NL": .25, "BE": .25}, .50, 22),
    "CBK": ("Corporate & Commercial Banking", "DIV_CWB", 520, .008, 1.00, STD, .65, 20),
    "WPB": ("Wealth & Private Banking", "DIV_CWB", 380, .007, 1.02, {"LU": .35, "GB": .30, "NL": .20, "BE": .15}, .55, 22),
    "SWE": ("Software Engineering", "DIV_TEC", 880, .010, 1.15, {"NL": .45, "GB": .35, "BE": .10, "LU": .10}, .95, 8),
    "DAI": ("Data, Analytics & AI", "DIV_TEC", 330, .011, 1.40, {"NL": .45, "GB": .40, "BE": .10, "LU": .05}, .97, 6),
    "INF": ("Infrastructure & Cloud", "DIV_TEC", 290, .009, 1.05, {"NL": .45, "GB": .35, "BE": .10, "LU": .10}, .90, 10),
    "CYB": ("Cyber Security", "DIV_TEC", 150, .009, 1.20, {"GB": .50, "NL": .35, "BE": .15}, .80, 14),
    "CHG": ("Change & Transformation", "DIV_TEC", 520, .010, 1.00, STD, .85, 14),
    "OPS": ("Banking Operations & Payments", "DIV_OPS", 880, .012, .90, {"GB": .40, "NL": .25, "BE": .15, "LU": .20}, .80, 16),
    "RSK": ("Risk Management", "DIV_RSK", 430, .008, 1.05, STD, .60, 24),
    "CMP": ("Compliance & Financial Crime", "DIV_RSK", 480, .010, 1.05, STD, .60, 24),
    "AUD": ("Internal Audit", "DIV_RSK", 115, .008, 1.00, STD, .55, 24),
    "LEG": ("Legal", "DIV_COR", 140, .007, 1.00, STD, .50, 26),
    "FIN": ("Finance & Treasury", "DIV_COR", 380, .008, 1.00, STD, .70, 20),
    "HRM": ("Human Resources", "DIV_COR", 190, .010, .97, STD, .70, 18),
    "MKT": ("Marketing & Communications", "DIV_COR", 145, .011, 1.00, {"GB": .5, "NL": .3, "BE": .2}, .80, 14),
    "OFC": ("Executive Office", "DIV_COR", 75, .007, 1.00, {"GB": .5, "NL": .3, "BE": .1, "LU": .1}, .60, 18),
}

# --------------------------------------------------------------------------------------------
# 2. Job architecture grounded in vacancy titles
# --------------------------------------------------------------------------------------------
BANK_RE = (r"(bank|banking|building society|\bing\b|abn amro|rabobank|kbc|belfius|bnp paribas|monzo|"
           r"barclays|natwest|santander|hsbc|lloyds|argenta|spuerkeess|bgl|triodos|volksbank)")
# ordered (function_key, regex on lower-case normalised title)
TITLE_RULES = [
    ("CYB", r"security|cyber|penetration|soc analyst"),
    ("DAI", r"data|machine learning|\bml\b|\bai\b|quantitative|analytics|reporting analyst|bi developer|statistic"),
    ("AUD", r"audit"),
    ("CMP", r"complian|financial crime|\baml\b|\bkyc\b|conduct|sanction|fraud"),
    ("RSK", r"risk|underwrit"),
    ("LEG", r"legal|lawyer|paralegal|counsel|solicitor"),
    ("FIN", r"financ|controller|treasur|accountant|fp&a|tax|product control"),
    ("HRM", r"\bhr\b|human resources|recruit|talent|people partner|reward|payroll|learning"),
    ("MKT", r"marketing|communications|brand|content|copywriter|social media"),
    ("WPB", r"wealth|private bank|investment|portfolio|beleggen"),
    ("CBK", r"relationship|corporate banking|business development|account manager|commercial|credit analyst|lending"),
    ("BRM", r"personal banker|branch|mortgage|hypothe|banking representative|associate banker|banking manager"),
    ("CSC", r"customer|member representative|complaints|contact centre|call centre|klantenservice"),
    ("INF", r"devops|site reliability|platform|cloud|infrastructure|network|database admin|ops engineer|systems engineer"),
    ("SWE", r"software|developer|engineer|architect|java|\.net|frontend|backend|full stack|tester|\bqa\b"),
    ("CHG", r"business analyst|project manager|programme manager|product owner|product manager|scrum|change manager|pmo|ux|designer|agile coach|delivery"),
    ("OPS", r"operations|payments|processing|onboarding|settlement|back office"),
    ("OFC", r"executive assistant|personal assistant|chief of staff|strategy"),
]
LEVEL_WORDS = r"^(remote|senior|sr\.?|lead|principal|junior|jr\.?|graduate|associate|assistant|staff|head of|chief|vp|avp)\s+"
FALLBACK_TITLES = {  # used only if the vacancy data yields < 3 titles for a function
    "OFC": ["Executive Assistant", "Strategy Analyst", "Chief of Staff"],
    "AUD": ["Internal Auditor", "IT Auditor", "Audit Manager"],
    "LEG": ["Legal Counsel", "Paralegal", "Contract Manager"],
    "HRM": ["HR Business Partner", "Recruiter", "Learning and Development Specialist"],
    "MKT": ["Marketing Manager", "Communications Specialist", "Content Designer"],
    "OPS": ["Operations Analyst", "Payments Operations Specialist", "KYC Operations Analyst"],
}
# levels: (code, prefix, grade band, weight in workforce, weight in hiring)
LEVELS_FRONT = [("L1", "", (3, 4), .70, .85), ("L2", "Senior ", (5, 6), .22, .12), ("L3", "Team Leader ", (7, 8), .08, .03)]
LEVELS_PROF = [("L2", "", (5, 6), .52, .62), ("L3", "Senior ", (7, 8), .32, .28), ("L4", "Lead ", (9, 10), .16, .10)]
FRONTLINE = {"CSC", "BRM", "OPS"}

# ESCO occupation candidates by keyword in job base title -> ESCO occupation title (exact label)
ESCO_OCC_HINTS = [
    (r"call centre|customer service|customer care|customer experience|customer advis|customer represent", "call centre agent"),
    (r"business analyst", "business analyst"),
    (r"accountant", "accountant"),
    (r"audit", "audit supervisor"),
    (r"personal banker|associate banker|banking representative", "bank account manager"),
    (r"branch manager|banking manager", "bank manager"),
    (r"treasur", "bank treasurer"),
    (r"actuar", "actuarial consultant"),
    (r"data officer", "chief data officer"),
    (r"software engineer|software developer", "software developer"),
    (r"data scientist", "data scientist"),
    (r"data analyst", "data analyst"),
    (r"data engineer", "data engineer"),
    (r"project manager|programme manager", "ICT project manager"),
    (r"product owner|product manager", "product manager"),
    (r"legal counsel", "legal adviser"),
    (r"compliance", "compliance officer"),
    (r"credit risk|risk analyst|risk manager", "risk manager"),
    (r"credit analyst", "credit analyst"),
    (r"financial analyst", "financial analyst"),
    (r"mortgage|hypothe", "mortgage broker"),
    (r"relationship manager|relationship director", "corporate banking manager"),
    (r"wealth|private banker", "wealth manager"),
    (r"recruit", "recruiter"),
    (r"security", "ICT security manager"),
    (r"devops|site reliability|platform engineer|cloud", "cloud engineer"),
    (r"scrum", "ICT project manager"),
    (r"solution architect|solutions architect|enterprise architect", "ICT system architect"),
]

# skills by function; (name, is_ai_related). Names chosen to match ESCO preferred labels where possible.
COMMON_SKILLS = [("teamwork principles", False), ("communicate in English in a competent way", False),
                 ("data protection", False), ("use generative AI assistants responsibly", True)]
FUNC_SKILLS = {
    "CSC": ["customer service", "handle customer complaints", "banking activities", "resolve banking issues", "active listening", "use a contact centre CRM"],
    "BRM": ["customer service", "mortgage loans", "assess mortgage risk", "examine mortgage loan documents", "banking activities", "achieve sales targets"],
    "CBK": ["business loans", "analyse loans", "decide on loan applications", "advise on credit rating", "interpret financial statements", "build business relationships"],
    "WPB": ["advise on investment", "develop investment portfolio", "financial products", "financial planning", "build business relationships"],
    "SWE": ["Java (computer programming)", "JavaScript", "Python (computer programming)", "Agile development", "DevOps", "SQL", ("AI-assisted software development", True)],
    "DAI": ["Python (computer programming)", "SQL", "perform data analysis", "data mining", "apply statistical analysis techniques",
            ("utilise machine learning", True), ("principles of artificial intelligence", True), ("large language model application development", True)],
    "INF": ["cloud technologies", "DevOps", "SQL Server", "network engineering", ("AIOps and LLM platform operations", True)],
    "CYB": ["cyber security", "identify ICT security risks", "ICT security standards", "cyber attack counter-measures", ("AI model security and red-teaming", True)],
    "CHG": ["analyse business processes", "business process modelling", "Agile project management", "ICT project management", "create prototype of user experience solutions", ("AI use-case identification", True)],
    "OPS": ["monitor banking activities", "improve business processes", "fraud detection", "accounting entries", ("intelligent document processing", True)],
    "RSK": ["analyse financial risk", "apply credit risk policy", "apply credit stress testing methodologies", "advise on risk management", ("AI model risk management", True)],
    "CMP": ["advise on legal compliance for participation in financial markets", "prevent fraudulent activities", "anti-money laundering screening", "comply with legal regulations", ("EU AI Act compliance", True)],
    "AUD": ["audit techniques", "check accounting records", "advise on risk management", ("auditing AI systems", True)],
    "LEG": ["comply with legal regulations", "compile legal documents", "advise on legal decisions", "contract law", ("EU AI Act compliance", True)],
    "FIN": ["accounting", "prepare financial statements", "interpret financial statements", "budgetary principles", "carry out statistical forecasts"],
    "HRM": ["recruit employees", "carry out recruiting services", "negotiate employment agreements", "skills-based workforce planning", ("AI in HR processes", True)],
    "MKT": ["apply social media marketing", "brand marketing techniques", "adapt to change in marketing", ("generative AI content creation", True)],
    "OFC": ["advise on communication strategies", "plan teamwork", "strategic planning"],
}
PROF_LABELS = {1: "awareness", 2: "basic", 3: "intermediate", 4: "advanced", 5: "expert"}


def load_vacancy_titles():
    con = duckdb.connect()
    q = f"""
        select title_clean, count(*) n, count(distinct company) nc
        from read_parquet('{VAC.replace(os.sep, '/')}')
        where regexp_matches(lower(company), '{BANK_RE}')
          and country in ('GB','NL','BE','LU')
          and not coalesce(is_duplicate, false)
          and title_clean is not null
        group by 1
    """
    df = con.execute(q).fetchdf()
    con.close()
    df = df[~df.title_clean.str.contains(r"[�?]", regex=True)]
    base = df.title_clean.str.strip()
    for _ in range(3):
        base = base.str.replace(LEVEL_WORDS, "", regex=True, flags=re.I)
    base = base.str.replace(r"\s*[-,(|/].*$", "", regex=True).str.strip()
    df = df.assign(base=base.str.title().str.replace(r"\bUx\b", "UX", regex=True).str.replace(r"\bHr\b", "HR", regex=True)
                   .str.replace(r"\bDevops\b", "DevOps", regex=True).str.replace(r"\bIt\b", "IT", regex=True)
                   .str.replace(r"\bKyc\b", "KYC", regex=True).str.replace(r"\bAdviser\b", "Advisor", regex=True))
    df = df[~df.base.isin(["Customer Service", "Operations"])]
    g = df.groupby("base").agg(n=("n", "sum"), nc=("nc", "max")).reset_index()
    g = g[(g.nc >= 5) & (g.base.str.len().between(5, 40)) & (g.base.str.split().str.len().between(2, 4))
          & ~g.base.str.contains("Chapter|Counsel$", regex=True) | g.base.eq("Legal Counsel")]
    generic = {"Manager", "Senior Manager", "Analyst", "Associate Director", "Director", "Team Lead", "Team Leader",
               "Business Manager", "Specialist", "Consultant", "Engineer", "Officer", "Vice President", "Intern"}
    g = g[~g.base.isin(generic)]
    rows = []
    for _, r in g.iterrows():
        t = r.base.lower()
        for fk, pat in TITLE_RULES:
            if re.search(pat, t):
                rows.append((fk, r.base, int(r.n)))
                break
    m = pd.DataFrame(rows, columns=["fk", "base", "n"]).sort_values("n", ascending=False)
    picked = {}
    for fk in FUNCTIONS:
        sub = m[m.fk == fk].head(6 if fk in ("CSC", "SWE", "DAI", "CHG", "RSK", "CMP") else 4)
        lst = list(zip(sub.base, sub.n))
        if len(lst) < 3:
            have = {b for b, _ in lst}
            lst += [(t, 0) for t in FALLBACK_TITLES.get(fk, []) if t not in have][: 3 - len(lst)]
        picked[fk] = lst
    return picked


def load_esco():
    occ = {}
    for f in glob.glob(ESCO_OCC_GLOB):
        try:
            d = json.load(gzip.open(f))
        except Exception:
            continue
        for x in d.get("_embedded", {}).get("results", []):
            if x.get("title") and x.get("uri"):
                occ[x["title"].lower()] = (x["uri"], x.get("code") or "")
    sk = {}
    if os.path.exists(ESCO_SKILLS):
        s = pd.read_csv(ESCO_SKILLS, usecols=["skill_uri", "preferred_label_en", "alt_labels_en"])
        for uri, lab, alts in s.itertuples(index=False):
            if isinstance(alts, str):
                for a in alts.split("|"):
                    sk.setdefault(a.strip().lower(), (uri, lab))
        for uri, lab, _ in s.itertuples(index=False):
            if isinstance(lab, str):
                sk[lab.lower()] = (uri, lab)
    return occ, sk


# --------------------------------------------------------------------------------------------
def main():
    os.makedirs(OUT, exist_ok=True)
    picked = load_vacancy_titles()
    occ, esco_sk = load_esco()

    # ---- departments
    dep_rows = [("NWB", f"{COMPANY} Group", "", "GROUP", 0)]
    for k, v in DIVISIONS.items():
        dep_rows.append((k, v, "NWB", "GROUP", 1))
    teams = []  # (team_id, fk, country, base_hc)
    for fk, (name, div, base, *_rest) in FUNCTIONS.items():
        fid = f"FN_{fk}"
        dep_rows.append((fid, name, div, "GROUP", 2))
        split = _rest[2]
        for c, sh in split.items():
            tid = f"T_{fk}_{c}"
            dep_rows.append((tid, f"{name} {c}", fid, c, 3))
            teams.append((tid, fk, c, base * sh))
    departments = pd.DataFrame(dep_rows, columns=["department_id", "name", "parent", "country", "org_level"])

    # ---- job architecture
    job_rows, job_weights = [], {}
    jid = 0
    for fk, titles in picked.items():
        levels = LEVELS_FRONT if fk in FRONTLINE else LEVELS_PROF
        tot = sum(math.sqrt(max(n, 20)) for _, n in titles)
        for base, n in titles:
            esco_title = next((t for pat, t in ESCO_OCC_HINTS if re.search(pat, base.lower())), None)
            uri, code = occ.get(esco_title.lower(), ("", "")) if esco_title else ("", "")
            isco = code.split(".")[0] if code else ""
            for lvl, pre, (g0, g1), w_wf, w_hire in levels:
                jid += 1
                job_id = f"J{jid:04d}"
                job_rows.append((job_id, f"{pre}{base}".strip(), FUNCTIONS[fk][0], base, lvl, f"G{g0:02d}-G{g1:02d}",
                                 f"FN_{fk}", isco, uri, esco_title if uri else "", n))
                job_weights[job_id] = (fk, math.sqrt(max(n, 20)) / tot * w_wf, math.sqrt(max(n, 20)) / tot * w_hire, g0, g1)
        jid += 1
        job_id = f"J{jid:04d}"
        job_rows.append((job_id, f"Head of {FUNCTIONS[fk][0]}", FUNCTIONS[fk][0], "Head of function", "L5", "G11-G12",
                         f"FN_{fk}", "", "", "", 0))
        job_weights[job_id] = (fk, .006, .002, 11, 12)
    jobs = pd.DataFrame(job_rows, columns=["job_id", "job_title", "job_family", "base_title", "job_level", "grade_band",
                                           "department_id", "isco08_code", "esco_uri", "esco_occupation_label",
                                           "source_vacancy_count"])

    # ---- job skills
    js_rows = []
    for j in jobs.itertuples():
        fk = j.department_id[3:]
        lvl = int(j.job_level[1])
        skills = [(s, False) if isinstance(s, str) else s for s in FUNC_SKILLS[fk]] + COMMON_SKILLS
        for name, is_ai in skills:
            hit = esco_sk.get(name.lower())
            uri, label = (hit if hit else ("", name))
            prof = int(np.clip(lvl + (0 if not is_ai else -1) + rnd.choice([0, 0, 1, -1]), 1, 5))
            js_rows.append((j.job_id, label, uri, prof, PROF_LABELS[prof], "core" if not is_ai else "emerging", is_ai))
    job_skills = pd.DataFrame(js_rows, columns=["job_id", "skill_name", "skill_uri", "proficiency_level",
                                                "proficiency_label", "skill_category", "is_ai_related"])

    # ---- employees: monthly stock-flow simulation per team
    jobs_by_fk = {}
    for job_id, (fk, w_wf, w_hire, g0, g1) in job_weights.items():
        jobs_by_fk.setdefault(fk, []).append((job_id, w_wf, w_hire, g0, g1))

    def pick_job(fk, hire=False):
        lst = jobs_by_fk[fk]
        w = np.array([x[2] if hire else x[1] for x in lst])
        x = lst[rng.choice(len(lst), p=w / w.sum())]
        return x[0], f"G{rnd.randint(x[3], x[4]):02d}"

    emps = []  # dicts
    nid = [0]

    def new_emp(tid, fk, c, hire_date, hire=False):
        nid[0] += 1
        job_id, grade = pick_job(fk, hire)
        part_p = {"NL": .30, "BE": .18, "GB": .12, "LU": .10}[c]
        fte = 1.0 if rnd.random() > part_p else rnd.choice([.5, .6, .8, .8, .9])
        e = {"employee_id": f"EMP{nid[0]:06d}", "job_id": job_id, "department_id": tid, "country": c, "grade": grade,
             "hire_date": hire_date, "exit_date": None, "fte": fte}
        emps.append(e)
        return e

    active = {}
    for tid, fk, c, base in teams:
        active[tid] = []
        for _ in range(int(round(base))):
            tenure_days = int(min(rng.exponential(7.5 * 365) + 30, 33 * 365))
            active[tid].append(new_emp(tid, fk, c, START - timedelta(days=tenure_days)))

    for mi, (y, m) in enumerate(MONTHS):
        frac = mi / (NM - 1)
        for tid, fk, c, base in teams:
            _, _, _, rate, trend, *_ = FUNCTIONS[fk]
            seasonal = 1.25 if m in (1, 9) else (0.8 if m in (7, 8, 12) else 1.0)
            # trend kicks in from 2024 onward (AI-driven restructuring in contact centre etc.)
            tf = 1 + (trend - 1) * max(0.0, (frac - 0.2) / 0.8)
            target = base * tf * (1 + rng.normal(0, 0.004))
            still = []
            for e in active[tid]:
                if rnd.random() < rate * seasonal:
                    d = rand_day(y, m)
                    e["exit_date"] = max(d, e["hire_date"] + timedelta(days=1))
                else:
                    still.append(e)
            n_hire = max(0, int(round(target - len(still) + rng.normal(0, 0.6))))
            for _ in range(n_hire):
                still.append(new_emp(tid, fk, c, rand_day(y, m), hire=True))
            active[tid] = still

    employees = pd.DataFrame(emps)
    employees["is_synthetic"] = True

    # ---- headcount monthly (derived from employees so it is consistent by construction)
    emp_hire = pd.to_datetime(employees.hire_date)
    emp_exit = pd.to_datetime(employees.exit_date)
    hc_parts = []
    for y, m in MONTHS:
        me = pd.Timestamp(eom(y, m))
        ms = pd.Timestamp(date(y, m, 1))
        act = (emp_hire <= me) & (emp_exit.isna() | (emp_exit > me))
        hired = (emp_hire >= ms) & (emp_hire <= me)
        exited = (emp_exit >= ms) & (emp_exit <= me)
        sub = employees.assign(headcount=act.astype(int), fte_a=np.where(act, employees.fte, 0.0),
                               hires=hired.astype(int), exits=exited.astype(int))
        sub = sub[act | hired | exited]
        g = sub.groupby(["department_id", "job_id", "country"], as_index=False)[["headcount", "fte_a", "hires", "exits"]].sum()
        g.insert(0, "month", f"{y:04d}-{m:02d}")
        hc_parts.append(g)
    headcount = pd.concat(hc_parts, ignore_index=True).rename(columns={"fte_a": "fte"})
    headcount["fte"] = headcount.fte.round(2)
    team_month_hc = headcount.groupby(["month", "department_id"]).headcount.sum().to_dict()

    # ---- AI usage logs (daily, per team x tool x model x use case)
    usage = gen_ai_usage(teams, team_month_hc)

    # ---- courses + learning
    courses, learning = gen_learning(employees, jobs)

    # ---- recruiting
    recruiting = gen_recruiting(employees, jobs)

    # ---- model price reference (approximate public list prices, as used for cost_eur)
    pricing = pd.DataFrame([(mdl, VENDOR[mdl], frm.isoformat(), pin, pout) for mdl, sched in MODELS.items() for frm, pin, pout in sched],
                           columns=["model", "model_provider", "valid_from", "list_price_usd_per_1m_input", "list_price_usd_per_1m_output"])
    pricing["fx_usd_eur"] = FX_USD_EUR
    pricing["note"] = "approximate public list price; enterprise discount applied on top in ai_usage_logs"

    # ---- write
    for name, df in [("model_pricing", pricing), ("departments", departments), ("job_architecture", jobs), ("job_skills", job_skills),
                     ("employees", employees), ("headcount_monthly", headcount), ("ai_usage_logs", usage),
                     ("courses", courses), ("learning_records", learning), ("recruiting_records", recruiting)]:
        df = df.copy()
        df["is_synthetic"] = True
        for col in df.columns:
            if df[col].dtype == object and len(df) and isinstance(df[col].dropna().iloc[0] if df[col].notna().any() else "", date):
                df[col] = df[col].map(lambda d: d.isoformat() if isinstance(d, date) else "")
        df.to_csv(os.path.join(OUT, f"{name}.csv"), index=False, encoding="utf-8", lineterminator="\n")
        print(f"{name:20s} {len(df):>9,d} rows")


# --------------------------------------------------------------------------------------------
# AI usage
# --------------------------------------------------------------------------------------------
# Approximate public list prices, USD per 1M tokens (input, output). Approximations only.
# price schedule: list of (from_date, in, out)
MODELS = {
    "gpt-3.5-turbo": [(date(2023, 1, 1), 1.5, 2.0), (date(2023, 11, 6), 1.0, 2.0), (date(2024, 1, 25), 0.5, 1.5)],
    "gpt-4": [(date(2023, 1, 1), 30.0, 60.0)],
    "gpt-4-turbo": [(date(2023, 11, 6), 10.0, 30.0)],
    "gpt-4o": [(date(2024, 5, 13), 5.0, 15.0), (date(2024, 10, 1), 2.5, 10.0)],
    "gpt-4o-mini": [(date(2024, 7, 18), 0.15, 0.60)],
    "gpt-4.1": [(date(2025, 4, 14), 2.0, 8.0)],
    "gpt-4.1-mini": [(date(2025, 4, 14), 0.40, 1.60)],
    "claude-3.5-sonnet": [(date(2024, 6, 20), 3.0, 15.0)],
    "claude-3-haiku": [(date(2024, 3, 13), 0.25, 1.25)],
    "claude-sonnet-4": [(date(2025, 5, 22), 3.0, 15.0)],
    "claude-sonnet-4.5": [(date(2025, 9, 29), 3.0, 15.0)],
    "claude-haiku-4.5": [(date(2025, 10, 15), 1.0, 5.0)],
    "llama-3.1-70b-selfhosted": [(date(2024, 9, 1), 0.60, 0.60)],  # internal amortised GPU cost estimate
}
VENDOR = {k: ("OpenAI (via cloud)" if k.startswith("gpt") else "Anthropic (via cloud)" if k.startswith("claude")
              else "Self-hosted open-weight") for k in MODELS}
# tool -> list of (model, from, to, share-weight)
TOOL_MODELS = {
    "chat assistant": [("gpt-3.5-turbo", date(2023, 3, 1), date(2024, 3, 31), 1.0), ("gpt-4", date(2023, 6, 1), date(2024, 2, 29), 0.6),
                       ("gpt-4-turbo", date(2024, 1, 1), date(2024, 7, 31), 1.0), ("gpt-4o", date(2024, 6, 1), date(2025, 7, 31), 1.0),
                       ("gpt-4.1", date(2025, 6, 1), date(2026, 9, 30), 1.0), ("claude-sonnet-4", date(2025, 7, 1), date(2026, 9, 30), 0.7)],
    "coding assistant": [("gpt-4", date(2023, 5, 1), date(2024, 1, 31), 1.0), ("gpt-4-turbo", date(2023, 12, 1), date(2024, 8, 31), 1.0), ("claude-3.5-sonnet", date(2024, 7, 15), date(2025, 7, 31), 1.0),
                         ("claude-sonnet-4", date(2025, 6, 15), date(2025, 12, 31), 1.0), ("claude-sonnet-4.5", date(2025, 10, 15), date(2026, 9, 30), 1.2),
                         ("gpt-4.1", date(2025, 6, 1), date(2026, 9, 30), 0.4)],
    "API": [("gpt-3.5-turbo", date(2023, 9, 1), date(2024, 10, 31), 1.0), ("gpt-4o-mini", date(2024, 8, 1), date(2025, 12, 31), 1.0),
            ("claude-3-haiku", date(2024, 4, 1), date(2025, 6, 30), 0.5), ("llama-3.1-70b-selfhosted", date(2024, 10, 1), date(2026, 9, 30), 0.6),
            ("gpt-4.1-mini", date(2025, 5, 1), date(2026, 9, 30), 1.0), ("claude-haiku-4.5", date(2025, 11, 1), date(2026, 9, 30), 0.8)],
}
CHAT_UC = {"default": ["drafting & rewriting", "summarisation", "research & Q&A"],
           "CSC": ["customer reply drafting", "knowledge-base Q&A", "summarisation"],
           "BRM": ["customer reply drafting", "product & policy Q&A", "summarisation"],
           "LEG": ["contract review", "legal research", "drafting & rewriting"],
           "CMP": ["policy & regulation Q&A", "case summarisation", "drafting & rewriting"],
           "RSK": ["credit memo drafting", "regulation Q&A", "data analysis"],
           "HRM": ["job description writing", "policy Q&A", "drafting & rewriting"],
           "MKT": ["content creation", "translation", "drafting & rewriting"],
           "DAI": ["data analysis", "code explanation", "research & Q&A"],
           "FIN": ["data analysis", "report drafting", "summarisation"],
           "AUD": ["audit evidence summarisation", "regulation Q&A", "drafting & rewriting"]}
API_UC = {"CSC": ("call & chat summarisation", 25), "OPS": ("document processing & extraction", 18),
          "CMP": ("KYC / adverse-media screening", 10), "DAI": ("RAG & analytics pipelines", 30),
          "BRM": ("mortgage document extraction", 8), "MKT": ("content localisation", 6), "HRM": ("CV & skills extraction", 5)}
CODING_FK = {"SWE", "DAI", "INF", "CYB"}
FX_USD_EUR = 0.92


def price_at(model, d):
    p = None
    for frm, pin, pout in MODELS[model]:
        if d >= frm:
            p = (pin, pout)
    return p


def enterprise_discount(d):
    # negotiated volume discount grows 0% (2023) -> 25% (2026)
    t = (d - START).days / (END - START).days
    return 0.25 * min(1.0, max(0.0, (t - 0.15) / 0.75))


def gen_ai_usage(teams, team_month_hc):
    rows = []
    n_days = (END - START).days + 1
    for tid, fk, c, _ in teams:
        cap, mid = FUNCTIONS[fk][6], FUNCTIONS[fk][7]
        chat_uc = CHAT_UC.get(fk, CHAT_UC["default"])
        uc_w = np.array([.5, .3, .2])
        for di in range(n_days):
            d = START + timedelta(days=di)
            mi = (d.year - 2023) * 12 + d.month - 1
            hc = team_month_hc.get((f"{d.year:04d}-{d.month:02d}", tid), 0)
            if hc == 0:
                continue
            wk = d.weekday() >= 5
            hol = (d.month == 12 and d.day >= 24) or (d.month == 1 and d.day == 1) or (d.month == 8)
            day_act = (0.04 if wk else 0.60) * (0.6 if hol else 1.0)
            # enterprise chat assistant: tech pilot 2023-03, general rollout 2023-09
            pilot = 1.0 if fk in CODING_FK else (0.0 if d < date(2023, 9, 1) else 1.0)
            adopt = cap * logistic((mi - mid) / 4.0) * pilot
            maturity = min(1.0, max(0.0, mi / NM))
            for tool in ("chat assistant", "coding assistant", "API"):
                if tool == "coding assistant" and fk not in CODING_FK:
                    continue
                if tool == "API" and fk not in API_UC:
                    continue
                if tool == "chat assistant":
                    users = hc * adopt * day_act
                elif tool == "coding assistant":
                    users = hc * cap * logistic((mi - 10) / 3.5) * day_act * (0.9 if fk in ("SWE", "DAI") else 0.5)
                else:
                    a = logistic((mi - 20) / 3.0)
                    users = hc * a * day_act * 0.8
                users = rng.poisson(max(users, 0)) if users < 50 else int(round(users * rng.normal(1, 0.05)))
                if users <= 0:
                    continue
                avail = [(mdl, w) for mdl, f, t, w in TOOL_MODELS[tool] if f <= d <= t and price_at(mdl, d)]
                if not avail:
                    continue
                ws = np.array([w for _, w in avail])
                # newer models gain share over time: tilt weight toward later in list
                ws = ws * np.linspace(1, 1 + 2 * maturity, len(ws))
                shares = rng.dirichlet(ws / ws.sum() * 40)
                for (mdl, _), sh in zip(avail, shares):
                    mu = max(1, int(round(users * sh)))
                    if tool == "chat assistant":
                        ucs = list(zip(chat_uc, uc_w))
                        rpu, tin, tout = 6 + 8 * maturity, 1200 + 2800 * maturity, 350 + 250 * maturity
                    elif tool == "coding assistant":
                        ucs = [("code completion & generation", .6), ("code review & tests", .25), ("agentic coding tasks", .15 * maturity + .001)]
                        rpu, tin, tout = 25 + 55 * maturity, 4000 + 14000 * maturity, 500 + 900 * maturity
                    else:
                        uc, per_user = API_UC[fk]
                        ucs = [(uc, 1.0)]
                        rpu, tin, tout = per_user * (1 + maturity), 2500 + 1500 * maturity, 300 + 100 * maturity
                    tot_w = sum(w for _, w in ucs)
                    for uc, w in ucs:
                        au = max(1, int(round(mu * w / tot_w)))
                        req = int(rng.poisson(au * rpu)) + 1
                        it = int(req * tin * rng.lognormal(0, 0.15))
                        ot = int(req * tout * rng.lognormal(0, 0.15))
                        pin, pout = price_at(mdl, d)
                        cost = (it * pin + ot * pout) / 1e6 * FX_USD_EUR * (1 - enterprise_discount(d))
                        rows.append((d.isoformat(), tid, fk, tool, mdl, VENDOR[mdl], uc, req, it, ot, round(cost, 4), au))
    return pd.DataFrame(rows, columns=["date", "department_id", "function_code", "tool", "model", "model_provider",
                                       "use_case", "requests", "input_tokens", "output_tokens", "cost_eur", "active_users"])


# --------------------------------------------------------------------------------------------
# Learning
# --------------------------------------------------------------------------------------------
COURSES = [
    # course_id, title, skill_name, hours, category, mandatory, ai_related, available_from
    ("C001", "Anti-Money Laundering & Financial Crime Awareness (annual)", "anti-money laundering screening", 1.5, "compliance", True, False, date(2023, 1, 1)),
    ("C002", "Data Protection & GDPR Essentials (annual)", "data protection", 1.0, "compliance", True, False, date(2023, 1, 1)),
    ("C003", "Code of Conduct & Ethics (annual)", "comply with legal regulations", 0.75, "compliance", True, False, date(2023, 1, 1)),
    ("C004", "AI Literacy for Everyone (EU AI Act Art. 4)", "use generative AI assistants responsibly", 2.0, "ai", True, True, date(2025, 1, 15)),
    ("C010", "Generative AI at Northwind: Getting Started", "use generative AI assistants responsibly", 1.5, "ai", False, True, date(2023, 9, 1)),
    ("C011", "Prompt Engineering Fundamentals", "use generative AI assistants responsibly", 3.0, "ai", False, True, date(2023, 11, 1)),
    ("C012", "Responsible AI & Model Risk in Banking", "AI model risk management", 4.0, "ai", False, True, date(2024, 3, 1)),
    ("C013", "AI-Assisted Software Development", "AI-assisted software development", 6.0, "ai", False, True, date(2023, 6, 1)),
    ("C014", "Building RAG Applications with LLMs", "large language model application development", 12.0, "ai", False, True, date(2024, 5, 1)),
    ("C015", "Machine Learning for Credit Risk", "utilise machine learning", 16.0, "ai", False, True, date(2023, 1, 1)),
    ("C016", "EU AI Act for Legal & Compliance Professionals", "EU AI Act compliance", 5.0, "ai", False, True, date(2024, 8, 1)),
    ("C017", "AI Agents & Workflow Automation", "AI use-case identification", 6.0, "ai", False, True, date(2025, 3, 1)),
    ("C018", "Generative AI for Customer Conversations", "customer service", 2.5, "ai", False, True, date(2024, 2, 1)),
    ("C020", "Python for Data Analysis", "Python (computer programming)", 20.0, "technical", False, False, date(2023, 1, 1)),
    ("C021", "SQL Foundations", "SQL", 8.0, "technical", False, False, date(2023, 1, 1)),
    ("C022", "Cloud Fundamentals", "cloud technologies", 10.0, "technical", False, False, date(2023, 1, 1)),
    ("C023", "Secure Coding Practices", "cyber security", 6.0, "technical", False, False, date(2023, 1, 1)),
    ("C024", "Agile Ways of Working", "Agile project management", 4.0, "ways of working", False, False, date(2023, 1, 1)),
    ("C025", "Credit Risk Fundamentals", "analyse financial risk", 8.0, "banking", False, False, date(2023, 1, 1)),
    ("C026", "Mortgage Advice Certification Refresher", "mortgage loans", 6.0, "banking", False, False, date(2023, 1, 1)),
    ("C027", "Handling Complaints with Empathy", "handle customer complaints", 3.0, "customer", False, False, date(2023, 1, 1)),
    ("C028", "Leadership Essentials", "plan teamwork", 12.0, "leadership", False, False, date(2023, 1, 1)),
    ("C029", "Financial Statement Analysis", "interpret financial statements", 10.0, "banking", False, False, date(2023, 1, 1)),
    ("C030", "Process Improvement with Lean", "improve business processes", 6.0, "ways of working", False, False, date(2023, 1, 1)),
]
COURSE_AFFINITY = {  # function -> preferred elective course ids
    "CSC": ["C018", "C027", "C010", "C011"], "BRM": ["C026", "C018", "C027", "C010"], "CBK": ["C029", "C025", "C010", "C011"],
    "WPB": ["C029", "C010", "C011"], "SWE": ["C013", "C023", "C022", "C011", "C014", "C017"], "DAI": ["C014", "C015", "C020", "C011", "C017", "C012"],
    "INF": ["C022", "C013", "C017", "C023"], "CYB": ["C023", "C012", "C022", "C011"], "CHG": ["C024", "C017", "C011", "C030"],
    "OPS": ["C030", "C017", "C010", "C011"], "RSK": ["C012", "C015", "C025", "C020"], "CMP": ["C016", "C012", "C010", "C011"],
    "AUD": ["C012", "C016", "C020"], "LEG": ["C016", "C010", "C011"], "FIN": ["C020", "C021", "C029", "C011"],
    "HRM": ["C010", "C011", "C028"], "MKT": ["C010", "C011", "C017"], "OFC": ["C028", "C010", "C011"],
}


def gen_learning(employees, jobs):
    courses = pd.DataFrame([c[:7] + (c[7].isoformat(),) for c in COURSES],
                           columns=["course_id", "course_title", "skill_name", "hours", "category", "is_mandatory",
                                    "is_ai_related", "available_from"])
    courses["provider"] = ["Northwind Academy (internal)" if i % 3 else "External e-learning vendor (generic)" for i in range(len(courses))]
    cinfo = {c[0]: c for c in COURSES}
    lvl = jobs.set_index("job_id").job_level.to_dict()
    rows = []
    rid = 0
    for e in employees.itertuples():
        fk = e.department_id.split("_")[1]
        hire, exit_ = e.hire_date, e.exit_date if isinstance(e.exit_date, date) else None
        lo, hi = max(hire, START), min(exit_ if exit_ else END, END)
        if lo > hi:
            continue
        # mandatory annual courses
        for yr in range(lo.year, hi.year + 1):
            for cid in ("C001", "C002", "C003") + (("C004",) if yr >= 2025 else ()):
                c = cinfo[cid]
                s = max(lo, date(yr, 2 if cid != "C004" else 3, 1) + timedelta(days=rnd.randint(0, 120)), c[7])
                if s > hi:
                    continue
                rid += 1
                r = rnd.random()
                if s + timedelta(days=45) > END and r < 0.35:
                    st, comp = "in_progress", None
                elif r < 0.93:
                    st, comp = "completed", s + timedelta(days=rnd.randint(0, 30))
                else:
                    st, comp = "overdue", None
                if comp and comp > hi:
                    st, comp = ("withdrawn" if exit_ else "in_progress"), None
                rows.append((f"LR{rid:07d}", e.employee_id, cid, c[1], c[2], s, comp, st, c[3] if comp else round(c[3] * rnd.random() * .6, 2)))
        # electives: rate grows with time; AI courses more popular later
        span_m = max(1, (hi - lo).days // 30)
        base_rate = 0.06 + (0.03 if lvl.get(e.job_id) in ("L4", "L5") else 0)
        n = rng.poisson(base_rate * span_m)
        pref = COURSE_AFFINITY[fk]
        for _ in range(n):
            s = lo + timedelta(days=rnd.randint(0, (hi - lo).days))
            pool = [cid for cid in pref if cinfo[cid][7] <= s] or ["C024", "C028", "C030"]
            ai_boost = 1 + 3 * max(0, (s - date(2023, 9, 1)).days / 1100)
            w = np.array([ai_boost if cinfo[cid][6] else 1.0 for cid in pool])
            cid = pool[rng.choice(len(pool), p=w / w.sum())]
            c = cinfo[cid]
            rid += 1
            r = rnd.random()
            dur = int(c[3] * rnd.uniform(2, 6))
            comp = s + timedelta(days=dur)
            if comp > hi or r < 0.12:
                st = "in_progress" if (comp > hi and not exit_) else "withdrawn"
                comp = None
            else:
                st = "completed"
            rows.append((f"LR{rid:07d}", e.employee_id, cid, c[1], c[2], s, comp, st, c[3] if comp else round(c[3] * rnd.random() * .5, 2)))
    learning = pd.DataFrame(rows, columns=["record_id", "employee_id", "course_id", "course_title", "skill_name",
                                           "start_date", "completion_date", "status", "hours"])
    return courses, learning


# --------------------------------------------------------------------------------------------
# Recruiting (requisition level, no candidate data)
# --------------------------------------------------------------------------------------------
APPLICANT_MEAN = {"CSC": 90, "BRM": 45, "OPS": 55, "SWE": 35, "DAI": 40, "INF": 25, "CYB": 18, "CHG": 45, "RSK": 30,
                  "CMP": 35, "AUD": 20, "LEG": 25, "FIN": 40, "HRM": 60, "MKT": 70, "CBK": 30, "WPB": 25, "OFC": 50}
CHANNELS = ["careers site", "LinkedIn", "employee referral", "recruitment agency", "job board", "internal mobility", "graduate programme"]


def gen_recruiting(employees, jobs):
    lvl = jobs.set_index("job_id").job_level.to_dict()
    hires = employees[pd.to_datetime(employees.hire_date) >= pd.Timestamp(START)].copy()
    hires["q"] = pd.to_datetime(hires.hire_date).dt.to_period("Q").astype(str)
    rows, rq = [], 0
    for (job_id, tid, c, q), grp in hires.groupby(["job_id", "department_id", "country", "q"]):
        fk = tid.split("_")[1]
        hd = sorted(grp.hire_date)
        # frontline volume roles: one requisition can fill several seats
        chunk = 6 if fk in FRONTLINE and lvl[job_id] == "L1" else 1
        for i in range(0, len(hd), chunk):
            seats = hd[i:i + chunk]
            rq += 1
            notice = rnd.randint(14, 75) if lvl[job_id] in ("L1", "L2") else rnd.randint(30, 95)
            filled = seats[0] - timedelta(days=notice)
            ttf = int(rng.gamma(4, 9 if fk in FRONTLINE else 13))
            opened = filled - timedelta(days=ttf)
            ch_w = np.array([.28, .22, .14, .12 if lvl[job_id] in ("L3", "L4", "L5") else .06, .10, .10,
                             .06 if lvl[job_id] in ("L1", "L2") else .0])
            ch = CHANNELS[rng.choice(len(CHANNELS), p=ch_w / ch_w.sum())]
            appl = int(rng.poisson(APPLICANT_MEAN[fk] * len(seats) * (0.6 if lvl[job_id] in ("L4", "L5") else 1.0))) + len(seats)
            rows.append((f"REQ{rq:06d}", job_id, tid, c, opened, filled, "filled", appl, len(seats), len(seats), ch, ttf))
    # unfilled / cancelled / still-open requisitions
    jobs_by_team = employees.groupby("department_id").job_id.unique().to_dict()
    teams = list(jobs_by_team)
    for _ in range(int(rq * 0.18)):
        tid = rnd.choice(teams)
        fk, c = tid.split("_")[1], tid.split("_")[2]
        job_id = rnd.choice(list(jobs_by_team[tid]))
        opened = START + timedelta(days=rnd.randint(0, (END - START).days))
        rq += 1
        age = (END - opened).days
        st = "open" if age < 120 and rnd.random() < .7 else rnd.choice(["cancelled", "cancelled", "on_hold"])
        appl = int(rng.poisson(APPLICANT_MEAN[fk] * (0.3 + 0.7 * rnd.random())))
        rows.append((f"REQ{rq:06d}", job_id, tid, c, opened, None, st, appl, 1, 0, "careers site", None))
    rec = pd.DataFrame(rows, columns=["requisition_id", "job_id", "department_id", "country", "opened_date", "filled_date",
                                      "status", "applicants", "positions", "hires", "source_channel", "time_to_fill_days"])
    return rec.sort_values("opened_date").reset_index(drop=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    main()
    print(f"done in {time.time() - t0:.1f}s")
