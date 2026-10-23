import React, { useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Trash2,
  Plus,
  DollarSign,
  Tag,
  Film,
  Image as ImageIcon,
  Check,
  RefreshCw,
  ExternalLink,
  Shield,
  FileText,
  PenTool
} from 'lucide-react';
import { StockAsset, AgencyKey } from '../types';
import { MICROSTOCK_AGENCIES, ADOBE_CATEGORIES, SHUTTERSTOCK_CATEGORIES, POND5_CATEGORIES } from '../constants/agencies';
import { categorizeCsvItemsApi } from '../services/api';
import { formatBytes } from '../utils/mediaInspector';

interface AssetInspectorModalProps {
  asset: StockAsset | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedAsset: StockAsset) => void;
}

export const AssetInspectorModal: React.FC<AssetInspectorModalProps> = ({
  asset,
  isOpen,
  onClose,
  onSave,
}) => {
  const [currentAsset, setCurrentAsset] = useState<StockAsset>(() => asset || ({} as StockAsset));
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [copiedKeywords, setCopiedKeywords] = useState(false);
  const [activeTab, setActiveTab] = useState<'metadata' | 'compliance' | 'pricing'>('metadata');

  // Agency compliance validator function
  const validateAgency = (agencyKey: AgencyKey) => {
    const config = MICROSTOCK_AGENCIES[agencyKey];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Media type check
    if (currentAsset.mediaType === 'video' && !config.supportsVideo) {
      errors.push(`Video is not supported on this platform.`);
    }
    if (currentAsset.mediaType === 'image' && !config.supportsPhoto) {
      errors.push(`BlackBox only accepts video footage (4K / HD).`);
    }
    if (currentAsset.mediaType === 'vector') {
      if (!config.supportsVector) {
        errors.push(`${config.name} exclusively accepts video footage.`);
      }
      if (agencyKey === 'shutterstock' && !currentAsset.filename.toLowerCase().endsWith('.eps')) {
        errors.push('Shutterstock Contributor FTPS strictly requires vector submissions in .EPS format (compatible with Illustrator 8/10). Direct .AI vector files are rejected by Shutterstock.');
      }
    }

    // Megapixels (scalable for vectors)
    if (currentAsset.mediaType !== 'vector' && currentAsset.dimensions.megapixels < config.minMegapixels) {
      errors.push(`Requires at least ${config.minMegapixels}MP (current: ${currentAsset.dimensions.megapixels}MP).`);
    }

    // Title length & word count
    const titleWords = currentAsset.metadata.title.trim().split(/\s+/).filter(Boolean).length;
    if (titleWords < 5) {
      errors.push(`Title must contain at least 5 words (current: ${titleWords}).`);
    }
    if (currentAsset.metadata.title.length > 200) {
      warnings.push(`Title exceeds 200 characters (${currentAsset.metadata.title.length} chars).`);
    }

    // Keywords count
    const kwCount = currentAsset.metadata.keywords.length;
    if (kwCount < config.minKeywords) {
      errors.push(`Requires minimum ${config.minKeywords} keywords (current: ${kwCount}).`);
    }
    if (kwCount > config.maxKeywords) {
      warnings.push(`Keywords exceed max limit of ${config.maxKeywords} (${kwCount} tags).`);
    }

    // Categories
    if (config.requiresCategory) {
      if (agencyKey === 'adobe' && !currentAsset.metadata.adobeCategory) {
        errors.push(`Adobe Stock category is required.`);
      }
      if (agencyKey === 'shutterstock' && (!currentAsset.metadata.shutterstockPrimaryCategory || !currentAsset.metadata.shutterstockSecondaryCategory)) {
        errors.push(`Shutterstock requires both Primary and Secondary categories.`);
      }
      if (agencyKey === 'pond5' && !currentAsset.metadata.pond5Category) {
        errors.push(`Pond5 category is required.`);
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
    };
  };

  const handleAutoCategorize = async () => {
    setIsGeneratingAi(true);
    try {
      const res = await categorizeCsvItemsApi([
        {
          filename: currentAsset.filename,
          title: currentAsset.metadata.title,
          description: currentAsset.metadata.description,
          keywords: currentAsset.metadata.keywords,
        },
      ]);

      if (res && res.results && res.results.length > 0) {
        const cat = res.results[0];
        setCurrentAsset((prev) => ({
          ...prev,
          metadata: {
            ...prev.metadata,
            adobeCategory: cat.adobeCategory || prev.metadata.adobeCategory,
            shutterstockPrimaryCategory: cat.shutterstockPrimaryCategory || prev.metadata.shutterstockPrimaryCategory,
            shutterstockSecondaryCategory: cat.shutterstockSecondaryCategory || prev.metadata.shutterstockSecondaryCategory,
            pond5Category: cat.pond5Category || prev.metadata.pond5Category,
            editorialRequired: cat.editorialRequired !== undefined ? cat.editorialRequired : prev.metadata.editorialRequired,
          },
        }));
      }
    } catch (err) {
      console.warn('Auto categorize failed:', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleAddKeyword = () => {
    if (!newKeywordInput.trim()) return;
    const splitTokens = newKeywordInput
      .split(/[,;\n]/)
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 1 && !currentAsset.metadata.keywords.includes(k));

    if (splitTokens.length > 0) {
      setCurrentAsset((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          keywords: [...prev.metadata.keywords, ...splitTokens],
        },
      }));
    }
    setNewKeywordInput('');
  };

  const handleRemoveKeyword = (index: number) => {
    setCurrentAsset((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        keywords: prev.metadata.keywords.filter((_, i) => i !== index),
      },
    }));
  };

  const handleDeduplicateKeywords = () => {
    const unique = Array.from(new Set(currentAsset.metadata.keywords.map((k) => k.trim().toLowerCase())));
    setCurrentAsset((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        keywords: unique,
      },
    }));
  };

  const handleCopyKeywords = () => {
    navigator.clipboard.writeText(currentAsset.metadata.keywords.join(', '));
    setCopiedKeywords(true);
    setTimeout(() => setCopiedKeywords(false), 2000);
  };

  const handleSaveAndClose = () => {
    onSave(currentAsset);
    onClose();
  };

  React.useEffect(() => {
    if (asset) {
      setCurrentAsset({ ...asset });
    }
  }, [asset]);

  if (!isOpen || !asset || !currentAsset?.id) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-6xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
              <span className="text-white font-medium text-sm truncate max-w-sm">{currentAsset.filename}</span>
              <span>·</span>
              <span>{formatBytes(currentAsset.fileSize)}</span>
              <span>·</span>
              <span className={`uppercase font-bold ${currentAsset.mediaType === 'vector' ? 'text-amber-400' : 'text-indigo-400'}`}>
                {currentAsset.mediaType}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAndClose}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors cursor-pointer"
            >
              Save Changes
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Left column media + right column metadata */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* Left Column: Media Preview & Technical Specs (5 cols) */}
          <div className="lg:col-span-5 p-5 space-y-5 bg-slate-950/40 overflow-y-auto">
            {/* Media Player / Viewer */}
            <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center group">
              {currentAsset.mediaType === 'video' ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={currentAsset.previewUrl}
                    alt={currentAsset.filename}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-lg">
                      <Film className="w-6 h-6 ml-0.5" />
                    </div>
                  </div>
                  {currentAsset.dimensions.duration && (
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 text-xs font-mono bg-black/80 text-white rounded">
                      {currentAsset.dimensions.duration}s
                    </div>
                  )}
                </div>
              ) : currentAsset.mediaType === 'vector' ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950 p-2">
                  <img
                    src={currentAsset.previewUrl}
                    alt={currentAsset.filename}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2.5 right-2.5 px-2 py-0.5 text-[11px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded flex items-center gap-1.5 shadow-sm">
                    <PenTool className="w-3.5 h-3.5 text-amber-400" />
                    <span>{currentAsset.filename.toLowerCase().endsWith('.ai') ? 'Adobe Illustrator (.ai)' : 'Vector (.eps)'}</span>
                  </div>
                </div>
              ) : (
                <img
                  src={currentAsset.previewUrl}
                  alt={currentAsset.filename}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {/* Technical Specifications Matrix */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3.5 space-y-2.5">
              <div className="text-xs font-semibold text-slate-300">Technical Specifications</div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/50">
                  <div className="text-slate-400 text-[10px]">Resolution / Artboard</div>
                  <div className="text-slate-200 mt-0.5">
                    {currentAsset.dimensions.width} × {currentAsset.dimensions.height}
                  </div>
                </div>

                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/50">
                  <div className="text-slate-400 text-[10px]">
                    {currentAsset.mediaType === 'vector' ? 'Vector Scalability' : 'Megapixels'}
                  </div>
                  <div className="text-emerald-400 mt-0.5 font-bold">
                    {currentAsset.mediaType === 'vector' ? 'Infinite Vector' : `${currentAsset.dimensions.megapixels.toFixed(2)} MP`}
                  </div>
                </div>

                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/50">
                  <div className="text-slate-400 text-[10px]">Aspect Ratio</div>
                  <div className="text-slate-200 mt-0.5">{currentAsset.dimensions.aspectRatio}</div>
                </div>

                <div className="bg-slate-950/60 p-2 rounded border border-slate-800/50">
                  <div className="text-slate-400 text-[10px]">Format / Codec</div>
                  <div className="text-slate-200 mt-0.5 truncate">
                    {currentAsset.dimensions.codec || (currentAsset.mediaType === 'vector' ? (currentAsset.filename.toLowerCase().endsWith('.ai') ? 'Adobe Illustrator (.ai)' : 'Encapsulated PostScript (.eps)') : currentAsset.mediaType === 'video' ? 'H.264/ProRes' : 'JPEG RGB')}
                  </div>
                </div>
              </div>
            </div>

            {/* Multi-Agency Compliance Matrix */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Cross-Agency Preflight Status</span>
                <span className="text-[11px] font-mono text-slate-400">8 Platforms</span>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {(Object.keys(MICROSTOCK_AGENCIES) as AgencyKey[]).map((key) => {
                  const check = validateAgency(key);
                  const config = MICROSTOCK_AGENCIES[key];
                  const isTarget = currentAsset.targetAgencies.includes(key);

                  return (
                    <div
                      key={key}
                      className={`p-2 rounded border text-xs transition-colors flex items-start justify-between gap-2 ${
                        isTarget
                          ? check.passed
                            ? 'bg-emerald-950/20 border-emerald-900/50 text-slate-200'
                            : 'bg-rose-950/20 border-rose-900/50 text-slate-200'
                          : 'bg-slate-950/30 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {check.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <div>
                          <div className="font-medium text-slate-200">{config.name}</div>
                          {!check.passed && check.errors.length > 0 && (
                            <div className="text-[11px] text-rose-400 mt-0.5">
                              {check.errors[0]}
                            </div>
                          )}
                          {check.passed && check.warnings.length > 0 && (
                            <div className="text-[11px] text-amber-400 mt-0.5">
                              {check.warnings[0]}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const updated = isTarget
                            ? currentAsset.targetAgencies.filter((k) => k !== key)
                            : [...currentAsset.targetAgencies, key];
                          setCurrentAsset((prev) => ({ ...prev, targetAgencies: updated }));
                        }}
                        className={`text-[11px] font-medium px-2 py-0.5 rounded transition-colors ${
                          isTarget
                            ? 'bg-slate-800 text-indigo-300 hover:bg-slate-700'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {isTarget ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Metadata Editor Studio (7 cols) */}
          <div className="lg:col-span-7 p-6 space-y-6 overflow-y-auto">
            {/* Manual Metadata Header & AI Auto-Categorize Action */}
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Manual Metadata & Taxonomies</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Metadata is sourced directly from your manual CSV. Use Auto-Categorize to deduce microstock categories.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAutoCategorize}
                disabled={isGeneratingAi}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Deduce Adobe Stock and Shutterstock categories from title and keywords"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                <span>{isGeneratingAi ? 'Classifying...' : 'Auto-Categorize with AI'}</span>
              </button>
            </div>

            {/* Title Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-200">
                  Asset Title <span className="text-rose-400">*</span>
                </label>
                <div className="text-[11px] font-mono text-slate-400">
                  {currentAsset.metadata.title.trim().split(/\s+/).filter(Boolean).length} words ·{' '}
                  {currentAsset.metadata.title.length}/200 chars
                </div>
              </div>
              <input
                type="text"
                value={currentAsset.metadata.title}
                onChange={(e) =>
                  setCurrentAsset((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, title: e.target.value },
                  }))
                }
                placeholder="High-converting commercial title (minimum 5 words)"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <p className="text-[11px] text-slate-400">
                Shutterstock requires at least 5 words. Avoid subjective terms like "beautiful" or "best".
              </p>
            </div>

            {/* Description Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-200">Commercial Description</label>
                <span className="text-[11px] font-mono text-slate-400">
                  {currentAsset.metadata.description.length} chars
                </span>
              </div>
              <textarea
                rows={2}
                value={currentAsset.metadata.description}
                onChange={(e) =>
                  setCurrentAsset((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, description: e.target.value },
                  }))
                }
                placeholder="Detailed scene description for search indexation and editorial review..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Agency Categories Mapping Grid */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-200">Agency Categories Taxonomy</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Adobe Stock Category */}
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-400 font-medium">Adobe Stock (21 Categories)</div>
                  <select
                    value={currentAsset.metadata.adobeCategory}
                    onChange={(e) =>
                      setCurrentAsset((prev) => ({
                        ...prev,
                        metadata: { ...prev.metadata, adobeCategory: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {ADOBE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pond5 Category */}
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-400 font-medium">Pond5 Category</div>
                  <select
                    value={currentAsset.metadata.pond5Category}
                    onChange={(e) =>
                      setCurrentAsset((prev) => ({
                        ...prev,
                        metadata: { ...prev.metadata, pond5Category: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {POND5_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Shutterstock Primary */}
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-400 font-medium">Shutterstock Primary Category</div>
                  <select
                    value={currentAsset.metadata.shutterstockPrimaryCategory}
                    onChange={(e) =>
                      setCurrentAsset((prev) => ({
                        ...prev,
                        metadata: { ...prev.metadata, shutterstockPrimaryCategory: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {SHUTTERSTOCK_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Shutterstock Secondary */}
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-400 font-medium">Shutterstock Secondary Category</div>
                  <select
                    value={currentAsset.metadata.shutterstockSecondaryCategory}
                    onChange={(e) =>
                      setCurrentAsset((prev) => ({
                        ...prev,
                        metadata: { ...prev.metadata, shutterstockSecondaryCategory: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {SHUTTERSTOCK_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Legal, Releases & Pricing Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg">
              {/* Editorial Toggle */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-300">Licensing Mode</span>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentAsset((prev) => ({
                        ...prev,
                        metadata: { ...prev.metadata, editorialRequired: false },
                      }))
                    }
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                      !currentAsset.metadata.editorialRequired
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    Commercial RF
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentAsset((prev) => ({
                        ...prev,
                        metadata: { ...prev.metadata, editorialRequired: true },
                      }))
                    }
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                      currentAsset.metadata.editorialRequired
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    Editorial Only
                  </button>
                </div>
              </div>

              {/* Releases */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-300">Releases Required</span>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentAsset.metadata.modelReleaseRequired}
                      onChange={(e) =>
                        setCurrentAsset((prev) => ({
                          ...prev,
                          metadata: { ...prev.metadata, modelReleaseRequired: e.target.checked },
                        }))
                      }
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>Model</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentAsset.metadata.propertyReleaseRequired}
                      onChange={(e) =>
                        setCurrentAsset((prev) => ({
                          ...prev,
                          metadata: { ...prev.metadata, propertyReleaseRequired: e.target.checked },
                        }))
                      }
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>Property</span>
                  </label>
                </div>
              </div>

              {/* Pond5 Price */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-300">Pond5 Price (USD)</span>
                <div className="relative mt-1">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="number"
                    value={currentAsset.metadata.pond5PriceUsd || 79}
                    onChange={(e) =>
                      setCurrentAsset((prev) => ({
                        ...prev,
                        metadata: { ...prev.metadata, pond5PriceUsd: Number(e.target.value) },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 pl-7 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Keywords Section with Ranking Order Management */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">Ranked Stock Keywords</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-400">
                      {currentAsset.metadata.keywords.length} / 50 tags
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Adobe Stock & Alamy algorithmically rank the first 10 keywords with the highest weight.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDeduplicateKeywords}
                    className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                  >
                    Deduplicate
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyKeywords}
                    className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors flex items-center gap-1"
                  >
                    {copiedKeywords ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKeywords ? 'Copied!' : 'Copy All'}</span>
                  </button>
                </div>
              </div>

              {/* Add keyword input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newKeywordInput}
                  onChange={(e) => setNewKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                  placeholder="Add keywords (separate with commas or press enter)..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {/* Keywords Tag Cloud */}
              <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-3 bg-slate-950/80 border border-slate-800/80 rounded-lg">
                {currentAsset.metadata.keywords.map((kw, idx) => {
                  const isTopTen = idx < 10;
                  return (
                    <span
                      key={`${kw}-${idx}`}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors font-mono ${
                        isTopTen
                          ? 'bg-indigo-950/80 border border-indigo-700/60 text-indigo-200'
                          : 'bg-slate-900 border border-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                      <span>{kw}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(idx)}
                        className="text-slate-400 hover:text-rose-400 p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
