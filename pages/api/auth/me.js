import jwt from 'jsonwebtoken';
import { parse } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get token from cookies
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.token;

    console.log('Checking authentication...');
    console.log('Cookie received:', !!token);
    console.log('JWT_SECRET being used:', JWT_SECRET.substring(0, 20) + '...');

    if (!token) {
      console.log('No token found in cookies');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    console.log('Token verified successfully for user:', decoded.username);

    return res.status(200).json({
      username: decoded.username
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}