-- JobHunter — initial schema (phase 1)
-- Run in Supabase SQL editor, or via `supabase db push`.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Leftovers from a partial earlier run (safe if absent).
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Preferences & profile
-- ---------------------------------------------------------------------------

create table public.preferences (
  user_id           uuid primary key references auth.users on delete cascade,
  home_address      text not null default 'קריית אונו',
  home_lat          double precision,
  home_lng          double precision,
  max_commute_min   int  not null default 45,
  target_salary     int  not null default 23000,
  role_tracks       text[] not null default array['Data Analyst','BI Developer','Data Engineer','Product Analyst'],
  weights           jsonb not null default '{"skills":30,"role":20,"commute":15,"stability":15,"salary":10,"domain":5,"hebrew":5}',
  preferred_domains text[] not null default array['fintech','health'],
  negative_keywords text[] not null default array['sales','account executive','student','סטודנט'],
  preference_notes  text not null default '',
  digest_hour       int  not null default 8,
  ingest_token      text not null default encode(extensions.gen_random_bytes(24), 'hex'), -- for iOS Shortcut
  updated_at        timestamptz not null default now()
);

create table public.master_profile_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  kind        text not null check (kind in ('role','project','skill','achievement','education','course','summary')),
  title       text not null,
  org         text,
  start_date  date,
  end_date    date,
  details     text not null default '',
  tags        text[] not null default '{}',
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.cv_base (
  user_id    uuid not null references auth.users on delete cascade,
  lang       text not null check (lang in ('en','he')),
  content    jsonb not null,           -- structured CV
  updated_at timestamptz not null default now(),
  primary key (user_id, lang)
);

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------

create table public.companies (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  name         text not null,
  ats          text check (ats in ('greenhouse','lever','comeet','none')),
  ats_board    text,                   -- greenhouse token / lever slug / comeet uid
  ats_token    text,                   -- comeet public token
  website      text,
  status       text not null default 'active' check (status in ('active','blacklist','suggested','paused')),
  tier_override text check (tier_override in ('A','B','C')),
  last_fetched_at timestamptz,
  last_fetch_count int,
  last_fetch_error text,
  created_at   timestamptz not null default now(),
  unique (user_id, name)
);

create table public.company_cards (
  company_name   text primary key,     -- normalized lowercase name; shared cache
  tier           text not null check (tier in ('A','B','C')),
  is_public      boolean,
  employees      int,
  founded_year   int,
  funding_stage  text,
  recent_layoffs boolean,
  sector         text,
  hq_country     text,
  work_language  text check (work_language in ('he','en','mixed')),
  is_staffing    boolean not null default false,  -- placement / outsourcing company
  summary        text,
  sources        jsonb not null default '[]',
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '90 days'
);

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

create table public.jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  fingerprint   text not null,         -- normalized company+title, for dedup
  title         text not null,
  company       text not null,
  company_hidden boolean not null default false,   -- posted by a staffing agency
  location      text,
  lat           double precision,
  lng           double precision,
  remote        text check (remote in ('onsite','hybrid','remote','unknown')) default 'unknown',
  description   text not null default '',
  language      text check (language in ('he','en')),
  apply_email   text,
  apply_url     text,
  salary_min    int,
  salary_max    int,
  posted_at     timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  is_open       boolean not null default true,
  filtered_out  text,                  -- reason if a hard filter dropped it
  unique (user_id, fingerprint)
);
create index jobs_user_seen on public.jobs (user_id, first_seen_at desc);

create table public.job_sources (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs on delete cascade,
  source      text not null,           -- greenhouse | lever | comeet | linkedin_email | manual | alljobs | drushim
  external_id text,
  url         text,
  fetched_at  timestamptz not null default now(),
  unique (job_id, source, external_id)
);

create table public.job_scores (
  job_id       uuid primary key references public.jobs on delete cascade,
  total        int not null check (total between 0 and 100),
  breakdown    jsonb not null,         -- {skills, role, commute, stability, salary, domain, hebrew}
  explanation  text not null,
  missing_skills text[] not null default '{}',
  tags         text[] not null default '{}',
  salary_estimate int,
  commute_transit_min int,
  commute_drive_min   int,
  model        text not null,
  scored_at    timestamptz not null default now()
);

create table public.commute_cache (
  origin       text not null,
  destination  text not null,
  transit_min  int,
  drive_min    int,
  computed_at  timestamptz not null default now(),
  primary key (origin, destination)
);

-- ---------------------------------------------------------------------------
-- Feedback & learning
-- ---------------------------------------------------------------------------

create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  job_id     uuid not null references public.jobs on delete cascade,
  kind       text not null check (kind in ('up','down','open','save','hide','score_fix')),
  reasons    text[] not null default '{}',
  score_fix  int,
  note       text,
  created_at timestamptz not null default now()
);

create table public.preference_suggestions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  suggestion  text not null,
  rationale   text not null,
  change      jsonb not null,          -- machine-applicable patch to preferences
  status      text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------

create table public.cv_versions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  job_id      uuid references public.jobs on delete set null,
  lang        text not null check (lang in ('en','he')),
  content     jsonb not null,
  pdf_path    text,
  cover_letter text,
  created_at  timestamptz not null default now()
);

create table public.applications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  job_id       uuid not null references public.jobs on delete cascade,
  status       text not null default 'saved' check (status in
                 ('saved','applied','screening','interview','home_task','offer','hired','rejected','no_response','withdrawn')),
  interview_round int not null default 0,
  cv_version_id uuid references public.cv_versions on delete set null,
  channel      text,                   -- email | form | agency
  contact_name text,
  contact_email text,
  notes        text not null default '',
  applied_at   timestamptz,
  updated_at   timestamptz not null default now(),
  unique (user_id, job_id)
);

create table public.application_events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications on delete cascade,
  kind           text not null,        -- status_change | email_in | email_out | note
  payload        jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  endpoint   text not null unique,
  keys       jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security: every user sees only their rows
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['preferences','master_profile_items','cv_base','companies','jobs',
                           'feedback','preference_suggestions','cv_versions','applications','push_subscriptions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy own_rows on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

alter table public.job_sources enable row level security;
create policy own_rows on public.job_sources for all
  using (exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid()));

alter table public.job_scores enable row level security;
create policy own_rows on public.job_scores for all
  using (exists (select 1 from public.jobs j where j.id = job_id and j.user_id = auth.uid()));

alter table public.application_events enable row level security;
create policy own_rows on public.application_events for all
  using (exists (select 1 from public.applications a where a.id = application_id and a.user_id = auth.uid()));

-- Shared caches: readable by signed-in users, written only by the service role.
alter table public.company_cards enable row level security;
create policy read_all on public.company_cards for select using (auth.role() = 'authenticated');
alter table public.commute_cache enable row level security;
create policy read_all on public.commute_cache for select using (auth.role() = 'authenticated');

-- Create a preferences row automatically for each new user.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Convenience view for the jobs list.
create view public.jobs_feed with (security_invoker = true) as
select j.*, s.total, s.breakdown, s.explanation, s.missing_skills, s.tags,
       s.salary_estimate, s.commute_transit_min, s.commute_drive_min,
       a.status as application_status,
       (select array_agg(distinct src.source) from public.job_sources src where src.job_id = j.id) as sources
from public.jobs j
left join public.job_scores s on s.job_id = j.id
left join public.applications a on a.job_id = j.id;
