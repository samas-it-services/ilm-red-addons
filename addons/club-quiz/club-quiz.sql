-- Knowledge Quiz — reference registration + schema (mirrored from the ilm.red monorepo).
-- This is a REFERENCE mirror. Real club UUIDs are replaced with the :club_id placeholder.
BEGIN;

-- Per-completion attempt rows + public per-club aggregates for the Knowledge Quiz.
CREATE TABLE IF NOT EXISTS club_quiz_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES book_clubs(id) ON DELETE CASCADE,
  addon_slug text NOT NULL DEFAULT 'club-quiz',
  user_id    uuid NOT NULL,
  level      text NOT NULL CHECK (level IN ('beginner','intermediate','expert')),
  score      int  NOT NULL CHECK (score >= 0),
  total      int  NOT NULL CHECK (total > 0),
  pct        int  GENERATED ALWAYS AS (round(100.0 * score / total)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (score <= total)
);
CREATE INDEX IF NOT EXISTS cqa_club_level ON club_quiz_attempts (club_id, addon_slug, level);
CREATE INDEX IF NOT EXISTS cqa_user       ON club_quiz_attempts (user_id);
ALTER TABLE club_quiz_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cqa_insert_own ON club_quiz_attempts;
CREATE POLICY cqa_insert_own ON club_quiz_attempts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS cqa_select_own ON club_quiz_attempts;
CREATE POLICY cqa_select_own ON club_quiz_attempts FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON club_quiz_attempts FROM anon;

CREATE OR REPLACE FUNCTION club_quiz_stats(p_club_id uuid, p_addon text DEFAULT 'club-quiz')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
  SELECT coalesce(jsonb_object_agg(level, obj), '{}'::jsonb) FROM (
    SELECT level, jsonb_build_object('attempts', count(*), 'learners', count(DISTINCT user_id),
      'avg_pct', round(avg(pct))::int, 'top_pct', max(pct)) AS obj
    FROM club_quiz_attempts WHERE club_id = p_club_id AND addon_slug = p_addon GROUP BY level) s;
$fn$;
GRANT EXECUTE ON FUNCTION club_quiz_stats(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION record_quiz_attempt(p_club_id uuid, p_level text, p_score int, p_total int, p_addon text DEFAULT 'club-quiz')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE uid uuid := auth.uid(); v_best int; v jsonb;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF p_level NOT IN ('beginner','intermediate','expert') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_level'); END IF;
  IF p_total <= 0 OR p_score < 0 OR p_score > p_total THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_score'); END IF;
  INSERT INTO club_quiz_attempts (club_id, addon_slug, user_id, level, score, total) VALUES (p_club_id, p_addon, uid, p_level, p_score, p_total);
  SELECT max(pct) INTO v_best FROM club_quiz_attempts WHERE club_id = p_club_id AND addon_slug = p_addon AND level = p_level AND user_id = uid;
  SELECT (club_quiz_stats(p_club_id, p_addon) -> p_level) INTO v;
  RETURN coalesce(v, '{}'::jsonb) || jsonb_build_object('ok', true, 'your_best_pct', v_best);
END $fn$;
GRANT EXECUTE ON FUNCTION record_quiz_attempt(uuid, text, int, int, text) TO authenticated;

-- Register the add-on in addon_registry (published, official).
INSERT INTO addon_registry (
  slug, name, version, description, icon, author, license, entry_point,
  category, permissions, config_schema, is_builtin, is_official, is_free, status, privacy_statement)
VALUES (
  'club-quiz', 'Knowledge Quiz', '1.0.0', 'A per-level knowledge quiz for a club: ten questions each at Beginner, Intermediate and Expert, with an explanation on a wrong answer and a total score. Signed-in readers save their attempt and the club shows global stats. Ships a built-in Cryptography set; a curator can supply their own questions in config.', '🧠',
  'ILM Red Unbound', 'Apache-2.0', 'ClubQuizAddon', 'general', ARRAY['read_books']::text[],
  '{"type":"object","properties":{"levels":{"type":"object","title":"Custom question set","description":"Optional override of the built-in set: { beginner:[{q,options,answer,explain}], intermediate:[...], expert:[...] }"}}}'::jsonb, false, true, true, 'published', 'Runs in your browser. When you are signed in, your result (level, score, total) is saved so the club can show aggregate stats (attempts, averages); individual answers are never stored. Signed-out readers see only the aggregates.')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, version = EXCLUDED.version, description = EXCLUDED.description,
  icon = EXCLUDED.icon, entry_point = EXCLUDED.entry_point, category = EXCLUDED.category,
  permissions = EXCLUDED.permissions, config_schema = EXCLUDED.config_schema,
  is_official = true, status = 'published', privacy_statement = EXCLUDED.privacy_statement;

-- Enable this add-on for one club. Replace :club_id with the club's UUID.
INSERT INTO book_club_addons (book_club_id, addon_id, version, config, is_enabled, installed_by)
SELECT bc.id, ar.id, ar.version, '{}'::jsonb, true, bc.owner_id
FROM book_clubs bc
CROSS JOIN addon_registry ar
WHERE bc.id = :club_id
  AND ar.slug = 'club-quiz'
ON CONFLICT (book_club_id, addon_id) DO UPDATE SET is_enabled = true;

COMMIT;
