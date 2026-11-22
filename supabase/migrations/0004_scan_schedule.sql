-- 0004: user-controlled automatic scans (on/off, hours, days, company research). Safe to run more than once.

alter table public.preferences add column if not exists scan_enabled boolean not null default true;
-- Israel-time hours to scan at; the scheduler runs at 07, 12, 17 and 21.
alter table public.preferences add column if not exists scan_hours int[] not null default '{7,17}';
-- Days of week, 0 = Sunday … 6 = Saturday.
alter table public.preferences add column if not exists scan_days int[] not null default '{0,1,2,3,4}';
-- Research new companies automatically (web search — the costly part). Off = only on request.
alter table public.preferences add column if not exists auto_company_research boolean not null default true;

notify pgrst, 'reload schema';

select 'ok' as status,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'preferences'
       and column_name in ('scan_enabled','scan_hours','scan_days','auto_company_research')) as new_columns;
