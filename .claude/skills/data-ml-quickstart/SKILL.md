---
name: data-ml-quickstart
description: Use when the challenge involves a dataset, classic machine learning, forecasting, or analytics — fast EDA, baseline model, honest evaluation, and presenting results.
---

# Data & ML quickstart

1. **Look at the data first (15 min):** shape, dtypes, missing values, duplicates, target distribution, 5 raw rows. `pandas`: `df.info(); df.describe(); df.isna().mean()`. Write down what each column means and what leaks the answer.
2. **Define the question & metric** before modelling (regression → MAE; classification → F1/PR-AUC when imbalanced; ranking → top-k hit rate). Tie it to the user's decision.
3. **Baseline first:** majority class / mean / last value / simple rule. Then logistic or linear regression, then gradient boosting (`lightgbm`/`xgboost`/`sklearn`). Stop when it beats baseline meaningfully.
4. **Split correctly:** by time for time series, by group/user for repeated entities; no leakage (fit scalers/encoders on train only). Keep a final holdout untouched until the end.
5. **Pre-trained over trained:** for text/images/audio use hosted or open models (embeddings, classification, OCR, speech) rather than training from scratch.
6. **Explain:** feature importances / SHAP / example errors. Show 3 failure cases honestly.
7. **Ship it:** save the model (`joblib`) or call the API; expose via the backend (`backend-api`); cache predictions; pin library versions in `requirements.txt`.
8. **Visualize for the pitch:** one clear chart per message (use a plain bar/line, labelled axes, highlighted takeaway).
9. **Scale story:** batch vs streaming, retraining schedule, monitoring drift, feature store — talk, don't build.

Keep notebooks out of `main` unless needed; put reproducible logic in `src/` scripts. Large data → don't commit; document the download step in `docs/STACK.md`.

**Done when:** a script reproduces the metric from raw data in one command and the number is on a slide with its baseline next to it.
