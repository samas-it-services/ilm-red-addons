# Drawing Diffusion — an AI diagram-model bake-off, in a notebook

A runnable companion to the ilm.red engineering post
**["Drawing Diffusion"](https://ilm.red/blog/drawing-diffusion-ai-diagram-model-bakeoff)**.

The post makes one narrow claim: when a teaching diagram needs **labels**, an image model is the
wrong tool and a *text* model asked for `SVG` is the right one. This notebook builds that claim
from scratch so you can check it instead of taking it on faith:

1. **One word, two pictures** — why the meaning has to be settled before anything is drawn.
   `diffusion` in the AI club and `diffusion` in physics are unrelated ideas sharing six letters.
2. **Scoring a label** — the metric the whole bake-off turns on, written before any model is called.
3. **Why raster models misspell** — the failure, measured, on recorded output from the real run.
4. **The SVG path** — ask for a drawing, not a painting, then read the labels back out of the
   `<text>` nodes and verify them mechanically.
5. **The cost arithmetic** — why roughly 100× cheaper is what settles it for a whole catalogue.

## Run it

Opens in [Google Colab](https://colab.research.google.com/github/samas-it-services/ilm-red-addons/blob/master/notebooks/drawing-diffusion/drawing_diffusion_lab.ipynb)
and runs top to bottom on a free CPU runtime. It is fully **offline** by default — no API keys, no
account. Locally:

```bash
pip install cairosvg jupyter
jupyter notebook drawing_diffusion_lab.ipynb
```

`cairosvg` is optional; without it the notebook still runs and simply prints the SVG source instead
of rendering it.

## Offline by default, live if you want

The raster results are a **recorded fixture** — OCR transcripts of the images the real bake-off
produced. Re-running an image model would cost money and would not reproduce byte-for-byte anyway,
which is itself the finding. The SVG engine falls back to a deterministic generator that honours the
same prompt contract.

Set `OPENAI_API_KEY` in the Setup cell to swap the SVG engine over to a real model and re-run that
half live. The scoring function does not change — that is the point of writing it first.

## What it is (and isn't)

Teaching code, not production code. The real engine renders house styles, handles RTL scripts, and
runs as a tracked job on the worker. What is faithful here is the argument: label accuracy is
measurable, typed characters cannot be misspelled by a renderer, and the cost gap across a
two-hundred-diagram catalogue is about two orders of magnitude.

Concepts used here have plain-words pages in the
[Artificial Intelligence Collective](https://ilm.red/book-clubs/ai):
[diffusion](https://ilm.red/book-clubs/ai/terms/diffusion) ·
[text-to-image model](https://ilm.red/book-clubs/ai/terms/text-to-image-model) ·
[visual text rendering](https://ilm.red/book-clubs/ai/terms/visual-text-rendering)

Licensed Apache-2.0, like the rest of this repository.
