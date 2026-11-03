#!/bin/bash
# usage: smoke_test.sh <db>  - (re)start the API on the given DB and smoke-test every endpoint
cd ~/rag
pkill -f "[u]vicorn serve:app"; sleep 1
RAG_DB=$1 COMPANY_DB=${COMPANY_DB:-$HOME/company/mock_company.duckdb} nohup ~/.local/bin/uvicorn serve:app --host 127.0.0.1 --port 8000 > serve.log 2>&1 &
for i in $(seq 1 60); do curl -sf localhost:8000/health && break; sleep 3; done; echo; tail -3 serve.log
H="Content-Type: application/json"
p() { python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d, ensure_ascii=False)[:900])"; }
echo "== search"; curl -s -X POST localhost:8000/search_postings -H "$H" -d '{"query":"use of generative AI and large language models in banking","k":4}' | python3 -c "
import sys,json; d=json.load(sys.stdin); d=d.get('results',d) if isinstance(d,dict) else d
[print(round(r['score'],3), r['vacancy_id'], r['title'], '|', r['company'], r['country'], r['text'][:110].replace(chr(10),' ')) for r in d]"
echo "== search NL"; curl -s -X POST localhost:8000/search_postings -H "$H" -d '{"query":"klantenservice medewerker","k":3,"country":"NL"}' | p
echo "== titles"; curl -s -X POST localhost:8000/similar_titles -H "$H" -d '{"title":"KYC Analyst","k":5}' | p
echo "== extract"; curl -s -X POST localhost:8000/extract_skills -H "$H" -d '{"text":"Builds credit risk models in Python and validates them with the model risk team. Presents results to senior management."}' | p
echo "== top"; curl -s -X POST localhost:8000/top_skills -H "$H" -d '{"country":"GB","title_contains":"data","k":8}' | p
echo "== company (MOCK)"; curl -s -X POST localhost:8000/company_sql -H "$H" -d '{"sql":"SELECT department, count(*) n FROM employees GROUP BY 1 ORDER BY 2 DESC"}' | p
