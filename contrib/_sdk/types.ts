/**
 * The add-on SDK: everything a contrib add-on is allowed to use from ilm.red.
 *
 * Contrib code never imports the app (`@/...`), never reads `process.env` and never calls `fetch`
 * itself. It receives these interfaces instead. In tests they are the fakes in `./fakes.mjs`; when an
 * add-on is imported into ilm.red, `scripts/import-contrib-addon.mjs` in the app maps each one to the
 * real module (listed next to each interface) and a drift test there keeps the shapes in step.
 */

/** Two-letter language code used by the Gazette. */
export type Lang = 'en' | 'ur' | 'lg';

/** A club member's role. Real source: club membership in the app. */
export type ClubRole = 'owner' | 'admin' | 'moderator' | 'member' | 'visitor';

/** The signed-in reader, or a visitor. Real source: AuthContext + club membership. */
export interface Member {
  id: string | null;
  displayName: string | null;
  role: ClubRole;
  isSuperAdmin: boolean;
}

/**
 * One model call. Real source: worker `scripts/lib/blogFactory.mjs` callModel + usageLine + providerLog.
 * `system` is the cacheable prefix (house frame and style guide); `prompt` is the per-call part.
 */
export interface ModelRequest {
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  reasoning?: 'low' | 'high' | null;
  /** What the call is for, shown in the console: scout, write, check, council, level, update, fix. */
  stage: string;
}

export interface ModelReply {
  text: string;
  tokensIn: number;
  tokensOut: number;
  cachedIn: number;
  costUsd: number;
  ms: number;
  requestId: string | null;
}

export type CallModel = (req: ModelRequest) => Promise<ModelReply>;

/**
 * Network for the gatherers. Real source: a worker helper with a fixed host allow-list and timeouts.
 * Contrib code cannot reach any host the manifest does not declare.
 */
export interface Net {
  getJson(url: string): Promise<unknown>;
  getText(url: string): Promise<string>;
  /** HTTP status after redirects for a HEAD (or small GET) request; 0 when unreachable. */
  status(url: string): Promise<number>;
}

/** One logged model call, as the AI ops console shows it. Real table: gazette_voice_calls. */
export interface CallRecord {
  runId: string;
  storyKey: string | null;
  stage: string;
  lang: Lang;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cachedIn: number;
  costUsd: number;
  ms: number;
  status: 'ok' | 'error' | 'refused';
  request: { system: string; prompt: string; truncated: boolean };
  reply: { text: string; truncated: boolean };
  requestId: string | null;
  at: string;
}

export type LogCall = (rec: CallRecord) => Promise<void>;

/** Asks the app to queue an existing job kind (for example enrich-term). Real source: enqueue_system_job RPC. */
export type QueueJob = (kind: string, subjectKey: string, payload?: Record<string, unknown>) => Promise<{ jobId: string } | { refused: string }>;

/** Everything the pipeline is given. */
export interface PipelineDeps {
  callModel: CallModel;
  net: Net;
  logCall: LogCall;
  queueJob: QueueJob;
  now: () => Date;
}

/** Props every club add-on surface receives. Real source: AddonSurfaceProps in src/components/addons. */
export interface AddonSurfaceProps {
  clubId: string;
  clubSlug: string;
}

/** Calls to ilm.red's API (the add-on's own operations only). Real source: the app's API client. */
export interface Api {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown, opts?: { idempotencyKey?: string }): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
}

/** Translation function. Real source: useT(ns).t from src/i18n/I18nProvider. */
export type TFunc = (key: string, vars?: Record<string, string | number>) => string;

/** The React-side SDK, provided by `SdkProvider` (app) or `TestSdkProvider` (tests). */
export interface UiSdk {
  member: Member;
  lang: Lang;
  rtl: boolean;
  t: TFunc;
  api: Api;
  /** Real source: useClubAddonEnabled(clubId, slug). */
  addonEnabled: (clubId: string, slug: string) => boolean;
  /** Per-reader preference; members through the API, visitors in the browser. */
  prefs: { get(key: string): string | null; set(key: string, value: string): void };
  /** Build a link to an app page, e.g. a term page. */
  href: { term(clubSlug: string, termSlug: string): string; paper(paperPath: string): string };
}
