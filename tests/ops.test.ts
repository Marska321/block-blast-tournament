import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
// @ts-ignore Operational helpers are native Node ES modules.
import { encrypt, decrypt } from '../scripts/ops/archive.mjs';
// @ts-ignore Operational helpers are native Node ES modules.
import { checkHealth } from '../scripts/ops/health.mjs';

test('encrypted backup round-trip rejects tampering and wrong keys', async () => {
  const dir=await mkdtemp(join(tmpdir(),'bb-backup-'));
  try {
    const path=join(dir,'test.enc'),key=randomBytes(32),raw=randomBytes(300000);
    await encrypt(Readable.from([raw]),path,key);
    const collect=async(k:Buffer)=>{const chunks=[];for await(const c of await decrypt(path,k))chunks.push(c);return Buffer.concat(chunks);};
    assert.deepEqual(await collect(key),raw);
    assert.equal((await readFile(path)).includes(raw.subarray(0,32)),false);
    await assert.rejects(collect(randomBytes(32)));
    const corrupt=await readFile(path);corrupt[200]^=1;await writeFile(path,corrupt);
    await assert.rejects(collect(key));
    await assert.rejects(encrypt(Readable.from(['overwrite']),path,key));
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('health detects unavailable databases and stale or demo responses',async()=>{
  const now=Date.parse('2026-11-17T12:00:00Z');
  let mode='healthy';
  const request=async(url:URL)=>{
    if(url.pathname==='/')return new Response('<title>Blok Blaster</title><script src="/assets/game.js"></script><link href="/assets/game.css">');
    if(url.pathname.startsWith('/assets/'))return new Response('',{headers:{'content-type':url.pathname.endsWith('.css')?'text/css':'application/javascript'}});
    if(mode==='down')return new Response('',{status:503});
    return Response.json({day:'2026-11-17',today:'2026-11-17',closed:false,demo:mode==='demo',entries:[],participants:0,serverTime: new Date(now-(mode==='stale'?600000:0)).toISOString()});
  };
  assert.equal((await checkHealth('https://example.com',request,now)).healthy,true);
  for(mode of ['down','stale','demo'])assert.equal((await checkHealth('https://example.com',request,now)).healthy,false);
});

test('backup CLI authenticates before publishing unpacked data and preserves existing files',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'bb-cli-'));
  try {
    const keyFile=join(dir,'test.key'),archive=join(dir,'snapshot.enc'),target=join(dir,'restore.dump');
    const env={...process.env,BACKUP_KEY_FILE:keyFile,BACKUP_RESTORE_FILE:target};
    const run=(...args:string[])=>spawnSync(process.execPath,['scripts/ops/backup.mjs',...args],{env,encoding:'utf8'});
    assert.equal(run('keygen').status,0);
    assert.notEqual(run('keygen').status,0);
    const key=await readFile(keyFile);
    await encrypt(Readable.from(['PGDMP private fixture']),archive,key);
    assert.equal(run('verify',archive).status,0);
    assert.equal(run('unpack',archive).status,0);
    assert.equal(await readFile(target,'utf8'),'PGDMP private fixture');
    assert.notEqual(run('unpack',archive).status,0);
    assert.equal(await readFile(target,'utf8'),'PGDMP private fixture');
    await writeFile(target+'.partial','existing partial');
    assert.notEqual(run('unpack',archive).status,0);
    assert.equal(await readFile(target+'.partial','utf8'),'existing partial');
    const damaged=await readFile(archive);damaged[22]^=1;await writeFile(archive,damaged);
    assert.notEqual(run('verify',archive).status,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});
