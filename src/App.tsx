import { useState, useCallback, useRef } from 'react';
import { extractBillData, type BillData } from './utils/pdfExtractor';
import { generateLandscapePDF } from './utils/pdfGenerator';

interface FileJob {
  id: string;
  file: File;
  status: 'pending' | 'extracting' | 'generating' | 'done' | 'error';
  progress: number;
  billData?: BillData;
  pdfBlob?: Blob;
  error?: string;
}

export default function App() {
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const [customSignature, setCustomSignature] = useState<string | null>(null);
  const [customSigName, setCustomSigName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewJob, setPreviewJob] = useState<FileJob | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  const handleAddFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newJobs: FileJob[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type === 'application/pdf') {
        newJobs.push({
          id: `${file.name}-${Date.now()}-${i}`,
          file,
          status: 'pending',
          progress: 0,
        });
      }
    }
    setJobs(prev => [...prev, ...newJobs]);
    e.target.value = '';
  }, []);

  const handleClearFiles = useCallback(() => {
    setJobs([]);
  }, []);

  const handleRemoveJob = useCallback((id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

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

  const processAll = useCallback(async () => {
    if (jobs.length === 0) return;
    setIsProcessing(true);

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      if (job.status === 'done') continue;

      // Update status to extracting
      setJobs(prev => prev.map((j, idx) => 
        idx === i ? { ...j, status: 'extracting' as const, progress: 25 } : j
      ));

      try {
        // Extract data
        const billData = await extractBillData(job.file);
        
        setJobs(prev => prev.map((j, idx) => 
          idx === i ? { ...j, status: 'generating' as const, progress: 60, billData } : j
        ));

        // Generate PDF
        const pdfBytes = await generateLandscapePDF(billData, customSignature);
        const pdfBlob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });

        setJobs(prev => prev.map((j, idx) => 
          idx === i ? { ...j, status: 'done' as const, progress: 100, billData, pdfBlob } : j
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
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadAll = useCallback(() => {
    jobs.filter(j => j.status === 'done').forEach(job => {
      setTimeout(() => downloadFile(job), 100);
    });
  }, [jobs, downloadFile]);

  const previewData = useCallback((job: FileJob) => {
    setPreviewJob(job);
    setShowPreview(true);
  }, []);

  const doneCount = jobs.filter(j => j.status === 'done').length;
  const errorCount = jobs.filter(j => j.status === 'error').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/30">
              📑
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">PDF Bill Converter</h1>
              <p className="text-indigo-300 text-xs">Portrait → Landscape with Signature</p>
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

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Section 1: File Upload */}
        <section className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">1</span>
            Select PDF Bills to Convert
          </h2>
          
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-medium transition-all shadow-lg shadow-indigo-500/20"
            >
              📁 Add PDFs
            </button>
            {jobs.length > 0 && (
              <button
                onClick={handleClearFiles}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all border border-white/10"
              >
                🗑 Clear List
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleAddFiles}
              className="hidden"
            />
          </div>

          {/* File list */}
          {jobs.length > 0 && (
            <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden">
              <div className="max-h-48 overflow-y-auto">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg">
                        {job.status === 'done' ? '✅' : 
                         job.status === 'error' ? '❌' : 
                         job.status === 'extracting' ? '🔍' :
                         job.status === 'generating' ? '⚙️' : '📄'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-white text-sm truncate">{job.file.name}</p>
                        {job.status === 'error' && (
                          <p className="text-red-400 text-xs truncate">{job.error}</p>
                        )}
                        {(job.status === 'extracting' || job.status === 'generating') && (
                          <p className="text-indigo-300 text-xs">
                            {job.status === 'extracting' ? 'Extracting data...' : 'Generating PDF...'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === 'done' && (
                        <>
                          <button
                            onClick={() => previewData(job)}
                            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-all"
                          >
                            👁 Preview
                          </button>
                          <button
                            onClick={() => downloadFile(job)}
                            className="px-3 py-1 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs transition-all"
                          >
                            💾 Download
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleRemoveJob(job.id)}
                        className="px-2 py-1 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-300 text-xs transition-all"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {jobs.length === 0 && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400/50 hover:bg-white/5 transition-all"
            >
              <div className="text-4xl mb-3">📄</div>
              <p className="text-white/60">Click or drag PDF files here</p>
              <p className="text-white/30 text-sm mt-1">Supports government bill PDFs</p>
            </div>
          )}
        </section>

        {/* Section 2: Signature Override */}
        <section className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">2</span>
            Override Signature Image <span className="text-white/40 font-normal text-sm">(Optional)</span>
          </h2>
          <p className="text-indigo-300 text-sm mb-4">
            Upload a manual screenshot to bypass automatic signature extraction.
            If not provided, the signature will be extracted from the source PDF.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => sigInputRef.current?.click()}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all border border-white/10"
            >
              🖼 Browse Screenshot
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
                  className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs transition-all"
                >
                  Remove
                </button>
              </div>
            ) : (
              <span className="text-white/40 text-sm">Using default extraction from PDF</span>
            )}
          </div>

          {customSignature && (
            <div className="mt-4 bg-black/20 rounded-xl p-4 inline-block">
              <img
                src={customSignature}
                alt="Custom signature"
                className="max-h-24 rounded border border-white/10"
              />
            </div>
          )}
        </section>

        {/* Section 3: Convert */}
        <section className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">3</span>
            Convert All PDFs
          </h2>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={processAll}
              disabled={jobs.length === 0 || isProcessing}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-lg transition-all hover:shadow-lg hover:shadow-green-500/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              {isProcessing ? '⏳ Processing...' : '🚀 Convert All PDFs'}
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

          {/* Progress bar */}
          {isProcessing && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-indigo-300 mb-1">
                <span>Processing...</span>
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
                ✅ Successfully converted {doneCount} file{doneCount > 1 ? 's' : ''}. 
                Click "Download" on each file or "Download All" to save them.
              </p>
            </div>
          )}
        </section>

        {/* How it works */}
        <section className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-bold text-white mb-4">ℹ️ How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="text-2xl mb-2">📥</div>
              <p className="text-white text-sm font-medium">Upload PDFs</p>
              <p className="text-white/40 text-xs mt-1">Add one or more portrait bill PDFs</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="text-2xl mb-2">🔍</div>
              <p className="text-white text-sm font-medium">Extract Data</p>
              <p className="text-white/40 text-xs mt-1">Headers, tables, metadata & signature</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="text-2xl mb-2">🔄</div>
              <p className="text-white text-sm font-medium">Rebuild Landscape</p>
              <p className="text-white/40 text-xs mt-1">Generate new A4 landscape PDF</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="text-2xl mb-2">✍️</div>
              <p className="text-white text-sm font-medium">Place Signature</p>
              <p className="text-white/40 text-xs mt-1">Auto-extracted or custom override</p>
            </div>
          </div>
        </section>
      </main>

      {/* Preview Modal */}
      {showPreview && previewJob?.billData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-2xl border border-white/10 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">
                📋 Extracted Data: {previewJob.file.name}
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Headers */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <h4 className="text-indigo-300 text-sm font-medium mb-2">Document Headers</h4>
                {[previewJob.billData.header_1, previewJob.billData.header_2, previewJob.billData.header_3, previewJob.billData.header_4]
                  .filter(h => h)
                  .map((h, i) => (
                    <p key={i} className="text-white text-sm">{h}</p>
                  ))}
              </div>

              {/* Metadata */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <h4 className="text-indigo-300 text-sm font-medium mb-2">Metadata</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {[
                    ['Department', previewJob.billData.dept],
                    ['Head of Account', previewJob.billData.head_of_account],
                    ['Grant No.', previewJob.billData.grant_no],
                    ['DDO', previewJob.billData.ddo],
                    ['Treasury', previewJob.billData.treasury],
                    ['Bill No', previewJob.billData.bill_no],
                    ['Bill Date', previewJob.billData.bill_date],
                    ['Remarks', previewJob.billData.remarks],
                  ].map(([label, value]) => (
                    value && (
                      <div key={label} className="flex gap-2">
                        <span className="text-white/50 shrink-0">{label}:</span>
                        <span className="text-white">{value}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>

              {/* Table */}
              {previewJob.billData.table_data.length > 0 && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/5 overflow-x-auto">
                  <h4 className="text-indigo-300 text-sm font-medium mb-2">Table Data ({previewJob.billData.table_data.length} rows)</h4>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        {previewJob.billData.table_data[0]?.map((_, i) => (
                          <th key={i} className="text-left text-white/50 px-2 py-1">Col {i + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewJob.billData.table_data.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-b border-white/5">
                          {row.map((cell, j) => (
                            <td key={j} className="text-white/80 px-2 py-1 max-w-[150px] truncate">{cell}</td>
                          ))}
                        </tr>
                      ))}
                      {previewJob.billData.table_data.length > 10 && (
                        <tr>
                          <td colSpan={6} className="text-white/30 px-2 py-1 text-center">
                            ... and {previewJob.billData.table_data.length - 10} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Signature */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <h4 className="text-indigo-300 text-sm font-medium mb-2">Extracted Signature</h4>
                {previewJob.billData.signatureImage ? (
                  <img
                    src={previewJob.billData.signatureImage}
                    alt="Extracted signature"
                    className="max-h-32 rounded border border-white/10 bg-white p-2"
                  />
                ) : (
                  <p className="text-white/40 text-sm">No signature extracted from source PDF</p>
                )}
              </div>

              {/* Notes */}
              {previewJob.billData.notes && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <h4 className="text-indigo-300 text-sm font-medium mb-2">Notes</h4>
                  <p className="text-white/80 text-sm whitespace-pre-wrap">{previewJob.billData.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
