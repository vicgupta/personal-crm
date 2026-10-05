#!/usr/bin/env node
// Sets (or rotates) the login password for the Personal CRM.
// Writes only the scrypt hash to ./.env (mode 600) — the plaintext password
// is never stored. Restart the service afterwards to apply.
//
// Usage:  cd /root/personal-crm/server && npm run set-password
import { scryptSync, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, '.env');

function promptHidden(label) {
  return new Promise((resolve) => {
    process.stdout.write(label);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    let input = '';
    const onData = (chunk) => {
      const s = chunk.toString('utf8');
      if (s === '\r' || s === '\n' || s === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(input);
      } else if (s === '\u0003') {
        process.stdout.write('\n');
        process.exit(1);
      } else if (s === '\u007f' || s === '\b') {
        input = input.slice(0, -1);
      } else if (s >= ' ') {
        input += s;
      }
    };
    stdin.on('data', onData);
  });
}

const p1 = await promptHidden('New password: ');
if (p1.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}
const p2 = await promptHidden('Confirm password: ');
if (p1 !== p2) {
  console.error('Passwords do not match.');
  process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const derived = scryptSync(p1, salt, 64).toString('hex');
const hash = `scrypt$${salt}$${derived}`;

let env = '';
try {
  env = fs.readFileSync(envPath, 'utf8');
} catch {
  /* fresh file */
}
const kept = env
  .split('\n')
  .filter((line) => line.trim() !== '' && !line.startsWith('CRM_PASSWORD_HASH='));
kept.push(`CRM_PASSWORD_HASH=${hash}`);
fs.writeFileSync(envPath, kept.join('\n') + '\n');
fs.chmodSync(envPath, 0o600);

console.log(`Password updated in ${envPath} (mode 600).`);
console.log('Restart the service to apply:  systemctl restart personal-crm');
