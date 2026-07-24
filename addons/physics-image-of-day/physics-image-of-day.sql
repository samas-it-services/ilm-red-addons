-- Physics Image of the Day — reference registration + schema (mirrored from the ilm.red monorepo).
-- This is a REFERENCE mirror. Real club UUIDs are replaced with the :club_id placeholder.
BEGIN;

-- Storage for the daily science images (public science images: NASA public domain,
-- ESO / ESA-Hubble CC BY 4.0). Public-read; the nightly service-role fetch bypasses RLS.
CREATE TABLE IF NOT EXISTS image_of_day (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source         text NOT NULL,
  published_date date NOT NULL,
  title          text NOT NULL,
  image_url      text NOT NULL,
  thumb_url      text,
  credit         text,
  source_url     text,
  description    text,
  media_type     text NOT NULL DEFAULT 'image',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT image_of_day_source_date_uniq UNIQUE (source, published_date)
);
CREATE INDEX IF NOT EXISTS idx_image_of_day_date ON image_of_day (published_date DESC);
ALTER TABLE image_of_day ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS image_of_day_public_read ON image_of_day;
CREATE POLICY image_of_day_public_read ON image_of_day FOR SELECT USING (true);

-- Register the add-on in addon_registry (published, official).
INSERT INTO addon_registry (
  slug, name, version, description, icon, author, license, entry_point,
  category, permissions, config_schema, is_builtin, is_official, is_free, status, privacy_statement)
VALUES (
  'physics-image-of-day', 'Physics Image of the Day', '1.0.0', 'Today''s astronomy & physics images from NASA APOD, NASA Image of the Day, ESO and ESA/Hubble — shown together, with a carousel to browse past days. Every image keeps its source credit and a link to the original.', '🔭',
  'ILM Red Unbound', 'Apache-2.0', 'PhysicsImageOfDayAddon', 'engagement', ARRAY['net:external']::text[],
  '{}'::jsonb, false, true, true, 'published', 'Displays public science images fetched daily from NASA, ESO and ESA/Hubble. Each image keeps its source''s credit and a link to the original page. No personal data is collected or shared.')
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
  AND ar.slug = 'physics-image-of-day'
ON CONFLICT (book_club_id, addon_id) DO UPDATE SET is_enabled = true;

COMMIT;
