-- FluxMoney - onboarding WhatsApp status
-- Date: 2026-07-11
-- Scope: add persistent status for optional WhatsApp onboarding step.

alter table public.user_access
  add column if not exists onboarding_whatsapp_status text;

alter table public.user_access
  drop constraint if exists user_access_onboarding_whatsapp_status_chk;

alter table public.user_access
  add constraint user_access_onboarding_whatsapp_status_chk
  check (
    onboarding_whatsapp_status is null
    or onboarding_whatsapp_status in ('pending', 'done', 'skipped')
  );
