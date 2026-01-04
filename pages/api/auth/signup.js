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

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Check if user already exists
  const existingUser = db.data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (existingUser) {
    return res.status(400).json({ error: 'Username already exists. Please choose another one.' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create new user
  const newUser = {
    username,
    password: hashedPassword,
    publicKey: null, // Will be set by client after key generation
    createdAt: new Date().toISOString()
  };

  db.data.users.push(newUser);
  await db.write();

  // Create JWT token
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });

  // Set HTTP-only cookie
  const cookie = serialize('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/'
  });

  res.setHeader('Set-Cookie', cookie);

  return res.status(201).json({
    message: 'Account created successfully',
    user: { username }
  });
}