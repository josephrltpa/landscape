import { useRef, useState, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface SignaturePadProps {
  onComplete: (signatureDataUrl: string) => void;
}

export default function SignaturePad({ onComplete }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [penColor, setPenColor] = useState('#1e1b4b');
  const [penWidth, setPenWidth] = useState(2.5);

  const handleBegin = useCallback(() => {
    setIsEmpty(false);
  }, []);

  const handleClear = useCallback(() => {
    sigRef.current?.clear();
    setIsEmpty(true);
  }, []);

  const handleUndo = useCallback(() => {
    if (sigRef.current) {
      const data = sigRef.current.toData();
      if (data.length > 0) {
        data.pop();
        sigRef.current.fromData(data);
      }
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      // Get signature with transparent background
      const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png');
      onComplete(dataUrl);
    }
  }, [onComplete]);

  const colors = [
    { name: 'Black', value: '#1e1b4b' },
    { name: 'Blue', value: '#1d4ed8' },
    { name: 'Red', value: '#dc2626' },
    { name: 'Green', value: '#16a34a' },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-white mb-3">✍️ Capture Your Signature</h2>
        <p className="text-purple-300">
          Draw your signature in the area below. Use your mouse or touch to sign.
        </p>
      </div>

      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        {/* Signature Canvas */}
        <div className="bg-white rounded-xl overflow-hidden shadow-inner mb-4 relative">
          {/* Guide lines */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-8 right-8 top-1/2 border-b border-dashed border-gray-200" />
            <div className="absolute left-8 right-8 bottom-12 text-center text-gray-300 text-sm">
              {isEmpty ? 'Sign here' : ''}
            </div>
          </div>
          <SignatureCanvas
            ref={sigRef}
            penColor={penColor}
            canvasProps={{
              className: 'w-full h-48 sm:h-64',
              style: { width: '100%', height: '100%' }
            }}
            minWidth={penWidth * 0.6}
            maxWidth={penWidth}
            onBegin={handleBegin}
          />
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Pen settings */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-sm">Color:</span>
              {colors.map(color => (
                <button
                  key={color.value}
                  onClick={() => setPenColor(color.value)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    penColor === color.value 
                      ? 'border-purple-400 scale-110 shadow-lg' 
                      : 'border-white/20 hover:border-white/40'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-sm">Size:</span>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={penWidth}
                onChange={(e) => setPenWidth(parseFloat(e.target.value))}
                className="w-20 accent-purple-500"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleUndo}
              disabled={isEmpty}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-all border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↩ Undo
            </button>
            <button
              onClick={handleClear}
              disabled={isEmpty}
              className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm transition-all border border-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              🗑 Clear
            </button>
            <button
              onClick={handleSubmit}
              disabled={isEmpty}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Use Signature →
            </button>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-6 bg-purple-500/10 rounded-xl border border-purple-500/20 p-4">
        <p className="text-purple-200 text-sm">
          💡 <strong>Tips:</strong> Sign slowly and clearly for best results. 
          The signature will be placed on your rotated document in the next step.
        </p>
      </div>
    </div>
  );
}
