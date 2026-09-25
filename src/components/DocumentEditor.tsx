import { useRef, useState, useEffect, useCallback } from 'react';

interface DocumentEditorProps {
  image: string;
  mode: 'rotate' | 'place';
  signatureData?: string;
  onComplete: (resultDataUrl: string) => void;
}

export default function DocumentEditor({ image, mode, signatureData, onComplete }: DocumentEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
  const [sigElement, setSigElement] = useState<HTMLImageElement | null>(null);
  const [sigPos, setSigPos] = useState({ x: 50, y: 50 });
  const [sigSize, setSigSize] = useState({ width: 200, height: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Load the main image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImgElement(img);
      // Calculate canvas size based on image
      const maxW = 800;
      const maxH = 600;
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      setCanvasSize({
        width: img.width * ratio,
        height: img.height * ratio,
      });
    };
    img.src = image;
  }, [image]);

  // Load signature image if in place mode
  useEffect(() => {
    if (mode === 'place' && signatureData) {
      const sig = new Image();
      sig.onload = () => {
        setSigElement(sig);
        // Default signature size
        const ratio = Math.min(200 / sig.width, 80 / sig.height);
        setSigSize({
          width: sig.width * ratio,
          height: sig.height * ratio,
        });
        // Position in bottom-right area
        setSigPos({
          x: canvasSize.width - 220,
          y: canvasSize.height - 100,
        });
      };
      sig.src = signatureData;
    }
  }, [mode, signatureData, canvasSize]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgElement) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Apply rotation
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);

    // Draw image centered
    const drawW = canvasSize.width;
    const drawH = canvasSize.height;
    ctx.drawImage(imgElement, 0, 0, drawW, drawH);

    ctx.restore();

    // Draw signature if in place mode
    if (mode === 'place' && sigElement) {
      ctx.drawImage(sigElement, sigPos.x, sigPos.y, sigSize.width, sigSize.height);
      
      // Draw border around signature
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(sigPos.x, sigPos.y, sigSize.width, sigSize.height);
      ctx.setLineDash([]);
    }
  }, [imgElement, sigElement, rotation, sigPos, sigSize, canvasSize, mode]);

  // Handle rotation
  const handleRotateLeft = () => setRotation(prev => (prev - 90 + 360) % 360);
  const handleRotateRight = () => setRotation(prev => (prev + 90) % 360);

  // Handle signature dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (mode !== 'place') return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if click is within signature bounds
    if (
      x >= sigPos.x && x <= sigPos.x + sigSize.width &&
      y >= sigPos.y && y <= sigPos.y + sigSize.height
    ) {
      setIsDragging(true);
      setDragOffset({ x: x - sigPos.x, y: y - sigPos.y });
    }
  }, [mode, sigPos, sigSize]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;

    // Constrain to canvas bounds
    setSigPos({
      x: Math.max(0, Math.min(x, canvasSize.width - sigSize.width)),
      y: Math.max(0, Math.min(y, canvasSize.height - sigSize.height)),
    });
  }, [isDragging, dragOffset, canvasSize, sigSize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle signature resize
  const handleSigResize = useCallback((delta: number) => {
    setSigSize(prev => {
      const newWidth = Math.max(80, Math.min(prev.width + delta, canvasSize.width * 0.6));
      const ratio = newWidth / prev.width;
      return {
        width: newWidth,
        height: prev.height * ratio,
      };
    });
  }, [canvasSize]);

  // Handle confirm rotation
  const handleConfirmRotation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgElement) return;

    // Create a new canvas with the rotated image
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    if (rotation === 90 || rotation === 270) {
      tempCanvas.width = canvasSize.height;
      tempCanvas.height = canvasSize.width;
    } else {
      tempCanvas.width = canvasSize.width;
      tempCanvas.height = canvasSize.height;
    }

    tempCtx.save();
    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate((rotation * Math.PI) / 180);
    tempCtx.drawImage(imgElement, -canvasSize.width / 2, -canvasSize.height / 2, canvasSize.width, canvasSize.height);
    tempCtx.restore();

    const dataUrl = tempCanvas.toDataURL('image/png');
    onComplete(dataUrl);
  }, [imgElement, rotation, canvasSize, onComplete]);

  // Handle confirm placement
  const handleConfirmPlacement = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onComplete(dataUrl);
  }, [onComplete]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-white mb-3">
          {mode === 'rotate' ? '🔄 Rotate Your Document' : '📍 Place Your Signature'}
        </h2>
        <p className="text-purple-300">
          {mode === 'rotate' 
            ? 'Rotate the document from portrait to landscape orientation.'
            : 'Drag to position your signature. Use +/- to resize.'
          }
        </p>
      </div>

      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        {/* Canvas */}
        <div ref={containerRef} className="flex justify-center mb-6">
          <canvas
            ref={canvasRef}
            className="rounded-xl shadow-2xl border border-white/10 bg-white cursor-default"
            style={{ 
              maxWidth: '100%', 
              height: 'auto',
              cursor: mode === 'place' ? (isDragging ? 'grabbing' : 'default') : 'default'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          {mode === 'rotate' && (
            <>
              <button
                onClick={handleRotateLeft}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all border border-white/10 flex items-center gap-2"
              >
                ↺ Rotate Left
              </button>
              <div className="px-4 py-2 rounded-xl bg-purple-500/20 text-purple-200 font-mono text-sm border border-purple-500/20">
                {rotation}°
              </div>
              <button
                onClick={handleRotateRight}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all border border-white/10 flex items-center gap-2"
              >
                Rotate Right ↻
              </button>
              <button
                onClick={handleConfirmRotation}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold transition-all hover:shadow-lg hover:shadow-purple-500/30"
              >
                Confirm Rotation →
              </button>
            </>
          )}

          {mode === 'place' && (
            <>
              <button
                onClick={() => handleSigResize(-20)}
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all border border-white/10"
              >
                − Smaller
              </button>
              <button
                onClick={() => handleSigResize(20)}
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all border border-white/10"
              >
                + Larger
              </button>
              <button
                onClick={() => {
                  setSigPos({ x: canvasSize.width - 220, y: canvasSize.height - 100 });
                }}
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all border border-white/10"
              >
                ↘ Bottom Right
              </button>
              <button
                onClick={handleConfirmPlacement}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold transition-all hover:shadow-lg hover:shadow-purple-500/30"
              >
                Finalize ✓
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tips */}
      {mode === 'place' && (
        <div className="mt-4 bg-purple-500/10 rounded-xl border border-purple-500/20 p-4">
          <p className="text-purple-200 text-sm">
            💡 <strong>Tip:</strong> Click and drag the signature to reposition it. 
            Use the +/- buttons to resize. The dashed border shows the signature area.
          </p>
        </div>
      )}
    </div>
  );
}
