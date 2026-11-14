-- Explicit API grants. Newer Supabase projects can be created with
-- "automatically expose new tables" off, which leaves our tables invisible
-- to the Data API. RLS (from 0001) still restricts every row to its owner.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- Make the Data API pick up the new tables right away.
notify pgrst, 'reload schema';

-- Sanity check: should list 16 rows (15 tables + the jobs_feed view).
select table_name, table_type
from information_schema.tables
where table_schema = 'public'
order by table_type, table_name;
