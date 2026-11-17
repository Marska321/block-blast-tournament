import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {encrypt,decrypt} from './archive.mjs';
import assert from 'node:assert/strict';
const name=`bb-backup-rehearsal-${process.pid}`;
const image='postgres@sha256:0d938e975177bef9f1f61f3f9dbcf2e0aa0a139568f66d3415ed8892eb97f6ac';
function run(args,input){return new Promise((ok,bad)=>{const p=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',c=>out+=c);p.stderr.on('data',c=>err+=c);p.on('error',bad);p.on('close',n=>n===0?ok(out):bad(new Error(err)));p.stdin.end(input);});}
const dir=await mkdtemp(join(tmpdir(),'backup-rehearsal-'));
try {
 await run(['run','-d','--name',name,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust',image]);
 for(let i=0;i<30;i++){try{await run(['exec',name,'pg_isready','-U','postgres']);break;}catch(e){if(i===29)throw e;await new Promise(r=>setTimeout(r,500));}}
 await run(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA storage;CREATE SCHEMA supabase_migrations;CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('00000000-0000-4000-8000-000000000001');CREATE TABLE public.classic_daily_best(user_id uuid REFERENCES auth.users(id),score integer);INSERT INTO public.classic_daily_best VALUES('00000000-0000-4000-8000-000000000001',1234);ALTER TABLE public.classic_daily_best ENABLE ROW LEVEL SECURITY;REVOKE ALL ON public.classic_daily_best FROM anon,authenticated;CREATE DATABASE restored;`);
 await run(['exec',name,'psql','-U','postgres','-d','restored','-v','ON_ERROR_STOP=1','-c','DROP SCHEMA public;']);
 const dump=spawn('docker',['exec',name,'pg_dump','-U','postgres','--format=custom','--no-owner','--schema=public','--schema=auth','--schema=storage','--schema=supabase_migrations'],{stdio:['ignore','pipe','pipe']});
 const complete=new Promise((ok,bad)=>dump.on('close',n=>n===0?ok():bad(new Error('dump failed'))));
 const path=join(dir,'test.enc'),key=randomBytes(32);
 await encrypt(dump.stdout,path,key);await complete;
 const chunks=[];for await(const c of await decrypt(path,key))chunks.push(c);
 const raw=Buffer.concat(chunks);
 await run(['exec','-i',name,'pg_restore','-U','postgres','--dbname=restored','--exit-on-error','--single-transaction','--no-owner'],raw);
 const result=await run(['exec',name,'psql','-U','postgres','-d','restored','-Atc',"SELECT score FROM public.classic_daily_best;SELECT relrowsecurity FROM pg_class WHERE oid='public.classic_daily_best'::regclass;SELECT count(*) FROM auth.users;SELECT has_table_privilege('anon','public.classic_daily_best','SELECT');"]);
 assert.equal(result.trim(),'1234\nt\n1\nf');
 console.log('PASS PostgreSQL 17 fixture: dump, AES-GCM encryption, authenticated decryption, isolated transactional restore, score/Auth linkage, RLS and denied anonymous reads. No production access.');
}finally{await run(['rm','-f',name]).catch(()=>{});await rm(dir,{recursive:true,force:true});}
