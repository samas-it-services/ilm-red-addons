-- Test stand-in for the ilm.red objects the add-on relies on (PGlite only; never shipped).
CREATE TABLE book_clubs (id uuid PRIMARY KEY, owner_id uuid NOT NULL, slug text, name text);
CREATE TABLE book_club_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), book_club_id uuid NOT NULL, user_id uuid NOT NULL, role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(), UNIQUE (book_club_id, user_id));
CREATE TABLE user_roles (user_id uuid, role text);
CREATE TABLE addon_registry (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE, name text, version text, description text, icon text, author text, license text,
  entry_point text, category text, permissions text[], config_schema jsonb, is_builtin boolean, is_official boolean, is_free boolean, status text, privacy_statement text);
CREATE TABLE book_club_addons (book_club_id uuid, addon_id uuid, version text, config jsonb DEFAULT '{}', is_enabled boolean DEFAULT true, installed_by uuid, PRIMARY KEY (book_club_id, addon_id));
-- book_club_members has no status column in ilm.red (checked against the live schema 16 Nov 2026).
-- The real club_role_of, copied from the app (20261005006100_book_clubs_organize_api.sql).
CREATE FUNCTION club_role_of(p_club uuid, p_owner uuid, p_viewer uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_viewer IS NULL THEN NULL WHEN p_owner = p_viewer THEN 'owner'
    ELSE (SELECT CASE WHEN m.role IN ('owner') THEN 'owner' WHEN m.role IN ('admin', 'moderator') THEN 'moderator' ELSE 'member' END
            FROM book_club_members m WHERE m.book_club_id = p_club AND m.user_id = p_viewer
           ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'moderator' THEN 1 ELSE 2 END LIMIT 1) END; $$;
CREATE FUNCTION has_role(p_user uuid, p_role text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_user AND role = p_role) $$;
CREATE FUNCTION is_system_actor() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('test.system', true), 'on') = 'on' $$;
