# Keeping a Secret on Someone Else's Machine — notebook

A runnable companion to the ilm.red engineering post **"Keeping a Secret on Someone Else's Machine."**
It builds every idea from the article from scratch, small enough to hold in your hand:

1. **Envelope encryption** — a per-book *data key* wrapped by one *master key* in a vault.
2. **Sealing a page** with AES-256-GCM, and watching a one-byte tamper get caught.
3. **The access gate** — one door that re-checks "may you read this?" before handing over a key, which is what makes revocation real.
4. **A faint watermark** — signing what a camera would see, since you cannot encrypt your way out of a photo.
5. **Offline versus recall** — the trade with no free answer, felt in code.

## Run it

Opens in [Google Colab](https://colab.research.google.com/github/samas-it-services/ilm-red-addons/blob/master/notebooks/keeping-a-secret/keeping_a_secret_lab.ipynb) and runs top to bottom. It is fully **offline** with a mock vault — no API keys, no accounts. Locally:

```bash
pip install cryptography Pillow jupyter
jupyter notebook keeping_a_secret_lab.ipynb
```

## What it is (and isn't)

Teaching code, not production code. The goal is to make the moving parts obvious. The real system uses the same primitives (authenticated encryption, envelope-wrapped keys, an access-checked key service, a per-reader watermark) wired into a reader that caches pages on the device.

Licensed Apache-2.0, like the rest of this repository.
