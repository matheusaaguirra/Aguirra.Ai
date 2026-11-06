create table aguirra_private.graph_items (
  owner_key text not null,
  kind text not null check(kind in ('message','memory','setting','audio')),
  item_key text not null,
  value jsonb not null,
  changed_at timestamptz not null default now(),
  primary key(owner_key,kind,item_key)
);
alter table aguirra_private.graph_items enable row level security;
revoke all on aguirra_private.graph_items from public,anon,authenticated;

-- Only the application server can address a private visitor or voice namespace.
create function public.aguirra_graph_store(server_token text, owner_key text, operation text, items jsonb default '[]', lookup text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; e jsonb;
begin
 if owner_key is null or owner_key !~ '^[0-9a-f]{64}$' or length(coalesce(server_token,''))<32 or not exists
 (select 1 from aguirra_private.public_config where token_hash=encode(sha256(convert_to(server_token,'UTF8')),'hex'))
 then raise exception 'unauthorized' using errcode='42501'; end if;
 if operation='read' then
   select coalesce(jsonb_agg(value order by changed_at,item_key),'[]') into result from aguirra_private.graph_items t where t.owner_key=$2 and kind<>'audio';
   return result;
 elsif operation='audio' then
   select value into result from aguirra_private.graph_items t where t.owner_key=$2 and kind='audio' and item_key=lookup and changed_at>now()-interval '7 days';
   return result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended($2,0));
 if operation in ('clear','clear_audio','remove_memory') then
   delete from aguirra_private.graph_items t where t.owner_key=$2 and (operation='clear' or operation='clear_audio' and kind='audio' or operation='remove_memory' and kind='memory' and item_key=lookup);
 elsif operation in ('put','import') then
   if jsonb_typeof(items)<>'array' or jsonb_array_length(items)>160 or octet_length(items::text)>5000000 then raise exception 'too large'; end if;
   for e in select * from jsonb_array_elements(items) loop
     if e->>'kind' not in ('message','memory','setting','audio') or length(e->>'key') not between 1 and 150 then raise exception 'invalid item'; end if;
     insert into aguirra_private.graph_items as t values ($2,e->>'kind',e->>'key',e->'value',now())
     on conflict on constraint graph_items_pkey do update set value=excluded.value,changed_at=now() where operation='put' and t.kind<>'message';
   end loop;
   delete from aguirra_private.graph_items t where t.owner_key=$2 and kind='audio' and item_key in
     (select item_key from (select item_key, changed_at, row_number() over(order by changed_at desc,item_key) as rn,
       sum(octet_length(value::text)) over(order by changed_at desc,item_key) as bytes from aguirra_private.graph_items where graph_items.owner_key=$2 and kind='audio') a
      where rn>20 or bytes>8000000 or changed_at<now()-interval '7 days');
   if (select sum(octet_length(value::text)) from aguirra_private.graph_items t where t.owner_key=$2 and kind<>'audio')>12000000 then raise exception 'guest storage full'; end if;
 else raise exception 'unknown operation'; end if;
 return 'true';
end $$;
revoke all on function public.aguirra_graph_store(text,text,text,jsonb,text) from public;
grant execute on function public.aguirra_graph_store(text,text,text,jsonb,text) to anon,authenticated;

create function public.aguirra_import_graph(batch jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); item jsonb;
begin
 if u is null or jsonb_array_length(batch)>160 then raise exception 'invalid import'; end if;
 insert into public.aguirra_threads(id,user_id,title) values(u,u,'Registros do Aguirra') on conflict(id) do nothing;
 for item in select * from jsonb_array_elements(batch) loop
   if item->>'kind'='message' then
     insert into public.aguirra_messages(id,user_id,thread_id,role,content,reply_id,sources,failed,exclude_context,created_at)
     values ((item->>'id')::uuid,u,u,item->>'role',item->>'content',(item->>'reply_id')::uuid,coalesce(item->'sources','[]'),coalesce((item->>'failed')::boolean,false),coalesce((item->>'exclude_context')::boolean,false),(item->>'created_at')::timestamptz)
     on conflict(id) do nothing;
     if not exists(select 1 from public.aguirra_messages where id=(item->>'id')::uuid and user_id=u and content=item->>'content') then raise exception 'record collision'; end if;
   elsif item->>'kind'='memory' then
     insert into public.aguirra_memories(user_id,category,key,content,origin)
     values(u,item->>'category',item->>'key',item->>'content','manual') on conflict(user_id,key) do nothing;
   end if;
 end loop;
 return true;
end $$;
revoke all on function public.aguirra_import_graph(jsonb) from public,anon;
grant execute on function public.aguirra_import_graph(jsonb) to authenticated;
