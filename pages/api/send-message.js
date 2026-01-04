import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'db.json');
const adapter = new JSONFile(dbPath);
const db = new Low(adapter, { users: [], messages: [] });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await db.read();

  const messageData = req.body;
  const { from, to, timestamp, type } = messageData;

  if (!from || !to) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Verify users exist
  const fromUser = db.data.users.find(u => u.username === from);
  const toUser = db.data.users.find(u => u.username === to);

  if (!fromUser || !toUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Store encrypted message or file (server never sees plaintext)
  const message = {
    ...messageData,
    timestamp: timestamp || new Date().toISOString()
  };

  db.data.messages.push(message);
  await db.write();

  return res.status(200).json({ 
    message: type === 'file' ? 'File sent successfully' : 'Message sent successfully',
    encrypted: true 
  });
}