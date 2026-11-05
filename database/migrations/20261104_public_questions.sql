begin;
alter table public.aguirra_messages add column if not exists search_entry_point text check(char_length(search_entry_point)<=60000);
create table if not exists aguirra_private.public_config (id boolean primary key default true check(id), token_hash text not null);
create table if not exists aguirra_private.public_budget (kind text not null, visitor text not null, bucket timestamptz not null, count integer not null, primary key(kind,visitor,bucket));
alter table aguirra_private.public_config enable row level security;
alter table aguirra_private.public_budget enable row level security;
revoke all on aguirra_private.public_config, aguirra_private.public_budget from public, anon, authenticated;
-- RPC accepts only a server-held secret. It returns a boolean and never user data.
create or replace function public.aguirra_claim_public_budget(server_token text, budget_kind text, visitor_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare b timestamptz; v text; cap integer; used integer;
begin
  if server_token is null or length(server_token)<32 or not exists(select 1 from aguirra_private.public_config where token_hash=encode(sha256(convert_to(server_token,'UTF8')),'hex')) then raise exception 'server authorization required' using errcode='42501'; end if;
  if budget_kind not in ('guest','google') or visitor_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid budget'; end if;
  b := case when budget_kind='google' then date_trunc('day',now()) else date_trunc('hour',now()) end;
  v := case when budget_kind='google' then 'all' else visitor_hash end;
  cap := case when budget_kind='google' then 100 else 30 end;
  perform pg_advisory_xact_lock(hashtextextended(budget_kind||v,0));
  select count into used from aguirra_private.public_budget where kind=budget_kind and visitor=v and bucket=b;
  if coalesce(used,0)>=cap then return false; end if;
  delete from aguirra_private.public_budget where bucket<now()-interval '2 days';
  insert into aguirra_private.public_budget(kind,visitor,bucket,count) values(budget_kind,v,b,1)
    on conflict(kind,visitor,bucket) do update set count=aguirra_private.public_budget.count+1;
  return true;
end $$;
revoke all on function public.aguirra_claim_public_budget(text,text,text) from public;
grant execute on function public.aguirra_claim_public_budget(text,text,text) to anon, authenticated;
commit;
