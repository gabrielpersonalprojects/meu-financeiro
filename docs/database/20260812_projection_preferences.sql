-- Projection preferences sync (remote-first) for FluxMoney
-- Proposal only. Review before applying in any environment.

create extension if not exists pgcrypto;

create table if not exists public.user_projection_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  preferences jsonb not null default '{
    "version": 1,
    "excludedAccountIds": [],
    "excludedCardIds": [],
    "excludedTransactionIds": [],
    "excludedGroupIds": []
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_projection_preferences_profile_id_check
    check (profile_id in ('pf', 'pj')),
  constraint user_projection_preferences_user_profile_unique
    unique (user_id, profile_id)
);

create or replace function public.set_user_projection_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_projection_preferences_updated_at
  on public.user_projection_preferences;

create trigger set_user_projection_preferences_updated_at
before update on public.user_projection_preferences
for each row
execute function public.set_user_projection_preferences_updated_at();

alter table public.user_projection_preferences
  enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_projection_preferences'
      and policyname = 'user_projection_preferences_select_own'
  ) then
    create policy "user_projection_preferences_select_own"
      on public.user_projection_preferences
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_projection_preferences'
      and policyname = 'user_projection_preferences_insert_own'
  ) then
    create policy "user_projection_preferences_insert_own"
      on public.user_projection_preferences
      for insert
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_projection_preferences'
      and policyname = 'user_projection_preferences_update_own'
  ) then
    create policy "user_projection_preferences_update_own"
      on public.user_projection_preferences
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_projection_preferences'
      and policyname = 'user_projection_preferences_delete_own'
  ) then
    create policy "user_projection_preferences_delete_own"
      on public.user_projection_preferences
      for delete
      using (auth.uid() = user_id);
  end if;
end
$$;
