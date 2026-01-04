export default function handler(req, res) {
  res.status(200).json({ message: 'Socket server running' });
}