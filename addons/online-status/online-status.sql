-- Online Status — reference registration + schema (mirrored from the ilm.red monorepo).
-- This is a REFERENCE mirror. Real club UUIDs are replaced with the :club_id placeholder.
BEGIN;

-- Online Status reads live realtime presence and honours a per-member privacy flag.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS presence_hidden boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN profiles.presence_hidden IS
  'When true, the member does not broadcast presence and is shown as offline to others.';

-- Register the add-on in addon_registry (published, official).
INSERT INTO addon_registry (
  slug, name, version, description, icon, author, license, entry_point,
  category, permissions, config_schema, is_builtin, is_official, is_free, status, privacy_statement)
VALUES (
  'online-status', 'Online Status', '1.0.0', 'Track and display member online status with privacy controls. See who is active, idle, or offline in real-time.', '👥',
  'ILM Red Unbound', 'Apache-2.0', 'OnlineStatusAddon', 'communication', ARRAY['read_members', 'track_users']::text[],
  '{"type":"object","properties":{"enabled":{"type":"boolean","title":"Enable Status Tracking","default":true},"showLastSeen":{"type":"boolean","title":"Show Last Seen","default":true},"groupByStatus":{"type":"boolean","title":"Group by Status","default":true},"showOnlineCount":{"type":"boolean","title":"Show Online Count","default":true},"allowPrivateMode":{"type":"boolean","title":"Allow Private Mode","default":true},"autoOfflineMinutes":{"type":"number","title":"Auto-offline Timeout (minutes)","default":15},"showActivityStatus":{"type":"boolean","title":"Show Activity Status","default":true}}}'::jsonb, true, true, true, 'published', 'Shows which members are currently active. Your online status is visible to other members of this club while you browse it; it is never shared outside the club.')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, version = EXCLUDED.version, description = EXCLUDED.description,
  icon = EXCLUDED.icon, entry_point = EXCLUDED.entry_point, category = EXCLUDED.category,
  permissions = EXCLUDED.permissions, config_schema = EXCLUDED.config_schema,
  is_official = true, status = 'published', privacy_statement = EXCLUDED.privacy_statement;

-- 'online-status' is a built-in add-on: it is auto-installed and enabled in EVERY club by the
-- auto_install_builtin_addons() trigger, and is protected from removal. No manual step needed.

COMMIT;
