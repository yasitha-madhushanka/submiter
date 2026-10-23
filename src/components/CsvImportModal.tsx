import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Info,
  Check,
  FileText,
  RotateCcw,
  Loader2,
  Sliders,
  Trash2,
  Plus
} from 'lucide-react';
import { StockAsset } from '../types';
import { categorizeCsvItemsApi, CategorizeCsvResult } from '../services/api';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingAssets: StockAsset[];
  onApplyImport: (importedAssets: StockAsset[], stats: { updatedCount: number; newCount: number }) => void;
}

export interface ParsedCsvRow {
  filename: string;
  title: string;
  description: string;
  keywords: string[];
  adobeCategory?: string;
  shutterstockPrimaryCategory?: string;
  shutterstockSecondaryCategory?: string;
  pond5Category?: string;
  editorialRequired?: boolean;
  matchedAssetId?: string;
}

export const ADOBE_CATEGORIES = [
  'Animals',
  'Buildings and Architecture',
  'Business',
  'Drinks',
  'The Environment',
  'States of Mind',
  'Food',
  'Graphic Resources',
  'Hobbies and Leisure',
  'Industry',
  'Landscape',
  'Lifestyle',
  'People',
  'Plants and Flowers',
  'Culture and Religion',
  'Science',
  'Social Issues',
  'Sports',
  'Technology',
  'Transport',
  'Travel',
];

const DEFAULT_SAMPLE_CSV = `Filename,Title,Description,Keywords
"20260704_075739.jpg","Spectacular green mountain valley in tropical highlands under clouds","Panoramic scenic landscape of dense tropical forest trees and hills under overcast sky","mountain, landscape, valley, nature, forest, tropical, green, scenic, clouds, sky, wilderness, hills, highland, environment, outdoor, travel, exploration, natural, trees, panoramic"
"20260606_153839.jpg","Lush tropical jungle landscape with winding river in morning mist","Aerial view of tropical rainforest valley with sunlight piercing morning mist","landscape, jungle, tropical, rainforest, river, nature, mist, aerial, green, wild, environment, morning, scenic, trees, outdoor, water, valley, conservation, foliage"`;

/**
 * Universal CSV & TSV parser with support for quotes, commas, semicolons, and tabs
 */
function parseDelimitedText(text: string): { headers: string[]; rawRows: string[][] } {
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!clean) return { headers: [], rawRows: [] };

  // Detect delimiter from first non-empty line
  const firstLine = clean.split('\n')[0];
  let delimiter = ',';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = '\t';
  } else if (semiCount > commaCount) {
    delimiter = ';';
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < clean.length) {
    const char = clean[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < clean.length && clean[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return { headers: [], rawRows: [] };

  const headers = rows[0].map((h) => h.trim());
  const rawRows = rows.slice(1);
  return { headers, rawRows };
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  existingAssets,
  onApplyImport,
}) => {
  const [inputTab, setInputTab] = useState<'paste' | 'upload'>('paste');
  const [csvText, setCsvText] = useState(DEFAULT_SAMPLE_CSV);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [rawRowsData, setRawRowsData] = useState<string[][]>([]);

  // Column mapping states
  const [colFilename, setColFilename] = useState<number>(0);
  const [colTitle, setColTitle] = useState<number>(1);
  const [colDescription, setColDescription] = useState<number>(2);
  const [colKeywords, setColKeywords] = useState<number>(3);
  const [showColumnMapper, setShowColumnMapper] = useState(false);

  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([]);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isSuccessApplied, setIsSuccessApplied] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect columns on headers change
  const autoDetectColumns = (headers: string[]) => {
    let fnIdx = 0;
    let titleIdx = -1;
    let descIdx = -1;
    let kwIdx = -1;

    headers.forEach((h, idx) => {
      const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (lower.includes('file') || lower.includes('name') || lower.includes('image') || lower.includes('asset')) {
        if (fnIdx === 0 && !lower.includes('title')) fnIdx = idx;
      }
      if (lower.includes('title') || lower.includes('headline')) {
        titleIdx = idx;
      }
      if (lower.includes('desc') || lower.includes('caption') || lower.includes('detail')) {
        descIdx = idx;
      }
      if (lower.includes('key') || lower.includes('tag')) {
        kwIdx = idx;
      }
    });

    if (titleIdx === -1) titleIdx = headers.length > 1 ? 1 : 0;
    if (descIdx === -1) descIdx = headers.length > 2 ? 2 : titleIdx;
    if (kwIdx === -1) kwIdx = headers.length > 3 ? 3 : headers.length - 1;

    setColFilename(fnIdx);
    setColTitle(titleIdx);
    setColDescription(descIdx);
    setColKeywords(kwIdx);
  };

  const handleProcessCsv = async (rawCsv: string, explicitMapping?: { fn: number; title: number; desc: number; kw: number }) => {
    setParseError(null);
    setIsSuccessApplied(false);

    try {
      const { headers, rawRows } = parseDelimitedText(rawCsv);
      if (headers.length === 0 || rawRows.length === 0) {
        setParseError('Could not find valid rows in the CSV. Please ensure you have columns for Filename, Title, Description, and Keywords.');
        return;
      }

      setParsedHeaders(headers);
      setRawRowsData(rawRows);

      let fn = explicitMapping?.fn ?? colFilename;
      let title = explicitMapping?.title ?? colTitle;
      let desc = explicitMapping?.desc ?? colDescription;
      let kw = explicitMapping?.kw ?? colKeywords;

      if (!explicitMapping) {
        autoDetectColumns(headers);
      }

      const rows: ParsedCsvRow[] = rawRows.map((r) => {
        const rawFilename = (r[fn] || '').replace(/['"]/g, '').trim();
        const rawTitle = (r[title] || rawFilename.replace(/\.[^/.]+$/, '')).replace(/['"]/g, '').trim();
        const rawDesc = (r[desc] || rawTitle).replace(/['"]/g, '').trim();
        const rawKw = (r[kw] || '').replace(/^["']|["']$/g, '').trim();

        // Split keywords by comma or semicolon
        const keywords = rawKw
          .split(/[,;]/)
          .map((k) => k.replace(/['"]/g, '').trim().toLowerCase())
          .filter((k) => k.length > 1);

        // Normalize matching with queue assets
        const cleanName = rawFilename.toLowerCase().replace(/\.[^/.]+$/, '').trim();
        const matched = existingAssets.find((a) => {
          const aClean = a.filename.toLowerCase().replace(/\.[^/.]+$/, '').trim();
          return a.filename.toLowerCase() === rawFilename.toLowerCase() || aClean === cleanName;
        });

        return {
          filename: rawFilename || 'stock_media.jpg',
          title: rawTitle || 'Commercial Stock Media Asset',
          description: rawDesc || rawTitle,
          keywords: keywords.length > 0 ? keywords : ['commercial', 'stock', 'high resolution'],
          adobeCategory: 'Landscape',
          shutterstockPrimaryCategory: 'Nature',
          shutterstockSecondaryCategory: 'Parks/Outdoor',
          pond5Category: 'Nature & Wildlife',
          matchedAssetId: matched?.id,
        };
      });

      setParsedRows(rows);

      // Trigger AI Category Deduction
      setIsCategorizing(true);
      try {
        const catRes = await categorizeCsvItemsApi(
          rows.map((r) => ({
            filename: r.filename,
            title: r.title,
            description: r.description,
            keywords: r.keywords,
          }))
        );

        if (catRes && catRes.results && catRes.results.length > 0) {
          const catMap = new Map<string, CategorizeCsvResult>();
          catRes.results.forEach((c) => {
            catMap.set(c.filename.toLowerCase(), c);
            const clean = c.filename.toLowerCase().replace(/\.[^/.]+$/, '');
            catMap.set(clean, c);
          });

          setParsedRows((prev) =>
            prev.map((row) => {
              const matchedCat = catMap.get(row.filename.toLowerCase()) || catMap.get(row.filename.toLowerCase().replace(/\.[^/.]+$/, ''));
              if (matchedCat) {
                return {
                  ...row,
                  adobeCategory: matchedCat.adobeCategory || row.adobeCategory,
                  shutterstockPrimaryCategory: matchedCat.shutterstockPrimaryCategory || row.shutterstockPrimaryCategory,
                  shutterstockSecondaryCategory: matchedCat.shutterstockSecondaryCategory || row.shutterstockSecondaryCategory,
                  pond5Category: matchedCat.pond5Category || row.pond5Category,
                  editorialRequired: matchedCat.editorialRequired ?? false,
                };
              }
              return row;
            })
          );
        }
      } catch (catErr: any) {
        console.warn('AI Category deduction note:', catErr);
      } finally {
        setIsCategorizing(false);
      }
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse CSV string');
    }
  };

  // Initial load
  useEffect(() => {
    if (isOpen && parsedRows.length === 0 && csvText) {
      handleProcessCsv(csvText);
    }
  }, [isOpen]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setCsvText(text);
        handleProcessCsv(text);
      }
    };
    reader.readAsText(file);
  };

  const handleApplyToQueue = () => {
    if (parsedRows.length === 0) return;

    let updatedCount = 0;
    let newCount = 0;

    const updatedAssetsList = [...existingAssets];

    parsedRows.forEach((row) => {
      // Find matching asset in queue
      const cleanRowName = row.filename.toLowerCase().replace(/\.[^/.]+$/, '').trim();
      const existingIndex = updatedAssetsList.findIndex((a) => {
        const aClean = a.filename.toLowerCase().replace(/\.[^/.]+$/, '').trim();
        return (
          a.id === row.matchedAssetId ||
          a.filename.toLowerCase() === row.filename.toLowerCase() ||
          aClean === cleanRowName
        );
      });

      if (existingIndex !== -1) {
        // Update existing asset with user's manual CSV metadata
        const current = updatedAssetsList[existingIndex];
        updatedAssetsList[existingIndex] = {
          ...current,
          metadata: {
            ...current.metadata,
            title: row.title,
            description: row.description,
            keywords: row.keywords,
            adobeCategory: row.adobeCategory || current.metadata.adobeCategory,
            shutterstockPrimaryCategory: row.shutterstockPrimaryCategory || current.metadata.shutterstockPrimaryCategory,
            shutterstockSecondaryCategory: row.shutterstockSecondaryCategory || current.metadata.shutterstockSecondaryCategory,
            pond5Category: row.pond5Category || current.metadata.pond5Category,
            editorialRequired: row.editorialRequired ?? current.metadata.editorialRequired,
          },
          status: 'ready',
          updatedAt: new Date().toISOString(),
        };
        updatedCount++;
      } else {
        // Create new queued entry with user's metadata
        const isVideo = row.filename.toLowerCase().endsWith('.mp4') || row.filename.toLowerCase().endsWith('.mov');
        const newAsset: StockAsset = {
          id: `asset-csv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          filename: row.filename,
          fileSize: 0,
          mediaType: isVideo ? 'video' : 'image',
          previewUrl: '',
          dimensions: {
            width: 3840,
            height: 2160,
            megapixels: 8.29,
            aspectRatio: '16:9',
          },
          metadata: {
            title: row.title,
            description: row.description,
            keywords: row.keywords,
            adobeCategory: row.adobeCategory || 'Landscape',
            shutterstockPrimaryCategory: row.shutterstockPrimaryCategory || 'Nature',
            shutterstockSecondaryCategory: row.shutterstockSecondaryCategory || 'Parks/Outdoor',
            pond5Category: row.pond5Category || (isVideo ? 'Aerial & Drone' : 'Nature & Wildlife'),
            editorialRequired: false,
            modelReleaseRequired: false,
            propertyReleaseRequired: false,
            isAiGenerated: false,
            modelReleases: [],
            propertyReleases: [],
            pond5PriceUsd: isVideo ? 79 : 19,
            blackboxShare: { creatorPercentage: 100, curatorPercentage: 0 },
            alamyEssentialKeywords: row.keywords.slice(0, 5),
            complianceNotes: ['Imported via manual CSV with AI auto-categorization'],
          },
          status: 'ready',
          targetAgencies: isVideo
            ? ['adobe', 'shutterstock', 'blackbox', 'pond5', 'storyblocks', 'alamy', 'depositphotos', 'dreamstime', '123rf']
            : ['adobe', 'shutterstock', 'storyblocks', 'getty', 'pond5', 'alamy', 'depositphotos', 'dreamstime', '123rf'],
          agencySubmissions: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        updatedAssetsList.unshift(newAsset);
        newCount++;
      }
    });

    setIsSuccessApplied(true);
    onApplyImport(updatedAssetsList, { updatedCount, newCount });
    setTimeout(() => {
      onClose();
    }, 700);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-5xl max-h-[94vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Manual Metadata CSV Import</h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-mono">
                  AI Auto-Categories
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Load your custom metadata spreadsheet (<code className="text-slate-300 font-mono">Filename, Title, Description, Keywords</code>). Categories are intelligently deduced by AI.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 space-y-5 overflow-y-auto">
          {/* Sinhala / English Guidance Banner */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-start gap-3">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-slate-300">
              <div className="font-semibold text-white">
                ඔබගේ Manual CSV structure එක මෙතනින් paste කරන්න හෝ .csv file එකක් upload කරන්න.
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Your custom titles, descriptions, and keywords are imported directly from your CSV. Stock categories (<strong className="text-slate-200">Adobe Category, Shutterstock Category</strong>) are determined by AI from your keywords and title.
              </p>
            </div>
          </div>

          {/* Input Format Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInputTab('paste')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  inputTab === 'paste'
                    ? 'bg-slate-800 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Paste CSV Text</span>
              </button>

              <button
                type="button"
                onClick={() => setInputTab('upload')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  inputTab === 'upload'
                    ? 'bg-slate-800 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload .CSV File</span>
              </button>

              <button
                type="button"
                onClick={() => setShowColumnMapper(!showColumnMapper)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  showColumnMapper
                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Column Mapping {parsedHeaders.length > 0 && `(${parsedHeaders.length} cols)`}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCsvText('');
                  setParsedRows([]);
                }}
                className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 px-2 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCsvText(DEFAULT_SAMPLE_CSV);
                  handleProcessCsv(DEFAULT_SAMPLE_CSV);
                }}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium underline flex items-center gap-1 px-2 cursor-pointer"
              >
                <span>Sample CSV</span>
              </button>
            </div>
          </div>

          {/* Column Mapper Selector (if user has custom columns or headers) */}
          {showColumnMapper && parsedHeaders.length > 0 && (
            <div className="p-4 bg-slate-950/80 border border-indigo-900/60 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">Custom Column Mapping</span>
                <span className="text-[11px] text-slate-400">Match your CSV columns to StockSync fields</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-mono block mb-1">Filename Column</label>
                  <select
                    value={colFilename}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      setColFilename(idx);
                      handleProcessCsv(csvText, { fn: idx, title: colTitle, desc: colDescription, kw: colKeywords });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none"
                  >
                    {parsedHeaders.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-mono block mb-1">Title Column</label>
                  <select
                    value={colTitle}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      setColTitle(idx);
                      handleProcessCsv(csvText, { fn: colFilename, title: idx, desc: colDescription, kw: colKeywords });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none"
                  >
                    {parsedHeaders.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-mono block mb-1">Description Column</label>
                  <select
                    value={colDescription}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      setColDescription(idx);
                      handleProcessCsv(csvText, { fn: colFilename, title: colTitle, desc: idx, kw: colKeywords });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none"
                  >
                    {parsedHeaders.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-mono block mb-1">Keywords Column</label>
                  <select
                    value={colKeywords}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      setColKeywords(idx);
                      handleProcessCsv(csvText, { fn: colFilename, title: colTitle, desc: colDescription, kw: idx });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none"
                  >
                    {parsedHeaders.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Paste Tab */}
          {inputTab === 'paste' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Enter or paste your CSV lines:</span>
                <span className="text-[11px] text-slate-500 font-mono">Comma, semicolon, or tab delimited</span>
              </div>

              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`Filename,Title,Description,Keywords\n"20260704_075739.jpg","Tropical mountain road in morning sunlight","Scenic travel landscape with hills","mountain, landscape, road, nature, hills, morning, trees, clouds"`}
                rows={5}
                className="w-full bg-slate-950 font-mono text-xs text-slate-200 p-3 rounded-lg border border-slate-800 focus:outline-none focus:border-indigo-500"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleProcessCsv(csvText)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Parse CSV & Auto-Assign Categories</span>
                </button>
              </div>
            </div>
          )}

          {/* Upload Tab */}
          {inputTab === 'upload' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/40 rounded-xl p-8 text-center cursor-pointer transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-xl bg-emerald-600/10 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-white">Click or drag your .CSV or .TSV file here</p>
              <p className="text-xs text-slate-400 mt-1">
                Reads your columns (<code className="text-slate-300 font-mono">Filename, Title, Description, Keywords</code>) and matches to your batch assets
              </p>
            </div>
          )}

          {parseError && (
            <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Parsed Results Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    Parsed CSV Data Preview ({parsedRows.length} {parsedRows.length === 1 ? 'Asset' : 'Assets'})
                  </span>

                  {isCategorizing ? (
                    <span className="text-[11px] text-indigo-400 font-medium flex items-center gap-1.5 font-mono animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>AI Deducing Categories...</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Categories Assigned</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleProcessCsv(csvText)}
                  disabled={isCategorizing}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Re-Categorize with AI</span>
                </button>
              </div>

              {/* Data Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Filename</th>
                        <th className="py-2.5 px-3">Batch Queue Match</th>
                        <th className="py-2.5 px-3">Title</th>
                        <th className="py-2.5 px-3">Keywords</th>
                        <th className="py-2.5 px-3">Adobe Category (AI)</th>
                        <th className="py-2.5 px-3">Shutterstock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                      {parsedRows.map((row, idx) => {
                        const isMatched = Boolean(row.matchedAssetId);

                        return (
                          <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">
                              {row.filename}
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {isMatched ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 w-max">
                                  <Check className="w-3 h-3" />
                                  <span>Matched File</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-950 text-blue-300 border border-blue-800 flex items-center gap-1 w-max">
                                  <Plus className="w-3 h-3" />
                                  <span>New Queue Item</span>
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 font-sans max-w-xs truncate text-slate-200" title={row.title}>
                              {row.title}
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-300">
                              <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px]">
                                {row.keywords.length} tags
                              </span>
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap font-sans">
                              <select
                                value={row.adobeCategory || 'Landscape'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setParsedRows((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, adobeCategory: val } : r))
                                  );
                                }}
                                className="bg-slate-900 text-indigo-300 border border-slate-700 rounded px-2 py-0.5 text-xs font-medium focus:outline-none"
                              >
                                {ADOBE_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap font-sans text-slate-300">
                              {row.shutterstockPrimaryCategory || 'Nature'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Informative Guidance */}
              <div className="p-3 bg-indigo-950/30 border border-indigo-900/50 rounded-lg flex items-start gap-2.5 text-xs text-indigo-300">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-[11px] leading-relaxed">
                  <span className="font-semibold text-white">How This Metadata Is Embedded:</span>
                  <p>
                    When you click <strong>"Apply Metadata to Queue"</strong>, your manual Titles, Descriptions, and Keywords will update your assets. During SFTP upload to Adobe Stock and other agencies, this exact metadata is embedded directly into the JPEG/MP4 binary via IPTC/XMP.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApplyToQueue}
            disabled={parsedRows.length === 0 || isCategorizing}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
          >
            {isSuccessApplied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Applied to Queue!</span>
              </>
            ) : (
              <>
                <span>Apply Metadata to Queue ({parsedRows.length})</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
