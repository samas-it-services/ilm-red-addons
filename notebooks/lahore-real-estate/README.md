# Three cities, two witnesses — counts from Lamudi, prices from Zameen

Companion notebook for [Why invest in Lahore real-estate](https://ilm.red/blog/why-invest-in-lahore-real-estate).

The article argues Pakistani property data is opaque, so this notebook works only with data any
reader can verify in a browser — **no invented numbers anywhere**:

1. **Lamudi.pk listing counts** — the per-city counts the portal prints on its own homepage
   (recorded 2026-08-25, refreshed live on every run, with an honest fallback line when the
   fetch fails). From these it computes three structural measures — plots-per-house (the
   speculative frontier), flats share (verticality), commercial per 1,000 homes — that put
   numbers on the article's planned-city vs grown-city thesis.
2. **Zameen.com house-price index** — 187 monthly observations per city (Jan 2011 to Jul 2026)
   of average house asking prices, read from the server-rendered payload of Zameen's public
   index pages on 2026-08-26 and shipped as `zameen_house_index.csv`. Spot-check: the Lahore
   page's headline "PKR 5.09 Crore" is the CSV's 2026-07 row.

Headline readings from the real series (all nominal PKR, asking prices): all three cities are
roughly 5x since 2011; Karachi houses are +44% over the last 24 months and sit at their peak;
Lahore is 13% below its December 2024 peak; Islamabad is 17% below its February 2024 peak. The
trend-plus-band extrapolation fits the last 24 months of the real series — method, not advice.

- `lahore_real_estate_lab.ipynb` — the executed notebook.
- `zameen_house_index.csv` — the real monthly price series (3 cities x 187 months).
- `lamudi_series.csv` — the growing listing-count observation log (seeded 2026-08-25).
- `build_nb.py` — regenerates and re-executes the notebook reproducibly.

Wire it to the post after publishing:
`node scripts/blog-run-panel.mjs --post <uuid> --notebook lahore-real-estate --apply`
