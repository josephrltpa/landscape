import { useState, useRef, useCallback } from 'react';
import FileUploader from './components/FileUploader';
import SignaturePad from './components/SignaturePad';
import DocumentEditor from './components/DocumentEditor';
import StepIndicator from './components/StepIndicator';

type Step = 'upload' | 'rotate' | 'sign' | 'place' | 'done';

export default function App() {
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [rotatedImage, setRotatedImage] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setOriginalImage(dataUrl);
      setCurrentStep('rotate');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRotationComplete = useCallback((rotatedDataUrl: string) => {
    setRotatedImage(rotatedDataUrl);
    setCurrentStep('sign');
  }, []);

  const handleSignatureComplete = useCallback((signatureDataUrl: string) => {
    setSignatureData(signatureDataUrl);
    setCurrentStep('place');
  }, []);

  const handlePlacementComplete = useCallback((finalDataUrl: string) => {
    setFinalImage(finalDataUrl);
    setCurrentStep('done');
  }, []);

  const handleReset = () => {
    setCurrentStep('upload');
    setOriginalImage(null);
    setRotatedImage(null);
    setSignatureData(null);
    setFinalImage(null);
  };

  const steps: { key: Step; label: string; icon: string }[] = [
    { key: 'upload', label: 'Upload', icon: '📄' },
    { key: 'rotate', label: 'Rotate', icon: '🔄' },
    { key: 'sign', label: 'Sign', icon: '✍️' },
    { key: 'place', label: 'Place', icon: '📍' },
    { key: 'done', label: 'Done', icon: '✅' },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/30">
              B
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">Bill Signer</h1>
              <p className="text-purple-300 text-xs">Rotate & Sign Documents</p>
            </div>
          </div>
          {currentStep !== 'upload' && (
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-all border border-white/10"
            >
              Start Over
            </button>
          )}
        </div>
      </header>

      {/* Step Indicator */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <StepIndicator steps={steps} currentIndex={currentStepIndex} />
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 pb-12">
        {currentStep === 'upload' && (
          <FileUploader onFileUpload={handleFileUpload} />
        )}

        {currentStep === 'rotate' && originalImage && (
          <DocumentEditor
            image={originalImage}
            mode="rotate"
            onComplete={handleRotationComplete}
          />
        )}

        {currentStep === 'sign' && (
          <SignaturePad onComplete={handleSignatureComplete} />
        )}

        {currentStep === 'place' && rotatedImage && signatureData && (
          <DocumentEditor
            image={rotatedImage}
            mode="place"
            signatureData={signatureData}
            onComplete={handlePlacementComplete}
          />
        )}

        {currentStep === 'done' && finalImage && (
          <div className="text-center space-y-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-white mb-2">All Done!</h2>
              <p className="text-purple-300 mb-6">Your document has been rotated and signed successfully.</p>
              <img
                src={finalImage}
                alt="Final signed document"
                className="max-w-full max-h-[500px] mx-auto rounded-xl shadow-2xl border border-white/10"
              />
              <div className="flex gap-4 justify-center mt-8">
                <a
                  href={finalImage}
                  download="signed-bill.png"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all"
                >
                  💾 Download Result
                </a>
                <button
                  onClick={handleReset}
                  className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold border border-white/10 transition-all"
                >
                  📄 Process Another
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
