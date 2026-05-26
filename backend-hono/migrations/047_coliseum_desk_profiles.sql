-- S80-T1: Coliseum Desk Profile Schema
-- Extends narrative_desks with profile metadata: display identity, archetypes,
-- broker/prop-firm classification, and affiliate disclosure fields.
-- Reuses narrative_desks.id as the desk identity anchor.

-- Desk registry (IF NOT EXISTS — may pre-exist in prod from earlier narrative work)
CREATE TABLE IF NOT EXISTS narrative_desks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  color        TEXT DEFAULT '#c79f4a',
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Desk membership (owner | manager | member)
CREATE TABLE IF NOT EXISTS narrative_desk_members (
  desk_id    UUID NOT NULL REFERENCES narrative_desks(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member'
               CHECK (role IN ('owner', 'manager', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (desk_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_narrative_desk_members_user
  ON narrative_desk_members(user_id);

-- Coliseum desk profile metadata
CREATE TABLE IF NOT EXISTS coliseum_desk_profiles (
  desk_id                  UUID PRIMARY KEY
                             REFERENCES narrative_desks(id) ON DELETE CASCADE,
  display_name             TEXT NOT NULL DEFAULT 'Priced In Capital',
  bio                      TEXT NOT NULL DEFAULT '',
  archetypes               TEXT[] NOT NULL DEFAULT '{}',
  broker_classification    TEXT,
  prop_firm_classification TEXT,
  affiliate_url            TEXT,
  affiliate_disclosure     TEXT,
  affiliate_relationship   TEXT,
  created_by               TEXT,
  updated_by               TEXT,
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now(),

  -- Only valid archetype values accepted
  CONSTRAINT archetypes_valid CHECK (
    archetypes <@ ARRAY[
      'narrative trader', 'thematic investor', 'nothing-happens',
      'macro', 'doomer', 'technician', 'contrarian',
      'vol trader', 'policy watcher', 'fundamentalist'
    ]::TEXT[]
  ),

  -- Affiliate URL requires disclosure text (disclosure-first rule)
  CONSTRAINT affiliate_requires_disclosure CHECK (
    affiliate_url IS NULL
    OR (affiliate_disclosure IS NOT NULL AND length(trim(affiliate_disclosure)) >= 12)
  )
);

CREATE INDEX IF NOT EXISTS idx_coliseum_desk_profiles_updated
  ON coliseum_desk_profiles(updated_at DESC);

-- Seed default Priced In Capital desk if it does not exist
INSERT INTO narrative_desks (name, slug, color, created_by)
VALUES ('Priced In Capital', 'priced-in-capital', '#c79f4a', 'system')
ON CONFLICT (slug) DO NOTHING;
