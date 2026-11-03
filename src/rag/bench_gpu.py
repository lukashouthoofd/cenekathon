"""Quick GPU settings sweep for build.py (bge-m3 chunk embedding, ConTeXT skill matching).

Run on the VM next to models.py:  python3 bench_gpu.py --parquet ~/data/vacancies_2024.parquet --esco ~/rag/esco_sentences.csv
The GPU is shared, so each variant is timed right after a baseline run and reported as a ratio.
Prints numbers only; no posting text is written anywhere.
"""
import argparse
import time

import duckdb
import numpy as np
import pandas as pd
import torch
from sentence_transformers.util import batch_to_device

import models
from models import DEVICE, ChunkEncoder, SkillMatcher, chunk_text, split_sentences


def timed(fn):
    torch.cuda.synchronize()
    t = time.perf_counter()
    out = fn()
    torch.cuda.synchronize()
    return time.perf_counter() - t, out


def match(m, sentences, batch_size, dtype, threshold=models.SKILL_THRESHOLD):
    """Copy of SkillMatcher.match with a switch for the einsum dtype."""
    order = np.argsort([len(s) for s in sentences])
    S = m.S.to(dtype)
    hits = set()
    with torch.no_grad():
        for i in range(0, len(sentences), batch_size):
            idx = order[i:i + batch_size]
            feats = batch_to_device(m.model.tokenize([sentences[j] for j in idx]), m.model.device)
            with torch.autocast(DEVICE, dtype=torch.float16):
                T = m.model[0](feats)["token_embeddings"]
            mask = feats["attention_mask"].bool()
            dots = torch.einsum("bld,kd->blk", T.to(dtype), S).float()
            alpha = dots.masked_fill(~mask[..., None], float("-inf")).softmax(dim=1)
            score = (alpha * dots / T.float().norm(dim=-1, keepdim=True)).sum(dim=1) / (m.S_norm + 1e-8)
            cand = score > threshold
            inner = mask.clone()
            inner[:, 0] = False
            inner[torch.arange(len(idx), device=DEVICE), mask.sum(1) - 1] = False
            best = dots.masked_fill(~cand[:, None, :], float("-inf")).argmax(-1)
            use = inner & cand.any(-1, keepdim=True)
            rows = torch.arange(len(idx), device=DEVICE)[:, None].expand_as(best)
            keep = torch.zeros_like(cand)
            keep[rows[use], best[use]] = True
            keep &= cand
            nz = keep.nonzero().cpu().numpy()
            hits.update(zip(idx[nz[:, 0]].tolist(), nz[:, 1].tolist()))
    return hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--parquet", required=True)
    ap.add_argument("--esco", required=True)
    ap.add_argument("--n-chunks", type=int, default=3000)
    ap.add_argument("--n-sents", type=int, default=10000)
    a = ap.parse_args()

    descs = [r[0] for r in duckdb.execute(
        f"SELECT description FROM read_parquet('{a.parquet}') WHERE length(description) > 500 LIMIT 3000").fetchall()]
    chunks = [c for d in descs for c in chunk_text(d) if len(c) > 1500][:a.n_chunks]
    sents = list(dict.fromkeys(s for d in descs for s in split_sentences(d)))[:a.n_sents]
    print(f"{len(chunks)} chunks (mean {np.mean([len(c) for c in chunks]):.0f} chars), {len(sents)} sentences")

    rows = []
    # 1) bge-m3: baseline = models.py (fp16, batch 64)
    enc = ChunkEncoder()
    enc.encode(chunks[:256])  # warm-up
    for name, bs, dtype in [("embed bs256 fp16", 256, torch.float16), ("embed bs64 bf16", 64, torch.bfloat16),
                            ("embed bs256 bf16", 256, torch.bfloat16)]:
        enc.model.to(torch.float16)
        tb, base = timed(lambda: enc.encode(chunks, batch_size=64))
        enc.model.to(dtype)
        tv, var = timed(lambda: enc.encode(chunks, batch_size=bs))
        cos = (base.astype(np.float32) * var.astype(np.float32)).sum(1)
        rows.append((name, tb, tv, f"min cos {cos.min():.5f}, mean {cos.mean():.6f}"))
    del enc
    torch.cuda.empty_cache()

    # 2) ConTeXT: baseline = models.py (fp16 einsum, batch 256); reference hits = fp32 einsum
    skills = sorted(pd.read_csv(a.esco).skill.unique())
    m = SkillMatcher(skills)
    match(m, sents[:512], 256, torch.float16)  # warm-up
    ref = match(m, sents, 256, torch.float32)
    for name, bs, dtype in [("skills bs64 fp16", 64, torch.float16), ("skills bs128 fp16", 128, torch.float16),
                            ("skills bs128 fp32", 128, torch.float32), ("skills bs256 fp32", 256, torch.float32)]:
        tb, base = timed(lambda: match(m, sents, 256, torch.float16))
        tv, var = timed(lambda: match(m, sents, bs, dtype))
        j = len(var & ref) / max(len(var | ref), 1)
        rows.append((name, tb, tv, f"{len(var)} hits, jaccard vs fp32 ref {j:.4f} (baseline {len(base & ref) / max(len(base | ref), 1):.4f})"))

    print(f"\n{'variant':22} {'base s':>7} {'var s':>7} {'speedup':>7}  check")
    for name, tb, tv, chk in rows:
        print(f"{name:22} {tb:7.2f} {tv:7.2f} {tb / tv:7.2f}x  {chk}")


if __name__ == "__main__":
    main()
