-- =============================================================================
-- 0031_insurance_and_citizenship.sql
--
-- Two additions from a real-estate source's field notes, both facts an agent is
-- asked about on every foreign-buyer viewing and could not record anywhere:
--
--   1. Property insurance. DASK (Zorunlu Deprem Sigortası) is mandatory in
--      Turkey — a missing or lapsed policy blocks a tapu transfer and blocks
--      electricity/water subscriptions, so it stops an appointment on the day.
--      Modelled as a CHILD TABLE rather than a dask_policy_no/dask_expiry_date
--      column pair: a unit can carry a DASK *and* a konut policy at once, every
--      policy renews annually (so there is history), and the column-pair shape
--      would need a third pair the first time anyone asks for another kind.
--
--   2. Citizenship eligibility. The $400k investment route is NOT derivable
--      from list_price: it needs an SPK-licensed appraisal at or above the
--      threshold, the unit must not have been sold to a foreigner for
--      citizenship before, and it carries a 3-year no-sale şerh on the tapu.
--      Only a human assessment answers it, so it is a stored tri-state flag.
--
-- Also extends run_work_checks() with a fifth sweep so an expiring policy of
-- ANY kind notifies the responsible agent.
--
-- Run after 0030_revoke_sweep_execute.sql. Idempotent: safe to re-run.
-- =============================================================================

-- =============================================================================
-- 1. PROPERTY INSURANCE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.property_insurance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES public.teams(id)      ON DELETE CASCADE,
  property_id  UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_by   UUID          REFERENCES public.profiles(id)   ON DELETE SET NULL,
  kind         TEXT NOT NULL,
  insurer      TEXT,
  policy_no    TEXT,
  start_date   DATE,
  -- The only field the reminder sweep needs, so it is NOT NULL: a policy with
  -- no end date could never be renewed on time, which defeats the point.
  end_date     DATE NOT NULL,
  premium      NUMERIC(14,2),
  currency     TEXT NOT NULL DEFAULT 'TRY',
  notes        TEXT,
  -- Reserved for a future SBM / partner-agency lookup. Turkey has no public
  -- policy-lookup API (SBM is gated behind licensed-insurer membership; the
  -- e-Devlet DASK screen is citizen-self-service), so entry is manual today.
  -- An integration writes these two and needs no migration and no UI change.
  external_ref TEXT,
  source       TEXT NOT NULL DEFAULT 'manual',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Kinds that actually exist in the Turkish market. Mirrored by InsuranceKind
-- in src/lib/db/types.ts and INSURANCE_KIND_LABEL in insuranceKinds.ts.
ALTER TABLE public.property_insurance DROP CONSTRAINT IF EXISTS property_insurance_kind_check;
ALTER TABLE public.property_insurance ADD CONSTRAINT property_insurance_kind_check
  CHECK (kind IN (
    'dask',        -- Zorunlu Deprem Sigortası — mandatory
    'konut',       -- Konut sigortası (fire, water, theft)
    'isyeri',      -- İşyeri sigortası (commercial premises)
    'kira_kaybi',  -- Kira kaybı / kiracı güvence
    'hayat',       -- Kredi hayat sigortası (alongside a mortgage)
    'diger'
  ));

ALTER TABLE public.property_insurance DROP CONSTRAINT IF EXISTS property_insurance_source_check;
ALTER TABLE public.property_insurance ADD CONSTRAINT property_insurance_source_check
  CHECK (source IN ('manual', 'import'));

ALTER TABLE public.property_insurance DROP CONSTRAINT IF EXISTS property_insurance_range_check;
ALTER TABLE public.property_insurance ADD CONSTRAINT property_insurance_range_check
  CHECK (start_date IS NULL OR end_date >= start_date);

ALTER TABLE public.property_insurance DROP CONSTRAINT IF EXISTS property_insurance_premium_check;
ALTER TABLE public.property_insurance ADD CONSTRAINT property_insurance_premium_check
  CHECK (premium IS NULL OR premium >= 0);

CREATE INDEX IF NOT EXISTS idx_property_insurance_property
  ON public.property_insurance(property_id);
-- The lookup the expiry sweep and the attention feed both read.
CREATE INDEX IF NOT EXISTS idx_property_insurance_expiry
  ON public.property_insurance(team_id, end_date);

DROP TRIGGER IF EXISTS trg_property_insurance_updated_at ON public.property_insurance;
CREATE TRIGGER trg_property_insurance_updated_at BEFORE UPDATE ON public.property_insurance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- A policy must not point at another team's property. Same shape as
-- assert_project_same_team() in 0026.
CREATE OR REPLACE FUNCTION public.assert_insurance_same_team()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE parent_team UUID;
BEGIN
  SELECT team_id INTO parent_team FROM public.properties WHERE id = NEW.property_id;
  IF parent_team IS DISTINCT FROM NEW.team_id THEN
    RAISE EXCEPTION 'property belongs to a different team';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_property_insurance_same_team ON public.property_insurance;
CREATE TRIGGER trg_property_insurance_same_team
  BEFORE INSERT OR UPDATE ON public.property_insurance
  FOR EACH ROW EXECUTE FUNCTION public.assert_insurance_same_team();

-- ── RLS — read for any team member, writes gated on team_is_writable() ───────
ALTER TABLE public.property_insurance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS property_insurance_select ON public.property_insurance;
CREATE POLICY property_insurance_select ON public.property_insurance FOR SELECT
  USING ((SELECT public.is_team_member(team_id)));

DROP POLICY IF EXISTS property_insurance_insert ON public.property_insurance;
CREATE POLICY property_insurance_insert ON public.property_insurance FOR INSERT
  WITH CHECK ((SELECT public.is_team_member(team_id))
          AND (SELECT public.team_is_writable(team_id)));

DROP POLICY IF EXISTS property_insurance_update ON public.property_insurance;
CREATE POLICY property_insurance_update ON public.property_insurance FOR UPDATE
  USING ((SELECT public.is_team_member(team_id)))
  WITH CHECK ((SELECT public.is_team_member(team_id))
          AND (SELECT public.team_is_writable(team_id)));

DROP POLICY IF EXISTS property_insurance_delete ON public.property_insurance;
CREATE POLICY property_insurance_delete ON public.property_insurance FOR DELETE
  USING ((SELECT public.is_team_member(team_id))
     AND (SELECT public.team_is_writable(team_id)));

-- =============================================================================
-- 2. CITIZENSHIP ELIGIBILITY
--
-- Nullable on purpose (tri-state, like properties.furnished):
--   NULL  = not assessed
--   true  = assessed eligible
--   false = assessed NOT eligible
-- A NOT NULL DEFAULT false would claim every existing row had been checked and
-- had failed, which is a different and wrong statement.
-- =============================================================================
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS citizenship_eligible BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_properties_citizenship
  ON public.properties(team_id) WHERE citizenship_eligible;

-- =============================================================================
-- 3. EXPIRING-POLICY NOTIFICATIONS
-- =============================================================================
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    -- existing (0011)
    'trial_started','invite_accepted','member_joined',
    'trial_ending','trial_ended','subscription_activated',
    'team_invite',
    -- work events (0029)
    'rent_overdue','lease_expiring','lead_silent','project_delivery',
    -- insurance (0031)
    'insurance_expiring'
  ));

-- Unchanged from 0029 except for the fifth block at the end.
CREATE OR REPLACE FUNCTION public.run_work_checks()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r          RECORD;
  inserted   INT := 0;
  wrote      INT := 0;
  -- Mirrors DEFAULT_ATTENTION_THRESHOLDS in src/lib/db/attentionLogic.ts so the
  -- dashboard feed and these notifications never disagree.
  lease_days CONSTANT INT := 30;
  lead_days  CONSTANT INT := 14;
  proj_days  CONSTANT INT := 30;
  ins_days   CONSTANT INT := 30;
  -- Don't repeat the same item within this window.
  quiet      CONSTANT INTERVAL := INTERVAL '30 days';
BEGIN
  -- ── Overdue rent ───────────────────────────────────────────────────────────
  FOR r IN
    SELECT p.id            AS payment_id,
           l.team_id,
           pr.id           AS property_id,
           pr.address_line,
           coalesce(pr.assigned_to, t.owner_id) AS recipient,
           (p.amount_due - p.amount_paid)       AS outstanding,
           l.currency
    FROM public.payments p
    JOIN public.leases     l  ON l.id = p.lease_id AND l.status = 'active'
    JOIN public.properties pr ON pr.id = l.property_id
    JOIN public.teams      t  ON t.id = l.team_id
    WHERE p.period_end < current_date
      AND p.amount_paid < p.amount_due
  LOOP
    INSERT INTO public.notifications (user_id, team_id, type, title, body, href)
    SELECT r.recipient, r.team_id, 'rent_overdue',
           'Gecikmiş kira ödemesi',
           r.address_line || ' için ' ||
             to_char(r.outstanding, 'FM999G999G999D00') || ' ' || r.currency ||
             ' tutarında ödeme gecikti.',
           '/properties/' || r.property_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = r.recipient
        AND n.type    = 'rent_overdue'
        AND n.href    = '/properties/' || r.property_id
        AND n.created_at > now() - quiet
    );
    GET DIAGNOSTICS wrote = ROW_COUNT;
    inserted := inserted + wrote;
  END LOOP;

  -- ── Leases ending soon ─────────────────────────────────────────────────────
  FOR r IN
    SELECT l.id AS lease_id, l.team_id, l.end_date,
           pr.id AS property_id, pr.address_line,
           coalesce(pr.assigned_to, t.owner_id) AS recipient
    FROM public.leases     l
    JOIN public.properties pr ON pr.id = l.property_id
    JOIN public.teams      t  ON t.id = l.team_id
    WHERE l.status = 'active'
      AND l.end_date IS NOT NULL
      AND l.end_date BETWEEN current_date AND current_date + lease_days
  LOOP
    INSERT INTO public.notifications (user_id, team_id, type, title, body, href)
    SELECT r.recipient, r.team_id, 'lease_expiring',
           'Kira sözleşmesi bitiyor',
           r.address_line || ' sözleşmesi ' || to_char(r.end_date, 'DD.MM.YYYY') ||
             ' tarihinde sona eriyor. Yenilemeyi konuşmak için iyi bir zaman.',
           '/properties/' || r.property_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = r.recipient
        AND n.type    = 'lease_expiring'
        AND n.href    = '/properties/' || r.property_id
        AND n.created_at > now() - quiet
    );
    GET DIAGNOSTICS wrote = ROW_COUNT;
    inserted := inserted + wrote;
  END LOOP;

  -- ── Leads gone quiet ───────────────────────────────────────────────────────
  FOR r IN
    SELECT ld.id AS lead_id, ld.team_id, ld.full_name,
           coalesce(ld.assigned_to, t.owner_id) AS recipient
    FROM public.leads ld
    JOIN public.teams t ON t.id = ld.team_id
    WHERE ld.status IN ('new','follow_up','interested')
      AND coalesce(ld.last_call_at, ld.created_at) < now() - (lead_days || ' days')::INTERVAL
  LOOP
    INSERT INTO public.notifications (user_id, team_id, type, title, body, href)
    SELECT r.recipient, r.team_id, 'lead_silent',
           'Müşteriyle uzun süredir görüşülmedi',
           r.full_name || ' ile ' || lead_days || ' günden uzun süredir görüşülmedi.',
           '/leads'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = r.recipient
        AND n.type    = 'lead_silent'
        -- href is the shared /leads page, so dedupe on the lead's name in the
        -- body instead; otherwise one quiet lead would mute all the others.
        AND n.body LIKE r.full_name || ' ile %'
        AND n.created_at > now() - quiet
    );
    GET DIAGNOSTICS wrote = ROW_COUNT;
    inserted := inserted + wrote;
  END LOOP;

  -- ── Projects nearing delivery ──────────────────────────────────────────────
  FOR r IN
    SELECT pj.id, pj.team_id, pj.name, pj.delivery_date, t.owner_id AS recipient
    FROM public.projects pj
    JOIN public.teams    t ON t.id = pj.team_id
    WHERE pj.delivery_date IS NOT NULL
      AND pj.delivery_date BETWEEN current_date AND current_date + proj_days
  LOOP
    INSERT INTO public.notifications (user_id, team_id, type, title, body, href)
    SELECT r.recipient, r.team_id, 'project_delivery',
           'Proje teslim tarihi yaklaşıyor',
           r.name || ' projesinin teslim tarihi ' ||
             to_char(r.delivery_date, 'DD.MM.YYYY') || '.',
           '/projects/' || r.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = r.recipient
        AND n.type    = 'project_delivery'
        AND n.href    = '/projects/' || r.id
        AND n.created_at > now() - quiet
    );
    GET DIAGNOSTICS wrote = ROW_COUNT;
    inserted := inserted + wrote;
  END LOOP;

  -- ── Insurance policies expiring or already lapsed (0031) ───────────────────
  -- Already-expired policies are included, not just upcoming ones: a lapsed
  -- DASK is worse than an expiring one and must not go quiet.
  FOR r IN
    SELECT ins.id, ins.team_id, ins.kind, ins.end_date,
           pr.id AS property_id, pr.address_line,
           coalesce(pr.assigned_to, t.owner_id) AS recipient
    FROM public.property_insurance ins
    JOIN public.properties pr ON pr.id = ins.property_id
    JOIN public.teams      t  ON t.id = ins.team_id
    WHERE ins.end_date <= current_date + ins_days
      -- Don't nag forever about a policy abandoned a year ago.
      AND ins.end_date >= current_date - 90
  LOOP
    INSERT INTO public.notifications (user_id, team_id, type, title, body, href)
    SELECT r.recipient, r.team_id, 'insurance_expiring',
           CASE WHEN r.kind = 'dask' THEN 'DASK poliçesi bitiyor'
                ELSE 'Sigorta poliçesi bitiyor' END,
           r.address_line || ' için ' ||
             CASE r.kind
               WHEN 'dask'       THEN 'DASK'
               WHEN 'konut'      THEN 'konut sigortası'
               WHEN 'isyeri'     THEN 'işyeri sigortası'
               WHEN 'kira_kaybi' THEN 'kira kaybı sigortası'
               WHEN 'hayat'      THEN 'kredi hayat sigortası'
               ELSE 'sigorta'
             END || ' poliçesi ' || to_char(r.end_date, 'DD.MM.YYYY') ||
             CASE WHEN r.end_date < current_date
                  THEN ' tarihinde sona erdi.'
                  ELSE ' tarihinde sona eriyor.' END,
           -- The fragment keeps the dedupe key unique PER KIND. Without it a
           -- unit carrying a DASK and a konut policy that expire in the same
           -- month would collapse to a single notification.
           '/properties/' || r.property_id || '#sigorta-' || r.kind
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = r.recipient
        AND n.type    = 'insurance_expiring'
        AND n.href    = '/properties/' || r.property_id || '#sigorta-' || r.kind
        AND n.created_at > now() - quiet
    );
    GET DIAGNOSTICS wrote = ROW_COUNT;
    inserted := inserted + wrote;
  END LOOP;

  RETURN inserted;
END;
$$;

-- ⚠️ CREATE OR REPLACE re-grants EXECUTE to PUBLIC, which reopens the exact
-- hole 0030 was written to close. Revoke from PUBLIC (not just the roles, which
-- inherit through it) and re-grant to service_role.
REVOKE EXECUTE ON FUNCTION public.run_work_checks() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.run_work_checks() TO service_role;
