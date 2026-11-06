import test from 'node:test';
import assert from 'node:assert/strict';
import cache from '../shared/answer-cache.cjs';
import {visitor,stableId,importedItems} from '../agent/lib/cloud-graph.ts';
test('A related question retrieves supporting memory without replaying a different intent',()=>{
 const t='O que é memória RAM?', a='RAM guarda dados temporariamente.';
 const messages=[{id:'q',role:'user',content:t,reply_id:'a'},{id:'a',role:'assistant',content:a,cache_meta:cache.makeMeta(t,a,'google_ai',[],true)}];
 assert.equal(cache.find('Para que serve RAM?',messages,[],true),null);
 assert.equal(cache.related('Para que serve RAM?',messages,[],true)[0]?.id,'q');
 assert.deepEqual(cache.related('Para que serve RAM hoje?',messages,[],true),[]);
 assert.deepEqual(cache.related('Para que serve RAM?',messages,[],false),[]);
 assert.deepEqual(cache.related('Para que serve RAM?',messages,[{category:'notes',content:'Mudou'}],true),[]);
});
test('Visitor namespace follows only its session cookie and legacy imports preserve records',()=>{
 const old=process.env.AGUIRRA_GUEST_SECRET;process.env.AGUIRRA_GUEST_SECRET='disposable-test-key';
 try {
   const first=visitor(new Request('https://example.org/api/session'));
   const second=visitor(new Request('https://example.org/api/data',{headers:{Cookie:first.cookies[0].split(';')[0]}}));
   assert.equal(first.owner,second.owner); assert.notEqual(first.owner,visitor(new Request('https://example.org/api/session')).owner);
   const id=stableId('test'), answer=stableId('response');
   const entries=importedItems({messages:[{id,role:'user',content:'Pergunta?',reply_id:answer,created_at:new Date().toISOString()}],memories:[]});
   assert.equal(entries[0].value.reply_id,answer);
 } finally {if(old===undefined)delete process.env.AGUIRRA_GUEST_SECRET;else process.env.AGUIRRA_GUEST_SECRET=old;}
});
