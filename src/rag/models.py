"""Model wrappers shared by build.py and serve.py.

- bge-m3 (BAAI, multilingual, 1024-d): vectors for posting chunks and queries (RAG evidence).
- JobBERT-v3 (TechWolf, multilingual): vectors for job titles (similar job profiles).
- ConTeXT-match (TechWolf, English): ESCO skill extraction, implemented from
  Decorte et al. 2025, "Efficient Text Encoders for Labor Market Analysis", arXiv:2505.24640,
  Eq. 1-4 plus the redundancy filter (threshold 0.48).
"""
import re

import numpy as np
import torch
from sentence_transformers import SentenceTransformer
from sentence_transformers.util import batch_to_device

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CHUNK_MODEL = "BAAI/bge-m3"
TITLE_MODEL = "TechWolf/JobBERT-v3"
SKILL_MODEL = "TechWolf/ConTeXT-Skill-Extraction-base"
SKILL_THRESHOLD = 0.48
ESCO_URL = "https://huggingface.co/datasets/TechWolf/Synthetic-ESCO-skill-sentences/resolve/main/dataset.csv"

_SPLIT = re.compile(r"\n+|(?<=[.!?;])\s+(?=[A-Z0-9À-Ý])")
_BULLET = re.compile(r"^[\s•·\-\*–▪●◦]+")


def split_sentences(text):
    """Lines and sentences of a posting, bullets stripped, 3-60 words."""
    out = []
    for s in _SPLIT.split(text or ""):
        s = _BULLET.sub("", s).strip()
        if 3 <= len(s.split()) <= 60:
            out.append(s)
    return out


def chunk_text(text, size=2000):
    """Pack paragraphs (or sentences of long paragraphs) into chunks of <= size chars."""
    units = []
    for para in re.split(r"\n+", text or ""):
        para = para.strip()
        if len(para) <= size:
            units.append(para)
        else:
            for s in re.split(r"(?<=[.!?;])\s+", para):
                units.extend(s[i:i + size] for i in range(0, len(s), size))
    chunks, cur = [], ""
    for u in filter(None, units):
        if cur and len(cur) + len(u) + 1 > size:
            chunks.append(cur)
            cur = ""
        cur = f"{cur}\n{u}" if cur else u
    if cur:
        chunks.append(cur)
    return chunks


class ChunkEncoder:
    def __init__(self):
        self.model = SentenceTransformer(CHUNK_MODEL, device=DEVICE)
        self.model.max_seq_length = 512
        if DEVICE == "cuda":
            self.model.half()

    def encode(self, texts, batch_size=64, progress=False):
        return self.model.encode(texts, batch_size=batch_size, normalize_embeddings=True,
                                 convert_to_numpy=True, show_progress_bar=progress)


class TitleEncoder:
    """JobBERT-v3 has an asymmetric head; titles go through the "anchor" branch (see its model card)."""

    def __init__(self):
        self.model = SentenceTransformer(TITLE_MODEL, device=DEVICE)

    @torch.no_grad()
    def encode(self, titles, batch_size=512):
        order = np.argsort([len(t) for t in titles])
        out = np.zeros((len(titles), self.model.get_sentence_embedding_dimension()), np.float32)
        for i in range(0, len(titles), batch_size):
            idx = order[i:i + batch_size]
            feats = batch_to_device(self.model.tokenize([titles[j] for j in idx]), self.model.device)
            feats["text_keys"] = ["anchor"]
            emb = self.model.forward(feats)["sentence_embedding"]
            out[idx] = torch.nn.functional.normalize(emb, dim=-1).float().cpu().numpy()
        return out


class SkillMatcher:
    def __init__(self, skills, batch_size=256):
        self.model = SentenceTransformer(SKILL_MODEL, device=DEVICE)
        self.model.max_seq_length = 128
        self.skills = list(skills)
        self.batch_size = batch_size
        # Eq. 1: skill embedding = mean of its token embeddings (the model's mean pooling, unnormalised)
        self.S = self.model.encode(self.skills, batch_size=512, convert_to_tensor=True).float()
        self.S_norm = self.S.norm(dim=1)

    @torch.no_grad()
    def match(self, sentences, threshold=SKILL_THRESHOLD):
        """Return (sentence_idx, skill_idx, score) arrays for skills that pass threshold + redundancy filter."""
        order = np.argsort([len(s) for s in sentences])
        res_s, res_k, res_v = [], [], []
        for i in range(0, len(sentences), self.batch_size):
            idx = order[i:i + self.batch_size]
            feats = batch_to_device(self.model.tokenize([sentences[j] for j in idx]), self.model.device)
            with torch.autocast(DEVICE, dtype=torch.float16, enabled=DEVICE == "cuda"):
                T = self.model[0](feats)["token_embeddings"]
            mask = feats["attention_mask"].bool()
            # fp16 matmul on tensor cores (1.75x faster on the A100, 99.9% identical hits vs fp32), fp32 after.
            dots = torch.einsum("bld,kd->blk", T.half(), self.S.half()).float()
            alpha = dots.masked_fill(~mask[..., None], float("-inf")).softmax(dim=1)          # Eq. 4
            # Eq. 3 with Eq. 2's cosine folded in: sum_j alpha_j * dot_j / (|x_j| |s|)
            score = (alpha * dots / T.float().norm(dim=-1, keepdim=True)).sum(dim=1) / (self.S_norm + 1e-8)
            cand = score > threshold
            # Redundancy filter: keep candidates with the highest dot product for >= 1 real token
            # (begin/end template tokens excluded).
            inner = mask.clone()
            inner[:, 0] = False
            inner[torch.arange(len(idx), device=DEVICE), mask.sum(1) - 1] = False
            best = dots.masked_fill(~cand[:, None, :], float("-inf")).argmax(-1)
            use = inner & cand.any(-1, keepdim=True)
            rows = torch.arange(len(idx), device=DEVICE)[:, None].expand_as(best)
            keep = torch.zeros_like(cand)
            keep[rows[use], best[use]] = True
            keep &= cand
            nz = keep.nonzero()
            res_s.append(idx[nz[:, 0].cpu().numpy()])
            res_k.append(nz[:, 1].cpu().numpy())
            res_v.append(score[nz[:, 0], nz[:, 1]].cpu().numpy())
        if not res_s:
            return np.array([], int), np.array([], int), np.array([], np.float32)
        return np.concatenate(res_s), np.concatenate(res_k), np.concatenate(res_v)
