-- Welcome Message — reference registration + schema (mirrored from the ilm.red monorepo).
-- This is a REFERENCE mirror. Real club UUIDs are replaced with the :club_id placeholder.
BEGIN;

-- Register the add-on in addon_registry (published, official).
INSERT INTO addon_registry (
  slug, name, version, description, icon, author, license, entry_point,
  category, permissions, config_schema, is_builtin, is_official, is_free, status, privacy_statement)
VALUES (
  'welcome-message', 'Welcome Message', '1.0.0', 'Display customizable welcome messages to new and existing members. Include club stats, upcoming events, and personalized greetings.', '💬',
  'ILM Red Unbound', 'Apache-2.0', 'WelcomeMessageAddon', 'communication', ARRAY['read_members', 'read_books']::text[],
  '{"type":"object","properties":{"title":{"type":"string","title":"Welcome Title","default":"Welcome to our Book Club! 📚"},"enabled":{"type":"boolean","title":"Enable Welcome Message","default":true},"message":{"type":"string","title":"Welcome Message","default":"We are excited to have you here!"},"dismissible":{"type":"boolean","title":"Allow Dismissal","default":true},"showToAllMembers":{"type":"boolean","title":"Show to All Members","default":false},"showToNewMembers":{"type":"boolean","title":"Show to New Members","default":true},"showBookClubStats":{"type":"boolean","title":"Show Club Statistics","default":true},"showUpcomingEvents":{"type":"boolean","title":"Show Upcoming Events","default":true}}}'::jsonb, true, true, true, 'published', 'Shows a welcome message to new members. No personal data is collected or shared outside this club.')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, version = EXCLUDED.version, description = EXCLUDED.description,
  icon = EXCLUDED.icon, entry_point = EXCLUDED.entry_point, category = EXCLUDED.category,
  permissions = EXCLUDED.permissions, config_schema = EXCLUDED.config_schema,
  is_official = true, status = 'published', privacy_statement = EXCLUDED.privacy_statement;

-- 'welcome-message' is a built-in add-on: it is auto-installed and enabled in EVERY club by the
-- auto_install_builtin_addons() trigger, and is protected from removal. No manual step needed.

COMMIT;
