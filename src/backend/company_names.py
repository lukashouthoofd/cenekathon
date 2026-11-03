"""Company-name normalisation: the same employer is posted under several spellings."""
import re

SUFFIXES = {"bv", "nv", "sa", "plc", "ltd", "limited", "group", "holding", "holdings"}

# Normalised variant -> canonical name. Every pair was seen in data/vacancies_2021.parquet.
ALIASES = {
    "rbs": "royal bank of scotland",
    "ing netherlands": "ing",
    "ing nederland": "ing",
    "ing bank": "ing",
    "ing groep": "ing",
    "abn amro bank": "abn amro",
    "nationwide": "nationwide building society",
    "lloyds bank": "lloyds banking",
    "barclays bank": "barclays",
    "barclays uk": "barclays",
    "hsbc bank": "hsbc",
    "hsbc uk": "hsbc",
    "santander uk": "santander",
    "rabobank gruppe": "rabobank",
}


def normalise_company(name):
    """Lowercase, drop punctuation, strip legal suffixes, then map known aliases."""
    if name is None:
        return None
    s = re.sub(r"[^\w&\s]", "", name.lower())
    words = s.split()
    while len(words) > 1 and words[-1] in SUFFIXES:
        words.pop()
    s = " ".join(words)
    return ALIASES.get(s, s) or None
