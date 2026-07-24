-- AI Dataset of the Day — reference registration + schema (mirrored from the ilm.red monorepo).
-- This is a REFERENCE mirror. Real club UUIDs are replaced with the :club_id placeholder.
BEGIN;

-- Curated seed bank + today's rendered item per add-on. Both public-read; the nightly
-- service-role "daily-cards" pass upserts daily_cards and bypasses RLS.
CREATE TABLE IF NOT EXISTS daily_card_seeds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_slug  text NOT NULL,
  position    integer NOT NULL,
  title       text NOT NULL,
  subtitle    text,
  blurb       text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_card_seeds_slug_pos_uniq UNIQUE (addon_slug, position)
);
CREATE INDEX IF NOT EXISTS idx_daily_card_seeds_slug ON daily_card_seeds (addon_slug, position);
ALTER TABLE daily_card_seeds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_card_seeds_public_read ON daily_card_seeds;
CREATE POLICY daily_card_seeds_public_read ON daily_card_seeds FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS daily_cards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_slug  text NOT NULL,
  shown_date  date NOT NULL,
  seed_id     uuid REFERENCES daily_card_seeds(id) ON DELETE SET NULL,
  title       text NOT NULL,
  subtitle    text,
  explainer   text,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  source      text NOT NULL DEFAULT 'curated',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_cards_slug_date_uniq UNIQUE (addon_slug, shown_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_cards_slug_date ON daily_cards (addon_slug, shown_date DESC);
ALTER TABLE daily_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_cards_public_read ON daily_cards;
CREATE POLICY daily_cards_public_read ON daily_cards FOR SELECT USING (true);

-- Register the add-on in addon_registry (published, official).
INSERT INTO addon_registry (
  slug, name, version, description, icon, author, license, entry_point,
  category, permissions, config_schema, is_builtin, is_official, is_free, status, privacy_statement)
VALUES (
  'ai-dataset-of-day', 'AI Dataset of the Day', '1.0.0', 'A well-known machine-learning dataset each day — what it is and why it matters. Curated catalogue, refreshed daily.', '🗂️',
  'ILM Red Unbound', 'Apache-2.0', 'AiDatasetOfDayAddon', 'engagement', ARRAY[]::text[],
  '{}'::jsonb, false, true, true, 'published', 'Shows one item a day from a curated catalogue of public ML datasets. An optional AI-written explainer is generated server-side. No personal data is collected.')
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
  AND ar.slug = 'ai-dataset-of-day'
ON CONFLICT (book_club_id, addon_id) DO UPDATE SET is_enabled = true;

COMMIT;
