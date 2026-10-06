// Usage: npm run seed   -- DEVELOPMENT ONLY: wipes users, items, matches, claims and notifications.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { connectDB } from '../config/db.js';
import { loadModels, shutdownModels } from '../services/embeddings.js';
import { processItem } from '../services/processItem.js';
import User from '../models/User.js';
import Item from '../models/Item.js';
import Match from '../models/Match.js';
import Claim from '../models/Claim.js';
import Notification from '../models/Notification.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const { pairs } = JSON.parse(fs.readFileSync(path.join(dir, 'testPairs.json'), 'utf8'));
const today = new Date();
today.setUTCHours(0, 0, 0, 0);
const dayAt = (offset) => new Date(today.getTime() + offset * 86400000);

async function main() {
  await connectDB();
  await Promise.all([User, Item, Match, Claim, Notification].map((m) => m.deleteMany({})));

  const hash = await bcrypt.hash('Student@123', 10);
  const [admin, alice, bob] = await User.create([
    { name: 'Admin', email: 'admin@findit.test', passwordHash: await bcrypt.hash('Admin@123', 10), role: 'admin', phone: '+91 90000 00001' },
    { name: 'Alice (owner of lost items)', email: 'alice@findit.test', passwordHash: hash, phone: '+91 90000 00002' },
    { name: 'Bob (finder)', email: 'bob@findit.test', passwordHash: hash, phone: '+91 90000 00003' }
  ]);

  // 10 lost posts by Alice and the 10 matching found posts by Bob = 20 items
  const ids = [];
  for (const p of pairs.slice(0, 10)) {
    const l = await Item.create({ type: 'lost', category: p.category, postedBy: alice._id, ...p.lost, dateOccurred: dayAt(p.lost.dayOffset) });
    const f = await Item.create({ type: 'found', category: p.category, postedBy: bob._id, ...p.found, dateOccurred: dayAt(p.found.dayOffset) });
    ids.push(l._id, f._id);
  }

  console.log('Loading models and generating embeddings + matches...');
  await loadModels();
  for (const id of ids) await processItem(id); // sequential keeps memory low
  await shutdownModels();

  console.log(`\nSeeded ${ids.length} items and ${await Match.countDocuments()} matches.`);
  console.log('Logins:  admin@findit.test / Admin@123   alice@findit.test / Student@123   bob@findit.test / Student@123');
  console.log('Demo claim: log in as Alice, open "Lost black iPhone 13", claim the match with answer "golden retriever puppy".');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
