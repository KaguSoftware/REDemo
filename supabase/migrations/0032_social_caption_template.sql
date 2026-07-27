-- =============================================================================
-- 0032_social_caption_template.sql — a second template kind
--
-- Agents post listings to Instagram, and the caption is the office's voice the
-- same way the WhatsApp message is. Rather than a new table, this widens the
-- existing message_templates.kind CHECK: the row shape, RLS, uniqueness and
-- token-whitelist story are all identical, and the settings UI already renders
-- one card per kind.
--
-- Tokens are still resolved app-side against the fixed whitelist in
-- src/lib/whatsappMessage.ts, so a caption can no more surface the homeowner's
-- name or the tapu identifiers than a WhatsApp message can. That matters more
-- here, not less: a WhatsApp leak reaches one client, a caption reaches
-- everyone.
--
-- Run after 0031_insurance_and_citizenship.sql. Idempotent: safe to re-run.
-- =============================================================================

ALTER TABLE public.message_templates
  DROP CONSTRAINT IF EXISTS message_templates_kind_check;

ALTER TABLE public.message_templates
  ADD CONSTRAINT message_templates_kind_check
  CHECK (kind IN ('whatsapp_property', 'social_caption'));
