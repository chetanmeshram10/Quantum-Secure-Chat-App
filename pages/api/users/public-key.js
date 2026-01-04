import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'db.json');
const adapter = new JSONFile(dbPath);
const db = new Low(adapter, { users: [], messages: [] });

export default async function handler(req, res) {
  await db.read();

  if (req.method === 'GET') {
    // Get user's public key
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const user = db.data.users.find(u => u.username === username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.publicKey) {
      return res.status(404).json({ error: 'Public key not found for user' });
    }

    return res.status(200).json({ publicKey: user.publicKey });
  }

  if (req.method === 'POST') {
    // Store user's public key (only public key, never private key)
    const { username, publicKey } = req.body;

    if (!username || !publicKey) {
      return res.status(400).json({ error: 'Username and public key are required' });
    }

    const userIndex = db.data.users.findIndex(u => u.username === username);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user with public key
    db.data.users[userIndex].publicKey = publicKey;
    await db.write();

    return res.status(200).json({ message: 'Public key stored successfully' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}