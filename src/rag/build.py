"""Build rag.duckdb (vectors + skill tags) from the team's vacancy DuckDB, or the raw Parquet files.

Primary input: the normalized DuckDB from src/data/build_duckdb.py (table `vacancies`), via --source-db.
Any --source-sql only has to return these columns:
  vacancy_id, title, description, company, date_posted, country, city
Only BE, NL, LU and GB rows are kept.

Examples:
  python build.py --out rag.duckdb --source-db vacancies.duckdb               # src.vacancies
  python build.py --out rag.duckdb --source-db vacancies.duckdb --years 2022-2026
  python build.py --out sample.duckdb --limit 3000            # raw Parquet sample, for testing
  python build.py --out rag.duckdb --stages embed,skills       # re-run some stages

Stages: dedup, embed, titles, skills (default: all, in that order).
"""
import argparse
import hashlib
import time

import duckdb
import numpy as np
import pandas as pd
import pyarrow as pa

PARQUET = "/home/team19/data/vacancies_*.parquet"
COLUMNS = "vacancy_id, title, description, company, date_posted, country, city"
COUNTRIES = ("BE", "NL", "LU", "GB")
LEGAL = r"\b(ltd|limited|plc|llp|inc|group|holdings?|nv|bv|sa|ag|gmbh|se|uk|netherlands|belgium|luxembourg)\b"


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def vectors(emb):
    """numpy [n, d] float32 -> Arrow fixed-size list (DuckDB reads it as FLOAT[d])."""
    emb = np.ascontiguousarray(emb, dtype=np.float32)
    return pa.FixedSizeListArray.from_arrays(pa.array(emb.ravel()), emb.shape[1])


def dedup(con, source_sql, limit):
    if limit:
        source_sql = f"SELECT * FROM ({source_sql}) USING SAMPLE reservoir({limit} ROWS) REPEATABLE (42)"
    con.execute(f"""
    CREATE OR REPLACE TEMP TABLE raw AS
    WITH src AS ({source_sql}),
    c AS (
      SELECT vacancy_id, title, company, date_posted, upper(trim(country)) AS country, city,
        trim(regexp_replace(regexp_replace(
          replace(replace(replace(regexp_replace(regexp_replace(coalesce(description, ''), '<(br|/?p|/?li|/?div|/?h[1-6]|/?tr|/?ul|/?ol)\\b[^>]*>', chr(10), 'gi'), '<[^>]+>', ' ', 'g'),
            '&nbsp;', ' '), '&amp;', '&'), chr(13), ''),
          '[ \\t]+', ' ', 'g'), '\\n\\s*\\n+', '\\n\\n', 'g')) AS desc_clean,
        trim(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(company, '')),
          '[^a-z0-9à-ÿ ]', ' ', 'g'), '{LEGAL}', ' ', 'g'), '\\s+', ' ', 'g')) AS company_norm,
        trim(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(title, '')),
          '^[^:]{{2,30}}:\\s*', ''), '\\([^)]*\\)|\\[[^\\]]*\\]', ' ', 'g'), '\\s+', ' ', 'g')) AS title_norm
      FROM src)
    SELECT *, md5(company_norm || '|' || title_norm || '|' ||
                  lower(regexp_replace(desc_clean, '\\s+', ' ', 'g'))) AS dkey
    FROM c""")
    keep = ", ".join(f"'{c}'" for c in COUNTRIES)
    (n_junk,) = con.execute(f"DELETE FROM raw WHERE country IS NULL OR country NOT IN ({keep})").fetchone()
    log(f"dedup: dropped {n_junk} rows outside {'/'.join(COUNTRIES)}")
    # One row per unique posting; the earliest copy is the representative.
    con.execute("""
    CREATE OR REPLACE TABLE postings AS
    SELECT arg_min(vacancy_id, coalesce(date_posted, DATE '9999-12-31')) AS vacancy_id,
           arg_min(title, coalesce(date_posted, DATE '9999-12-31')) AS title, title_norm,
           arg_min(company, coalesce(date_posted, DATE '9999-12-31')) AS company, company_norm,
           arg_min(country, coalesce(date_posted, DATE '9999-12-31')) AS country,
           arg_min(city, coalesce(date_posted, DATE '9999-12-31')) AS city,
           min(date_posted) AS first_posted, max(date_posted) AS last_posted,
           count(*) AS n_copies, any_value(desc_clean) AS description, dkey
    FROM raw GROUP BY dkey, title_norm, company_norm""")
    con.execute("""
    CREATE OR REPLACE TABLE posting_ids AS
    SELECT r.vacancy_id, p.vacancy_id AS rep_id FROM raw r JOIN postings p USING (dkey)""")
    con.execute("ALTER TABLE postings DROP COLUMN dkey")
    n_raw, n_post = con.execute("SELECT (SELECT count(*) FROM raw), (SELECT count(*) FROM postings)").fetchone()
    log(f"dedup: {n_raw} rows -> {n_post} unique postings")


def header(title, company, city, country, day):
    """`title | company | city, country | YYYY-MM-DD`, with missing parts left out."""
    place = ", ".join(p.strip() for p in (city, country) if p and p.strip())
    parts = (title, company, place, day.isoformat() if day else None)
    return " | ".join(p.strip() for p in parts if p and p.strip())


def embed(con, batch_postings):
    from models import ChunkEncoder, chunk_text

    enc = ChunkEncoder()
    dim = enc.model.get_embedding_dimension()
    con.execute(f"""CREATE OR REPLACE TABLE chunks (vacancy_id VARCHAR, chunk_idx INTEGER, text VARCHAR,
                    country VARCHAR, year INTEGER, emb FLOAT[{dim}])""")
    # Each distinct embedded string is encoded once: md5 digest -> (vacancy_id, chunk_idx) of its first copy.
    # Later copies are collected in `dups` and get the first copy's vector at the end.
    first, dups, n_post = {}, [], 0
    reader = con.cursor().execute("""SELECT vacancy_id, title, company, city, country, first_posted, description
                                     FROM postings""").to_arrow_reader(batch_postings)
    for batch in reader:
        new = {"vacancy_id": [], "chunk_idx": [], "text": [], "country": [], "year": []}
        keys = []
        for vid, title, company, city, country, day, desc in zip(*batch.to_pydict().values()):
            # The header goes into the vector (not into `text`) so a chunk is findable without its posting.
            head = header(title, company, city, country, day)
            year = day.year if day else None
            for i, ch in enumerate(chunk_text(desc)):
                key = f"{head}\n{ch}"
                h = hashlib.md5(key.encode()).digest()
                if h in first:
                    dups.append((vid, i, ch, country, year) + first[h])
                    continue
                first[h] = (vid, i)
                for col, v in zip(new, (vid, i, ch, country, year)):
                    new[col].append(v)
                keys.append(key)
        n_post += batch.num_rows
        if keys:
            con.register("t", pa.table({**new, "emb": vectors(enc.encode(keys))}))
            con.execute(f"INSERT INTO chunks SELECT vacancy_id, chunk_idx, text, country, year, "
                        f"emb::FLOAT[{dim}] FROM t")
            con.unregister("t")
        log(f"embed: {n_post} postings, {len(first)} unique chunks embedded, {len(dups)} duplicate chunks")
    if dups:
        con.register("d", pd.DataFrame(dups, columns=["vacancy_id", "chunk_idx", "text", "country", "year",
                                                      "ref_id", "ref_idx"]))
        con.execute("""INSERT INTO chunks SELECT d.vacancy_id, d.chunk_idx, d.text, d.country, d.year, c.emb
                       FROM d JOIN chunks c ON c.vacancy_id = d.ref_id AND c.chunk_idx = d.ref_idx""")
        con.unregister("d")
    n = con.execute("SELECT count(*) FROM chunks").fetchone()[0]
    log(f"embed: wrote {n} chunks ({len(first)} unique, {dim}-d)")


def titles(con):
    from models import TitleEncoder

    df = con.execute("""SELECT title_norm, sum(n_copies) AS n_postings FROM postings
                        WHERE title_norm <> '' GROUP BY 1""").df()
    emb = TitleEncoder().encode(df.title_norm.tolist())
    con.register("t", pa.table({"title_norm": df.title_norm, "n_postings": df.n_postings, "emb": vectors(emb)}))
    con.execute(f"CREATE OR REPLACE TABLE titles AS SELECT title_norm, n_postings, "
                f"emb::FLOAT[{emb.shape[1]}] AS emb FROM t")
    con.unregister("t")
    log(f"titles: {len(df)} unique normalised titles")


def skills(con, esco_csv, max_sentence_postings):
    from models import ESCO_URL, SkillMatcher, split_sentences

    skill_names = sorted(pd.read_csv(esco_csv or ESCO_URL).skill.unique())
    matcher = SkillMatcher(skill_names)
    sent_id, sents, pairs = {}, [], []
    for vid, desc in con.execute("SELECT vacancy_id, description FROM postings").fetchall():
        for s in split_sentences(desc):
            h = hashlib.md5(s.encode()).digest()
            if h not in sent_id:
                sent_id[h] = len(sents)
                sents.append(s)
            pairs.append((vid, sent_id[h]))
    # Sentences repeated in many postings are company boilerplate (benefits, EDI statements), not requirements.
    freq = np.bincount([s for _, s in set(pairs)], minlength=len(sents))  # postings per sentence
    keep = np.flatnonzero(freq <= max_sentence_postings)
    log(f"skills: {len(pairs)} sentences ({len(sents)} unique, {len(sents) - len(keep)} boilerplate skipped) "
        f"x {len(skill_names)} ESCO skills")
    s_idx, k_idx, score = matcher.match([sents[i] for i in keep])
    s_idx = keep[s_idx]
    con.register("hits", pd.DataFrame({"sent": s_idx, "skill_id": k_idx, "score": score}))
    con.register("sents", pd.DataFrame({"sent": np.arange(len(sents)), "sentence": sents}))
    con.register("ps", pd.DataFrame(pairs, columns=["vacancy_id", "sent"]))
    con.register("sk", pd.DataFrame({"skill_id": np.arange(len(skill_names)), "skill": skill_names}))
    con.execute("CREATE OR REPLACE TABLE skills AS SELECT * FROM sk")
    con.execute("""
    CREATE OR REPLACE TABLE posting_skills AS
    SELECT ps.vacancy_id, sk.skill, max(h.score) AS score, arg_max(sents.sentence, h.score) AS evidence
    FROM ps JOIN hits h USING (sent) JOIN sents USING (sent) JOIN sk USING (skill_id)
    GROUP BY ALL""")
    for t in ("hits", "sents", "ps", "sk"):
        con.unregister(t)
    n, p = con.execute("SELECT count(*), count(DISTINCT vacancy_id) FROM posting_skills").fetchone()
    log(f"skills: {n} posting-skill links over {p} postings")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="rag.duckdb")
    ap.add_argument("--source-db", help="DuckDB file to read from (attached read-only as `src`)")
    ap.add_argument("--source-sql", help="query returning the standard columns (tables in --source-db: src.<table>)")
    ap.add_argument("--years", help="keep year(date_posted) in these years, e.g. 2022-2026 or 2025,2026")
    ap.add_argument("--limit", type=int, help="random sample of N source rows (testing)")
    ap.add_argument("--stages", default="dedup,embed,titles,skills")
    ap.add_argument("--batch-postings", type=int, default=50_000,
                    help="postings per embed batch (bounds memory)")
    ap.add_argument("--esco-csv", help="local copy of the ESCO skill sentence CSV (default: download)")
    ap.add_argument("--max-sentence-postings", type=int, default=20,
                    help="skip sentences that occur in more postings than this (boilerplate)")
    a = ap.parse_args()

    con = duckdb.connect(a.out)
    if a.source_db:
        con.execute(f"ATTACH '{a.source_db}' AS src (READ_ONLY)")
    source_sql = a.source_sql or (f"SELECT {COLUMNS} FROM src.vacancies" if a.source_db
                                  else f"SELECT {COLUMNS} FROM read_parquet('{PARQUET}')")
    if a.years:
        years = sorted({y for part in a.years.split(",")
                        for y in range(int(part.split("-")[0]), int(part.split("-")[-1]) + 1)})
        source_sql = f"SELECT * FROM ({source_sql}) WHERE year(date_posted) IN ({', '.join(map(str, years))})"
        log(f"source: years {years}")
    stages = a.stages.split(",")
    if "dedup" in stages:
        dedup(con, source_sql, a.limit)
    if "embed" in stages:
        embed(con, a.batch_postings)
    if "titles" in stages:
        titles(con)
    if "skills" in stages:
        skills(con, a.esco_csv, a.max_sentence_postings)
    con.close()
    log(f"done: {a.out}")


if __name__ == "__main__":
    main()
