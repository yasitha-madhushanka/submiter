import React, { useState, useRef } from 'react';
import { Upload, X, Film, Image as ImageIcon, CheckCircle2, FileSpreadsheet, PenTool } from 'lucide-react';
import { StockAsset } from '../types';
import { inspectMediaFile, formatBytes } from '../utils/mediaInspector';
import { uploadMediaFile } from '../services/api';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAssets: (assets: StockAsset[]) => void;
  onOpenImportCsv?: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onAddAssets,
  onOpenImportCsv,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [processedFiles, setProcessedFiles] = useState<{ name: string; size: number; type: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);

    const newAssets: StockAsset[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        setUploadStatusText(`Inspecting & caching "${file.name}" on server...`);
        const inspected = await inspectMediaFile(file);

        // Upload file binary to server so SFTP streaming has the real file bytes
        let serverFileResult: any = null;
        try {
          serverFileResult = await uploadMediaFile(file);
        } catch (uploadErr) {
          console.warn('Server storage warning:', uploadErr);
        }

        const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const defaultTitle = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

        const defaultKeywords = inspected.mediaType === 'vector'
          ? Array.from(new Set([
              ...cleanName.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
              'vector',
              'illustration',
              'graphic',
              'design',
              'artwork',
              'clipart',
              'isolated',
              'element',
              'symbol',
              'icon',
              'modern',
              'creative',
            ])).slice(0, 15)
          : [];

        const isAiFile = file.name.toLowerCase().endsWith('.ai');
        const isZipFile = file.name.toLowerCase().endsWith('.zip');

        const asset: StockAsset = {
          id: assetId,
          filename: file.name,
          fileSize: file.size,
          mediaType: inspected.mediaType,
          previewUrl: serverFileResult?.previewDataUrl || inspected.previewUrl,
          serverFilePath: serverFileResult?.file?.path,
          fileUrl: serverFileResult?.file?.url,
          fileDataUrl: inspected.mediaType === 'image' && inspected.previewUrl.startsWith('data:') ? inspected.previewUrl : undefined,
          dimensions: inspected.dimensions,
          metadata: {
            title: defaultTitle,
            description: `Stock ${inspected.mediaType === 'vector' ? (isZipFile ? 'vector package illustration' : 'vector graphic illustration') : inspected.mediaType}: ${cleanName}`,
            keywords: defaultKeywords,
            adobeCategory: inspected.mediaType === 'vector' ? 'Graphic Resources' : 'Landscape',
            shutterstockPrimaryCategory: inspected.mediaType === 'vector' ? 'Vectors' : 'Nature',
            shutterstockSecondaryCategory: inspected.mediaType === 'vector' ? 'Backgrounds/Textures' : 'Parks/Outdoor',
            pond5Category: inspected.mediaType === 'vector' ? 'Illustrations & Vectors' : inspected.mediaType === 'video' ? 'Aerial & Drone' : 'Nature & Wildlife',
            editorialRequired: false,
            modelReleaseRequired: false,
            propertyReleaseRequired: false,
            isAiGenerated: false,
            modelReleases: [],
            propertyReleases: [],
            pond5PriceUsd: inspected.mediaType === 'video' ? 79 : inspected.mediaType === 'vector' ? 25 : 19,
            blackboxShare: {
              creatorPercentage: 100,
              curatorPercentage: 0,
            },
            alamyEssentialKeywords: inspected.mediaType === 'vector' ? ['vector', 'illustration', 'graphic'] : [],
            complianceNotes: [
              inspected.mediaType === 'vector'
                ? isZipFile
                  ? 'Vector ZIP Package detected (Enriches with IPTC companion JPEG + vector XMP + sidecar CSVs for Adobe Stock, Depositphotos, Freepik, Shutterstock)'
                  : isAiFile
                  ? 'Vector .AI format detected (Targeting Adobe Stock, Storyblocks, Getty, Depositphotos)'
                  : 'Vector .EPS format detected (Compatible with Adobe Stock, Shutterstock FTPS, Depositphotos)'
                : 'Pending metadata import via CSV',
            ],
          },
          status: 'draft',
          targetAgencies: inspected.mediaType === 'video' 
            ? ['adobe', 'shutterstock', 'blackbox', 'pond5', 'storyblocks', 'alamy', 'dreamstime', '123rf']
            : isZipFile
            ? ['adobe', 'depositphotos', 'shutterstock', 'storyblocks', 'getty', 'pond5', 'alamy', 'dreamstime', '123rf']
            : isAiFile
            ? ['adobe', 'storyblocks', 'getty', 'pond5', 'alamy', 'depositphotos', 'dreamstime', '123rf'] // Shutterstock strictly requires .EPS
            : ['adobe', 'shutterstock', 'storyblocks', 'getty', 'pond5', 'alamy', 'depositphotos', 'dreamstime', '123rf'],
          agencySubmissions: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        newAssets.push(asset);
        setProcessedFiles((prev) => [...prev, { name: file.name, size: file.size, type: inspected.mediaType }]);
      } catch (err) {
        console.error('Failed to parse file:', file.name, err);
      }
    }

    setIsProcessing(false);
    if (newAssets.length > 0) {
      onAddAssets(newAssets);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white">Upload Real Media Files</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Supports Vectors (.AI, .EPS), Photos (JPEG, PNG, TIFF), and 4K/HD Video (MP4, MOV, ProRes)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drop Zone */}
        <div className="p-6 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-950/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/tiff,video/mp4,video/quicktime,video/x-m4v,.ai,.eps,.zip,application/zip,application/x-zip-compressed,application/x-zip,application/postscript,application/illustrator,image/x-eps,application/pdf"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            {isProcessing ? (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-semibold text-slate-200 text-center font-mono">
                  {uploadStatusText || 'Ingesting & saving media binaries on server...'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enabling real SFTP streaming to Adobe Stock and target microstocks
                </p>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>

                <p className="text-sm font-medium text-slate-200 text-center">
                  Drag & drop vectors (.AI, .EPS, .ZIP), photos, or video footage here, or <span className="text-indigo-400 underline">browse files</span>
                </p>
                <p className="text-xs text-slate-500 mt-1 text-center font-mono">
                  Auto-enriches ZIP packages with IPTC companion JPEG previews, vector XMP, and sidecar CSVs
                </p>

                <div className="flex items-center justify-center flex-wrap gap-2.5 mt-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/25 text-purple-300 font-mono text-[11px]">
                    <PenTool className="w-3.5 h-3.5 text-purple-400" />
                    <span>Vector ZIP (.ZIP)</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-300 font-mono text-[11px]">
                    <PenTool className="w-3.5 h-3.5 text-amber-400" />
                    <span>Vectors (.AI, .EPS)</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-mono text-[11px]">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Photos (JPEG, PNG, TIFF)</span>
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 font-mono text-[11px]">
                    <Film className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Video (4K, HD, ProRes)</span>
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Workflow Guidance Card */}
          <div className="p-3.5 bg-emerald-950/30 border border-emerald-900/60 rounded-xl flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-emerald-200">Manual CSV Metadata Workflow</p>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                After uploading your media files, click <strong className="text-white">"Import Metadata CSV"</strong> in the toolbar. You can paste or upload your custom CSV file (<code className="text-emerald-300 font-mono">Filename, Title, Description, Keywords</code>). Categories will be intelligently assigned and matched directly to your files.
              </p>
            </div>
          </div>
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="px-6 py-3 bg-indigo-950/40 border-t border-indigo-900/50 flex items-center gap-2 text-xs text-indigo-300 font-mono">
            <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Validating file structure and writing to local server storage...</span>
          </div>
        )}
      </div>
    </div>
  );
};
