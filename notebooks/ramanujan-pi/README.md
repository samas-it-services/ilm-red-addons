# The Ramanujan π Lab: notebook

A runnable companion to the ilm.red post **"Ramanujan and the series for 1/π: six papers, explained."**

In 1914 Srinivasa Ramanujan published 17 infinite sums for the number 1/π. This notebook lets you run them
and see why mathematicians were astonished:

1. **A slow sum first**: the Leibniz series, which needs ten thousand terms for three digits.
2. **Ramanujan's fastest series**: about 8 new correct digits with every term.
3. **The Chudnovsky formula** (1988): about 14 digits a term, the engine behind modern π records.
4. **The race**: all three on one chart.
5. **Evidence is not proof**: the number that looks whole for twelve decimal places and is not.
6. **A conjugate pair**: flip the sign of a square root and watch one sum settle and the other blow up.

## Run it

Opens in [Google Colab](https://colab.research.google.com/github/samas-it-services/ilm-red-addons/blob/master/notebooks/ramanujan-pi/ramanujan_pi_lab.ipynb)
and runs top to bottom on a free CPU runtime. Standard library plus matplotlib; no API keys, no accounts, no
network calls. Locally:

```bash
pip install matplotlib jupyter
jupyter notebook ramanujan_pi_lab.ipynb
```

The reference digits of π are computed inside the notebook with Machin's 1706 formula, which is independent of
every series being tested.
