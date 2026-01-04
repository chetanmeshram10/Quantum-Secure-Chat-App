import { useState } from 'react';

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
  '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
  '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜',
  '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐',
  '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
  '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👏',
  '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾',
  '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉',
  '⚡', '🔥', '💯', '✨', '🌟', '⭐', '💫', '🌈',
  '🚀', '🛸', '🌙', '☀️', '⛅', '🌤️', '⛈️', '🌩️'
];

export default function EmojiPicker({ onEmojiSelect, onClose }) {
  const [search, setSearch] = useState('');

  return (
    <>
      <div className="emoji-picker-overlay" onClick={onClose}></div>
      <div className="emoji-picker">
        <div className="emoji-header">
          <h4>Pick an emoji</h4>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>
        
        <input
          type="text"
          placeholder="Search emoji..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="emoji-search"
        />

        <div className="emoji-grid">
          {EMOJIS.map((emoji, idx) => (
            <button
              key={idx}
              className="emoji-btn"
              onClick={() => {
                onEmojiSelect(emoji);
                onClose();
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .emoji-picker-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.3);
          z-index: 999;
        }

        .emoji-picker {
          position: fixed;
          bottom: 80px;
          right: 20px;
          width: 320px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          z-index: 1000;
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .emoji-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 15px;
          border-bottom: 1px solid #e2e8f0;
        }

        .emoji-header h4 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
        }

        .close-btn {
          width: 28px;
          height: 28px;
          border: none;
          background: #f1f5f9;
          border-radius: 8px;
          cursor: pointer;
          font-size: 18px;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          background: #e2e8f0;
          color: #334155;
        }

        .emoji-search {
          width: 100%;
          padding: 12px 15px;
          border: none;
          border-bottom: 1px solid #e2e8f0;
          font-size: 14px;
        }

        .emoji-search:focus {
          outline: none;
          background: #f8fafc;
        }

        .emoji-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 4px;
          padding: 12px;
          max-height: 280px;
          overflow-y: auto;
        }

        .emoji-btn {
          width: 32px;
          height: 32px;
          border: none;
          background: transparent;
          font-size: 20px;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .emoji-btn:hover {
          background: #f1f5f9;
          transform: scale(1.2);
        }

        @media (max-width: 640px) {
          .emoji-picker {
            bottom: 70px;
            right: 10px;
            left: 10px;
            width: auto;
          }
        }
      `}</style>
    </>
  );
}