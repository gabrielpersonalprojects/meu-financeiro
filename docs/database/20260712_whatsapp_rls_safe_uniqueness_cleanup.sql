-- FluxMoney - Cleanup for partially applied WhatsApp uniqueness migration
-- Safe to run multiple times before re-running 20260712_whatsapp_rls_safe_uniqueness.sql

begin;

drop trigger if exists trg_user_access_whatsapp_normalization on public.user_access;

drop function if exists public.check_whatsapp_available(uuid, text);
drop function if exists public.user_access_apply_whatsapp_normalization();
drop function if exists public.normalize_whatsapp_br_safe(text);
drop function if exists public.normalize_whatsapp_br(text);

drop index if exists public.user_access_whatsapp_number_normalized_uidx;

commit;
