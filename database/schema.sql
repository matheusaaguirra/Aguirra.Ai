-- Initial schema for Aguirra. Apply only to the dedicated Aguirra project.
begin;
create schema if not exists aguirra_private;
revoke all on schema aguirra_private from public, anon;
grant usage on schema aguirra_private to authenticated;

create table public.aguirra_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  created_at timestamptz not null default now(),
  unique(id,user_id)
);
create table public.aguirra_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null,
  role text not null check(role in ('user','assistant')),
  content text not null check(char_length(content) between 1 and 40000),
  sources jsonb not null default '[]'::jsonb check(jsonb_typeof(sources)='array'),
  reply_id uuid,
  failed boolean not null default false,
  exclude_context boolean not null default false,
  cache_meta jsonb,
  created_at timestamptz not null default now(),
  foreign key(thread_id,user_id) references public.aguirra_threads(id,user_id) on delete cascade,
  unique(id,user_id)
);
create table public.aguirra_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check(category in ('profile','preferences','goals','projects','notes')),
  key text not null check(char_length(key) between 1 and 100),
  content text not null check(char_length(content) between 3 and 500),
  origin text not null default 'manual' check(origin in ('manual','declared')),
  source_message_id uuid,
  updated_at timestamptz not null default now(),
  foreign key(source_message_id,user_id) references public.aguirra_messages(id,user_id),
  unique(user_id,key)
);
create table public.aguirra_topics (
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(char_length(name) between 1 and 80),
  count integer not null default 1 check(count>0),
  primary key(user_id,name)
);
create table public.aguirra_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  memory_enabled boolean not null default true
);
create table aguirra_private.rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket timestamptz not null,
  count integer not null default 0,
  primary key(user_id,bucket)
);
create index aguirra_threads_owner_date on public.aguirra_threads(user_id,created_at desc);
create index aguirra_messages_owner_date on public.aguirra_messages(user_id,created_at desc);
create index aguirra_messages_thread_date on public.aguirra_messages(thread_id,user_id,created_at);
create index aguirra_memories_source on public.aguirra_memories(source_message_id,user_id);

alter table public.aguirra_threads enable row level security;
alter table public.aguirra_messages enable row level security;
alter table public.aguirra_memories enable row level security;
alter table public.aguirra_topics enable row level security;
alter table public.aguirra_settings enable row level security;
alter table aguirra_private.rate_limits enable row level security;
do $$ declare t text; begin
  foreach t in array array['aguirra_threads','aguirra_messages','aguirra_memories','aguirra_topics','aguirra_settings'] loop
    execute format('revoke all on public.%I from anon',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('create policy owner_access on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
  end loop;
end $$;

-- Only this narrowly scoped function may mutate the hidden rate-limit table.
create function aguirra_private.claim_request() returns boolean
language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); current_bucket timestamptz := date_trunc('hour',now()); used integer; daily integer;
begin
  if u is null then raise exception 'authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  select coalesce(sum(count),0) into daily from aguirra_private.rate_limits where user_id=u and bucket>=date_trunc('day',now());
  if daily>=100 then return false; end if;
  insert into aguirra_private.rate_limits(user_id,bucket,count) values(u,current_bucket,1)
    on conflict(user_id,bucket) do update set count=aguirra_private.rate_limits.count+1
    where aguirra_private.rate_limits.count<30 returning count into used;
  delete from aguirra_private.rate_limits where user_id=u and bucket<now()-interval '2 days';
  return used is not null;
end $$;
revoke all on function aguirra_private.claim_request() from public,anon;
grant execute on function aguirra_private.claim_request() to authenticated;
create function public.aguirra_claim_request() returns boolean language sql security invoker set search_path='' as $$ select aguirra_private.claim_request(); $$;
revoke all on function public.aguirra_claim_request() from public,anon;
grant execute on function public.aguirra_claim_request() to authenticated;

create function public.aguirra_touch_topic(topic_name text) returns void language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if char_length(topic_name)>80 or char_length(topic_name)<1 then raise exception 'invalid topic'; end if;
  insert into public.aguirra_topics(user_id,name,count) values(auth.uid(),topic_name,1)
    on conflict(user_id,name) do update set count=public.aguirra_topics.count+1;
end $$;
revoke all on function public.aguirra_touch_topic(text) from public,anon;
grant execute on function public.aguirra_touch_topic(text) to authenticated;

create function public.aguirra_forget_all() returns void language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  delete from public.aguirra_memories where user_id=auth.uid();
  delete from public.aguirra_threads where user_id=auth.uid();
  delete from public.aguirra_topics where user_id=auth.uid();
end $$;
revoke all on function public.aguirra_forget_all() from public,anon;
grant execute on function public.aguirra_forget_all() to authenticated;
commit;
