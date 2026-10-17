-- Global (system) roles have organization_id = NULL; the compound unique
-- (organization_id, slug) does NOT enforce uniqueness across NULL rows in
-- Postgres. This partial unique index closes that hole.
CREATE UNIQUE INDEX IF NOT EXISTS roles_global_slug_unique
  ON roles (slug)
  WHERE organization_id IS NULL;
