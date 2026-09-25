import { useCallback, useState } from 'react';

interface FileUploaderProps {
  onFileUpload: (file: File) => void;
}

export default function FileUploader({ onFileUpload }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      onFileUpload(file);
    }
  }, [onFileUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  }, [onFileUpload]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-3">Upload Your Bill</h2>
        <p className="text-purple-300">
          Upload a bill/receipt image. We'll rotate it to landscape and help you add your signature.
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer
          ${isDragging 
            ? 'border-purple-400 bg-purple-500/10 scale-[1.02]' 
            : 'border-white/20 bg-white/5 hover:border-purple-400/50 hover:bg-white/10'
          }
        `}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
        />
        
        <div className="space-y-4">
          <div className="text-6xl">
            {isDragging ? '📥' : '📄'}
          </div>
          <div>
            <p className="text-white text-lg font-medium">
              {isDragging ? 'Drop your file here!' : 'Drag & drop your bill here'}
            </p>
            <p className="text-purple-300 text-sm mt-2">
              or click to browse • Supports PNG, JPG, JPEG, WebP
            </p>
          </div>
        </div>

        {/* Decorative corners */}
        <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-purple-500/50 rounded-tl-lg" />
        <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-purple-500/50 rounded-tr-lg" />
        <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-purple-500/50 rounded-bl-lg" />
        <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-purple-500/50 rounded-br-lg" />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
          <div className="text-2xl mb-2">📄</div>
          <p className="text-white text-sm font-medium">Upload</p>
          <p className="text-purple-300 text-xs mt-1">Any bill or receipt image</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
          <div className="text-2xl mb-2">🔄</div>
          <p className="text-white text-sm font-medium">Rotate</p>
          <p className="text-purple-300 text-xs mt-1">Portrait to landscape</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
          <div className="text-2xl mb-2">✍️</div>
          <p className="text-white text-sm font-medium">Sign</p>
          <p className="text-purple-300 text-xs mt-1">Add your signature</p>
        </div>
      </div>
    </div>
  );
}
