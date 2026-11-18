// @ts-check
import { describe, expect, it } from 'vitest';
import { checkStory, repairLength, deptOk, limitsFor } from '../pipeline/checks.mjs';
import { matchTerms, variants } from '../pipeline/terms.mjs';
import { buildSystem, capLearned, fill } from '../pipeline/layers.mjs';
import { callRecord, MAX_BYTES } from '../pipeline/calllog.mjs';
import { longestCopiedRun, numbersIn, sentences, wordCount, cutBytes } from '../pipeline/text.mjs';
import { parseScout } from '../pipeline/scout.mjs';
import { applyFixPairs, verdictKey } from '../pipeline/council.mjs';
import { fromCuratorLevel } from '../pipeline/levels.mjs';
import { createBudget, estimateUsd } from '../pipeline/budget.mjs';
import { parseModelJson } from '../pipeline/json.mjs';
import { samplePapers } from './helpers.mjs';
import { SAMPLE } from './scripted.mjs';

const { papers } = samplePapers();
const ctx = (/** @type {Partial<import('../pipeline/checks.mjs').CheckContext>} */ o = {}) => ({
  lang: /** @type {'en'} */ ('en'), allowedUrls: new Set(['https://arxiv.org/abs/2611.12634']), paperUrl: 'https://arxiv.org/abs/2611.12634',
  sourceTexts: [papers[1].abstract], factText: papers[1].abstract, ...o,
});
const quant = () => ({ paper: 10, ...SAMPLE['10'] });

describe('checks', () => {
  it('the quantization sample passes', () => {
    const r = checkStory(quant(), ctx());
    expect(r.fails).toEqual([]);
    expect(r.stats.words).toBe(131);
  });
  it('catches em dash, hype, opener, bare URL, missing paper link and a number not in the sources', () => {
    const s = { ...quant(), headline: 'A groundbreaking screen', body: `This paper shows 99 things ${String.fromCharCode(0x2014)} see https://x.org ${'word '.repeat(90)}`, question: 'Why?' };
    const codes = checkStory(s, ctx()).fails.map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(['hype', 'em_dash', 'opener', 'bare_url', 'no_paper_link', 'number_not_in_sources']));
  });
  it('catches a run of more than 20 copied words', () => {
    const copied = papers[1].abstract.split(' ').slice(0, 25).join(' ');
    const s = { ...quant(), body: `${SAMPLE['10'].body} ${copied}.` };
    const f = checkStory(s, ctx()).fails.find((x) => x.code === 'copied');
    expect(f?.detail).toMatch(/^25 words/);
  });
  it('dept format, English and Urdu', () => {
    expect(deptOk('from the close-enough-for-int8 dept.', 'en', limitsFor('en'))).toBe(true);
    expect(deptOk('from the pun dept.', 'en', limitsFor('en'))).toBe(false);
    expect(deptOk('From The Close-Enough dept', 'en', limitsFor('en'))).toBe(false);
    expect(deptOk('شعبۂ جیسا کیپشن، ویسا افلاطون', 'ur', limitsFor('ur'))).toBe(true);
    expect(deptOk('شعبه', 'ur', limitsFor('ur'))).toBe(false);
  });
  it('short length scales the word limits', () => {
    expect(limitsFor('en', 'short')).toMatchObject({ minWords: 63, maxWords: 112 });
  });
  it('length repair keeps the first sentence and the paper link, and never breaks a link', () => {
    const long = { ...quant(), body: `${SAMPLE['10'].body} One more aside here to push it over. And another aside that is not needed at all here. A third one to be sure of the limit being passed now.` };
    const r = repairLength(long, ctx());
    expect(r).not.toBeNull();
    expect(checkStory(/** @type {any} */ (r), ctx()).ok).toBe(true);
    expect(r?.body.startsWith('Quantization saves memory')).toBe(true);
  });
  it('a finance club refuses advice', () => {
    const s = { ...quant(), question: 'Should you buy the stock now?' };
    expect(checkStory({ ...s, body: s.body.replace('you are early', 'you should buy the stock') }, ctx({ finance: true })).fails.map((f) => f.code)).toContain('advice');
  });
});

describe('text helpers', () => {
  it('splits sentences without breaking links or decimals', () => {
    const b = 'See [the paper](https://arxiv.org/abs/2611.12869). It runs at 0.55 times. Done!';
    const s = sentences(b);
    expect(s).toHaveLength(3);
    expect(s.join('')).toBe(b);
  });
  it('reads standalone numbers, not names', () => {
    expect(numbersIn('In 2024, Qwen3-32B and int8 ran 16-fold at 0.55 on ۲۰۲۴')).toEqual(['2024', '16', '0.55', '2024']);
  });
  it('counts words without URLs', () => {
    expect(wordCount('a [b c](https://x.org/y) d')).toBe(4);
  });
  it('longest copied run', () => {
    expect(longestCopiedRun('the cat sat on the mat today', ['a cat sat on the mat']).n).toBe(5);
  });
  it('cuts bytes on a character boundary', () => {
    const r = cutBytes('ا'.repeat(10), 5);
    expect(r.truncated).toBe(true);
    expect(r.text).toBe('اا');
  });
});

describe('terms', () => {
  it('finds the 8 sample terms in the Plato story, first mention, never inside a link, not inside a longer term', () => {
    const m = matchTerms(SAMPLE['9'].body, papers[0].terms, 'en');
    expect(m.map((x) => x.slug)).toEqual(['platonic-representation-hypothesis-prh', 'vision-model', 'language-model', 'representation-similarity-metric', 'model-depth', 'unimodal-model', 'cross-modal-alignment', 'vision-language-model-vlm']);
    const lm = m.find((x) => x.slug === 'language-model');
    expect(SAMPLE['9'].body.slice(0, lm?.start).endsWith('and ')).toBe(true);
  });
  it('skips a term inside link text', () => {
    const t = [{ name: 'code', slug: 'code' }];
    const body = '[The code is up](https://github.com/x/y). Some code here.';
    expect(matchTerms(body, t, 'en')[0].start).toBe(body.indexOf('Some code') + 5);
  });
  it('matches aliases and plurals', () => {
    expect(variants({ name: 'Mixture-of-Experts model', slug: 'm', aliases: ['mixture of experts'] }, 'en')).toEqual(expect.arrayContaining(['mixture of experts', 'Mixture-of-Experts models']));
  });
  it('Urdu uses the Urdu name', () => {
    const m = matchTerms(SAMPLE['9ur'].body, papers[0].terms, 'ur');
    expect(m.map((x) => x.slug)).toEqual(expect.arrayContaining(['platonic-representation-hypothesis-prh', 'language-model']));
  });
  it('curator levels map 1 easy, 2 and 3 advanced, 4 expert', () => {
    expect([1, 2, 3, 4, null].map(fromCuratorLevel)).toEqual(['easy', 'advanced', 'advanced', 'expert', null]);
  });
});

describe('prompt layers', () => {
  it('orders house, stage, voice, learned; fills placeholders; drops header comments', () => {
    const { system, layers } = buildSystem({ frame: '<!-- gv-frame-1: x -->\nRules for {{masthead}}.', stage: '<!-- s-1: y -->\nTask.', voice: { text: 'Be brief.', version: 'v3' }, learned: [{ id: 'a', text: 'Rule A.' }], vars: { masthead: 'The AI Gazette' } });
    expect(layers.map((l) => [l.kind, l.version])).toEqual([['house', 'gv-frame-1'], ['stage', 's-1'], ['voice', 'v3'], ['learned', '1 rule']]);
    expect(system.startsWith('Rules for The AI Gazette.')).toBe(true);
    expect(system).not.toMatch(/<!--/);
  });
  it('caps learned rules at 10 and 1,500 characters, pinned first', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ id: String(i), text: `Rule ${i}.` }));
    expect(capLearned([...many, { id: 'p', text: 'Pinned.', pinned: true }])[0].id).toBe('p');
    expect(capLearned(many)).toHaveLength(10);
    expect(capLearned([{ id: 'x', text: 'y'.repeat(1600) }])).toEqual([]);
  });
  it('fill leaves unknown placeholders empty', () => {
    expect(fill('a {{b}} c')).toBe('a  c');
  });
});

describe('Scout parsing', () => {
  it('ignores item numbers that do not exist, duplicates and papers not in the batch', () => {
    const batch = [{ paper: papers[0], items: [{ source: /** @type {const} */ ('hn'), kind: /** @type {const} */ ('discussion'), url: 'https://a.org', title: 'a', exact: true, weak: false }] }];
    const out = parseScout(JSON.stringify({ papers: [{ paper: 9, keep: [{ item: 1, kind: 'weird' }, { item: 1 }, { item: 7 }] }, { paper: 99, keep: [{ item: 1 }] }] }), batch);
    expect(out.get(9)).toHaveLength(1);
    expect(out.get(9)?.[0].kind).toBe('discussion');
    expect(out.has(99)).toBe(false);
  });
  it('reads JSON inside code fences, refuses prose', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => parseModelJson('no json here')).toThrow();
  });
});

describe('council helpers', () => {
  it('applies a fix only when its text occurs exactly once', () => {
    const s = { paper: 1, headline: 'a b', dept: 'd', body: 'x y x', question: 'q' };
    const r = applyFixPairs(s, [{ from: 'x', to: 'z' }, { from: 'y', to: 'w' }]);
    expect(r.applied).toEqual([{ from: 'y', to: 'w' }]);
    expect(r.story.body).toBe('x w x');
  });
  it('verdict keys change when the story or the sources change', () => {
    const s = { paper: 1, headline: 'a', dept: 'd', body: 'b', question: 'q' };
    expect(verdictKey('skeptic', s, [])).toBe(verdictKey('skeptic', { ...s }, []));
    expect(verdictKey('skeptic', s, [])).not.toBe(verdictKey('skeptic', { ...s, body: 'c' }, []));
    expect(verdictKey('skeptic', s, [])).not.toBe(verdictKey('editor', s, []));
  });
});

describe('budget and call log', () => {
  it('estimates and refuses past the cap', () => {
    const b = createBudget(0.01);
    const est = estimateUsd({ system: 'x'.repeat(4000), prompt: 'y'.repeat(4000) }, { in: 0.003, out: 0.015 }, 500);
    expect(est).toBeCloseTo(0.0135, 4);
    expect(b.canAfford(est)).toBe(false);
  });
  it('redacts anything that looks like a key and cuts at 64 KB', () => {
    const key = 'sk-ant-' + 'b'.repeat(30);
    const rec = callRecord({ runId: 'r', storyKey: null, lang: 'en', req: { model: 'm', system: `k ${key}`, prompt: 'z'.repeat(MAX_BYTES + 10), stage: 'write' }, reply: null, status: 'error', error: 'boom', at: new Date(0) });
    expect(rec.request.system).toBe('k [redacted]');
    expect(rec.request.truncated).toBe(true);
    expect(rec.reply.text).toBe('boom');
  });
});

describe('the paper\'s own arXiv number is a known fact', () => {
  it('a link that names "arXiv 2611.12799" does not fail the number check (first live edition, 16 Nov 2026)', async () => {
    const { sourceTexts } = await import('../pipeline/write.mjs');
    const p = { ...papers[1], arxivId: '2611.12799', url: 'https://arxiv.org/abs/2611.12799' };
    const { facts } = sourceTexts(p, []);
    expect(numbersIn('See [arXiv 2611.12799](https://arxiv.org/abs/2611.12799).').every((n) => facts.includes(n))).toBe(true);
  });
});


describe('the Week in Numbers', () => {
  const story = { n: 1, paperId: 'p1', headline: 'H', body: 'Exposure in [25% of runs](https://a.b/c) gave 97.9% violations after 128 updates.',
    claims: [{ text: '97.9% certified profitable violations after 128 updates', status: 'supported' }, { text: '25% of training episodes', status: 'unsupported' }] };
  it('keeps a figure only when it is in the story and in a traced claim', async () => {
    const { parseNumbers } = await import('../pipeline/numbers.mjs');
    const out = parseNumbers(JSON.stringify({ numbers: [
      { paper: 1, figure: '97.9%', label: 'of agents ended up cheating for profit' },
      { paper: 1, figure: '25%', label: 'of runs had conflicts' },
      { paper: 1, figure: '42', label: 'invented' },
      { paper: 9, figure: '128', label: 'no such story' },
    ] }), [story]);
    expect(out.map((x) => x.figure)).toEqual(['97.9%']);
  });
  it('refuses long, hyped or em dash labels', async () => {
    const { parseNumbers } = await import('../pipeline/numbers.mjs');
    const em = String.fromCharCode(0x2014);
    const out = parseNumbers(JSON.stringify({ numbers: [
      { paper: 1, figure: '97.9%', label: 'a groundbreaking share of agents' },
      { paper: 1, figure: '128', label: `updates ${em} long ones` },
      { paper: 1, figure: '128', label: 'x'.repeat(95) },
    ] }), [story]);
    expect(out).toEqual([]);
  });
  it('a figure must be a measured amount, not a name with a digit in it (week 46 Physics: "SU(4)", "1/f")', async () => {
    const { isStatistic, parseNumbers } = await import('../pipeline/numbers.mjs');
    for (const ok of ['97.9%', '896 GPU-days', '7.4 points', '145', '0.4%', '3x', '$1.2 billion', '~40 ms', '100']) expect(isStatistic(ok), ok).toBe(true);
    for (const bad of ['SU(4)', '1/f', 'GPT-4', '10^6', '2024', 'O(n)', 'H100', 'Llama-3', '']) expect(isStatistic(bad), bad).toBe(false);
    const phys = { n: 1, paperId: 'p1', headline: 'H', body: 'SU(4) results under 1/f noise pushed the coefficient above 100.',
      claims: [{ text: 'uses SU(4) results; 1/f noise; coefficient above 100', status: 'supported' }] };
    const out = parseNumbers(JSON.stringify({ numbers: [
      { paper: 1, figure: 'SU(4)', label: 'Lattice test uses SU(4) results' },
      { paper: 1, figure: '1/f', label: 'A driven qubit faces 1/f noise' },
      { paper: 1, figure: '100', label: 'Anomaly coefficient forced above 100' },
    ] }), [phys]);
    expect(out.map((x) => x.figure)).toEqual(['100']);
  });
  it('sends only stories with traced numeric claims', async () => {
    const { numbersData } = await import('../pipeline/numbers.mjs');
    const d = numbersData([story, { ...story, n: 2, claims: [] }]);
    expect(d).toMatch(/STORY 1/);
    expect(d).not.toMatch(/STORY 2/);
    expect(d).not.toMatch(/25% of training episodes/);
  });
});

describe('data labels never reach readers', () => {
  it('a story that writes "No SOURCES" fails with label_leak', () => {
    const p = papers[1];
    const r = checkStory({ ...SAMPLE['9'], body: `${SAMPLE['9'].body} No SOURCES have weighed in yet.` }, ctx());
    expect(r.fails.map((f) => f.code)).toContain('label_leak');
    expect(p).toBeTruthy();
  });
});
