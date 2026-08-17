# Estimating what AI actually costs: the notebook

A runnable companion to the ilm.red engineering post **"The $21 Paragraph: What It Really Costs to
Run AI, and Why Your Estimate Is Lying."**

It rebuilds the arithmetic behind an AI bill from scratch, small enough to hold in your hand, and
then reproduces the four-step chain that turned a fourteen-cent job in our own pipeline into a
$21.44 charge and stopped every job on the site for six hours.

1. **The billing unit**, a toy tokenizer with a byte-level fallback, showing why the same sentence
   costs more in a script the tokenizer never learned.
2. **The unforecastable half**: 20,000 simulated jobs with a fixed prompt and a varying answer,
   because output length is decided while the model writes and is priced higher than input.
3. **Measuring the wrong thing**: reproduce our markup bug on a synthetic post and watch a
   96%-markup document overstate its own cost by ~26×.
4. **The chain**: `estimate → nothing priced → nothing reported → COALESCE → margin`, each link a
   function you can switch on and off to watch the bill move.
5. **The blast radius**: simulate a day against a global spend cap and see the same real spend
   either finish the queue or halt the site.
6. **The repair**: reprice a ledger from a token log and find the mis-billed rows with one query.

## Run it

Opens in [Google Colab](https://colab.research.google.com/github/samas-it-services/ilm-red-addons/blob/master/notebooks/estimating-ai-cost/estimating_ai_cost_lab.ipynb)
and runs top to bottom on a free CPU runtime. It is fully **offline**, with no API keys, no accounts, no
network calls. Locally:

```bash
pip install matplotlib jupyter
jupyter notebook estimating_ai_cost_lab.ipynb
```

Everything is seeded (`random.seed(20260806)`, the date of the incident), so the numbers you get are
the numbers in the post.

## What it is (and isn't)

Teaching code, not production code. The tokenizer is a toy: real ones learn their vocabulary from
data (Sennrich et al. 2016; Kudo & Richardson 2018), but it fails in the same direction as a real
one, which is the only property the argument needs. The rates are plausible round numbers, not any
vendor's price list, because prices change and the structure is the point: input and output are
metered separately and asymmetrically.

The real system is this same arithmetic wired into a job queue with a per-call token log. What the
notebook does *not* simulate is the part that actually bit us, a rate table keyed so specifically
that the price lookup missed and every call recorded a cost of `NULL`. That one is in the post.

Licensed Apache-2.0, like the rest of this repository.
