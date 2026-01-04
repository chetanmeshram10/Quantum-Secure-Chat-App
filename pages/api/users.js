import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'db.json');
const adapter = new JSONFile(dbPath);
const db = new Low(adapter, { users: [], messages: [] });

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await db.read();

  // Return all users (without passwords or private keys)
  const users = db.data.users.map(({ password, ...user }) => user);

  return res.status(200).json(users);
}