-- 0003: job-age setting, AI company discovery, base-CV enrichment interview.
-- Safe to run more than once.

-- Job age: hide / skip scoring jobs posted more than N days ago.
alter table public.preferences add column if not exists max_job_age_days int not null default 30;

-- Company discovery: where a company came from and why the AI suggested it.
alter table public.companies add column if not exists source text not null default 'manual'
  check (source in ('manual','seed','ai'));
alter table public.companies add column if not exists suggest_reason text;

-- Profile: a few more kinds of facts for the CV.
alter table public.master_profile_items drop constraint if exists master_profile_items_kind_check;
alter table public.master_profile_items add constraint master_profile_items_kind_check
  check (kind in ('role','project','skill','achievement','education','course','summary',
                  'language','certification','military','volunteer'));

-- Enrichment interview: AI asks short questions to fill CV gaps; answers become profile items.
create table if not exists public.profile_questions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  question    text not null,
  why         text not null default '',       -- what the answer will improve
  answer      text,
  status      text not null default 'open' check (status in ('open','answered','skipped','applied')),
  created_at  timestamptz not null default now()
);
alter table public.profile_questions enable row level security;
drop policy if exists own_rows on public.profile_questions;
create policy own_rows on public.profile_questions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Data API access (new Supabase projects don't expose tables automatically).
grant select, insert, update, delete on public.profile_questions to authenticated, service_role;

notify pgrst, 'reload schema';

select 'ok' as status,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'preferences' and column_name = 'max_job_age_days') as age_column,
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'profile_questions') as questions_table;
