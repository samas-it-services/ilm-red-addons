// @ts-check
import { describe, expect, it } from 'vitest';
import { runEdition } from '../pipeline/run.mjs';
import { checkStory } from '../pipeline/checks.mjs';
import { allowedUrls, sourceTexts, writerTerms, writeData } from '../pipeline/write.mjs';
import { loadPromptFiles } from '../prompts/index.mjs';
import { fakeDeps } from '../../_sdk/fakes.mjs';
import { recordedNet, samplePapers } from './helpers.mjs';
import { sampleModel, memoryStore, SAMPLE, KEPT_9 } from './scripted.mjs';

const P = loadPromptFiles();
const prompts = {
  frame: P.frame,
  stages: { scout: P.scout, 'write.en': P['write.en'], 'write.ur': P['write.ur'], rewrite: P.rewrite, skeptic: P.skeptic, editor: P.editor, level: P.level },
  voices: { 'write.ur': { text: P['voice.default.ur'], version: 'v1' } },
  learned: { en: [], ur: [] },
};
const config = { sources: /** @type {any} */ (['hn', 'hf', 's2', 'news', 'github']), writerModel: 'claude-sonnet-5', cheapModel: 'deepseek-v4-flash', budgetUsd: 0.5, rates: {} };
const { club, papers } = samplePapers();
const prh = papers[0];

describe('Urdu Newsroom', () => {
  it('the Urdu sample passes the Urdu checks (limits, dept line, Urdu digits read as numbers)', () => {
    const fakeKept = KEPT_9.map((url) => ({ item: { source: /** @type {const} */ ('hn'), kind: /** @type {const} */ ('discussion'), url, title: 't', exact: true, weak: false, linksTo: url.includes('47921601') ? 'https://arxiv.org/abs/2405.07987' : undefined }, kind: 'news', adds: '', stance: 'neutral', notable: true }));
    const st = sourceTexts(prh, fakeKept);
    const r = checkStory({ paper: 9, ...SAMPLE['9ur'] }, { lang: 'ur', allowedUrls: allowedUrls(prh, fakeKept), paperUrl: prh.url, sourceTexts: st.texts, factText: st.facts });
    expect(r.fails).toEqual([]);
    expect(r.stats.words).toBeGreaterThan(150);
  });

  it('the writer is given Urdu term names where they exist', () => {
    expect(writerTerms(prh, 'ur')).toEqual(expect.arrayContaining(['افلاطونی نمائندگی کا مفروضہ (Platonic Representation Hypothesis (PRH))', 'لسانی ماڈل (language model)', 'vision model']));
    expect(writeData([{ paper: prh, sources: [] }], 'ur')).toMatch(/SOURCES:\n\(none yet\)/);
  });

  it('runs end to end in Urdu: Urdu prompt and voice, Urdu term matches, same coverage reused from the English run', async () => {
    const store = memoryStore();
    const model = sampleModel({}, { lang: 'ur' });
    const deps = fakeDeps({ callModel: model.callModel, net: recordedNet({ newsOk: true }).net });
    const { records } = await runEdition({ runId: 'ur-1', club, lang: 'ur', papers: [prh], config, prompts, store, deps });
    expect(records[0].state).toBe('ready');
    expect(records[0].terms.map((t) => t.slug)).toEqual(['platonic-representation-hypothesis-prh', 'language-model']);
    const write = deps.logged.find((c) => c.stage === 'write');
    expect(write?.request.system).toMatch(/write one Newsroom story per paper in Urdu/);
    expect(write?.request.system).toMatch(/ہمارے قاری/);
    // A second language in the same edition reuses the day's coverage. If it gathered again, this network
    // would fail every source, the sample's links would not be in the gathered set and the story would be plain.
    const deps2 = fakeDeps({ callModel: sampleModel().callModel, net: { getJson: async () => { throw new Error('should be cached'); }, getText: async () => { throw new Error('should be cached'); }, status: async () => 200 } });
    const again = await runEdition({ runId: 'en-1', club, lang: 'en', papers: [prh], config, prompts: { ...prompts, voices: {} }, store, deps: deps2 });
    expect(again.records[0].state).toBe('ready');
  });

  it('refuses Arabic letter forms only through normalising, and flags coinages and Roman Urdu in the headline', () => {
    const s = { paper: 9, ...SAMPLE['9ur'], headline: 'Plato kay ghaar mein saaf caption' };
    const fakeKept = KEPT_9.map((url) => ({ item: { source: /** @type {const} */ ('hn'), kind: /** @type {const} */ ('discussion'), url, title: 't', exact: true, weak: false, linksTo: url.includes('47921601') ? 'https://arxiv.org/abs/2405.07987' : undefined }, kind: 'news', adds: '', stance: 'neutral', notable: true }));
    const st = sourceTexts(prh, fakeKept);
    const codes = checkStory({ ...s, question: `${s.question} تعامل` }, { lang: 'ur', allowedUrls: allowedUrls(prh, fakeKept), paperUrl: prh.url, sourceTexts: st.texts, factText: st.facts }).fails.map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(['roman_text', 'urdu_coinage']));
  });
});

describe('Urdu batch size and pricing', () => {
  it('writes Urdu three stories at a time and English five (Urdu needs about twice the output)', async () => {
    const { WRITE_BATCH } = await import('../pipeline/run.mjs');
    expect(WRITE_BATCH).toEqual({ en: 5, ur: 3 });
  });
});
