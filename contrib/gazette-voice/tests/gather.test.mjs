// @ts-check
import { describe, expect, it } from 'vitest';
import { gatherAll } from '../pipeline/gather/index.mjs';
import { gatherHn } from '../pipeline/gather/hn.mjs';
import { parseRss } from '../pipeline/gather/news.mjs';
import { isArxivUrlFor } from '../pipeline/gather/util.mjs';
import { checkLinks, urlShapeOk } from '../pipeline/links.mjs';
import { fakeNet } from '../../_sdk/fakes.mjs';
import { fixtureText, recordedNet, samplePapers } from './helpers.mjs';

const ALL = /** @type {const} */ (['hn', 'hf', 's2', 'news', 'github', 'youtube']);
const [prh, quant] = samplePapers().papers;

describe('exact arXiv matching', () => {
  it('accepts abs, pdf and versions, refuses near-miss numbers', () => {
    expect(isArxivUrlFor('https://arxiv.org/abs/2611.12869', '2611.12869')).toBe(true);
    expect(isArxivUrlFor('https://arxiv.org/pdf/2611.12869v2.pdf', '2611.12869')).toBe(true);
    expect(isArxivUrlFor('https://arxiv.org/abs/2601.18692', '2611.12869')).toBe(false);
    expect(isArxivUrlFor('https://arxiv.org/abs/2611.128690', '2611.12869')).toBe(false);
  });
});

describe('Hacker News (recorded 16 Nov)', () => {
  it('drops the fuzzy URL match for a different paper and keeps topic threads as weak', async () => {
    const items = await gatherHn(prh, recordedNet().net);
    expect(items.some((i) => i.title === 'A Pragmatic VLA Foundation Model')).toBe(false);
    const jepa = items.find((i) => i.url === 'https://news.ycombinator.com/item?id=50325454');
    expect(jepa).toMatchObject({ points: 172, comments: 85, weak: true, exact: false });
  });
  it('finds nothing for the quantization paper (both URL hits are near misses)', async () => {
    expect(await gatherHn(quant, recordedNet().net)).toEqual([]);
  });
});

describe('all sources for the Plato paper', () => {
  it('collects Hugging Face votes, the code repo with stars, HN threads, and survives the Google News block page', async () => {
    const { items, notes } = await gatherAll(prh, recordedNet().net, [...ALL]);
    const hf = items.find((i) => i.source === 'hf' && i.kind === 'votes');
    expect(hf).toMatchObject({ points: 7, exact: true });
    const code = items.find((i) => i.kind === 'code');
    expect(code).toMatchObject({ url: 'https://github.com/ExplainableML/prh-closer-look', stars: 8, source: 'github' });
    expect(items.filter((i) => i.kind === 'code')).toHaveLength(1);
    expect(notes).toEqual([{ source: 'news', error: 'news: reply is not RSS (blocked or changed)' }]);
  });
  it('with the successful news reply, keeps Quanta and EPFL as weak topic items', async () => {
    const { items, notes } = await gatherAll(prh, recordedNet({ newsOk: true }).net, [...ALL]);
    expect(notes).toEqual([]);
    const news = items.filter((i) => i.source === 'news').map((i) => i.outlet);
    expect(news).toEqual(expect.arrayContaining(['Quanta Magazine', 'EPFL']));
  });
  it("finds the prior work the paper answers in its own references (EPFL, Back into Plato's Cave)", async () => {
    const { items } = await gatherAll(prh, recordedNet().net, ['s2']);
    const urls = items.map((i) => i.url);
    expect(urls).toEqual(expect.arrayContaining(['https://arxiv.org/abs/2602.14486', 'https://arxiv.org/abs/2604.18572']));
    expect(items.every((i) => i.weak && i.kind === 'paper')).toBe(true);
    expect(urls).not.toContain('https://arxiv.org/abs/2103.00020');
  });
  it('only calls declared sources', async () => {
    const { net, seen } = recordedNet();
    await gatherAll(prh, net, ['hf']);
    expect(seen).toEqual(['https://huggingface.co/api/papers/2611.12869']);
  });
});

describe('the quantization paper has no coverage', () => {
  it('has no outside coverage (only weak prior work from its references), and the news block is only a note', async () => {
    const { items, notes } = await gatherAll(quant, recordedNet().net, [...ALL]);
    expect(items.filter((i) => i.kind !== 'paper')).toEqual([]);
    expect(items.every((i) => i.weak)).toBe(true);
    expect(notes.map((n) => n.source)).toEqual(['news']);
  });
});

describe('RSS parsing', () => {
  it('refuses a block page', () => {
    expect(() => parseRss(fixtureText('recorded/news-2611.12869.xml'))).toThrow(/not RSS/);
  });
});

describe('link safety', () => {
  it('refuses http, shorteners and credentials in the URL', () => {
    expect(urlShapeOk('http://example.org/a')).toBe(false);
    expect(urlShapeOk('https://bit.ly/x')).toBe(false);
    expect(urlShapeOk('https://user:pw@example.org/')).toBe(false);
    expect(urlShapeOk('https://www.quantamagazine.org/x')).toBe(true);
  });
  it('drops dead links and asks each URL once', async () => {
    const { net } = fakeNet({}, { 'https://dead.example.org/': 404 });
    let asked = 0;
    const counting = { ...net, status: async (/** @type {string} */ u) => { asked++; return net.status(u); } };
    const cache = new Map();
    const items = [{ url: 'https://ok.example.org/' }, { url: 'https://dead.example.org/' }, { url: 'https://ok.example.org/' }];
    const r = await checkLinks(items, counting, { cache });
    expect(r.ok).toHaveLength(2);
    expect(r.dropped).toEqual([{ url: 'https://dead.example.org/', why: 'status 404' }]);
    expect(asked).toBe(2);
  });
});
