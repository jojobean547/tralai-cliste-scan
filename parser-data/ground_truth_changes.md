# Ground truth corrections

`ground_truth_capstone.csv` is the file exactly as used in the capstone. Never edit it:
`scripts/scoreParser.ts` uses it to prove the scorer still matches the notebook.

`ground_truth.csv` is the app's development copy. Every change to it is logged here.

| Date | Image | Field(s) | Was | Now | Reason |
|---|---|---|---|---|---|
| 2026-11-09 | Dunnes_030.jpg | deal_type, deal_qty, deal_price | (blank) | price, 2, 10 | Label reads "2 for €10" (same layout as Dunnes_041). Annotation slip, confirmed against the photo. |
