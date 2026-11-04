-- Transaction-only fixtures; no e-mails or test accounts survive this check.
begin;
insert into auth.users(id,aud,role,email) values
 ('aaaaaaaa-0000-4000-8000-000000000001','authenticated','authenticated','aguirra-rls-a@example.invalid'),
 ('aaaaaaaa-0000-4000-8000-000000000002','authenticated','authenticated','aguirra-rls-b@example.invalid');
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
insert into public.aguirra_threads(id,user_id,title) values('bbbbbbbb-0000-4000-8000-000000000001',auth.uid(),'RLS fixture');
insert into public.aguirra_messages(id,user_id,thread_id,role,content) values('cccccccc-0000-4000-8000-000000000001',auth.uid(),'bbbbbbbb-0000-4000-8000-000000000001','user','Prefiro exemplos curtos');
insert into public.aguirra_memories(user_id,category,key,content,source_message_id) values(auth.uid(),'preferences','short','Prefere exemplos curtos','cccccccc-0000-4000-8000-000000000001');
select public.aguirra_touch_topic('Desenvolvimento');
do $$ declare i integer; allowed boolean; begin
  for i in 1..30 loop allowed:=public.aguirra_claim_request(); if not allowed then raise exception 'quota rejected too early'; end if; end loop;
  if public.aguirra_claim_request() then raise exception 'quota failed to stop request 31'; end if;
end $$;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
do $$ begin
  if exists(select 1 from public.aguirra_threads) or exists(select 1 from public.aguirra_memories) or exists(select 1 from public.aguirra_messages) then raise exception 'cross-user read leak'; end if;
  begin
    insert into public.aguirra_memories(user_id,category,key,content) values('aaaaaaaa-0000-4000-8000-000000000001','notes','bad','Forbidden write');
    raise exception 'cross-user insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.aguirra_messages(user_id,thread_id,role,content) values(auth.uid(),'bbbbbbbb-0000-4000-8000-000000000001','user','Forbidden thread');
    raise exception 'cross-user foreign key accepted';
  exception when foreign_key_violation then null; end;
  delete from public.aguirra_memories;
end $$;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.aguirra_memories)<>1 then raise exception 'cross-user delete changed owner data'; end if;
  begin
    update public.aguirra_memories set user_id='aaaaaaaa-0000-4000-8000-000000000002';
    raise exception 'ownership reassignment allowed';
  exception when insufficient_privilege then null; end;
end $$;
select public.aguirra_forget_all();
do $$ begin if exists(select 1 from public.aguirra_memories) or exists(select 1 from public.aguirra_messages) or exists(select 1 from public.aguirra_threads) then raise exception 'forget-all did not clear data'; end if; end $$;
reset role;
rollback;
select 'PASS: owner isolation, cross-user writes, thread ownership, quota, forget-all; fixtures rolled back' as result;
