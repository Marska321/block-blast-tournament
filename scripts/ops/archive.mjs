import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
const magic = Buffer.from('BBBACK01');
export async function encrypt(source, path, key) {
  if (key.length !== 32) throw new Error('Backup key must be 32 bytes');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(magic);
  const handle = await open(path, 'wx', 0o600);
  try { await handle.write(Buffer.concat([magic, iv])); } finally { await handle.close(); }
  await pipeline(source, cipher, createWriteStream(path, {flags:'a', mode:0o600}));
  const tail = await open(path, 'a');
  try { await tail.write(cipher.getAuthTag()); } finally { await tail.close(); }
}
// Authentication completes only at EOF. Never pipe this to a live database:
// verification must finish before any restore is attempted.
export async function decrypt(path, key) {
  const file = await open(path, 'r');
  let size, header, tag;
  try {
    size = (await file.stat()).size;
    if (size < 37) throw new Error('Invalid encrypted backup');
    header = Buffer.alloc(20); tag = Buffer.alloc(16);
    await file.read(header, 0, 20, 0); await file.read(tag, 0, 16, size - 16);
  } finally { await file.close(); }
  if (!header.subarray(0,8).equals(magic)) throw new Error('Invalid backup format');
  const cipher = createDecipheriv('aes-256-gcm', key, header.subarray(8));
  cipher.setAAD(magic); cipher.setAuthTag(tag);
  return Readable.from((async function*(){
    for await (const chunk of createReadStream(path,{start:20,end:size-17})) yield cipher.update(chunk);
    yield cipher.final();
  })());
}
