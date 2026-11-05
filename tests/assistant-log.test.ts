import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assistantLog,assistantHistory} from '../agent/lib/assistant-log.ts';
import {localDb,closeLocalStore,LOCAL_USER_ID} from '../agent/lib/local-store.ts';
test('Assistant reuses one storage log across requests, with continuous context and no new conversations',async()=>{const dir=mkdtempSync(join(tmpdir(),'aguirra-log-'));const old=process.env.AGUIRRA_LOCAL,oldDir=process.env.AGUIRRA_DATA_DIR;process.env.AGUIRRA_LOCAL='true';process.env.AGUIRRA_DATA_DIR=dir;try{const session={user:{id:LOCAL_USER_ID,email:'test'},token:'test',cookies:[]};assert.equal(await assistantLog(session),LOCAL_USER_ID);assert.equal(await assistantLog(session),LOCAL_USER_ID);assert.equal(localDb('aguirra_threads?select=*','GET').length,1);const messages=[{id:'1',role:'user',content:'Preferência',thread_id:'old'},{id:'2',role:'assistant',content:'Resposta antiga',thread_id:'old'},{id:'3',role:'user',content:'excluído',exclude_context:true},{id:'4',role:'assistant',content:'erro',failed:true},{id:'current',role:'user',content:'agora'}];assert.deepEqual(assistantHistory(messages,'current').map(m=>m.text),['Preferência','Resposta antiga']);}finally{closeLocalStore();if(old===undefined)delete process.env.AGUIRRA_LOCAL;else process.env.AGUIRRA_LOCAL=old;if(oldDir===undefined)delete process.env.AGUIRRA_DATA_DIR;else process.env.AGUIRRA_DATA_DIR=oldDir;rmSync(dir,{recursive:true,force:true});}});
