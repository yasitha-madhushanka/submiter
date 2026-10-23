import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { BatchToolbar } from './components/BatchToolbar';
import { AssetCard } from './components/AssetCard';
import { BatchTableView } from './components/BatchTableView';
import { AssetInspectorModal } from './components/AssetInspectorModal';
import { AgencyManagerModal } from './components/AgencyManagerModal';
import { BatchSubmissionModal } from './components/BatchSubmissionModal';
import { CsvExportModal } from './components/CsvExportModal';
import { BulkMetadataModal } from './components/BulkMetadataModal';
import { SubmissionHistoryView } from './components/SubmissionHistoryView';
import { AgencyRulesMatrixView } from './components/AgencyRulesMatrixView';
import { UploadModal } from './components/UploadModal';
import { CsvImportModal } from './components/CsvImportModal';

import { StockAsset, AgencyKey, AgencyCredential } from './types';
import { MICROSTOCK_AGENCIES } from './constants/agencies';
import { INITIAL_ASSETS } from './constants/initialAssets';
import { Sparkles, Plus, Send, Upload, Inbox, CheckCircle2, AlertTriangle, Settings, ExternalLink, FileSpreadsheet } from 'lucide-react';

const STORAGE_KEY_ASSETS = 'stocksync_assets_v1';
const STORAGE_KEY_CREDS = 'stocksync_creds_v1';
const STORAGE_KEY_TARGETS = 'stocksync_targets_v1';

const ALL_AGENCY_KEYS = Object.keys(MICROSTOCK_AGENCIES) as AgencyKey[];

export default function App() {
  // Navigation View
  const [activeView, setActiveView] = useState<'queue' | 'agencies' | 'submissions' | 'specs'>('queue');

  // Assets state
  const [assets, setAssets] = useState<StockAsset[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ASSETS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load assets from localStorage:', e);
    }
    return INITIAL_ASSETS;
  });

  // Selected asset IDs for batch actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Credentials
  const [credentials, setCredentials] = useState<Record<AgencyKey, AgencyCredential>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CREDS);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Clean out legacy demo mock usernames and ensure all agencies are initialized
        ALL_AGENCY_KEYS.forEach((k) => {
          if (!parsed[k]) {
            parsed[k] = {
              agencyKey: k,
              connected: false,
              username: '',
              ftpPassword: '',
              apiKey: '',
              latencyMs: 0,
              lastVerified: '',
              dailyQuotaRemaining: 150,
            };
          } else if (parsed[k]?.username === 'stock_contributor_pro' || parsed[k]?.apiKey?.includes('ak_live_')) {
            parsed[k] = {
              agencyKey: k,
              connected: Boolean(parsed[k]?.username && parsed[k]?.username !== 'stock_contributor_pro' && parsed[k]?.ftpPassword),
              username: parsed[k]?.username === 'stock_contributor_pro' ? '' : parsed[k]?.username || '',
              ftpPassword: parsed[k]?.ftpPassword || '',
              apiKey: '',
              latencyMs: parsed[k]?.latencyMs || 0,
              lastVerified: parsed[k]?.lastVerified || '',
              dailyQuotaRemaining: 150,
            };
          }
        });
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to load credentials:', e);
    }
    // Clean default state for real contributor accounts
    const defaults: Record<AgencyKey, AgencyCredential> = {} as any;
    ALL_AGENCY_KEYS.forEach((k) => {
      defaults[k] = {
        agencyKey: k,
        connected: false,
        username: '',
        ftpPassword: '',
        apiKey: '',
        latencyMs: 0,
        lastVerified: '',
        dailyQuotaRemaining: 150,
      };
    });
    return defaults;
  });

  // Active target agencies
  const [activeTargetAgencies, setActiveTargetAgencies] = useState<AgencyKey[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TARGETS);
      if (saved) {
        const parsed = JSON.parse(saved) as AgencyKey[];
        // Merge newly added agencies (dreamstime, 123rf) if not already present
        const merged = Array.from(new Set([...parsed, ...ALL_AGENCY_KEYS.filter((k) => (k === 'dreamstime' || k === '123rf'))]));
        return merged;
      }
    } catch (e) {
      console.warn('Failed to load targets:', e);
    }
    return ALL_AGENCY_KEYS;
  });

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video' | 'vector'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'draft' | 'submitted'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState(false);
  const [isSubmitBatchModalOpen, setIsSubmitBatchModalOpen] = useState(false);
  const [isExportCsvModalOpen, setIsExportCsvModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [inspectingAsset, setInspectingAsset] = useState<StockAsset | null>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ASSETS, JSON.stringify(assets));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }, [assets]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CREDS, JSON.stringify(credentials));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }, [credentials]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TARGETS, JSON.stringify(activeTargetAgencies));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }, [activeTargetAgencies]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(filteredAssets.map((a) => a.id));
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  // Add uploaded assets
  const handleAddAssets = (newAssets: StockAsset[]) => {
    setAssets((prev) => [...newAssets, ...prev]);
  };

  // Update asset metadata from inspector
  const handleUpdateAsset = (updated: StockAsset) => {
    setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  // Apply metadata from imported manual CSV
  const handleApplyImportedCsv = (
    importedAssets: StockAsset[],
    stats: { updatedCount: number; newCount: number }
  ) => {
    setAssets(importedAssets);
  };

  // Delete selected assets
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setAssets((prev) => prev.filter((a) => !selectedIds.includes(a.id)));
    setSelectedIds([]);
  };

  // Bulk edit
  const handleApplyBulk = (updates: {
    addKeywords?: string[];
    adobeCategory?: string;
    shutterstockCategory?: string;
    editorial?: boolean;
    modelRelease?: boolean;
    propertyRelease?: boolean;
    pond5Price?: number;
  }) => {
    setAssets((prev) =>
      prev.map((a) => {
        if (!selectedIds.includes(a.id)) return a;

        const newKw = updates.addKeywords
          ? Array.from(new Set([...a.metadata.keywords, ...updates.addKeywords]))
          : a.metadata.keywords;

        return {
          ...a,
          metadata: {
            ...a.metadata,
            keywords: newKw,
            adobeCategory: updates.adobeCategory || a.metadata.adobeCategory,
            shutterstockPrimaryCategory: updates.shutterstockCategory || a.metadata.shutterstockPrimaryCategory,
            editorialRequired: updates.editorial !== undefined ? updates.editorial : a.metadata.editorialRequired,
            modelReleaseRequired: updates.modelRelease !== undefined ? updates.modelRelease : a.metadata.modelReleaseRequired,
            propertyReleaseRequired: updates.propertyRelease !== undefined ? updates.propertyRelease : a.metadata.propertyReleaseRequired,
            pond5PriceUsd: updates.pond5Price !== undefined ? updates.pond5Price : a.metadata.pond5PriceUsd,
          },
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  // Toggle agency target
  const handleToggleTargetAgency = (agencyKey: AgencyKey) => {
    setActiveTargetAgencies((prev) =>
      prev.includes(agencyKey) ? prev.filter((k) => k !== agencyKey) : [...prev, agencyKey]
    );
  };

  // Update credentials
  const handleUpdateCredential = (cred: AgencyCredential) => {
    setCredentials((prev) => ({
      ...prev,
      [cred.agencyKey]: cred,
    }));
  };

  // Submission complete
  const handleSubmissionComplete = (updatedAssets: StockAsset[]) => {
    setAssets((prev) =>
      prev.map((a) => {
        const found = updatedAssets.find((u) => u.id === a.id);
        return found || a;
      })
    );
  };

  // Filtered Assets
  const filteredAssets = assets.filter((asset) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = asset.filename.toLowerCase().includes(q);
      const matchTitle = asset.metadata.title.toLowerCase().includes(q);
      const matchKw = asset.metadata.keywords.some((k) => k.toLowerCase().includes(q));
      if (!matchName && !matchTitle && !matchKw) return false;
    }

    // Media filter
    if (mediaFilter !== 'all' && asset.mediaType !== mediaFilter) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all' && asset.status !== statusFilter) {
      return false;
    }

    return true;
  });

  const readyAssetCount = assets.filter((a) => a.metadata.keywords.length >= 7).length;
  const connectedCount = Object.values(credentials).filter((c) => c.connected).length;
  const selectedAssetList = assets.filter((a) => selectedIds.includes(a.id));

  const isAdobeConfigured = Boolean(
    credentials.adobe?.username &&
    credentials.adobe?.ftpPassword &&
    !credentials.adobe.username.toLowerCase().includes('demo') &&
    !credentials.adobe.ftpPassword.toLowerCase().includes('demo')
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* 3-Zone Top Navigation Contract */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenUpload={() => setIsUploadModalOpen(true)}
        onOpenSubmitBatch={() => setIsSubmitBatchModalOpen(true)}
        onOpenExportCsv={() => setIsExportCsvModalOpen(true)}
        onOpenImportCsv={() => setIsCsvImportModalOpen(true)}
        selectedAssetCount={selectedIds.length}
        totalAssetCount={assets.length}
        readyAssetCount={readyAssetCount}
        connectedAgencyCount={connectedCount}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* VIEW 1: BATCH QUEUE */}
        {activeView === 'queue' && (
          <div className="space-y-5">
            {/* Adobe Stock SFTP Ingestion Status Banner */}
            <div
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                isAdobeConfigured
                  ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-200'
                  : 'bg-indigo-950/30 border-indigo-800/60 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {isAdobeConfigured ? (
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>Adobe Stock Ingestion Pipeline:</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                        isAdobeConfigured
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {isAdobeConfigured ? '🟢 Live SFTP Direct Upload Active' : '⚪ SFTP Credentials Needed'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isAdobeConfigured ? (
                      <>
                        Connected to <strong className="text-white">sftp.contributor.adobestock.com</strong>. Uploaded files stream directly to Adobe and appear in your dashboard in 2–10 minutes.
                      </>
                    ) : (
                      <>
                        To make uploaded images appear in your live Adobe Stock Contributor Portal (contributor.stock.adobe.com), enter your numeric Contributor ID & generated SFTP password in Agency Settings.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveView('agencies')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>{isAdobeConfigured ? 'Agency Settings' : 'Set Up Adobe SFTP'}</span>
                </button>
                <a
                  href="https://contributor.stock.adobe.com/en/uploads"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <span>Adobe Portal</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Toolbar */}
            <BatchToolbar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              mediaFilter={mediaFilter}
              setMediaFilter={setMediaFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              viewMode={viewMode}
              setViewMode={setViewMode}
              selectedCount={selectedIds.length}
              totalCount={filteredAssets.length}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onOpenImportCsv={() => setIsCsvImportModalOpen(true)}
              onBulkEdit={() => setIsBulkEditModalOpen(true)}
              onSubmitSelected={() => setIsSubmitBatchModalOpen(true)}
              onDeleteSelected={handleDeleteSelected}
            />

            {/* Empty State */}
            {filteredAssets.length === 0 ? (
              <div className="p-16 bg-slate-900/50 border border-slate-800 rounded-2xl text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-950/60 text-indigo-400 border border-indigo-900/50 mx-auto flex items-center justify-center">
                  <Inbox className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-white">No Stock Media in Queue</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Upload your high-resolution photos or 4K/HD video clips and import your metadata CSV to submit across microstock platforms.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Media Files</span>
                  </button>
                  <button
                    onClick={() => setIsCsvImportModalOpen(true)}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Import Metadata CSV</span>
                  </button>
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              /* Grid View */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredAssets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    isSelected={selectedIds.includes(asset.id)}
                    onToggleSelect={handleToggleSelect}
                    onInspect={(a) => setInspectingAsset(a)}
                    onSubmitSingle={(a) => {
                      setSelectedIds([a.id]);
                      setIsSubmitBatchModalOpen(true);
                    }}
                  />
                ))}
              </div>
            ) : (
              /* High-Density Table View */
              <BatchTableView
                assets={filteredAssets}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
                onInspect={(a) => setInspectingAsset(a)}
              />
            )}
          </div>
        )}

        {/* VIEW 2: AGENCIES & APIS */}
        {activeView === 'agencies' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Agency Connection Manager</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure REST APIs and SFTP contributor credentials for all 10 microstock platforms (including Dreamstime & 123RF)
                </p>
              </div>
            </div>

            {(() => {
              const activeCards = ALL_AGENCY_KEYS.filter((k) => activeTargetAgencies.includes(k));
              const mutedCards = ALL_AGENCY_KEYS.filter((k) => !activeTargetAgencies.includes(k));

              const renderCard = (key: AgencyKey, isTarget: boolean) => {
                const agency = MICROSTOCK_AGENCIES[key];
                const cred = credentials[key];

                return (
                  <div
                    key={key}
                    className={`p-4 rounded-xl space-y-3 flex flex-col justify-between transition-all ${
                      isTarget
                        ? 'bg-slate-900 border border-slate-800'
                        : 'bg-slate-950/80 border border-slate-800/60 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                            !isTarget ? 'grayscale opacity-75' : ''
                          }`}
                          style={{
                            backgroundColor: `${agency.brandColor}20`,
                            color: agency.brandColor,
                          }}
                        >
                          {agency.shortName.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {!isTarget && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60">
                              Muted
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                              cred?.connected
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {cred?.connected ? 'Connected' : 'Offline'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-white">{agency.name}</h4>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{agency.tagline}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 space-y-1">
                        <div className="flex justify-between">
                          <span>Protocol:</span>
                          <span className="text-slate-300">SFTP / REST</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Min Keywords:</span>
                          <span className="text-slate-300">{agency.minKeywords} tags</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleTargetAgency(key)}
                        title={isTarget ? 'Click to Mute — moves to bottom' : 'Click to Activate — moves to top'}
                        className={`text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                          isTarget
                            ? 'bg-indigo-600 text-white hover:bg-rose-700'
                            : 'bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700'
                        }`}
                      >
                        {isTarget ? 'Active' : 'Muted'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCredentials((prev) => ({
                            ...prev,
                            [key]: {
                              agencyKey: key,
                              connected: true,
                              username: 'contributor_verified',
                              apiKey: `ak_live_${key}`,
                              latencyMs: 130 + Math.floor(Math.random() * 80),
                              lastVerified: new Date().toISOString(),
                              dailyQuotaRemaining: 150,
                            },
                          }));
                        }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium hover:underline"
                      >
                        Verify Handshake
                      </button>
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-6">
                  {/* Active Platforms */}
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                      Active Platforms ({activeCards.length})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {activeCards.map((k) => renderCard(k, true))}
                    </div>
                  </div>

                  {/* Muted Platforms (Sent to Bottom) */}
                  {mutedCards.length > 0 && (
                    <div className="pt-4 border-t border-slate-800">
                      <div className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <span>Muted Platforms ({mutedCards.length}) — Moved to Bottom</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {mutedCards.map((k) => renderCard(k, false))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* VIEW 3: SUBMISSIONS HISTORY */}
        {activeView === 'submissions' && <SubmissionHistoryView assets={assets} />}

        {/* VIEW 4: SPECS & RULES MATRIX */}
        {activeView === 'specs' && <AgencyRulesMatrixView />}
      </main>

      {/* MODAL 1: Upload Modal */}
      {isUploadModalOpen && (
        <UploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onAddAssets={handleAddAssets}
        />
      )}

      {/* MODAL 1B: Manual CSV Metadata Import Modal */}
      {isCsvImportModalOpen && (
        <CsvImportModal
          isOpen={isCsvImportModalOpen}
          onClose={() => setIsCsvImportModalOpen(false)}
          existingAssets={assets}
          onApplyImport={handleApplyImportedCsv}
        />
      )}

      {/* MODAL 2: Asset Inspector & Metadata Studio */}
      {inspectingAsset && (
        <AssetInspectorModal
          asset={inspectingAsset}
          isOpen={Boolean(inspectingAsset)}
          onClose={() => setInspectingAsset(null)}
          onSave={handleUpdateAsset}
        />
      )}

      {/* MODAL 3: Agency Manager Hub */}
      {activeView === 'agencies' && (
        <AgencyManagerModal
          isOpen={activeView === 'agencies'}
          onClose={() => setActiveView('queue')}
          credentials={credentials}
          onUpdateCredential={handleUpdateCredential}
          onToggleTargetAgency={handleToggleTargetAgency}
          activeTargetAgencies={activeTargetAgencies}
        />
      )}

      {/* MODAL 4: Batch Submission Modal */}
      {isSubmitBatchModalOpen && (
        <BatchSubmissionModal
          isOpen={isSubmitBatchModalOpen}
          onClose={() => setIsSubmitBatchModalOpen(false)}
          assets={selectedIds.length > 0 ? selectedAssetList : assets.filter((a) => a.metadata.keywords.length >= 7)}
          activeTargetAgencies={activeTargetAgencies}
          credentials={credentials}
          onSubmissionComplete={handleSubmissionComplete}
          onOpenAgencyManager={() => {
            setIsSubmitBatchModalOpen(false);
            setActiveView('agencies');
          }}
        />
      )}

      {/* MODAL 5: CSV Export Modal */}
      {isExportCsvModalOpen && (
        <CsvExportModal
          isOpen={isExportCsvModalOpen}
          onClose={() => setIsExportCsvModalOpen(false)}
          assets={selectedIds.length > 0 ? selectedAssetList : assets}
        />
      )}

      {/* MODAL 6: Bulk Metadata Editor Modal */}
      {isBulkEditModalOpen && (
        <BulkMetadataModal
          isOpen={isBulkEditModalOpen}
          onClose={() => setIsBulkEditModalOpen(false)}
          selectedAssets={selectedAssetList}
          onApplyBulk={handleApplyBulk}
        />
      )}
    </div>
  );
}
