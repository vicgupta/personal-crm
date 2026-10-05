#!/usr/bin/env tsx
// Manage Personal CRM login users. Passwords are prompted (hidden input);
// only scrypt hashes are stored in the SQLite database.
//
// Usage (from the server directory):
//   npm run user list
//   npm run user add <username>
//   npm run user set-password <username>
//   npm run user remove <username>
import { stdin, stdout, exit } from 'node:process';
import { openDatabase } from './db.js';
import {
  ensureUsersTable,
  countUsers,
  listUsers,
  createUser,
  setUserPassword,
  deleteUser,
  hashPassword,
} from './auth.js';

function promptHidden(label: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    console.error('This command needs an interactive terminal (passwords are read hidden).');
    exit(1);
  }
  return new Promise((resolve) => {
    stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    let input = '';
    const onData = (chunk: Buffer) => {
      const s = chunk.toString('utf8');
      if (s === '\r' || s === '\n' || s === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        resolve(input);
      } else if (s === '\u0003') {
        stdout.write('\n');
        exit(1);
      } else if (s === '\u007f' || s === '\b') {
        input = input.slice(0, -1);
      } else if (s >= ' ') {
        input += s;
      }
    };
    stdin.on('data', onData);
  });
}

async function promptNewPassword(): Promise<string> {
  const p1 = await promptHidden('New password: ');
  if (p1.length < 8) {
    console.error('Password must be at least 8 characters.');
    exit(1);
  }
  const p2 = await promptHidden('Confirm password: ');
  if (p1 !== p2) {
    console.error('Passwords do not match.');
    exit(1);
  }
  return p1;
}

function usage(): never {
  console.error('Usage: npm run user <list|add|set-password|remove> [username]');
  exit(1);
}

const [cmd, username] = process.argv.slice(2);
const db = openDatabase();
ensureUsersTable(db);

switch (cmd) {
  case 'list': {
    const users = listUsers(db);
    if (users.length === 0) console.log('No users.');
    else for (const u of users) console.log(`#${u.id}  ${u.username}  (created ${u.created_at})`);
    break;
  }
  case 'add': {
    if (!username) usage();
    if (username.trim() !== username || username.length === 0) {
      console.error('Username must be non-empty with no surrounding whitespace.');
      exit(1);
    }
    const password = await promptNewPassword();
    try {
      createUser(db, username, hashPassword(password));
    } catch {
      console.error(`User "${username}" already exists.`);
      exit(1);
    }
    console.log(`User "${username}" created.`);
    break;
  }
  case 'set-password': {
    if (!username) usage();
    const password = await promptNewPassword();
    if (!setUserPassword(db, username, hashPassword(password))) {
      console.error(`No such user "${username}".`);
      exit(1);
    }
    console.log(`Password updated for "${username}". Existing sessions stay valid; the new password applies at next login.`);
    break;
  }
  case 'remove': {
    if (!username) usage();
    if (countUsers(db) <= 1) {
      console.error('Refusing to remove the last login user.');
      exit(1);
    }
    if (!deleteUser(db, username)) {
      console.error(`No such user "${username}".`);
      exit(1);
    }
    console.log(`User "${username}" removed.`);
    break;
  }
  default:
    usage();
}
