import { writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import webpush from 'web-push';
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
// wx prevents accidental key rotation, which would strand existing subscribers.
await writeFile('.env.push.local', [
  'UPDATES_ENABLED=true',
  'UPDATES_ORIGINS=https://blokblaster.vercel.app,https://block-blast-tournament.vercel.app',
  `WEB_PUSH_PUBLIC_KEY=${publicKey}`, `WEB_PUSH_PRIVATE_KEY=${privateKey}`,
  'WEB_PUSH_SUBJECT=https://blokblaster.vercel.app',
  `CRON_SECRET=${randomBytes(32).toString('hex')}`, '',
].join('\n'), { flag: 'wx', mode: 0o600 });
console.log('Saved notification keys in ignored .env.push.local. Private values were not printed. Keep this file backed up securely; do not regenerate keys after players subscribe.');
