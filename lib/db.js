import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join } from 'path';
import { mkdirSync } from 'fs';

let db = null;

async function getDB() {
  if (db) return db;

  const dataDir = join(process.cwd(), 'data');
  try {
    mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    // Directory already exists
  }

  const file = join(dataDir, 'db.json');
  const adapter = new JSONFile(file);
  
  db = new Low(adapter, { users: [], messages: [] });
  
  await db.read();
  
  if (!db.data) {
    db.data = { users: [], messages: [] };
    await db.write();
  }
  
  return db;
}

export default getDB;