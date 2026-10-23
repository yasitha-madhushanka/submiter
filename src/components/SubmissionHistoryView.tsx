import React from 'react';
import {
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  FileCheck,
  TrendingUp,
  DollarSign,
  ExternalLink
} from 'lucide-react';
import { StockAsset, AgencyKey } from '../types';
import { MICROSTOCK_AGENCIES } from '../constants/agencies';

interface SubmissionHistoryViewProps {
  assets: StockAsset[];
}

export const SubmissionHistoryView: React.FC<SubmissionHistoryViewProps> = ({ assets }) => {
  // Aggregate statistics
  let totalDispatches = 0;
  let approvedCount = 0;
  let inReviewCount = 0;
  let totalEstimatedValue = 0;

  const historyEntries: {
    asset: StockAsset;
    agencyKey: AgencyKey;
    submissionId: string;
    timestamp: string;
    reviewStatus: string;
  }[] = [];

  assets.forEach((asset) => {
    totalEstimatedValue += asset.metadata.pond5PriceUsd || (asset.mediaType === 'video' ? 79 : 19);

    (Object.keys(asset.agencySubmissions || {}) as AgencyKey[]).forEach((key) => {
      const sub = asset.agencySubmissions[key];
      if (sub && sub.status === 'submitted') {
        totalDispatches++;
        inReviewCount++;
        historyEntries.push({
          asset,
          agencyKey: key,
          submissionId: sub.submissionId || `${key.toUpperCase()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: sub.timestamp || asset.updatedAt,
          reviewStatus: sub.reviewStatus || 'under_review',
        });
      }
    });
  });

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="text-xs font-medium text-slate-400">Total Portfolio Assets</div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">{assets.length}</div>
          <div className="text-[11px] text-slate-400">
            {assets.filter((a) => a.mediaType === 'video').length} Videos ·{' '}
            {assets.filter((a) => a.mediaType === 'vector').length} Vectors ·{' '}
            {assets.filter((a) => a.mediaType === 'image').length} Photos
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="text-xs font-medium text-slate-400">Multi-Agency Dispatches</div>
          <div className="text-2xl font-bold font-mono text-indigo-400 tabular-nums">
            {totalDispatches}
          </div>
          <div className="text-[11px] text-slate-400">Transmitted via REST & SFTP</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="text-xs font-medium text-slate-400">In Curator Review</div>
          <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
            {inReviewCount}
          </div>
          <div className="text-[11px] text-slate-400">Avg turn: 2–5 business days</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="text-xs font-medium text-slate-400">Estimated Batch Asset Value</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            ${totalEstimatedValue.toFixed(0)} USD
          </div>
          <div className="text-[11px] text-slate-400">Across 10 microstock agencies</div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Transmission Audit Trail</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live record of media batches submitted to stock agencies
            </p>
          </div>
        </div>

        {historyEntries.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Clock className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-sm font-medium text-slate-300">No submissions recorded yet</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Select files in your Batch Queue and click "Submit to Stock Sites" to dispatch assets to Adobe, Shutterstock, BlackBox, and more.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Submission ID</th>
                  <th className="py-3 px-4">Asset Title</th>
                  <th className="py-3 px-4">Target Agency</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Review Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {historyEntries.map((entry, index) => {
                  const agency = MICROSTOCK_AGENCIES[entry.agencyKey];
                  return (
                    <tr key={index} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-indigo-400 font-medium">
                        {entry.submissionId}
                      </td>
                      <td className="py-3 px-4 text-slate-200 font-sans font-medium truncate max-w-xs">
                        {entry.asset.metadata.title}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-sans">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: agency.brandColor }}
                          />
                          <span>{agency.name}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 uppercase text-[10px]">
                        {entry.asset.mediaType}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-amber-400 text-xs">
                          <Clock className="w-3 h-3" />
                          <span>Under Review</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
