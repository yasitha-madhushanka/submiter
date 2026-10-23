import React, { useState } from 'react';
import { X, Layers, Plus, Check } from 'lucide-react';
import { StockAsset } from '../types';
import { ADOBE_CATEGORIES, SHUTTERSTOCK_CATEGORIES } from '../constants/agencies';

interface BulkMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAssets: StockAsset[];
  onApplyBulk: (updates: {
    addKeywords?: string[];
    adobeCategory?: string;
    shutterstockCategory?: string;
    editorial?: boolean;
    modelRelease?: boolean;
    propertyRelease?: boolean;
    pond5Price?: number;
  }) => void;
}

export const BulkMetadataModal: React.FC<BulkMetadataModalProps> = ({
  isOpen,
  onClose,
  selectedAssets,
  onApplyBulk,
}) => {
  const [keywordsToAdd, setKeywordsToAdd] = useState('');
  const [adobeCategory, setAdobeCategory] = useState('');
  const [shutterstockCategory, setShutterstockCategory] = useState('');
  const [licensingMode, setLicensingMode] = useState<'keep' | 'commercial' | 'editorial'>('keep');
  const [modelRelease, setModelRelease] = useState<'keep' | 'yes' | 'no'>('keep');
  const [pond5Price, setPond5Price] = useState<string>('');

  const handleApply = () => {
    const kwTokens = keywordsToAdd
      .split(/[,;\n]/)
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    onApplyBulk({
      addKeywords: kwTokens.length > 0 ? kwTokens : undefined,
      adobeCategory: adobeCategory || undefined,
      shutterstockCategory: shutterstockCategory || undefined,
      editorial: licensingMode === 'keep' ? undefined : licensingMode === 'editorial',
      modelRelease: modelRelease === 'keep' ? undefined : modelRelease === 'yes',
      pond5Price: pond5Price ? Number(pond5Price) : undefined,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Bulk Metadata Editor</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Apply changes to all {selectedAssets.length} selected assets simultaneously
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
        <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Add Keywords in Bulk */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Append Keywords to All Selected Files
            </label>
            <textarea
              rows={2}
              value={keywordsToAdd}
              onChange={(e) => setKeywordsToAdd(e.target.value)}
              placeholder="e.g. 4k production, commercial background, modern lifestyle, cinematic (separate with commas)"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Categories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Set Adobe Stock Category</label>
              <select
                value={adobeCategory}
                onChange={(e) => setAdobeCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">(Leave unchanged)</option>
                {ADOBE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Set Shutterstock Category</label>
              <select
                value={shutterstockCategory}
                onChange={(e) => setShutterstockCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">(Leave unchanged)</option>
                {SHUTTERSTOCK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Licensing & Releases */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-950/50 border border-slate-800 rounded-lg">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Licensing Mode</label>
              <select
                value={licensingMode}
                onChange={(e) => setLicensingMode(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value="keep">(Leave unchanged)</option>
                <option value="commercial">Commercial Royalty-Free</option>
                <option value="editorial">Editorial Only</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Model Release</label>
              <select
                value={modelRelease}
                onChange={(e) => setModelRelease(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value="keep">(Leave unchanged)</option>
                <option value="yes">Model Release Required (Yes)</option>
                <option value="no">No Model Release Required</option>
              </select>
            </div>
          </div>

          {/* Pond5 Price */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Set Uniform Pond5 USD Price</label>
            <input
              type="number"
              value={pond5Price}
              onChange={(e) => setPond5Price(e.target.value)}
              placeholder="e.g. 79 (leave blank to keep individual pricing)"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            Modifying {selectedAssets.length} assets
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Apply to Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
