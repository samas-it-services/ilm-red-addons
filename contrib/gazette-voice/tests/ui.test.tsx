// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { TestSdkProvider, testSdk } from '../../_sdk/testing';
import { NewsroomView, NewsroomStory, pieces } from '../ui';
import type { NewsroomStoryData } from '../ui';
import { runEdition } from '../pipeline/run.mjs';
import { toNewsroomData, chipsFor } from '../pipeline/present.mjs';
import { loadPromptFiles } from '../prompts/index.mjs';
import { fakeDeps } from '../../_sdk/fakes.mjs';
import { recordedNet, samplePapers } from './helpers.mjs';
import { sampleModel, memoryStore } from './scripted.mjs';

afterEach(cleanup);

const P = loadPromptFiles();
const { club, papers } = samplePapers();

/** The two sample stories exactly as the pipeline produces them, mapped for the screen. */
async function sampleStories(): Promise<NewsroomStoryData[]> {
  const deps = fakeDeps({ callModel: sampleModel().callModel, net: recordedNet({ newsOk: true }).net });
  const { records } = await runEdition({
    runId: 'r', club, lang: 'en', papers,
    config: { sources: ['hn', 'hf', 's2', 'news', 'github'], writerModel: 'claude-sonnet-5', cheapModel: 'deepseek-v4-flash', budgetUsd: 0.5, rates: {} },
    prompts: { frame: P.frame, stages: { scout: P.scout, 'write.en': P['write.en'], rewrite: P.rewrite, skeptic: P.skeptic, editor: P.editor, level: P.level }, voices: {}, learned: {} },
    store: memoryStore(), deps,
  });
  return records.map((r, i) => toNewsroomData(r, { storyId: `s${i}`, paperPath: papers[i].path, masthead: club.masthead }) as NewsroomStoryData);
}

const wrap = (ui: React.ReactNode, over: Parameters<typeof testSdk>[0] = {}) => render(<TestSdkProvider sdk={testSdk(over)}>{ui}</TestSdkProvider>);

describe('Newsroom screens', () => {
  it('shows the Plato story with its dept line, byline, links, question and chips', async () => {
    const [prh] = await sampleStories();
    wrap(<NewsroomView clubId="club_ai" clubSlug="ai" stories={[prh]} />);
    expect(screen.getByRole('heading', { name: "Plato's Cave Gets Cleaner Captions, and the Shadows Line Up Again" })).toBeTruthy();
    expect(screen.getByText('from the garbage-in-forms-out dept.')).toBeTruthy();
    expect(screen.getByText('Posted by the AI Gazette desk')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'an EPFL team' }).getAttribute('href')).toBe('https://arxiv.org/abs/2602.14486');
    expect(screen.getByRole('link', { name: 'an EPFL team' }).getAttribute('rel')).toContain('nofollow');
    const chips = within(screen.getByRole('list', { name: 'Coverage' }));
    expect(chips.getAllByRole('link').map((a) => a.textContent?.replace(/\u00a0/g, ' '))).toEqual(['Hacker News · 85 comments', 'Hugging Face · 7 upvotes', 'GitHub · 8 stars', 'Quanta Magazine']);
  });

  it('highlights 8 terms with level tags, each linking to its term page', async () => {
    const [prh] = await sampleStories();
    wrap(<NewsroomView clubId="club_ai" clubSlug="ai" stories={[prh]} />);
    const terms = document.querySelectorAll('a[data-level]');
    expect(terms).toHaveLength(8);
    const rsm = [...terms].find((a) => a.textContent?.startsWith('representation similarity metrics'));
    expect(rsm?.getAttribute('href')).toBe('https://ilm.red/book-clubs/ai/terms/representation-similarity-metric');
    expect(rsm?.getAttribute('data-level')).toBe('expert');
    expect(rsm?.querySelector('sup')?.textContent).toBe('Expert');
  });

  it('the switch turns every term into plain text; a level button hides only that level; the choice is remembered', async () => {
    const [prh] = await sampleStories();
    const sdk = testSdk();
    const { unmount } = render(<TestSdkProvider sdk={sdk}><NewsroomView clubId="club_ai" clubSlug="ai" stories={[prh]} /></TestSdkProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Expert' }));
    expect(document.querySelectorAll('a[data-level="expert"]')).toHaveLength(0);
    expect(document.querySelectorAll('a[data-level]')).toHaveLength(7);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Highlight terms' }));
    expect(document.querySelectorAll('a[data-level]')).toHaveLength(0);
    expect(screen.getByText(/representation similarity metrics/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Easy' }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    render(<TestSdkProvider sdk={sdk}><NewsroomView clubId="club_ai" clubSlug="ai" stories={[prh]} /></TestSdkProvider>);
    expect((screen.getByRole('checkbox', { name: 'Highlight terms' }) as HTMLInputElement).checked).toBe(false);
  });

  it('hover or keyboard focus shows the term card with its explainer', async () => {
    const [prh] = await sampleStories();
    wrap(<NewsroomView clubId="club_ai" clubSlug="ai" stories={[prh]} />);
    const lm = [...document.querySelectorAll('a[data-level]')].find((a) => a.textContent?.startsWith('language models')) as HTMLElement;
    fireEvent.focus(lm);
    expect(screen.getByRole('tooltip').textContent).toContain("The invisible engine powering today's talking computers.");
    fireEvent.blur(lm);
    expect(screen.queryByRole('tooltip')).toBeNull();
    const vm = [...document.querySelectorAll('a[data-level]')].find((a) => a.textContent?.startsWith('vision models')) as HTMLElement;
    fireEvent.mouseEnter(vm);
    expect(screen.getByRole('tooltip').textContent).toContain('No plain explainer yet.');
  });

  it('the quantization story says it has no coverage yet', async () => {
    const [, q] = await sampleStories();
    wrap(<NewsroomStory story={q} clubSlug="ai" prefs={{ highlight: true, levels: ['easy', 'advanced', 'expert'] }} />);
    expect(screen.getByText('No outside coverage yet')).toBeTruthy();
    expect(document.querySelectorAll('a[data-level]')).toHaveLength(7);
  });

  it('a plain story shows the Easy text with a plain label', () => {
    const plainStory = { story_id: 'p', paper_id: 'x', paper_path: '/books/x', lang: 'en', state: 'plain', headline: '', dept: '', byline: '', body: '', question: '', chips: [], terms: [], update: null, revision: 1, easy: { headline: 'Predicting how one model change shifts other behavior', text: 'Researchers found a surprisingly consistent rule.' } } as NewsroomStoryData;
    wrap(<NewsroomStory story={plainStory} clubSlug="ai" prefs={{ highlight: true, levels: [] }} />);
    expect(screen.getByText('Plain version')).toBeTruthy();
    expect(screen.getByText('Researchers found a surprisingly consistent rule.')).toBeTruthy();
  });

  it('shows the Update line with its link', async () => {
    const [prh] = await sampleStories();
    wrap(<NewsroomStory story={{ ...prh, update: 'A [new thread](https://news.ycombinator.com/item?id=1) drew 40 comments.' }} clubSlug="ai" prefs={{ highlight: false, levels: [] }} />);
    expect(screen.getByText('Update:')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'new thread' }).getAttribute('href')).toBe('https://news.ycombinator.com/item?id=1');
  });

  it('the gear shows only for managers; Suggest a fix only for signed-in readers', async () => {
    const [prh] = await sampleStories();
    const view = (role: 'member' | 'moderator' | 'visitor') => wrap(<NewsroomView clubId="club_ai" clubSlug="ai" stories={[prh]} onOpenConsole={() => {}} actions={{ onSuggestFix: () => {} }} />, { role, member: role === 'visitor' ? { id: null, displayName: null, role, isSuperAdmin: false } : undefined });
    view('member');
    expect(screen.queryByRole('button', { name: 'Open the AI ops console' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Suggest a fix' })).toBeTruthy();
    cleanup();
    view('moderator');
    expect(screen.getByRole('button', { name: 'Open the AI ops console' })).toBeTruthy();
    cleanup();
    view('visitor');
    expect(screen.queryByRole('button', { name: 'Suggest a fix' })).toBeNull();
  });

  it('renders nothing when the club does not have the add-on on', async () => {
    const [prh] = await sampleStories();
    const { container } = wrap(<NewsroomView clubId="club_x" clubSlug="x" stories={[prh]} />, { addonEnabled: () => false });
    expect(container.innerHTML).toBe('');
  });

  it('Urdu: right to left, Urdu words, terms by their Urdu names', () => {
    const ur = { story_id: 'u', paper_id: 'x', paper_path: '/b', lang: 'ur', state: 'ready', headline: 'افلاطون کے غار میں صاف کیپشن', dept: 'شعبۂ جیسا کیپشن، ویسا افلاطون', byline: 'اے آئی گزٹ ڈیسک کی پیشکش', body: 'نئے لسانی ماڈلز میں بھی', question: 'تو؟', chips: [], terms: [{ name: 'لسانی ماڈلز', slug: 'language-model', level: 'easy', start: 4, end: 15, hook: null }], update: null, revision: 1 } as NewsroomStoryData;
    wrap(<NewsroomView clubId="club_ai" clubSlug="ai" stories={[ur]} />, { lang: 'ur' });
    expect(screen.getByRole('region', { name: 'Newsroom' }).getAttribute('dir')).toBe('rtl');
    expect(screen.getByRole('checkbox', { name: 'اصطلاحات نمایاں کریں' })).toBeTruthy();
    expect(document.querySelector('a[data-level]')?.textContent).toBe('لسانی ماڈلزآسان');
    expect(document.querySelector('a[data-level] sup')?.className).toBe('sr-only');
  });

  it('never prints the level beside an English term either; the underline style carries it', async () => {
    const { LEVEL_CLASS } = await import('../ui/StoryBody');
    expect(LEVEL_CLASS.easy).toMatch(/border-dotted/);
    expect(LEVEL_CLASS.advanced).toMatch(/border-dashed/);
    expect(LEVEL_CLASS.expert).toMatch(/border-solid/);
  });
});

describe('screen helpers', () => {
  it('pieces never lets a term overlap a link and keeps all text', () => {
    const body = 'See [the paper](https://a.org) on models.';
    const ps = pieces(body, [{ name: 'paper', slug: 'p', level: 'easy', start: 9, end: 14, hook: null }, { name: 'models', slug: 'm', level: 'easy', start: 34, end: 40, hook: null }]);
    expect(ps.map((p) => p.kind)).toEqual(['text', 'link', 'text', 'term', 'text']);
    expect(ps.map((p) => p.text).join('')).toBe('See the paper on models.');
  });
  it('chips rank threads, votes, code, news; at most four; no duplicates', () => {
    const it = (o: object) => ({ item: { exact: true, weak: false, title: '', url: 'https://x.org', ...o }, kind: '', adds: '', stance: '', notable: true });
    const c = chipsFor([it({ source: 'news', kind: 'news', outlet: 'Quanta' }), it({ source: 'hn', kind: 'discussion', comments: 1200 }), it({ source: 'hf', kind: 'votes', points: 7 }), it({ source: 'github', kind: 'code', stars: 8 }), it({ source: 'hn', kind: 'discussion', comments: 3 })] as never);
    expect(c.map((x) => `${x.label}${x.detail ? ` ${x.detail}` : ''}`)).toEqual(['Hacker News 1.2k comments', 'Hugging Face 7 upvotes', 'GitHub 8 stars', 'Quanta']);
  });
});
