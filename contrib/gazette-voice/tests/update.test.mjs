// @ts-check
import { describe, expect, it } from 'vitest';
import { runUpdate, checkUpdate } from '../pipeline/update.mjs';
import { loadPromptFiles } from '../prompts/index.mjs';
import { fakeDeps, scriptedModel } from '../../_sdk/fakes.mjs';
import { recordedNet, samplePapers } from './helpers.mjs';

const P = loadPromptFiles();
const prompts = { frame: P.frame, stages: { scout: P.scout, update: P.update } };
const { club, papers } = samplePapers();
const config = { sources: /** @type {any} */ (['hn', 'hf', 's2', 'news', 'github']), cheapModel: 'deepseek-v4-flash', budgetUsd: 0.05, rates: {} };
const JEPA = 'https://news.ycombinator.com/item?id=50325454';

describe('Update runs', () => {
  it('adds one checked sentence when something notable is new', async () => {
    // Day 3: everything except the busy HN thread was known at publish time.
    const { net } = recordedNet({ newsOk: true });
    const all = await (await import('../pipeline/gather/index.mjs')).gatherAll(papers[0], net, config.sources);
    const known = all.items.map((i) => i.url).filter((u) => u !== JEPA);
    const model = scriptedModel((req) => req.stage === 'scout'
      ? JSON.stringify({ papers: [{ paper: 9, keep: [{ item: Number(req.prompt.match(/\[(\d+)\] .*item\?id=50325454$/m)?.[1]), kind: 'discussion', adds: 'busy thread', stance: 'skeptical', notable: true }] }] })
      : JSON.stringify({ updates: [{ paper: 9, update: `A [Hacker News thread on a related JEPA paper](${JEPA}) drew 85 comments, with some readers doubting the demo.` }] }));
    const deps = fakeDeps({ callModel: model.callModel, net });
    const [r] = await runUpdate({ runId: 'u1', club, lang: 'en', items: [{ paper: papers[0], knownUrls: known }], config, prompts, deps });
    expect(r.update).toMatch(/^A \[Hacker News thread/);
    expect(deps.logged.map((c) => c.stage)).toEqual(['scout', 'update']);
  });
  it('makes no model call when nothing is new', async () => {
    const { net } = recordedNet({ newsOk: true });
    const all = await (await import('../pipeline/gather/index.mjs')).gatherAll(papers[0], net, config.sources);
    const deps = fakeDeps({ net });
    const [r] = await runUpdate({ runId: 'u2', club, lang: 'en', items: [{ paper: papers[0], knownUrls: all.items.map((i) => i.url) }], config, prompts, deps });
    expect(r).toMatchObject({ update: null, why: 'nothing new' });
    expect(deps.logged).toEqual([]);
  });
  it('refuses an Update that links something old, runs long or invents a number', () => {
    const fresh = [{ item: { source: /** @type {const} */ ('hn'), kind: /** @type {const} */ ('discussion'), url: JEPA, title: 'Thread', points: 172, comments: 85, exact: false, weak: true }, kind: 'discussion', adds: '', stance: 'neutral', notable: true }];
    expect(checkUpdate(`See [it](${JEPA}) with 85 comments.`, fresh, 'en')).toEqual([]);
    expect(checkUpdate('See [old](https://arxiv.org/abs/2611.12869).', fresh, 'en')).toEqual(['link_not_new:https://arxiv.org/abs/2611.12869']);
    expect(checkUpdate(`See [it](${JEPA}) with 900 comments.`, fresh, 'en')).toEqual(['number:900']);
    expect(checkUpdate(`See [it](${JEPA}) ${'word '.repeat(45)}`, fresh, 'en')).toContain('too_long');
  });
});
