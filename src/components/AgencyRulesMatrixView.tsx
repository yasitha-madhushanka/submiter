import React from 'react';
import { ShieldCheck, BookOpen, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { MICROSTOCK_AGENCIES } from '../constants/agencies';
import { AgencyKey } from '../types';

export const AgencyRulesMatrixView: React.FC = () => {
  const agencyKeys = Object.keys(MICROSTOCK_AGENCIES) as AgencyKey[];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 rounded-xl space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">Cross-Platform Microstock Submission Rules Matrix</h2>
        </div>
        <p className="text-xs text-slate-300 max-w-3xl">
          Complete technical specifications and metadata acceptance criteria for all 10 supported microstock agencies (including Dreamstime & 123RF).
          StockSync Pro automatically formats and validates your batch against these rules prior to transmission.
        </p>
      </div>

      {/* Comparison Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 min-w-[160px]">Stock Agency</th>
                <th className="py-3 px-4">Min Resolution</th>
                <th className="py-3 px-4">Keywords Bounds</th>
                <th className="py-3 px-4">Key Taxonomy Spec</th>
                <th className="py-3 px-4">Video Codecs</th>
                <th className="py-3 px-4">Pricing Control</th>
                <th className="py-3 px-4">Typical Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {agencyKeys.map((key) => {
                const agency = MICROSTOCK_AGENCIES[key];
                return (
                  <tr key={key} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-sans font-bold text-slate-200 flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: agency.brandColor }}
                        />
                        <span>{agency.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                        {agency.key === 'blackbox' ? 'Video Syndication' : 'Direct Contributor'}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-300 tabular-nums">
                      {agency.minMegapixels} MP
                    </td>

                    <td className="py-3 px-4 text-slate-300 tabular-nums">
                      {agency.minKeywords} – {agency.maxKeywords} tags
                    </td>

                    <td className="py-3 px-4 text-slate-300 font-sans">
                      {key === 'adobe' && '21 Curated Categories (Top 10 keywords ranked)'}
                      {key === 'shutterstock' && '26 Primary & Secondary Categories required'}
                      {key === 'blackbox' && '40+ keywords minimum for 4K video syndication'}
                      {key === 'storyblocks' && 'Commercial video & photo library taxonomy'}
                      {key === 'getty' && 'Getty Controlled Vocabulary & editorial briefs'}
                      {key === 'pond5' && '17 Footage Categories + creator custom pricing'}
                      {key === 'alamy' && 'Essential & Super Keywords weighting hierarchy'}
                      {key === 'depositphotos' && 'Main categories + min 3.8MP JPEG/EPS'}
                      {key === 'dreamstime' && '3 Level Category Taxonomy + min 3.0MP JPEG/EPS/ZIP'}
                      {key === '123rf' && 'Standard metadata extraction + min 4.0MP JPEG/EPS'}
                    </td>

                    <td className="py-3 px-4 text-slate-300">
                      {agency.supportsVideo ? 'ProRes 422 / H.264 MP4' : 'N/A (Stills only)'}
                    </td>

                    <td className="py-3 px-4">
                      {agency.pricingControl ? (
                        <span className="text-emerald-400 font-semibold font-sans">
                          Creator sets $ price
                        </span>
                      ) : (
                        <span className="text-slate-400 font-sans">Fixed Tier %</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-300 tabular-nums">
                      {key === 'adobe' ? '2–4 days' : key === 'shutterstock' ? '1–3 days' : key === 'dreamstime' ? '2–5 days' : key === '123rf' ? '3–6 days' : '3–7 days'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pro Tips & Common Rejection Traps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4" />
            <span>Trademark & Logo Scrubbing</span>
          </div>
          <p className="text-xs text-slate-400">
            Microstock inspection algorithms immediately reject commercial submissions with visible brand logos
            (Apple, Nike, car emblems) on laptops, clothing, or architecture. Mark as "Editorial" if unavoidable.
          </p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
            <Info className="w-4 h-4" />
            <span>Adobe & Alamy Keyword Order</span>
          </div>
          <p className="text-xs text-slate-400">
            Unlike Google search, Adobe Stock and Alamy give exponential search weight to your first 10 keywords.
            Always position your most specific, high-intent concepts in slots #1 to #10.
          </p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
            <ShieldCheck className="w-4 h-4" />
            <span>Model & Property Releases</span>
          </div>
          <p className="text-xs text-slate-400">
            Any identifiable person requires a signed model release with a witness. Modern recognizable private architecture
            or ticketed event venues require a property release.
          </p>
        </div>
      </div>
    </div>
  );
};
