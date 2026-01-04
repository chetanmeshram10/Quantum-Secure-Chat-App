export default function FileUpload({ onFileSelect }) {
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Limit file size to 5MB
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      onFileSelect(file);
    }
  };

  return (
    <>
      <label htmlFor="file-upload" className="file-upload-btn">
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </label>
      <input
        id="file-upload"
        type="file"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept="image/*,.pdf,.doc,.docx,.txt"
      />

      <style jsx>{`
        .file-upload-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          color: #64748b;
        }

        .file-upload-btn:hover {
          background: #e2e8f0;
          color: #334155;
          transform: scale(1.1);
        }
      `}</style>
    </>
  );
}