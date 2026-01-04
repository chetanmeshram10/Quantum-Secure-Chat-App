import { serialize } from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Clear cookie
  res.setHeader('Set-Cookie', serialize('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: -1,
    sameSite: 'strict',
    path: '/'
  }));

  res.status(200).json({ success: true, message: 'Logged out successfully' });
}