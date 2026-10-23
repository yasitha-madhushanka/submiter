import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, Copy, Check, Info } from 'lucide-react';
import { StockAsset } from '../types';
import {
  generateAdobeStockCsv,
  generateShutterstockCsv,
  generatePond5Csv,
  generateBlackBoxCsv,
  generateUniversalJsonSidecar,
  triggerDownload,
} from '../utils/csvExport';

interface CsvExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: StockAsset[];
}

export const CsvExportModal: React.FC<CsvExportModalProps> = ({
  isOpen,
  onClose,
  assets,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<
    'adobe' | 'shutterstock' | 'pond5' | 'blackbox' | 'json'
  >('adobe');
  const [copied, setCopied] = useState(false);

  const getCsvContent = () => {
    switch (selectedFormat) {
      case 'adobe':
        return generateAdobeStockCsv(assets);
      case 'shutterstock':
        return generateShutterstockCsv(assets);
      case 'pond5':
        return generatePond5Csv(assets);
      case 'blackbox':
        return generateBlackBoxCsv(assets);
      case 'json':
        return generateUniversalJsonSidecar(assets);
    }
  };

  const currentContent = getCsvContent();

  const handleDownload = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    if (selectedFormat === 'json') {
      triggerDownload(currentContent, `stocksync_sidecars_${timestamp}.json`, 'application/json');
    } else {
      triggerDownload(currentContent, `stocksync_${selectedFormat}_${timestamp}.csv`, 'text/csv;charset=utf-8;');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
              <span>Export Agency-Formatted CSV & Metadata Sidecars</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Generate native batch import CSVs formatted for stock contributor portals and FTP pipelines
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-5 overflow-y-auto">
          {/* Format Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { id: 'adobe', label: 'Adobe Stock CSV', count: assets.length },
              { id: 'shutterstock', label: 'Shutterstock CSV', count: assets.length },
              { id: 'pond5', label: 'Pond5 Batch CSV', count: assets.length },
              { id: 'blackbox', label: 'BlackBox Video CSV', count: assets.filter((a) => a.mediaType === 'video').length },
              { id: 'json', label: 'Universal IPTC JSON', count: assets.length },
            ].map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setSelectedFormat(fmt.id as any)}
                className={`p-3 rounded-lg border text-left text-xs transition-colors ${
                  selectedFormat === fmt.id
                    ? 'bg-indigo-950/60 border-indigo-600 text-white font-semibold'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <div>{fmt.label}</div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  {fmt.count} eligible assets
                </div>
              </button>
            ))}
          </div>

          {/* Info Banner */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              {selectedFormat === 'adobe' && 'Compatible with Adobe Stock Contributor Portal > CSV Upload.'}
              {selectedFormat === 'shutterstock' && 'Conforms to Shutterstock Catalog Manager Bulk CSV template.'}
              {selectedFormat === 'pond5' && 'Includes Pond5 custom price column and categories mapping.'}
              {selectedFormat === 'blackbox' && 'Includes BlackBox creator/curator revenue splits for 4K video.'}
              {selectedFormat === 'json' && 'Complete IPTC/XMP sidecar JSON compatible with ExifTool and DAM systems.'}
            </span>
          </div>

          {/* Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">File Preview</span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-slate-400 hover:text-white flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Content'}</span>
              </button>
            </div>
            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300 max-h-64 overflow-y-auto whitespace-pre overflow-x-auto">
              {currentContent}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            {assets.length} items formatted · Ready to download
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {selectedFormat.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
