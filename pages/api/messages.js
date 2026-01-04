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

  const { user1, user2 } = req.query;

  if (!user1 || !user2) {
    return res.status(400).json({ error: 'Both user1 and user2 are required' });
  }

  // Get all encrypted messages between two users
  // Server returns encrypted data; decryption happens on client
  const messages = db.data.messages.filter(
    msg =>
      (msg.from === user1 && msg.to === user2) ||
      (msg.from === user2 && msg.to === user1)
  );

  // Sort by timestamp
  messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return res.status(200).json(messages);
}