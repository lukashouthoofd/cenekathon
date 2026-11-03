#!/usr/bin/env bash
# Build the RAG store on the GPU VM and (re)start the API, run FROM THE LAPTOP (Git Bash).
#   bash src/rag/run_build.sh <source.duckdb|.csv|.parquet|vm:/path> [out_name]
#   env overrides: API_PORT=8000 SESSION=live CODE_DIR=~/rag_live   (quote "~/..." or use an absolute path)
# Pipeline in tmux: build.py -> company.py on the synthetic Goldman Stanly CSVs (origin/main:data/synthetic) -> only on success:
#   stop whatever listens on API_PORT (by PID) and start uvicorn serve:app on 127.0.0.1:API_PORT.
set -euo pipefail
HOST=team19; VHOME=/home/team19
SRC=${1:?usage: run_build.sh <source.duckdb|.csv|.parquet|vm:/path> [out_name]}; OUT=${2:-rag}
PORT=${API_PORT:-8000}; SESS=${SESSION:-live}; CODE=${CODE_DIR:-rag_live}
CODE=${CODE#\~/}; case $CODE in /*) ;; *) CODE=$VHOME/$CODE;; esac; CODE=${CODE%/}
case $CODE in "$VHOME/rag"|"$VHOME/rag_wf") echo "refusing $CODE (used by other builds)" >&2; exit 2;; esac
HERE=$(cd "$(dirname "$0")" && pwd)

# 1. Source on the VM: vm:<path> is already there, else upload to ~/rag_src/.
case $SRC in
  vm:*) VSRC=${SRC#vm:};;
  *) [ -f "$SRC" ] || { echo "no such file: $SRC" >&2; exit 2; }
     ssh "$HOST" "mkdir -p ~/rag_src"; scp -q "$SRC" "$HOST:rag_src/"; VSRC=$VHOME/rag_src/$(basename "$SRC");;
esac

# 2. Source SQL by extension (build.py attaches --source-db read-only as `src`).
COLS="title, description, company, date_posted::DATE AS date_posted, country, city"
SRCDB=""
case $VSRC in
  *.duckdb)  SRCDB=$VSRC; SQL="SELECT vacancy_id::VARCHAR AS vacancy_id, $COLS FROM src.vacancies";;
  *.csv)     SQL="SELECT vacancy_id::VARCHAR AS vacancy_id, $COLS FROM read_csv('$VSRC')";;
  *.parquet) SQL="SELECT vacancy_id::VARCHAR AS vacancy_id, $COLS FROM read_parquet('$VSRC')";;
  *) echo "source must be .duckdb, .csv or .parquet: $VSRC" >&2; exit 2;;
esac

# 3. Remote pipeline script: %q-quoted variables header + fixed body (keeps SQL quotes intact).
PIPE=$(mktemp); SYN=$(mktemp -d); trap 'rm -rf "$PIPE" "$SYN"' EXIT
{ printf 'set -euo pipefail\nCODE=%q OUT=%q PORT=%q SRCDB=%q SQL=%q\n' "$CODE" "$OUT" "$PORT" "$SRCDB" "$SQL"
  cat <<'BODY'
cd "$CODE"; export PYTHONUNBUFFERED=1 PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
RAG=$CODE/$OUT.duckdb; ARGS=(--out "$RAG" --source-sql "$SQL" --esco-csv ~/rag/esco_sentences.csv)
[ -n "$SRCDB" ] && ARGS+=(--source-db "$SRCDB")
echo "== build $(date)"; python3 build.py "${ARGS[@]}"
CDB=""
if [ -f company.py ]; then
  python3 company.py --synthetic-dir "$CODE/synthetic" --rag-db "$RAG" --out "$CODE/company.duckdb"
  CDB=$CODE/company.duckdb
fi
OLD=$(ss -ltnpH "sport = :$PORT" | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true)
if [ -n "$OLD" ]; then echo "stopping pid $OLD on :$PORT"; kill $OLD; while ss -ltnH "sport = :$PORT" | grep -q .; do sleep 1; done; fi
RAG_DB=$RAG COMPANY_DB=$CDB nohup ~/.local/bin/uvicorn serve:app --host 127.0.0.1 --port "$PORT" > serve.log 2>&1 &
echo $! > serve.pid; echo "API pid $(cat serve.pid) on :$PORT"
for i in $(seq 1 100); do curl -sf "localhost:$PORT/health" && break; sleep 3; done
echo; echo "== PIPELINE DONE $(date)"
BODY
} > "$PIPE"

# 4. Ship code + pipeline, start tmux (refuse to reuse a running session).
if ssh "$HOST" "tmux has-session -t '$SESS' 2>/dev/null"; then echo "tmux session '$SESS' exists; pick SESSION=..." >&2; exit 1; fi
FILES=("$HERE"/*.py "$HERE"/*.json "$HERE/smoke_test.sh")
for f in departments job_architecture job_skills employees headcount_monthly ai_usage_logs model_pricing courses          learning_records recruiting_records; do
  git -C "$HERE" show "origin/main:data/synthetic/$f.csv" > "$SYN/$f.csv"
done
ssh "$HOST" "mkdir -p '$CODE/synthetic'"
scp -q "${FILES[@]}" "$HOST:$CODE/"; scp -q "$SYN"/*.csv "$HOST:$CODE/synthetic/"; scp -q "$PIPE" "$HOST:$CODE/pipeline.sh"
LOG=$CODE/$OUT.log
ssh "$HOST" "tmux new-session -d -s '$SESS' \"bash '$CODE/pipeline.sh' 2>&1 | tee '$LOG'\""

echo "started tmux '$SESS' on $HOST; log $LOG"
echo "  watch:  ssh $HOST tmux attach -t $SESS   (detach: Ctrl-b d)   or: ssh $HOST tail -f '$LOG'"
echo "  tunnel: ssh -N -L $PORT:localhost:$PORT $HOST   then: curl localhost:$PORT/health"
