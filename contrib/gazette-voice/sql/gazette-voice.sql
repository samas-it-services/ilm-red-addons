-- Gazette Voice: reference schema and functions (contrib, in review).
-- On import this becomes one additive migration in the ilm.red app. It relies on these app objects:
--   book_clubs(id, owner_id), book_club_members(book_club_id, user_id, role, status, joined_at),
--   club_role_of(club, owner, viewer) -> 'owner' | 'moderator' | 'member' | NULL,
--   has_role(user, 'super_admin'), is_system_actor(), addon_registry, book_club_addons.
-- Every api_* function is called by the API gateway as the system actor with the signed-in member as
-- p_actor, and answers jsonb { ok: true, ... } or { ok: false, reason }. Tables have RLS on and no
-- policies: they are read only through these functions.

BEGIN;

-- Registry row (published, official, off by default per club).
INSERT INTO addon_registry (slug, name, version, description, icon, author, license, entry_point, category, permissions, config_schema, is_builtin, is_official, is_free, status, privacy_statement)
VALUES ('gazette-voice', 'Gazette Voice', '0.1.0',
        'Adds a Newsroom view to a club''s Gazette: lively write-ups that link outside coverage, terms highlighted by level, member fixes and an AI ops console for managers.',
        '📰', 'ILM Red Unbound', 'Apache-2.0', 'GazetteVoiceAddon', 'engagement', ARRAY['read_books', 'ai:spend']::text[],
        '{"type":"object","properties":{"voice":{"enum":["newsroom","plain"]},"sources":{"type":"array"},"writer_model":{"type":"string"},"edition_budget_usd":{"type":"number","minimum":0.05,"maximum":1},"updates":{"type":"boolean"},"length":{"enum":["short","standard"]},"daily_regenerations":{"type":"integer","minimum":0,"maximum":100}}}'::jsonb,
        false, true, true, 'published',
        'Newsroom stories are written by AI from the paper and public coverage. Fixes you suggest are shown to the club''s managers with your name.')
ON CONFLICT (slug) DO UPDATE SET version = EXCLUDED.version, description = EXCLUDED.description, config_schema = EXCLUDED.config_schema, privacy_statement = EXCLUDED.privacy_statement;

-- ── Tables ────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gazette_voice_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      uuid NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
  week         text NOT NULL CHECK (week ~ '^\d{4}-W\d{2}$'),
  lang         text NOT NULL CHECK (lang IN ('en', 'ur')),
  kind         text NOT NULL CHECK (kind IN ('edition', 'trial', 'regenerate', 'update')),
  status       text NOT NULL DEFAULT 'running' CHECK (status IN ('priced', 'running', 'done', 'failed')),
  stages       jsonb NOT NULL DEFAULT '[]'::jsonb,
  budget_usd   numeric(10,5) NOT NULL CHECK (budget_usd >= 0),
  estimate_usd numeric(10,5),
  cost_usd     numeric(10,5) NOT NULL DEFAULT 0,
  stories      int NOT NULL DEFAULT 0,
  calls        int NOT NULL DEFAULT 0,
  started_by   uuid,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);
CREATE INDEX IF NOT EXISTS gvr_club_started ON gazette_voice_runs (club_id, started_at DESC);

CREATE TABLE IF NOT EXISTS paper_coverage (
  paper_id   uuid PRIMARY KEY,
  items      jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes      jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gazette_voice_stories (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
  week           text NOT NULL,
  paper_id       uuid NOT NULL,
  lang           text NOT NULL CHECK (lang IN ('en', 'ur')),
  state          text NOT NULL CHECK (state IN ('ready', 'plain')),
  reason         text,
  headline       text NOT NULL DEFAULT '',
  dept           text NOT NULL DEFAULT '',
  body           text NOT NULL DEFAULT '' CHECK (length(body) <= 6000),
  question       text NOT NULL DEFAULT '',
  sources        jsonb NOT NULL DEFAULT '[]'::jsonb,
  terms          jsonb NOT NULL DEFAULT '[]'::jsonb,
  checks         jsonb,
  verdicts       jsonb,
  update_text    text,
  update_sources jsonb,
  revision       int NOT NULL DEFAULT 1,
  run_id         uuid REFERENCES gazette_voice_runs(id) ON DELETE SET NULL,
  flagged_plain  boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, week, paper_id, lang)
);

-- Trial stories never reach gazette_voice_stories, so a trial can never be published.
CREATE TABLE IF NOT EXISTS gazette_voice_trial_stories (
  run_id     uuid NOT NULL REFERENCES gazette_voice_runs(id) ON DELETE CASCADE,
  paper_id   uuid NOT NULL,
  lang       text NOT NULL,
  story      jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, paper_id, lang)
);

CREATE TABLE IF NOT EXISTS gazette_voice_story_revisions (
  story_id   uuid NOT NULL REFERENCES gazette_voice_stories(id) ON DELETE CASCADE,
  revision   int NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('written', 'repaired', 'checked', 'fix_applied', 'regenerated', 'update', 'undo')),
  summary    text NOT NULL,
  who        text NOT NULL CHECK (who IN ('desk', 'member', 'manager', 'automatic')),
  actor      uuid,
  fix_id     uuid,
  fields     jsonb NOT NULL,          -- headline, dept, body, question, terms after this revision
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, revision)
);

CREATE TABLE IF NOT EXISTS gazette_voice_calls (
  id          bigserial PRIMARY KEY,
  club_id     uuid NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
  run_id      uuid NOT NULL REFERENCES gazette_voice_runs(id) ON DELETE CASCADE,
  story_id    uuid,
  stage       text NOT NULL,
  lang        text NOT NULL,
  model       text NOT NULL,
  tokens_in   int NOT NULL DEFAULT 0,
  tokens_out  int NOT NULL DEFAULT 0,
  cached_in   int NOT NULL DEFAULT 0,
  cost_usd    numeric(10,6) NOT NULL DEFAULT 0,
  ms          int NOT NULL DEFAULT 0,
  status      text NOT NULL CHECK (status IN ('ok', 'error', 'refused')),
  request     jsonb,                  -- { system, prompt, layers, truncated }; NULL once moved to storage
  reply       jsonb,                  -- { text, truncated };                     NULL once moved to storage
  body_path   text,                   -- storage object holding request and reply after 90 days
  request_id  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (request IS NOT NULL OR body_path IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS gvc_club_time ON gazette_voice_calls (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gvc_run ON gazette_voice_calls (run_id);

CREATE TABLE IF NOT EXISTS gazette_voice_prompts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
  stage           text NOT NULL CHECK (stage IN ('write', 'update', 'editor')),
  lang            text NOT NULL CHECK (lang IN ('en', 'ur')),
  default_version int,
  UNIQUE (club_id, stage, lang)
);
CREATE TABLE IF NOT EXISTS gazette_voice_prompt_versions (
  prompt_id  uuid NOT NULL REFERENCES gazette_voice_prompts(id) ON DELETE CASCADE,
  version    int NOT NULL,
  voice      text NOT NULL CHECK (length(voice) BETWEEN 20 AND 6000),
  note       text CHECK (note IS NULL OR length(note) <= 300),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prompt_id, version)
);

CREATE TABLE IF NOT EXISTS gazette_voice_learned (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
  lang       text NOT NULL CHECK (lang IN ('en', 'ur')),
  text       text NOT NULL CHECK (length(text) BETWEEN 5 AND 300),
  pinned     boolean NOT NULL DEFAULT false,
  removed_at timestamptz,
  from_fix   uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gazette_voice_fixes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id      uuid NOT NULL REFERENCES gazette_voice_stories(id) ON DELETE CASCADE,
  club_id       uuid NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
  member_id     uuid,                 -- NULL after the member's account is erased
  kind          text NOT NULL CHECK (kind IN ('fact', 'link', 'tone', 'wording', 'term_level', 'wrong_term', 'other')),
  quote         text CHECK (quote IS NULL OR length(quote) <= 500),
  replacement   text NOT NULL CHECK (length(replacement) <= 500),
  reason        text CHECK (reason IS NULL OR length(reason) <= 500),
  state         text NOT NULL CHECK (state IN ('applied', 'waiting', 'regenerating', 'regenerated', 'rejected', 'undone')),
  auto          boolean NOT NULL DEFAULT false,
  check_result  jsonb,
  learned_id    uuid,
  manager_reply text CHECK (manager_reply IS NULL OR length(manager_reply) <= 500),
  acted_by      uuid,
  acted_at      timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- One open fix per story per member.
CREATE UNIQUE INDEX IF NOT EXISTS gvf_one_open ON gazette_voice_fixes (story_id, member_id) WHERE state = 'waiting';
CREATE INDEX IF NOT EXISTS gvf_member_day ON gazette_voice_fixes (member_id, created_at);

CREATE TABLE IF NOT EXISTS gazette_voice_flags (
  story_id   uuid NOT NULL REFERENCES gazette_voice_stories(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('fact', 'tone')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, member_id)
);

-- Gazette-only term labels. Never written to the shared terms.level.
CREATE TABLE IF NOT EXISTS gazette_voice_term_labels (
  club_id    uuid NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
  term_slug  text NOT NULL,
  level      text NOT NULL CHECK (level IN ('easy', 'advanced', 'expert')),
  source     text NOT NULL CHECK (source IN ('step', 'manager')),
  set_by     uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, term_slug)
);

CREATE TABLE IF NOT EXISTS gazette_voice_prefs (
  user_id    uuid PRIMARY KEY,
  highlight  boolean NOT NULL DEFAULT true,
  levels     text[] NOT NULL DEFAULT ARRAY['easy', 'advanced', 'expert'],
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (levels <@ ARRAY['easy', 'advanced', 'expert'])
);

DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['gazette_voice_runs', 'paper_coverage', 'gazette_voice_stories', 'gazette_voice_trial_stories', 'gazette_voice_story_revisions',
                           'gazette_voice_calls', 'gazette_voice_prompts', 'gazette_voice_prompt_versions', 'gazette_voice_learned',
                           'gazette_voice_fixes', 'gazette_voice_flags', 'gazette_voice_term_labels', 'gazette_voice_prefs'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $do$;

-- ── Who may do what ───────────────────────────────────────────────────────────────────────────

-- Managers: the club's owner, admins and moderators (club_role_of folds admin into moderator), and super admins.
CREATE OR REPLACE FUNCTION gazette_voice_can_manage(p_club uuid, p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  -- COALESCE matters: club_role_of is NULL for someone outside the club, and NULL here would make every
  -- `IF NOT gazette_voice_can_manage(...)` skip its refusal. Always true or false, never NULL.
  SELECT COALESCE(p_actor IS NOT NULL AND (
    COALESCE(has_role(p_actor, 'super_admin'), false)
    OR COALESCE((SELECT club_role_of(c.id, c.owner_id, p_actor) IN ('owner', 'moderator') FROM book_clubs c WHERE c.id = p_club), false)
  ), false);
$fn$;

-- An active member of the club (any role).
CREATE OR REPLACE FUNCTION gazette_voice_is_member(p_club uuid, p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE(p_actor IS NOT NULL AND (
    EXISTS (SELECT 1 FROM book_clubs c WHERE c.id = p_club AND c.owner_id = p_actor)
    OR EXISTS (SELECT 1 FROM book_club_members m WHERE m.book_club_id = p_club AND m.user_id = p_actor AND m.status = 'active')
  ), false);
$fn$;

CREATE OR REPLACE FUNCTION gazette_voice_story_fields(s gazette_voice_stories)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $fn$
  SELECT jsonb_build_object('headline', s.headline, 'dept', s.dept, 'body', s.body, 'question', s.question, 'terms', s.terms);
$fn$;

-- ── Reader ────────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION api_gazette_voice_history(p_actor uuid, p_story uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE s gazette_voice_stories; v_manager boolean;
BEGIN
  IF NOT is_system_actor() THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_not_system'); END IF;
  SELECT * INTO s FROM gazette_voice_stories WHERE id = p_story;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  v_manager := gazette_voice_can_manage(s.club_id, p_actor);
  RETURN jsonb_build_object('ok', true, 'revisions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('revision', r.revision, 'at', r.created_at, 'kind', r.kind, 'summary', r.summary, 'who', r.who,
                                        'undoable', v_manager AND r.revision < s.revision) ORDER BY r.revision DESC)
      FROM gazette_voice_story_revisions r WHERE r.story_id = p_story), '[]'::jsonb));
END $fn$;

CREATE OR REPLACE FUNCTION api_gazette_voice_prefs_get(p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE p gazette_voice_prefs;
BEGIN
  IF NOT is_system_actor() THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_not_system'); END IF;
  IF p_actor IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in'); END IF;
  SELECT * INTO p FROM gazette_voice_prefs WHERE user_id = p_actor;
  RETURN jsonb_build_object('ok', true, 'highlight', COALESCE(p.highlight, true), 'levels', to_jsonb(COALESCE(p.levels, ARRAY['easy', 'advanced', 'expert'])));
END $fn$;

CREATE OR REPLACE FUNCTION api_gazette_voice_prefs_put(p_actor uuid, p_highlight boolean, p_levels text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT is_system_actor() THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_not_system'); END IF;
  IF p_actor IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in'); END IF;
  IF NOT (COALESCE(p_levels, '{}') <@ ARRAY['easy', 'advanced', 'expert']) THEN RETURN jsonb_build_object('ok', false, 'reason', 'validation_failed', 'field', 'levels'); END IF;
  INSERT INTO gazette_voice_prefs (user_id, highlight, levels) VALUES (p_actor, COALESCE(p_highlight, true), COALESCE(p_levels, '{}'))
  ON CONFLICT (user_id) DO UPDATE SET highlight = EXCLUDED.highlight, levels = EXCLUDED.levels, updated_at = now();
  RETURN api_gazette_voice_prefs_get(p_actor);
END $fn$;

-- ── Member fixes ──────────────────────────────────────────────────────────────────────────────

-- The API runs the pipeline's precheck and auto-apply rule (fixes.mjs) first and passes p_apply when
-- the fix may apply itself: the new body and terms. This function enforces the limits that need the
-- database: membership, one open fix per story, 10 a day, 3 applied automatically a day, the flags.
CREATE OR REPLACE FUNCTION api_gazette_voice_fix_create(
  p_actor uuid, p_story uuid, p_kind text, p_quote text, p_replacement text, p_reason text,
  p_check jsonb DEFAULT NULL, p_apply jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  s gazette_voice_stories;
  v_fix uuid;
  v_today int;
  v_auto_today int;
  v_flags int;
  v_rev int;
BEGIN
  IF NOT is_system_actor() THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_not_system'); END IF;
  IF p_actor IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in'); END IF;
  SELECT * INTO s FROM gazette_voice_stories WHERE id = p_story FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT gazette_voice_is_member(s.club_id, p_actor) AND NOT gazette_voice_can_manage(s.club_id, p_actor) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_club_member');
  END IF;
  IF p_kind NOT IN ('fact', 'link', 'tone', 'wording', 'term_level', 'wrong_term', 'other') THEN RETURN jsonb_build_object('ok', false, 'reason', 'validation_failed', 'field', 'kind'); END IF;
  IF length(COALESCE(p_replacement, '')) NOT BETWEEN 1 AND 500 OR length(COALESCE(p_reason, '')) > 500 OR length(COALESCE(p_quote, '')) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'validation_failed', 'field', 'too_long');
  END IF;
  IF strpos(COALESCE(p_replacement, '') || COALESCE(p_reason, ''), chr(8212)) > 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'validation_failed', 'field', 'em_dash'); END IF;
  IF EXISTS (SELECT 1 FROM gazette_voice_fixes WHERE story_id = p_story AND member_id = p_actor AND state = 'waiting') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'one_open_fix_per_story');
  END IF;
  SELECT count(*), count(*) FILTER (WHERE auto) INTO v_today, v_auto_today
    FROM gazette_voice_fixes WHERE member_id = p_actor AND created_at > now() - interval '1 day';
  IF v_today >= 10 THEN RETURN jsonb_build_object('ok', false, 'reason', 'daily_limit'); END IF;

  IF p_kind = 'wording' AND p_apply IS NOT NULL AND v_auto_today < 3 AND s.state = 'ready' THEN
    v_rev := s.revision + 1;
    UPDATE gazette_voice_stories SET body = p_apply->>'body', terms = COALESCE(p_apply->'terms', terms), revision = v_rev, updated_at = now()
     WHERE id = p_story RETURNING * INTO s;
    INSERT INTO gazette_voice_fixes (story_id, club_id, member_id, kind, quote, replacement, reason, state, auto, check_result)
    VALUES (p_story, s.club_id, p_actor, p_kind, p_quote, p_replacement, p_reason, 'applied', true, p_check) RETURNING id INTO v_fix;
    INSERT INTO gazette_voice_story_revisions (story_id, revision, kind, summary, who, actor, fix_id, fields)
    VALUES (p_story, v_rev, 'fix_applied', format('Wording fix applied automatically: "%s" to "%s"', left(COALESCE(p_quote, ''), 120), left(p_replacement, 120)), 'automatic', p_actor, v_fix, gazette_voice_story_fields(s));
    RETURN jsonb_build_object('ok', true, 'fix_id', v_fix, 'state', 'applied', 'revision', v_rev);
  END IF;

  INSERT INTO gazette_voice_fixes (story_id, club_id, member_id, kind, quote, replacement, reason, state, check_result)
  VALUES (p_story, s.club_id, p_actor, p_kind, p_quote, p_replacement, p_reason, 'waiting', p_check) RETURNING id INTO v_fix;

  -- Three different members, each in the club at least a week, flagging fact or tone: show the plain story.
  IF p_kind IN ('fact', 'tone') AND EXISTS (
       SELECT 1 FROM book_club_members m WHERE m.book_club_id = s.club_id AND m.user_id = p_actor AND m.status = 'active' AND m.joined_at <= now() - interval '7 days') THEN
    INSERT INTO gazette_voice_flags (story_id, member_id, kind) VALUES (p_story, p_actor, p_kind) ON CONFLICT DO NOTHING;
    SELECT count(DISTINCT member_id) INTO v_flags FROM gazette_voice_flags WHERE story_id = p_story;
    IF v_flags >= 3 AND NOT s.flagged_plain THEN UPDATE gazette_voice_stories SET flagged_plain = true, updated_at = now() WHERE id = p_story; END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'fix_id', v_fix, 'state', 'waiting', 'revision', s.revision);
END $fn$;

-- Manager actions on a fix. 'regenerate' only marks the fix; the API queues the paid job after pricing it,
-- and the worker saves the new story with gazette_voice_save_revision.
CREATE OR REPLACE FUNCTION api_gazette_voice_fix_action(
  p_actor uuid, p_fix uuid, p_action text, p_reply text DEFAULT NULL, p_rule text DEFAULT NULL, p_apply jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE f gazette_voice_fixes; s gazette_voice_stories; v_rev int; v_learned uuid; v_regen int;
BEGIN
  IF NOT is_system_actor() THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_not_system'); END IF;
  SELECT * INTO f FROM gazette_voice_fixes WHERE id = p_fix FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT gazette_voice_can_manage(f.club_id, p_actor) THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_club_manager'); END IF;
  IF length(COALESCE(p_reply, '')) > 500 THEN RETURN jsonb_build_object('ok', false, 'reason', 'validation_failed', 'field', 'reply'); END IF;
  SELECT * INTO s FROM gazette_voice_stories WHERE id = f.story_id FOR UPDATE;

  IF p_action = 'apply' THEN
    IF f.state <> 'waiting' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_waiting'); END IF;
    IF p_apply IS NULL OR NOT (p_apply ? 'body') THEN RETURN jsonb_build_object('ok', false, 'reason', 'validation_failed', 'field', 'apply'); END IF;
    v_rev := s.revision + 1;
    UPDATE gazette_voice_stories SET body = p_apply->>'body', headline = COALESCE(p_apply->>'headline', headline), terms = COALESCE(p_apply->'terms', terms),
           revision = v_rev, flagged_plain = false, updated_at = now() WHERE id = s.id RETURNING * INTO s;
    INSERT INTO gazette_voice_story_revisions (story_id, revision, kind, summary, who, actor, fix_id, fields)
    VALUES (s.id, v_rev, 'fix_applied', format('Fix #%s applied by a manager', left(p_fix::text, 8)), 'manager', p_actor, p_fix, gazette_voice_story_fields(s));
    UPDATE gazette_voice_fixes SET state = 'applied', manager_reply = p_reply, acted_by = p_actor, acted_at = now() WHERE id = p_fix;
    RETURN jsonb_build_object('ok', true, 'state', 'applied', 'revision', v_rev);

  ELSIF p_action = 'regenerate' THEN
    IF f.state <> 'waiting' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_waiting'); END IF;
    SELECT count(*) INTO v_regen FROM gazette_voice_runs WHERE club_id = f.club_id AND kind = 'regenerate' AND started_at > now() - interval '1 day';
    IF v_regen >= COALESCE((SELECT (bca.config->>'daily_regenerations')::int FROM book_club_addons bca JOIN addon_registry ar ON ar.id = bca.addon_id
                             WHERE bca.book_club_id = f.club_id AND ar.slug = 'gazette-voice'), 20) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'daily_regeneration_limit');
    END IF;
    UPDATE gazette_voice_fixes SET state = 'regenerating', manager_reply = p_reply, acted_by = p_actor, acted_at = now() WHERE id = p_fix;
    RETURN jsonb_build_object('ok', true, 'state', 'regenerating', 'story_id', s.id);

  ELSIF p_action = 'learn' THEN
    IF length(btrim(COALESCE(p_rule, ''))) NOT BETWEEN 5 AND 300 THEN RETURN jsonb_build_object('ok', false, 'reason', 'validation_failed', 'field', 'rule'); END IF;
    IF strpos(p_rule, chr(8212)) > 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'validation_failed', 'field', 'em_dash'); END IF;
    INSERT INTO gazette_voice_learned (club_id, lang, text, from_fix, created_by) VALUES (f.club_id, s.lang, btrim(p_rule), p_fix, p_actor) RETURNING id INTO v_learned;
    UPDATE gazette_voice_fixes SET learned_id = v_learned, acted_by = p_actor, acted_at = now() WHERE id = p_fix;
    RETURN jsonb_build_object('ok', true, 'learned_id', v_learned);

  ELSIF p_action = 'reject' THEN
    IF f.state <> 'waiting' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_waiting'); END IF;
    UPDATE gazette_voice_fixes SET state = 'rejected', manager_reply = p_reply, acted_by = p_actor, acted_at = now() WHERE id = p_fix;
    RETURN jsonb_build_object('ok', true, 'state', 'rejected');

  ELSIF p_action = 'undo' THEN
    IF f.state <> 'applied' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_applied'); END IF;
    PERFORM api_gazette_voice_story_undo(p_actor, s.id, (SELECT revision - 1 FROM gazette_voice_story_revisions WHERE fix_id = p_fix ORDER BY revision DESC LIMIT 1));
    UPDATE gazette_voice_fixes SET state = 'undone', acted_by = p_actor, acted_at = now() WHERE id = p_fix;
    RETURN jsonb_build_object('ok', true, 'state', 'undone');
  END IF;
  RETURN jsonb_build_object('ok', false, 'reason', 'validation_failed', 'field', 'action');
END $fn$;

-- Back to an earlier revision; recorded as a new revision so nothing is lost.
CREATE OR REPLACE FUNCTION api_gazette_voice_story_undo(p_actor uuid, p_story uuid, p_revision int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE s gazette_voice_stories; r gazette_voice_story_revisions; v_rev int;
BEGIN
  IF NOT is_system_actor() THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_not_system'); END IF;
  SELECT * INTO s FROM gazette_voice_stories WHERE id = p_story FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT gazette_voice_can_manage(s.club_id, p_actor) THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_club_manager'); END IF;
  SELECT * INTO r FROM gazette_voice_story_revisions WHERE story_id = p_story AND revision = p_revision;
  IF NOT FOUND OR p_revision >= s.revision THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  v_rev := s.revision + 1;
  UPDATE gazette_voice_stories SET headline = r.fields->>'headline', dept = r.fields->>'dept', body = r.fields->>'body', question = r.fields->>'question',
         terms = COALESCE(r.fields->'terms', '[]'::jsonb), revision = v_rev, updated_at = now() WHERE id = p_story RETURNING * INTO s;
  INSERT INTO gazette_voice_story_revisions (story_id, revision, kind, summary, who, actor, fields)
  VALUES (p_story, v_rev, 'undo', format('Back to revision %s', p_revision), 'manager', p_actor, gazette_voice_story_fields(s));
  RETURN jsonb_build_object('ok', true, 'revision', v_rev);
END $fn$;

-- Used by the worker (system) to save a new revision: written, repaired, checked, regenerated or update.
CREATE OR REPLACE FUNCTION gazette_voice_save_revision(p_story uuid, p_kind text, p_summary text, p_fields jsonb, p_fix uuid DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE s gazette_voice_stories; v_rev int;
BEGIN
  IF NOT is_system_actor() THEN RAISE EXCEPTION 'forbidden_not_system'; END IF;
  SELECT * INTO s FROM gazette_voice_stories WHERE id = p_story FOR UPDATE;
  v_rev := s.revision + 1;
  UPDATE gazette_voice_stories SET headline = COALESCE(p_fields->>'headline', headline), dept = COALESCE(p_fields->>'dept', dept), body = COALESCE(p_fields->>'body', body),
         question = COALESCE(p_fields->>'question', question), terms = COALESCE(p_fields->'terms', terms),
         update_text = CASE WHEN p_kind = 'update' THEN p_fields->>'update' ELSE update_text END,
         revision = v_rev, flagged_plain = CASE WHEN p_kind = 'regenerated' THEN false ELSE flagged_plain END, updated_at = now()
   WHERE id = p_story RETURNING * INTO s;
  INSERT INTO gazette_voice_story_revisions (story_id, revision, kind, summary, who, fix_id, fields) VALUES (p_story, v_rev, p_kind, p_summary, 'desk', p_fix, gazette_voice_story_fields(s));
  IF p_fix IS NOT NULL AND p_kind = 'regenerated' THEN UPDATE gazette_voice_fixes SET state = 'regenerated' WHERE id = p_fix; END IF;
  RETURN v_rev;
END $fn$;

-- ── Managers: console ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION api_gazette_voice_ops_summary(p_actor uuid, p_club uuid, p_week text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT is_system_actor() THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_not_system'); END IF;
  IF NOT gazette_voice_can_manage(p_club, p_actor) THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_club_manager'); END IF;
  RETURN jsonb_build_object('ok', true,
    'edition_cost_usd', (SELECT COALESCE(sum(cost_usd), 0) FROM gazette_voice_runs WHERE club_id = p_club AND week = p_week),
    'month_cost_usd', (SELECT COALESCE(sum(cost_usd), 0) FROM gazette_voice_runs WHERE club_id = p_club AND started_at >= date_trunc('month', now())),
    'month_editions', (SELECT count(DISTINCT week) FROM gazette_voice_runs WHERE club_id = p_club AND kind = 'edition' AND started_at >= date_trunc('month', now())),
    'cap_usd', COALESCE((SELECT (bca.config->>'edition_budget_usd')::numeric FROM book_club_addons bca JOIN addon_registry ar ON ar.id = bca.addon_id WHERE bca.book_club_id = p_club AND ar.slug = 'gazette-voice'), 0.5),
    'calls', (SELECT count(*) FROM gazette_voice_calls c JOIN gazette_voice_runs r ON r.id = c.run_id WHERE r.club_id = p_club AND r.week = p_week),
    'median_ms', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY c.ms) FROM gazette_voice_calls c JOIN gazette_voice_runs r ON r.id = c.run_id WHERE r.club_id = p_club AND r.week = p_week AND c.status = 'ok'),
    'stories_ready', (SELECT count(*) FROM gazette_voice_stories WHERE club_id = p_club AND week = p_week AND state = 'ready' AND NOT flagged_plain),
    'stories_plain', (SELECT count(*) FROM gazette_voice_stories WHERE club_id = p_club AND week = p_week AND (state = 'plain' OR flagged_plain)),
    'open_fixes', (SELECT count(*) FROM gazette_voice_fixes WHERE club_id = p_club AND state = 'waiting'),
    'auto_fixes_today', (SELECT count(*) FROM gazette_voice_fixes WHERE club_id = p_club AND auto AND created_at > now() - interval '1 day'));
END $fn$;

CREATE OR REPLACE FUNCTION api_gazette_voice_runs(p_actor uuid, p_club uuid, p_before timestamptz DEFAULT NULL, p_limit int DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT is_system_actor() THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_not_system'); END IF;
  IF NOT gazette_voice_can_manage(p_club, p_actor) THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_club_manager'); END IF;
  RETURN jsonb_build_object('ok', true, 'runs', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('run_id', r.id, 'kind', r.kind, 'week', r.week, 'lang', r.lang, 'stages', r.stages, 'stories', r.stories, 'calls', r.calls,
                                        'cost_usd', r.cost_usd, 'estimate_usd', r.estimate_usd, 'status', r.status, 'started_at', r.started_at) ORDER BY r.started_at DESC)
      FROM (SELECT * FROM gazette_voice_runs WHERE club_id = p_club AND (p_before IS NULL OR started_at < p_before) ORDER BY started_at DESC LIMIT LEAST(GREATEST(p_limit, 1), 100)) r), '[]'::jsonb));
END $fn$;

CREATE OR REPLACE FUNCTION api_gazette_voice_calls(p_actor uuid, p_club uuid, p_run uuid DEFAULT NULL, p_stage text DEFAULT NULL, p_status text DEFAULT NULL, p_before bigint DEFAULT NULL, p_limit int DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT is_system_actor() THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_not_system'); END IF;
  IF NOT gazette_voice_can_manage(p_club, p_actor) THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_club_manager'); END IF;
  RETURN jsonb_build_object('ok', true, 'calls', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('call_id', c.id, 'run_id', c.run_id, 'story_id', c.story_id, 'stage', c.stage, 'lang', c.lang, 'model', c.model,
                                        'tokens_in', c.tokens_in, 'tokens_out', c.tokens_out, 'cached_in', c.cached_in, 'cost_usd', c.cost_usd, 'ms', c.ms,
                                        'status', c.status, 'at', c.created_at) ORDER BY c.id DESC)
      FROM (SELECT * FROM gazette_voice_calls WHERE club_id = p_club AND (p_run IS NULL OR run_id = p_run) AND (p_stage IS NULL OR stage = p_stage)
              AND (p_status IS NULL OR status = p_status) AND (p_before IS NULL OR id < p_before) ORDER BY id DESC LIMIT LEAST(GREATEST(p_limit, 1), 200)) c), '[]'::jsonb));
END $fn$;

CREATE OR REPLACE FUNCTION api_gazette_voice_call(p_actor uuid, p_call bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE c gazette_voice_calls;
BEGIN
  IF NOT is_system_actor() THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_not_system'); END IF;
  SELECT * INTO c FROM gazette_voice_calls WHERE id = p_call;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT gazette_voice_can_manage(c.club_id, p_actor) THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_club_manager'); END IF;
  RETURN jsonb_build_object('ok', true, 'call', jsonb_build_object('call_id', c.id, 'run_id', c.run_id, 'story_id', c.story_id, 'stage', c.stage, 'lang', c.lang,
    'model', c.model, 'tokens_in', c.tokens_in, 'tokens_out', c.tokens_out, 'cached_in', c.cached_in, 'cost_usd', c.cost_usd, 'ms', c.ms, 'status', c.status,
    'request', c.request, 'reply', c.reply, 'body_path', c.body_path, 'at', c.created_at));
END $fn$;

-- After 90 days the API moves bodies to storage (one gzipped JSON per run) and calls this per call.
CREATE OR REPLACE FUNCTION gazette_voice_calls_archived(p_ids bigint[], p_path text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE n int;
BEGIN
  IF NOT is_system_actor() THEN RAISE EXCEPTION 'forbidden_not_system'; END IF;
  UPDATE gazette_voice_calls SET body_path = p_path, request = NULL, reply = NULL WHERE id = ANY(p_ids) AND created_at < now() - interval '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $fn$;

-- ── Managers: prompts and learned rules ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION api_gazette_voice_prompt_version(p_actor uuid, p_club uuid, p_stage text, p_lang text, p_voice text, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_prompt uuid; v_version int;
BEGIN
  IF NOT is_system_actor() THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_not_system'); END IF;
  IF NOT gazette_voice_can_manage(p_club, p_actor) THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_club_manager'); END IF;
  IF p_stage NOT IN ('write', 'update', 'editor') OR p_lang NOT IN ('en', 'ur') THEN RETURN jsonb_build_object('ok', false, 'reason', 'validation_failed', 'field', 'stage'); END IF;
  IF length(COALESCE(p_voice, '')) NOT BETWEEN 20 AND 6000 THEN RETURN jsonb_build_object('ok', false, 'reason', 'validation_failed', 'field', 'voice'); END IF;
  IF strpos(p_voice, chr(8212)) > 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'validation_failed', 'field', 'em_dash'); END IF;
  INSERT INTO gazette_voice_prompts (club_id, stage, lang) VALUES (p_club, p_stage, p_lang) ON CONFLICT (club_id, stage, lang) DO NOTHING;
  SELECT id INTO v_prompt FROM gazette_voice_prompts WHERE club_id = p_club AND stage = p_stage AND lang = p_lang FOR UPDATE;
  IF p_voice = (SELECT v.voice FROM gazette_voice_prompt_versions v WHERE v.prompt_id = v_prompt ORDER BY v.version DESC LIMIT 1) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unchanged');
  END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO v_version FROM gazette_voice_prompt_versions WHERE prompt_id = v_prompt;
  INSERT INTO gazette_voice_prompt_versions (prompt_id, version, voice, note, created_by) VALUES (v_prompt, v_version, p_voice, NULLIF(btrim(COALESCE(p_note, '')), ''), p_actor);
  RETURN jsonb_build_object('ok', true, 'version', v_version);
END $fn$;

CREATE OR REPLACE FUNCTION api_gazette_voice_prompt_default(p_actor uuid, p_club uuid, p_stage text, p_lang text, p_version int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_prompt uuid;
BEGIN
  IF NOT is_system_actor() THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_not_system'); END IF;
  IF NOT gazette_voice_can_manage(p_club, p_actor) THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_club_manager'); END IF;
  SELECT id INTO v_prompt FROM gazette_voice_prompts WHERE club_id = p_club AND stage = p_stage AND lang = p_lang;
  IF v_prompt IS NULL OR NOT EXISTS (SELECT 1 FROM gazette_voice_prompt_versions WHERE prompt_id = v_prompt AND version = p_version) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  UPDATE gazette_voice_prompts SET default_version = p_version WHERE id = v_prompt;
  RETURN jsonb_build_object('ok', true, 'default_version', p_version);
END $fn$;

CREATE OR REPLACE FUNCTION api_gazette_voice_prompts(p_actor uuid, p_club uuid, p_stage text, p_lang text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_prompt gazette_voice_prompts;
BEGIN
  IF NOT is_system_actor() THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_not_system'); END IF;
  IF NOT gazette_voice_can_manage(p_club, p_actor) THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_club_manager'); END IF;
  SELECT * INTO v_prompt FROM gazette_voice_prompts WHERE club_id = p_club AND stage = p_stage AND lang = p_lang;
  RETURN jsonb_build_object('ok', true, 'default_version', v_prompt.default_version,
    'versions', COALESCE((SELECT jsonb_agg(jsonb_build_object('version', v.version, 'voice', v.voice, 'note', v.note, 'at', v.created_at) ORDER BY v.version DESC)
                          FROM gazette_voice_prompt_versions v WHERE v.prompt_id = v_prompt.id), '[]'::jsonb),
    'learned', COALESCE((SELECT jsonb_agg(jsonb_build_object('rule_id', l.id, 'text', l.text, 'pinned', l.pinned, 'from_fix', l.from_fix) ORDER BY l.pinned DESC, l.created_at DESC)
                         FROM gazette_voice_learned l WHERE l.club_id = p_club AND l.lang = p_lang AND l.removed_at IS NULL), '[]'::jsonb));
END $fn$;

CREATE OR REPLACE FUNCTION api_gazette_voice_learned_update(p_actor uuid, p_rule uuid, p_text text, p_pinned boolean, p_removed boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE l gazette_voice_learned;
BEGIN
  IF NOT is_system_actor() THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_not_system'); END IF;
  SELECT * INTO l FROM gazette_voice_learned WHERE id = p_rule FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT gazette_voice_can_manage(l.club_id, p_actor) THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_club_manager'); END IF;
  IF p_text IS NOT NULL AND (length(btrim(p_text)) NOT BETWEEN 5 AND 300 OR strpos(p_text, chr(8212)) > 0) THEN RETURN jsonb_build_object('ok', false, 'reason', 'validation_failed', 'field', 'text'); END IF;
  UPDATE gazette_voice_learned SET text = COALESCE(btrim(p_text), text), pinned = COALESCE(p_pinned, pinned),
         removed_at = CASE WHEN p_removed THEN now() WHEN p_removed = false THEN NULL ELSE removed_at END WHERE id = p_rule;
  RETURN jsonb_build_object('ok', true);
END $fn$;

CREATE OR REPLACE FUNCTION api_gazette_voice_term_label(p_actor uuid, p_club uuid, p_slug text, p_level text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT is_system_actor() THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden_not_system'); END IF;
  IF NOT gazette_voice_can_manage(p_club, p_actor) THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_club_manager'); END IF;
  IF p_level NOT IN ('easy', 'advanced', 'expert') THEN RETURN jsonb_build_object('ok', false, 'reason', 'validation_failed', 'field', 'level'); END IF;
  INSERT INTO gazette_voice_term_labels (club_id, term_slug, level, source, set_by) VALUES (p_club, p_slug, p_level, 'manager', p_actor)
  ON CONFLICT (club_id, term_slug) DO UPDATE SET level = EXCLUDED.level, source = 'manager', set_by = EXCLUDED.set_by, updated_at = now();
  RETURN jsonb_build_object('ok', true, 'level', p_level);
END $fn$;

-- The level step saves labels only where no manager has set one.
CREATE OR REPLACE FUNCTION gazette_voice_save_step_labels(p_club uuid, p_labels jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE n int;
BEGIN
  IF NOT is_system_actor() THEN RAISE EXCEPTION 'forbidden_not_system'; END IF;
  INSERT INTO gazette_voice_term_labels (club_id, term_slug, level, source)
  SELECT p_club, k, v, 'step' FROM jsonb_each_text(p_labels) AS e(k, v) WHERE v IN ('easy', 'advanced', 'expert')
  ON CONFLICT (club_id, term_slug) DO UPDATE SET level = EXCLUDED.level, updated_at = now() WHERE gazette_voice_term_labels.source = 'step';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $fn$;

-- ── Erasure ───────────────────────────────────────────────────────────────────────────────────

-- Called by the app's erasure flow: a member's fix text is replaced wherever it was stored, including
-- inside logged prompts (bodies already in storage are rewritten by the API with the same texts).
CREATE OR REPLACE FUNCTION gazette_voice_erase_member(p_member uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE f record; t text; v_esc text; n_fixes int := 0; n_calls int := 0; c int; v_scrub text[] := '{}';
BEGIN
  IF NOT is_system_actor() THEN RAISE EXCEPTION 'forbidden_not_system'; END IF;
  FOR f IN SELECT id, club_id, replacement, reason FROM gazette_voice_fixes WHERE member_id = p_member LOOP
    FOREACH t IN ARRAY array_remove(ARRAY[f.replacement, f.reason], NULL) LOOP
      CONTINUE WHEN length(t) < 3;
      -- The text sits inside a longer JSON string in the stored prompt: match it JSON-escaped, without quotes.
      v_esc := substr(to_json(t)::text, 2, length(to_json(t)::text) - 2);
      UPDATE gazette_voice_calls SET request = replace(request::text, v_esc, '[removed]')::jsonb
       WHERE club_id = f.club_id AND request IS NOT NULL AND strpos(request::text, v_esc) > 0;
      GET DIAGNOSTICS c = ROW_COUNT; n_calls := n_calls + c;
      v_scrub := v_scrub || t;
    END LOOP;
    n_fixes := n_fixes + 1;
  END LOOP;
  UPDATE gazette_voice_fixes SET member_id = NULL, replacement = '[removed]', reason = CASE WHEN reason IS NULL THEN NULL ELSE '[removed]' END WHERE member_id = p_member;
  DELETE FROM gazette_voice_flags WHERE member_id = p_member;
  DELETE FROM gazette_voice_prefs WHERE user_id = p_member;
  -- scrub_texts: the API uses these once to rewrite call bodies already moved to storage, then drops them.
  RETURN jsonb_build_object('fixes', n_fixes, 'calls', n_calls, 'scrub_texts', to_jsonb(v_scrub));
END $fn$;

COMMIT;
