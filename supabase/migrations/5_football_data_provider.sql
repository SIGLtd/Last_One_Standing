-- football-data.org provider source type (server-side reconcile-fixtures only)

begin;

do $$ begin
  alter type fixture_sync_source add value if not exists 'football_data';
exception when duplicate_object then null; end $$;

commit;
