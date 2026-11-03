#!/bin/bash
# usage: smoke_test.sh [port]  - call every endpoint of the running API (default port 8000). Only tests; never restarts or kills anything.
PORT=${1:-8000}; U=localhost:$PORT; H="Content-Type: application/json"
p() { python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d, ensure_ascii=False)[:900])"; }
echo "== health"; curl -sf $U/health || { echo "API not reachable on :$PORT"; exit 1; }; echo
echo "== search"; curl -s -X POST $U/search_postings -H "$H" -d '{"query":"use of generative AI and large language models in banking","k":4}' | python3 -c "
import sys,json; [print(round(r['score'],3), r['vacancy_id'], r['title'], '|', r['company'], r['country']) for r in json.load(sys.stdin)]"
echo "== search NL"; curl -s -X POST $U/search_postings -H "$H" -d '{"query":"klantenservice medewerker","k":3,"country":"NL"}' | p
echo "== titles"; curl -s -X POST $U/similar_titles -H "$H" -d '{"title":"KYC Analyst","k":5}' | p
echo "== extract"; curl -s -X POST $U/extract_skills -H "$H" -d '{"text":"Builds credit risk models in Python and validates them with the model risk team."}' | p
echo "== top"; curl -s -X POST $U/top_skills -H "$H" -d '{"company":"ing","k":5}' | p
echo "== company_sql"; curl -s -X POST $U/company_sql -H "$H" -d '{"sql":"SELECT department_id, count(*) n FROM employees GROUP BY 1 ORDER BY 2 DESC LIMIT 5"}' | p
echo "== skill_gap"; curl -s -X POST $U/skill_gap -H "$H" -d '{"function":"Risk","k":3}' | p
