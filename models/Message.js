import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  receiver: { type: String, required: false },
  group: { type: String, required: false },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  isGroup: { type: Boolean, default: false },
  file: {
    name: String,
    type: String,
    size: Number,
    data: String // Base64 encoded
  }
});

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);