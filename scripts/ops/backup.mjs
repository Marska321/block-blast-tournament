import { pipeline } from 'node:stream/promises';
import { randomBytes } from 'node:crypto';
import { readFile, mkdir, rename, unlink, writeFile, open } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { encrypt, decrypt } from './archive.mjs';
const project = 'ivtbxaoflwuzkfbgtedh';
function insideSource(path) {
  const rel = relative(resolve('.'), resolve(path));
  return rel === '' || (!rel.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')) && rel !== '..' && !isAbsolute(rel));
}
const keyFile = process.env.BACKUP_KEY_FILE;
const directory = process.env.BACKUP_DIR;
function child(command, args, options={}) {
  const proc=spawn(command,args,{stdio:['ignore','pipe','ignore'],...options});
  const done = new Promise((ok,bad)=>{proc.on('error',()=>bad(new Error('PostgreSQL client unavailable')));proc.on('close',code=>code===0?ok():bad(new Error('PostgreSQL command failed; check client version, permissions and connection settings privately')));});
  // Avoid an unhandled rejection while stdout is still being consumed.
  done.catch(()=>{}); return {proc,done};
}
try {
  if (!keyFile) throw new Error('Set BACKUP_KEY_FILE to a private path outside the repository');
  if (insideSource(keyFile)) throw new Error('Keep the backup key outside the source repository');
  if (process.argv[2] === 'keygen') {
    await writeFile(keyFile,randomBytes(32),{flag:'wx',mode:0o600});
    console.log('Created backup key. Store a second copy separately in a password manager.');
  } else {
    const key=await readFile(keyFile);
    if (key.length!==32) throw new Error('Invalid backup key');
    if (process.argv[2] === 'verify') {
      const source=await decrypt(process.argv[3],key);
      let bytes=0;for await(const chunk of source) bytes+=chunk.length;
      if(!bytes)throw new Error('Empty backup');
      console.log('Encrypted backup authentication passed. A separate restore rehearsal is still required.');
    } else if (process.argv[2] === 'unpack') {
      const target = process.env.BACKUP_RESTORE_FILE;
      if (!target || insideSource(target))
        throw new Error('Set BACKUP_RESTORE_FILE outside the source repository');
      const partial = resolve(target) + '.partial';
      let created = false;
      try {
        const source = await decrypt(process.argv[3], key);
        const output = await open(partial, 'wx', 0o600);
        created = true;
        try { await pipeline(source, output.createWriteStream()); } finally { await output.close(); }
        // Link with exclusive semantics so an existing restored archive is never replaced.
        const { link } = await import('node:fs/promises');
        await link(partial, resolve(target)); await unlink(partial);
        console.log('Authenticated archive unpacked. It contains private data; restore only to an isolated test database first, then remove the plaintext archive.');
      } catch(e) { if(created) await unlink(partial).catch(()=>{}); throw e; }
    } else {
      if (process.argv[2] !== 'create') throw new Error('Use keygen, create, verify FILE, or unpack FILE');
      const host=process.env.PGHOST, user=process.env.PGUSER;
      const direct=host===`db.${project}.supabase.co` && user==='postgres';
      const pooler=/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host||'') && user===`postgres.${project}`;
      if ((!direct&&!pooler)||process.env.PGPORT!=='5432'||process.env.PGDATABASE!=='postgres'||process.env.PGSSLMODE!=='verify-full')
        throw new Error('Explicit production direct/session-pooler PGHOST, PGUSER, PGPORT=5432, PGDATABASE=postgres and PGSSLMODE=verify-full required');
      if(!directory)throw new Error('Set BACKUP_DIR to private backup storage');
      const root=resolve(directory);
      if(insideSource(root))throw new Error('Backup storage must be outside the source repository');
      await mkdir(root,{recursive:true,mode:0o700});
      const name=`blokblaster-${new Date().toISOString().replaceAll(':','-')}-${randomBytes(4).toString('hex')}.pgdump.enc`;
      const final=join(root,name), partial=final+'.partial';
      // pg_dump uses libpq's PG* environment / PGPASSFILE. No credentials in args or logs.
      const {proc,done}=child('pg_dump',['--format=custom','--no-owner','--schema=public','--schema=auth','--schema=storage','--schema=supabase_migrations']);
      try {
        await encrypt(proc.stdout,partial,key); await done;
        const plain=await decrypt(partial,key); let bytes=0;
        for await(const chunk of plain) bytes+=chunk.length;
        if(bytes<5)throw new Error('Empty backup');
        await rename(partial,final);
        console.log(JSON.stringify({backup:final,project,authenticated:true,restoreRehearsed:false}));
      } catch(e) {proc.kill();await unlink(partial).catch(()=>{});throw e;}
    }
  }
} catch(e) { console.error(e.message); process.exitCode=1; }
