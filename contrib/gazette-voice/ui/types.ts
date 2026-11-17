/** What the add-on's screens receive from the API (see docs/API.md). */
export type Level = 'easy' | 'advanced' | 'expert';

export interface NewsroomTerm {
  name: string;
  slug: string;
  level: Level;
  /** positions in `body` (the raw text with [anchor](url) links) */
  start: number;
  end: number;
  hook: string | null;
}

export interface NewsroomChip {
  kind: 'discussion' | 'votes' | 'code' | 'news' | 'citations' | 'video' | 'none';
  label: string;
  detail?: string;
  url?: string;
}

export interface NewsroomStoryData {
  story_id: string;
  paper_id: string;
  paper_path: string;
  lang: 'en' | 'ur';
  state: 'ready' | 'plain';
  headline: string;
  dept: string;
  byline: string;
  body: string;
  question: string;
  chips: NewsroomChip[];
  terms: NewsroomTerm[];
  update: string | null;
  revision: number;
  /** the paper's Easy story, shown when state is plain */
  easy?: { headline: string; text: string };
}

export interface TermPrefs {
  highlight: boolean;
  levels: Level[];
}

export const ALL_LEVELS: Level[] = ['easy', 'advanced', 'expert'];
