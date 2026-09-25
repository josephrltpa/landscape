import { useState, useCallback, useRef } from 'react';
import { convertPdfToLandscape, type ConversionResult } from './utils/pdfConverter';

interface FileJob {
  id: string;
  file: File;
  status: 'pending' | 'converting' | 'done' | 'error';
  progress: number;
  result?: ConversionResult;
  pdfBlob?: Blob;
  error?: string;
}

export default function App() {
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const [customSignature, setCustomSignature] = useState<string | null>(null);
  const [customSigName, setCustomSigName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  // --- FILE HANDLING ---
  const addFiles = useCallback((files: FileList | File[]) => {
    const newJobs: FileJob[] = [];
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      if (file.type === 'application/pdf') {
        newJobs.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          status: 'pending',
          progress: 0,
        });
      }
    }
    
    if (newJobs.length > 0) {
      setJobs(prev => [...prev, ...newJobs]);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
    e.target.value = '';
  }, [addFiles]);

  // --- DRAG AND DROP ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      addFiles(files);
    }
  }, [addFiles]);

  const handleClearFiles = useCallback(() => {
    setJobs([]);
  }, []);

  const handleRemoveJob = useCallback((id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  // --- SIGNATURE HANDLING ---
  const handleSignatureUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCustomSignature(reader.result as string);
      setCustomSigName(file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handleClearSignature = useCallback(() => {
    setCustomSignature(null);
    setCustomSigName('');
  }, []);

  // --- CONVERSION ---
  const processAll = useCallback(async () => {
    if (jobs.length === 0) return;
    setIsProcessing(true);

    const pendingJobs = jobs.filter(j => j.status === 'pending' || j.status === 'error');
    
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      if (job.status === 'done') continue;

      // Update status to converting
      setJobs(prev => prev.map((j, idx) => 
        idx === i ? { ...j, status: 'converting' as const, progress: 0 } : j
      ));

      try {
        const result = await convertPdfToLandscape(
          job.file,
          customSignature,
          (progress) => {
            setJobs(prev => prev.map((j, idx) => 
              idx === i ? { ...j, progress } : j
            ));
          }
        );

        const pdfBlob = new Blob([result.pdfBytes as unknown as BlobPart], { type: 'application/pdf' });

        setJobs(prev => prev.map((j, idx) => 
          idx === i ? { ...j, status: 'done' as const, progress: 100, result, pdfBlob } : j
        ));
      } catch (err: any) {
        console.error(`Error processing ${job.file.name}:`, err);
        setJobs(prev => prev.map((j, idx) => 
          idx === i ? { ...j, status: 'error' as const, error: err.message || 'Unknown error' } : j
        ));
      }
    }

    setIsProcessing(false);
  }, [jobs, customSignature]);

  const downloadFile = useCallback((job: FileJob) => {
    if (!job.pdfBlob) return;
    const url = URL.createObjectURL(job.pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Landscape_${job.file.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadAll = useCallback(() => {
    const doneJobs = jobs.filter(j => j.status === 'done');
    doneJobs.forEach((job, idx) => {
      setTimeout(() => downloadFile(job), idx * 200);
    });
  }, [jobs, downloadFile]);

  const doneCount = jobs.filter(j => j.status === 'done').length;
  const errorCount = jobs.filter(j => j.status === 'error').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-white/5">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/30">
              📑
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">PDF Bill Converter</h1>
              <p className="text-indigo-300 text-xs">Portrait → Landscape (100% formatting preserved)</p>
            </div>
          </div>
          {jobs.length > 0 && (
            <div className="text-sm text-indigo-300">
              {doneCount}/{jobs.length} converted
              {errorCount > 0 && <span className="text-red-400 ml-2">({errorCount} errors)</span>}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Section 1: File Upload with Drag & Drop */}
        <section className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">1</span>
            Select PDF Bills to Convert
          </h2>
          
          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
              ${isDragging 
                ? 'border-indigo-400 bg-indigo-500/20 scale-[1.01]' 
                : 'border-white/20 bg-white/5 hover:border-indigo-400/50 hover:bg-white/10'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="text-5xl mb-3">
              {isDragging ? '📥' : '📄'}
            </div>
            <p className="text-white text-lg font-medium">
              {isDragging ? 'Drop PDF files here!' : 'Drag & drop PDF files here'}
            </p>
            <p className="text-white/50 text-sm mt-2">
              or click to browse • Supports multiple files
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-medium transition-all shadow-lg shadow-indigo-500/20"
            >
              📁 Browse Files
            </button>
            {jobs.length > 0 && (
              <button
                onClick={handleClearFiles}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all border border-white/10"
              >
                🗑 Clear All
              </button>
            )}
          </div>

          {/* File list */}
          {jobs.length > 0 && (
            <div className="mt-4 bg-black/20 rounded-xl border border-white/5 overflow-hidden">
              <div className="max-h-56 overflow-y-auto">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-lg shrink-0">
                        {job.status === 'done' ? '✅' : 
                         job.status === 'error' ? '❌' : 
                         job.status === 'converting' ? '⚙️' : '📄'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm truncate">{job.file.name}</p>
                        {job.status === 'error' && (
                          <p className="text-red-400 text-xs truncate">{job.error}</p>
                        )}
                        {job.status === 'converting' && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden max-w-[200px]">
                              <div 
                                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full transition-all duration-300"
                                style={{ width: `${job.progress}%` }}
                              />
                            </div>
                            <span className="text-indigo-300 text-xs">{Math.round(job.progress)}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {job.status === 'done' && (
                        <button
                          onClick={() => downloadFile(job)}
                          className="px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-medium transition-all"
                        >
                          💾 Download
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveJob(job.id)}
                        className="px-2 py-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-300 text-sm transition-all"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Section 2: Signature Override */}
        <section className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">2</span>
            Override Signature <span className="text-white/40 font-normal text-sm">(Optional)</span>
          </h2>
          <p className="text-indigo-300 text-sm mb-4">
            Upload a signature image (PNG/JPG) to replace the one extracted from the PDF.
            The original signature area will be cleared and your image placed there.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => sigInputRef.current?.click()}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all border border-white/10"
            >
              🖼 Browse Signature Image
            </button>
            <input
              ref={sigInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleSignatureUpload}
              className="hidden"
            />

            {customSignature ? (
              <div className="flex items-center gap-3">
                <span className="text-green-300 text-sm">✓ {customSigName}</span>
                <button
                  onClick={handleClearSignature}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs transition-all"
                >
                  Remove
                </button>
              </div>
            ) : (
              <span className="text-white/40 text-sm">Keeping original signatures from PDF</span>
            )}
          </div>

          {customSignature && (
            <div className="mt-4 bg-black/20 rounded-xl p-4 inline-block">
              <img
                src={customSignature}
                alt="Custom signature preview"
                className="max-h-24 rounded border border-white/10 bg-white p-2"
              />
            </div>
          )}
        </section>

        {/* Section 3: Convert */}
        <section className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">3</span>
            Convert to Landscape
          </h2>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={processAll}
              disabled={jobs.length === 0 || isProcessing}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-lg transition-all hover:shadow-lg hover:shadow-green-500/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              {isProcessing ? '⏳ Converting...' : '🚀 Convert All PDFs'}
            </button>

            {doneCount > 1 && (
              <button
                onClick={downloadAll}
                className="px-6 py-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 font-medium transition-all border border-indigo-500/20"
              >
                💾 Download All ({doneCount})
              </button>
            )}
          </div>

          {/* Overall progress */}
          {isProcessing && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-indigo-300 mb-1">
                <span>Converting files...</span>
                <span>{doneCount + errorCount}/{jobs.length}</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full transition-all duration-500"
                  style={{ width: `${((doneCount + errorCount) / jobs.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {doneCount > 0 && !isProcessing && (
            <div className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <p className="text-green-300 text-sm">
                ✅ Successfully converted {doneCount} file{doneCount > 1 ? 's' : ''}! 
                All formatting, tables, and alignments preserved.
                {doneCount > 1 ? ' Click "Download All" or download individually.' : ' Click "Download" to save.'}
              </p>
            </div>
          )}
        </section>

        {/* How it works */}
        <section className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-bold text-white mb-4">ℹ️ How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="text-2xl mb-2">📄</div>
              <p className="text-white text-sm font-medium">Upload Portrait PDFs</p>
              <p className="text-white/40 text-xs mt-1">Drag & drop or browse for bill PDFs</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="text-2xl mb-2">🔄</div>
              <p className="text-white text-sm font-medium">Rotate to Landscape</p>
              <p className="text-white/40 text-xs mt-1">Each page rendered & rotated 90°</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="text-2xl mb-2">✍️</div>
              <p className="text-white text-sm font-medium">Optional Signature Override</p>
              <p className="text-white/40 text-xs mt-1">Replace signature or keep original</p>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <p className="text-indigo-200 text-sm">
              💡 <strong>100% Fidelity:</strong> The converter renders each page as a high-resolution image 
              and rotates it into landscape. This preserves all tables, alignments, borders, fonts, and 
              formatting exactly as they appear in the original PDF.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
