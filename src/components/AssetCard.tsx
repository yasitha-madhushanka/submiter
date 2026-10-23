import {
  Film,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Send,
  MoreVertical,
  Check,
  Clock,
  PenTool
} from 'lucide-react';
import { StockAsset, AgencyKey } from '../types';
import { MICROSTOCK_AGENCIES } from '../constants/agencies';
import { formatBytes } from '../utils/mediaInspector';

interface AssetCardProps {
  asset: StockAsset;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onInspect: (asset: StockAsset) => void;
  onSubmitSingle: (asset: StockAsset) => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({
  asset,
  isSelected,
  onToggleSelect,
  onInspect,
  onSubmitSingle,
}) => {
  const isVideo = asset.mediaType === 'video';
  const kwCount = asset.metadata.keywords.length;

  return (
    <div
      onClick={() => onInspect(asset)}
      className={`group relative rounded-xl border bg-slate-900 overflow-hidden cursor-pointer transition-all duration-200 hover:border-indigo-500/70 hover:shadow-lg hover:shadow-indigo-500/5 ${
        isSelected
          ? 'border-indigo-500 ring-1 ring-indigo-500 bg-slate-900/90'
          : 'border-slate-800'
      }`}
    >
      {/* Thumbnail Container */}
      <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
        <img
          src={asset.previewUrl}
          alt={asset.filename}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Top Overlay: Checkbox & Type Badge */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none">
          {/* Checkbox */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(asset.id);
            }}
            className="pointer-events-auto w-6 h-6 rounded-md bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center cursor-pointer hover:bg-black/80 transition-colors"
          >
            {isSelected && <Check className="w-4 h-4 text-indigo-400 stroke-[3]" />}
          </div>

          {/* Media specs tag */}
          <span className="px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[11px] font-mono text-white flex items-center gap-1 border border-white/10">
            {asset.mediaType === 'vector' ? (
              <>
                <PenTool className="w-3 h-3 text-amber-400" />
                <span className="text-amber-300 font-semibold">{asset.filename.toLowerCase().endsWith('.ai') ? 'AI Vector' : 'EPS Vector'}</span>
              </>
            ) : isVideo ? (
              <>
                <Film className="w-3 h-3 text-indigo-400" />
                <span>{asset.dimensions.width >= 3840 ? '4K UHD' : 'HD'}</span>
                {asset.dimensions.duration && <span>· {asset.dimensions.duration}s</span>}
              </>
            ) : (
              <>
                <ImageIcon className="w-3 h-3 text-emerald-400" />
                <span>{asset.dimensions.megapixels.toFixed(1)} MP</span>
              </>
            )}
          </span>
        </div>

        {/* Bottom scrim with title */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-3 pt-6 pointer-events-none">
          <p className="text-xs font-semibold text-white truncate drop-shadow-sm">
            {asset.metadata.title || asset.filename}
          </p>
        </div>
      </div>

      {/* Card Content Area */}
      <div className="p-3.5 space-y-3">
        {/* Unboxed Metadata with Typographic Separator (Zero-Pill rule) */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono truncate">
          <span>{formatBytes(asset.fileSize)}</span>
          <span aria-hidden="true">·</span>
          <span>{asset.dimensions.aspectRatio}</span>
          <span aria-hidden="true">·</span>
          <span>{asset.metadata.adobeCategory}</span>
          {asset.metadata.editorialRequired && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400 font-medium">Editorial</span>
            </>
          )}
        </div>

        {/* Keyword Counter & Readiness */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 font-mono text-slate-400">
            <span
              className={`font-semibold ${
                kwCount >= 25 ? 'text-emerald-400' : kwCount >= 10 ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {kwCount}
            </span>
            <span className="text-[11px]">/ 50 keywords</span>
          </div>

          {/* Submission Status */}
          {asset.status === 'submitted' ? (
            <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 font-mono">
              <CheckCircle2 className="w-3 h-3" />
              <span>Live Ingested</span>
            </span>
          ) : Object.values(asset.agencySubmissions || {}).some((s) => s.status === 'submitted_sandbox') ? (
            <span className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1 font-mono" title="Validated in Sandbox. Real credentials needed to transmit to platforms.">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>Sandbox Audited</span>
            </span>
          ) : asset.status === 'analyzing' ? (
            <span className="text-[11px] text-indigo-400 font-medium flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 animate-spin" />
              <span>Analyzing</span>
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium font-mono">
              {kwCount >= 7 ? 'Ready' : 'Draft'}
            </span>
          )}
        </div>

        {/* Agency Target Dots */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            {(Object.keys(MICROSTOCK_AGENCIES) as AgencyKey[]).map((key) => {
              const agency = MICROSTOCK_AGENCIES[key];
              const isTarget = asset.targetAgencies.includes(key);
              const submission = asset.agencySubmissions?.[key];
              const isRealSubmitted = submission?.status === 'submitted' && submission?.isRealUpload;
              const isSandbox = submission?.status === 'submitted_sandbox' || (submission?.status === 'submitted' && !submission?.isRealUpload);

              return (
                <div
                  key={key}
                  title={`${agency.name}: ${
                    isRealSubmitted
                      ? 'Live SFTP Ingested'
                      : isSandbox
                      ? 'Sandbox Audited (Connect credentials to upload)'
                      : isTarget
                      ? 'Target Enabled'
                      : 'Disabled'
                  }`}
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold transition-transform ${
                    isRealSubmitted
                      ? 'bg-emerald-500 text-black ring-1 ring-emerald-300'
                      : isSandbox
                      ? 'bg-amber-500 text-black ring-1 ring-amber-300'
                      : isTarget
                      ? 'text-white'
                      : 'bg-slate-800 text-slate-600 opacity-40'
                  }`}
                  style={{
                    backgroundColor: isRealSubmitted || isSandbox ? undefined : isTarget ? agency.brandColor : undefined,
                  }}
                >
                  {agency.shortName.charAt(0)}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(asset);
            }}
            className="text-[11px] text-slate-400 hover:text-white font-medium flex items-center gap-1 hover:underline cursor-pointer"
          >
            <Edit2 className="w-3 h-3 text-slate-400" />
            <span>Edit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
