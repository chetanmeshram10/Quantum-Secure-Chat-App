import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'db.json');
const adapter = new JSONFile(dbPath);
const db = new Low(adapter, { users: [], messages: [] });

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await db.read();

  const { username, password } = req.body;

  console.log('Login attempt for username:', username);

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Find user (case-insensitive)
  const user = db.data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!user) {
    console.log('User not found:', username);
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  
  if (!isPasswordValid) {
    console.log('Invalid password for user:', username);
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Create JWT token
  const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '7d' });

  // Set HTTP-only cookie
  const cookie = serialize('token', token, {
    httpOnly: true,
    secure: false, // Set to false for localhost
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/'
  });

  res.setHeader('Set-Cookie', cookie);

  console.log('Login successful for user:', user.username);
  console.log('Cookie set:', cookie);

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    user: { username: user.username }
  });
}