# Keeping a Secret on Someone Else's Machine — the actual constructions

A technical companion to the ilm.red essay. Notation is deliberately plain.

## 1. Envelope encryption (key wrapping)
Per-book data key `DEK` (256-bit, random). Master key `KEK` lives in a vault.

```
wrapped_DEK = AEAD-Enc(KEK, iv_w, DEK)        # stored next to the book
DEK         = AEAD-Dec(KEK, iv_w, wrapped_DEK) # only inside the vault boundary
```

A database dump yields `{wrapped_DEK}` for every book and never `KEK`, so it yields no usable key.
Rotation: bump `key_version`, re-wrap under a fresh `DEK`; the old wrapped key stops being issued.

## 2. Authenticated encryption at rest (AES-256-GCM)
For a page `P` with optional associated data `A`:

```
(C, T) = GCM-Enc_K(IV, P, A)          # C ciphertext, T 128-bit tag
at-rest blob = IV(12 bytes) ‖ C ‖ T(16 bytes)
```

Decryption verifies `T` (a GHASH over `A ‖ C`) **before** releasing `P`; a single flipped byte fails
the check, so tampering is caught rather than silently returned. This is AEAD (confidentiality +
integrity). **Nonce rule:** never reuse `IV` under the same `K` — GCM's security collapses if you do,
which is why every seal draws a fresh random 96-bit IV.

## 3. The access gate (why revocation is real)
```
issue_key(viewer, book):
    assert can_read(viewer, book)     # same check the reader passed
    return AEAD-Dec(KEK, wrapped_DEK[book])
```
Revocation = make `can_read` false; the door simply stops issuing. There is no separate "un-send".

## 4. Non-extractable key material
The sealing key is imported as a non-extractable handle (WebCrypto `extractable=false`): usable for
encrypt/decrypt, not exportable. Caveat: raw key bytes still transit page memory en route to the
worker. Non-extractability shrinks the exposure window; it does not remove key material from RAM.

## 5. Watermark (traceability, not prevention)
A per-reader label `L(viewer)` is tiled over the page at low opacity `α ≈ 0.06`. It survives a
screenshot but is easy to miss while reading. It is a *deterrent*: it does not stop a capture, it makes
a captured page point back to its reader. Robust marking is the spread-spectrum idea (Cox et al. 1997).

## 6. Offline vs revocation, quantified
Let `Δ` = revocation latency (time from "access removed" to "reader can no longer read").

```
memory-only key:  Δ ≈ 0          (re-checked on every resume, needs a signal to resume)
persisted key:    Δ ≈ time-to-next-online-recheck   (reads offline, recall is not instant)
```

You cannot minimise both `Δ` and offline availability at once; you choose a point on the curve, per book.

---
Companion notebook (runnable, offline mock): https://github.com/samas-it-services/ilm-red-addons/tree/master/notebooks/keeping-a-secret
