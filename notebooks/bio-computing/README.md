# Are you ready for bio-computing? — notebook

A runnable companion to the ilm.red engineering post **"Are you ready for bio-computing?"**

The article makes four claims that can be checked rather than repeated, so the notebook checks them:

1. **The energy argument** — 21 megawatts against 20 watts, computed, *including* the scaling step that makes the comparison honest. A 200,000-neuron dish is not a light bulb; it is about 47 microwatts.
2. **The closed loop** — the sense-compute-act cycle a dish needs in order to play anything: a stimulus encoder, a rate-coded population, a decoder, and the latency budget that forces silicon onto both ends of the biology.
3. **The training rule** — DishBrain was not rewarded. It was made *predictable* when it did well and *unpredictable* when it did badly. That rule, with no labelled target anywhere in the loop, is enough to move a population off chance, and the notebook watches it happen.
4. **The measurement problem** — two systems with completely different insides, tuned so their observable statistics match. Whether you can tell them apart depends entirely on which measurement you thought to take, which is the shape of the problem the ethics section is about.

## Run it

Opens in [Google Colab](https://colab.research.google.com/github/samas-it-services/ilm-red-addons/blob/master/notebooks/bio-computing/bio_computing_lab.ipynb) and runs top to bottom in under a minute. Fully **offline** — no API keys, no accounts, no GPU. Locally:

```bash
pip install numpy matplotlib jupyter
jupyter notebook bio_computing_lab.ipynb
```

Every random draw is seeded, so the numbers in the article match the numbers you get.

## What it is (and isn't)

Teaching code, not a replication. Nothing here models a real neuron: the "culture" is a layer of firing rates and the plasticity is a Hebbian update. Section 3 in particular saturates its task, because an eight-way lookup with no noise and no opponent is easy — a real culture on a real array improves modestly and unevenly, and the published result is a statistically detectable difference in performance, not a dish that gets good at Pong. The notebook says so where it matters.

Numbers taken from the article are marked in the cell that uses them. Numbers invented to make a demonstration run are marked too.

Licensed Apache-2.0, like the rest of this repository.
