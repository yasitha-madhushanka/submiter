import React from 'react';
import {
  Film,
  Image as ImageIcon,
  CheckCircle2,
  Sparkles,
  Edit2,
  Send,
  Check,
  Square,
  CheckSquare
} from 'lucide-react';
import { StockAsset, AgencyKey } from '../types';
import { MICROSTOCK_AGENCIES } from '../constants/agencies';
import { formatBytes } from '../utils/mediaInspector';

interface BatchTableViewProps {
  assets: StockAsset[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onInspect: (asset: StockAsset) => void;
}

export const BatchTableView: React.FC<BatchTableViewProps> = ({
  assets,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onInspect,
}) => {
  const allSelected = assets.length > 0 && selectedIds.length === assets.length;

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
              <th className="py-3 px-4 w-10 text-center">
                <button
                  type="button"
                  onClick={allSelected ? onDeselectAll : onSelectAll}
                  className="p-1 hover:text-white"
                >
                  {allSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </button>
              </th>
              <th className="py-3 px-3 w-16">Preview</th>
              <th className="py-3 px-4 min-w-[220px]">Title & File</th>
              <th className="py-3 px-4 text-right">Resolution</th>
              <th className="py-3 px-4 text-right">Size</th>
              <th className="py-3 px-4">Categories</th>
              <th className="py-3 px-4 text-center">Keywords</th>
              <th className="py-3 px-4 text-center">Agencies</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/80 font-mono">
            {assets.map((asset) => {
              const isSelected = selectedIds.includes(asset.id);
              const isVideo = asset.mediaType === 'video';
              const kwCount = asset.metadata.keywords.length;

              return (
                <tr
                  key={asset.id}
                  onClick={() => onInspect(asset)}
                  className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${
                    isSelected ? 'bg-indigo-950/30' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td
                    className="py-2.5 px-4 text-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(asset.id);
                    }}
                  >
                    <div className="w-4 h-4 rounded border border-slate-700 bg-slate-950 flex items-center justify-center mx-auto cursor-pointer">
                      {isSelected && <Check className="w-3 h-3 text-indigo-400 stroke-[3]" />}
                    </div>
                  </td>

                  {/* Thumbnail */}
                  <td className="py-2.5 px-3">
                    <div className="w-12 h-8 rounded bg-slate-950 overflow-hidden relative border border-slate-800 shrink-0">
                      <img
                        src={asset.previewUrl}
                        alt={asset.filename}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      {isVideo ? (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Film className="w-3 h-3 text-indigo-400" />
                        </div>
                      ) : asset.mediaType === 'vector' ? (
                        <div className="absolute bottom-0 right-0 px-1 py-0.2 bg-amber-500 text-black text-[8px] font-extrabold uppercase rounded-tl">
                          {asset.filename.toLowerCase().endsWith('.ai') ? 'AI' : 'EPS'}
                        </div>
                      ) : null}
                    </div>
                  </td>

                  {/* Title & Filename */}
                  <td className="py-2.5 px-4">
                    <div className="font-sans font-semibold text-slate-200 text-xs truncate max-w-sm">
                      {asset.metadata.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-sm mt-0.5">
                      {asset.filename}
                    </div>
                  </td>

                  {/* Resolution & Specs (tabular-nums) */}
                  <td className="py-2.5 px-4 text-right tabular-nums text-slate-300">
                    <div>
                      {asset.dimensions.width}×{asset.dimensions.height}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {isVideo
                        ? `${asset.dimensions.duration || 10}s · ${asset.dimensions.fps || 30}fps`
                        : asset.mediaType === 'vector'
                        ? 'Vector · Scalable'
                        : `${asset.dimensions.megapixels.toFixed(1)} MP`}
                    </div>
                  </td>

                  {/* File Size */}
                  <td className="py-2.5 px-4 text-right tabular-nums text-slate-300">
                    {formatBytes(asset.fileSize)}
                  </td>

                  {/* Categories */}
                  <td className="py-2.5 px-4 text-slate-300 font-sans">
                    <div className="text-xs">{asset.metadata.adobeCategory}</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                      {asset.metadata.shutterstockPrimaryCategory}
                    </div>
                  </td>

                  {/* Keywords Count */}
                  <td className="py-2.5 px-4 text-center tabular-nums">
                    <span
                      className={`font-semibold ${
                        kwCount >= 25 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {kwCount}
                    </span>
                    <span className="text-[10px] text-slate-400"> / 50</span>
                  </td>

                  {/* Target Agencies Indicator */}
                  <td className="py-2.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {(Object.keys(MICROSTOCK_AGENCIES) as AgencyKey[]).map((k) => {
                        const isTarget = asset.targetAgencies.includes(k);
                        const sub = asset.agencySubmissions?.[k];
                        const isLive = sub?.status === 'submitted' && sub?.isRealUpload;
                        const isSandbox = sub?.status === 'submitted_sandbox' || (sub?.status === 'submitted' && !sub?.isRealUpload);

                        return (
                          <span
                            key={k}
                            className={`w-2 h-2 rounded-full ${
                              isLive
                                ? 'bg-emerald-400'
                                : isSandbox
                                ? 'bg-amber-400'
                                : isTarget
                                ? 'bg-indigo-400'
                                : 'bg-slate-800'
                            }`}
                            title={`${MICROSTOCK_AGENCIES[k].name}: ${
                              isLive ? 'Live Ingested' : isSandbox ? 'Sandbox Audited' : isTarget ? 'Targeted' : 'Disabled'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspect(asset);
                        }}
                        className="px-2.5 py-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors flex items-center gap-1 cursor-pointer border border-slate-700/60"
                        title="Edit Metadata"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span className="font-sans text-[11px]">Edit</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
