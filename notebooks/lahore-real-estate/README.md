# Three cities, one method — Lamudi's Pakistan footprint

Companion notebook for [Why invest in Lahore real-estate](https://ilm.red/blog/why-invest-in-lahore-real-estate).

The article argues Pakistani property data is opaque, so this notebook works only with what any
reader can verify in a browser: the per-city listing counts Lamudi.pk prints on its own homepage
(recorded 2026-08-25, refreshed live on every run — with an honest fallback line when the fetch
fails). From those counts it computes three structural measures — plots-per-house (the
speculative frontier), flats share (verticality), commercial per 1,000 homes — that put numbers
on the article's planned-city vs grown-city thesis for Islamabad, Lahore and Karachi.

The forecasting section is deliberately two-staged: a collection cell appends each run's counts
to `lamudi_series.csv`, and the trend-plus-band extrapolation runs on **clearly labelled
synthetic data** until that CSV holds six real dates — at which point the same cell fits the
real series and the caveat retires itself. Counts are not prices, asking is not selling, one
portal is one witness; the notebook says so wherever it matters.

- `lahore_real_estate_lab.ipynb` — the executed notebook.
- `lamudi_series.csv` — the growing observation log (seeded with the 2026-08-25 snapshot).
- `build_nb.py` — regenerates and re-executes the notebook reproducibly.

Wire it to the post after publishing:
`node scripts/blog-run-panel.mjs --post <uuid> --notebook lahore-real-estate --apply`
