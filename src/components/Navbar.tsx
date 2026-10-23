import React from 'react';
import { Upload, Send, ShieldCheck, Database, FileSpreadsheet, Sparkles } from 'lucide-react';
import { StockAsset, AgencyKey } from '../types';

interface NavbarProps {
  activeView: 'queue' | 'agencies' | 'submissions' | 'specs';
  setActiveView: (view: 'queue' | 'agencies' | 'submissions' | 'specs') => void;
  onOpenUpload: () => void;
  onOpenSubmitBatch: () => void;
  onOpenExportCsv: () => void;
  onOpenImportCsv: () => void;
  selectedAssetCount: number;
  totalAssetCount: number;
  readyAssetCount: number;
  connectedAgencyCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  setActiveView,
  onOpenUpload,
  onOpenSubmitBatch,
  onOpenExportCsv,
  onOpenImportCsv,
  selectedAssetCount,
  readyAssetCount,
  connectedAgencyCount,
}) => {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3.5 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setActiveView('queue');
          }}
          className="text-lg font-bold tracking-tight text-white hover:text-indigo-400 transition-colors flex items-center gap-2"
        >
          <span className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center text-xs font-black text-white shadow-sm">
            SS
          </span>
          <span>StockSync Pro</span>
        </a>
      </div>

      {/* Zone 2: 4-6 clean text navigation links */}
      <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
        <button
          onClick={() => setActiveView('queue')}
          className={`transition-colors pb-0.5 whitespace-nowrap ${
            activeView === 'queue'
              ? 'text-white border-b-2 border-indigo-500 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          Batch Queue
        </button>

        <button
          onClick={() => setActiveView('agencies')}
          className={`transition-colors pb-0.5 whitespace-nowrap flex items-center gap-1.5 ${
            activeView === 'agencies'
              ? 'text-white border-b-2 border-indigo-500 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          <span>Agencies & APIs</span>
          <span className="text-xs font-mono text-slate-400">({connectedAgencyCount}/10)</span>
        </button>

        <button
          onClick={() => setActiveView('submissions')}
          className={`transition-colors pb-0.5 whitespace-nowrap ${
            activeView === 'submissions'
              ? 'text-white border-b-2 border-indigo-500 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          Submission History
        </button>

        <button
          onClick={() => setActiveView('specs')}
          className={`transition-colors pb-0.5 whitespace-nowrap ${
            activeView === 'specs'
              ? 'text-white border-b-2 border-indigo-500 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          Agency Rules Matrix
        </button>
      </nav>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenImportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-sm"
          title="Import manual microstock CSV (Filename, Title, Description, Keywords)"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span>Import CSV</span>
        </button>

        <button
          onClick={onOpenExportCsv}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap"
          title="Export CSVs for Adobe Stock, Shutterstock, Pond5, BlackBox"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
          <span>Export CSV</span>
        </button>

        <button
          onClick={onOpenUpload}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
        >
          <Upload className="w-3.5 h-3.5 text-indigo-400" />
          <span>Upload Media</span>
        </button>

        <button
          onClick={onOpenSubmitBatch}
          disabled={readyAssetCount === 0}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shadow-sm ${
            readyAssetCount > 0
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer hover:shadow-indigo-500/25'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>
            {selectedAssetCount > 0
              ? `Submit Selected (${selectedAssetCount})`
              : `Submit All Ready (${readyAssetCount})`}
          </span>
        </button>
      </div>
    </header>
  );
};
