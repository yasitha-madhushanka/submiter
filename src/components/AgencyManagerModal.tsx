import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Key,
  Server,
  ExternalLink,
  ShieldCheck,
  Info,
  HelpCircle,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  VolumeX,
  Volume2
} from 'lucide-react';
import { AgencyKey, AgencyCredential } from '../types';
import { MICROSTOCK_AGENCIES } from '../constants/agencies';
import { verifyAgency, testAgencySftpApi } from '../services/api';

interface AgencyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: Record<AgencyKey, AgencyCredential>;
  onUpdateCredential: (cred: AgencyCredential) => void;
  onToggleTargetAgency: (agencyKey: AgencyKey) => void;
  activeTargetAgencies: AgencyKey[];
}

export const AgencyManagerModal: React.FC<AgencyManagerModalProps> = ({
  isOpen,
  onClose,
  credentials,
  onUpdateCredential,
  onToggleTargetAgency,
  activeTargetAgencies,
}) => {
  const [testingAgency, setTestingAgency] = useState<AgencyKey | null>(null);
  const [selectedAgencyKey, setSelectedAgencyKey] = useState<AgencyKey>('adobe');
  const [connectionFeedback, setConnectionFeedback] = useState<{
    agencyKey: AgencyKey;
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const [protocolMode, setProtocolMode] = useState<Record<AgencyKey, 'api' | 'sftp'>>({
    adobe: 'sftp',
    shutterstock: 'sftp',
    blackbox: 'sftp',
    storyblocks: 'sftp',
    getty: 'sftp',
    pond5: 'sftp',
    alamy: 'sftp',
    depositphotos: 'sftp',
    dreamstime: 'sftp',
    '123rf': 'sftp',
  });

  const selectedAgencyConfig = MICROSTOCK_AGENCIES[selectedAgencyKey];
  const selectedCred = credentials[selectedAgencyKey] || {
    agencyKey: selectedAgencyKey,
    connected: false,
    username: '',
    apiKey: '',
  };

  const handleTestConnection = async (agencyKey: AgencyKey, options?: { host?: string; port?: number; label?: string }) => {
    setTestingAgency(agencyKey);
    setConnectionFeedback(null);
    const cred = credentials[agencyKey];

    // If real username & password exist, test live SFTP / FTP server connection
    if (cred?.username && cred?.ftpPassword && !cred.username.toLowerCase().includes('demo')) {
      try {
        const res = await testAgencySftpApi(agencyKey, {
          username: cred.username,
          password: cred.ftpPassword,
          host: options?.host,
          port: options?.port,
        });

        if (res.success) {
          onUpdateCredential({
            ...cred,
            agencyKey,
            connected: true,
            latencyMs: res.latencyMs || 120,
            lastVerified: new Date().toISOString(),
          });
          setConnectionFeedback({
            agencyKey,
            type: 'success',
            message: res.message || `Successfully connected to ${MICROSTOCK_AGENCIES[agencyKey].name}! Live direct uploads are active.`,
          });
        } else {
          onUpdateCredential({
            ...cred,
            agencyKey,
            connected: false,
          });
          setConnectionFeedback({
            agencyKey,
            type: 'error',
            message: res.message || 'Connection failed. Please check your credentials.',
          });
        }
      } catch (err: any) {
        setConnectionFeedback({
          agencyKey,
          type: 'error',
          message: err.message || 'Failed to connect to agency server.',
        });
      } finally {
        setTestingAgency(null);
      }
      return;
    }

    if (!cred?.username || !cred?.ftpPassword) {
      setConnectionFeedback({
        agencyKey,
        type: 'error',
        message: `Please enter your ${MICROSTOCK_AGENCIES[agencyKey].name} contributor username/email and password to verify live connection.`,
      });
      setTestingAgency(null);
      return;
    }

    // Otherwise, simulate handshake or prompt for credentials
    try {
      const res = await verifyAgency(agencyKey, {
        username: cred?.username,
        apiKey: cred?.apiKey || 'DEMO_KEY_9831',
        ftpPassword: cred?.ftpPassword || 'DEMO_PASS',
        autoAuth: true,
        allowDemo: true,
      });

      if (res && res.status === 'connected') {
        const isReal = res.isRealConnection;
        onUpdateCredential({
          agencyKey,
          connected: true,
          username: cred?.username || 'Contributor_Demo',
          apiKey: cred?.apiKey || 'ak_live_stock_78129',
          ftpPassword: cred?.ftpPassword,
          ftpHost: res.ftpHost,
          latencyMs: res.latencyMs,
          lastVerified: new Date().toISOString(),
          dailyQuotaRemaining: res.details?.dailyQuotaRemaining || 150,
        });

        setConnectionFeedback({
          agencyKey,
          type: isReal ? 'success' : 'info',
          message: isReal
            ? `Live connection confirmed to ${MICROSTOCK_AGENCIES[agencyKey].name}!`
            : `Sandbox handshake verified for ${MICROSTOCK_AGENCIES[agencyKey].name}. To stream files to your live dashboard, enter your real Contributor credentials.`,
        });
      }
    } catch (err: any) {
      setConnectionFeedback({
        agencyKey,
        type: 'error',
        message: err.message || 'Verification error.',
      });
    } finally {
      setTestingAgency(null);
    }
  };

  const isRealCredActive = Boolean(
    selectedCred.username &&
    selectedCred.ftpPassword &&
    !selectedCred.username.toLowerCase().includes('demo') &&
    !selectedCred.ftpPassword.toLowerCase().includes('demo')
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <span>Agency Connection Hub & Real SFTP Ingestion</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure credentials to upload real image/video files directly into your contributor dashboards
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Split */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-800 overflow-y-auto">
          {/* Agency List (5 cols) */}
          <div className="md:col-span-5 p-4 space-y-3 overflow-y-auto bg-slate-950/40">
            {(() => {
              const allKeys = Object.keys(MICROSTOCK_AGENCIES) as AgencyKey[];
              const activeKeys = allKeys.filter((k) => activeTargetAgencies.includes(k));
              const mutedKeys = allKeys.filter((k) => !activeTargetAgencies.includes(k));

              const renderAgencyCard = (key: AgencyKey, isActive: boolean) => {
                const agency = MICROSTOCK_AGENCIES[key];
                const cred = credentials[key];
                const isSelected = selectedAgencyKey === key;
                const isConnected = cred?.connected;
                const hasRealCreds = Boolean(
                  cred?.username &&
                  cred?.ftpPassword &&
                  !cred.username.toLowerCase().includes('demo')
                );

                return (
                  <div
                    key={key}
                    onClick={() => {
                      setSelectedAgencyKey(key);
                      setConnectionFeedback(null);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? isActive
                          ? 'bg-slate-800/90 border-indigo-500 shadow-sm ring-1 ring-indigo-500/30'
                          : 'bg-slate-900 border-amber-500/70 shadow-sm ring-1 ring-amber-500/20'
                        : isActive
                        ? 'bg-slate-900/60 hover:bg-slate-800/50 border-slate-800/80'
                        : 'bg-slate-950/70 hover:bg-slate-900/70 border-slate-800/40 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm shrink-0 ${
                          !isActive ? 'grayscale opacity-75' : ''
                        }`}
                        style={{ backgroundColor: `${agency.brandColor}20`, color: agency.brandColor }}
                      >
                        {agency.shortName.substring(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5 truncate">
                          <span className={`truncate ${!isActive ? 'text-slate-400' : ''}`}>{agency.name}</span>
                          {!isActive && (
                            <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/60 px-1.5 py-0.2 rounded font-mono shrink-0 flex items-center gap-0.5">
                              <VolumeX className="w-2.5 h-2.5" />
                              <span>Muted</span>
                            </span>
                          )}
                          {isActive && hasRealCreds && (
                            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 rounded font-mono shrink-0">
                              Live SFTP
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {isConnected ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{hasRealCreds ? 'Live Connected' : 'Sandbox Connected'}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">Not configured</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleTargetAgency(key);
                        }}
                        title={isActive ? 'Click to Mute — moves platform down to the bottom' : 'Click to Activate — moves platform back to the top'}
                        className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 ${
                          isActive
                            ? 'bg-indigo-600/90 text-white hover:bg-rose-700 hover:text-white shadow-sm'
                            : 'bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700/80'
                        }`}
                      >
                        {isActive ? (
                          <>
                            <span className="group-hover:hidden">Active</span>
                          </>
                        ) : (
                          <>
                            <VolumeX className="w-3 h-3 text-amber-400" />
                            <span>Activate</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              };

              return (
                <>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-2 uppercase tracking-wider">
                    <span>Platforms ({allKeys.length})</span>
                    <span className="text-[11px] font-normal font-mono text-slate-400">
                      <span className="text-emerald-400 font-semibold">{activeKeys.length} Active</span>
                      {mutedKeys.length > 0 && <span> · <span className="text-amber-400/90 font-semibold">{mutedKeys.length} Muted</span></span>}
                    </span>
                  </div>

                  {/* Active Platforms (At the Top) */}
                  <div className="space-y-1.5">
                    {activeKeys.map((key) => renderAgencyCard(key, true))}
                  </div>

                  {/* Muted Platforms (Sent to Bottom) */}
                  {mutedKeys.length > 0 && (
                    <div className="pt-3 border-t border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5 text-amber-400/90">
                          <VolumeX className="w-3.5 h-3.5" />
                          <span>Muted Platforms ({mutedKeys.length})</span>
                        </span>
                        <span className="text-[10px] text-slate-500 lowercase font-mono">moved to bottom · excluded from upload</span>
                      </div>
                      <div className="space-y-1.5">
                        {mutedKeys.map((key) => renderAgencyCard(key, false))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Agency Config Details (7 cols) */}
          <div className="md:col-span-7 p-6 space-y-5 overflow-y-auto">
            {/* Agency Banner */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{selectedAgencyConfig.name}</h3>
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: selectedAgencyConfig.brandColor }}
                  />
                  {isRealCredActive ? (
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-semibold">
                      Live Upload Ready
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-semibold">
                      Sandbox Simulation Mode
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{selectedAgencyConfig.tagline}</p>
              </div>

              <button
                type="button"
                onClick={() => handleTestConnection(selectedAgencyKey)}
                disabled={testingAgency === selectedAgencyKey}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingAgency === selectedAgencyKey ? 'animate-spin' : ''}`} />
                <span>{testingAgency === selectedAgencyKey ? 'Testing Connection...' : 'Test SFTP Connection'}</span>
              </button>
            </div>

            {/* Target Status Active vs Muted Banner with Immediate Toggle */}
            {(() => {
              const isSelectedActive = activeTargetAgencies.includes(selectedAgencyKey);
              return isSelectedActive ? (
                <div className="p-3 bg-emerald-950/30 border border-emerald-800/60 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-emerald-300 block">Target Status: Active Platform</span>
                      <p className="text-[11px] text-emerald-400/80 truncate">
                        Included in multi-platform batch submissions. Files will stream to {selectedAgencyConfig.shortName}.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleTargetAgency(selectedAgencyKey)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700/80 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                    title="Mute this agency — will move it to the bottom of the Agency Connection list"
                  >
                    <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                    <span>Mute Platform (Send to Bottom)</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <VolumeX className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-amber-300 block">Target Status: Muted (Moved to Bottom)</span>
                      <p className="text-[11px] text-amber-400/80 truncate">
                        This agency is inactive and will be skipped during batch uploads.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleTargetAgency(selectedAgencyKey)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                    title="Activate this agency — will restore it to the top of the Agency Connection list"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span>Activate Platform (Move to Top)</span>
                  </button>
                </div>
              );
            })()}

            {/* Connection Feedback Banner */}
            {connectionFeedback && connectionFeedback.agencyKey === selectedAgencyKey && (
              <div
                className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 animate-in fade-in duration-200 ${
                  connectionFeedback.type === 'success'
                    ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
                    : connectionFeedback.type === 'error'
                    ? 'bg-rose-950/50 border-rose-800 text-rose-200'
                    : 'bg-indigo-950/50 border-indigo-800 text-indigo-200'
                }`}
              >
                {connectionFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : connectionFeedback.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{connectionFeedback.message}</p>
                  {connectionFeedback.type === 'success' && selectedAgencyKey === 'adobe' && (
                    <p className="text-[11px] text-emerald-300/80 mt-1">
                      Files submitted to Adobe Stock will be transferred directly to Adobe's SFTP storage and will appear in your Adobe Stock dashboard under "Uploaded Files" in 2 to 10 minutes.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Adobe Stock Specific Setup Guide & Explainer */}
            {selectedAgencyKey === 'adobe' && (
              <div className="p-4 bg-indigo-950/30 border border-indigo-900/60 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      How to get uploads into your Adobe Stock Dashboard
                    </h4>
                  </div>
                  <a
                    href="https://contributor.stock.adobe.com/en/uploads"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 underline font-medium"
                  >
                    <span>Open Adobe Contributor Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300">
                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                    <span className="font-bold text-indigo-300">1. Contributor ID</span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Log in to <span className="text-slate-200">contributor.stock.adobe.com</span>, click <span className="text-slate-200 font-semibold">Upload</span>, then click <span className="text-slate-200 font-semibold">SFTP Details</span>. Copy your numeric Contributor ID.
                    </p>
                  </div>

                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                    <span className="font-bold text-amber-400">2. Generate SFTP Password</span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Click <span className="text-slate-200 font-semibold">"Generate Password"</span> on Adobe's page. <strong className="text-amber-300">Do NOT use your Adobe account password!</strong> Adobe generates a separate 12-char SFTP password.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80 flex items-start gap-2 text-[11px] text-slate-400">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-300">Processing Timeline:</strong> Adobe Stock's automated ingest bot takes <strong className="text-white">2 to 10 minutes</strong> after an SFTP upload to process the file and display it in the <strong className="text-white">"Uploaded Files" (New)</strong> tab on contributor.stock.adobe.com.
                  </span>
                </div>
              </div>
            )}

            {/* Shutterstock Specific Setup Guide */}
            {selectedAgencyKey === 'shutterstock' && (
              <div className="p-4 bg-rose-950/20 border border-rose-900/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-rose-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Shutterstock Contributor FTPS Connection (Port 21, TLS)
                    </h4>
                  </div>
                  <a
                    href="https://submit.shutterstock.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 underline font-medium"
                  >
                    <span>submit.shutterstock.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300">
                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                    <span className="font-bold text-rose-300">1. Contributor Email or Username</span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Enter the login email address or contributor username you use to log in to <span className="text-slate-200">submit.shutterstock.com</span>.
                    </p>
                  </div>

                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                    <span className="font-bold text-rose-300">2. Contributor Password</span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Enter your Shutterstock account password (the same password you use to log in to Shutterstock).
                    </p>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80 flex items-start gap-2 text-[11px] text-slate-400">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-300">Target Ingestion Host:</strong> Connected to <strong className="text-white">ftps.shutterstock.com:21</strong> via secure Explicit FTPS (TLS). Files appear in your Shutterstock dashboard under <strong className="text-white">"Select and submit"</strong> in 5 to 15 minutes.
                  </span>
                </div>
              </div>
            )}

            {/* Pond5 Specific Setup Guide */}
            {selectedAgencyKey === 'pond5' && (
              <div className="p-4 bg-amber-950/20 border border-amber-900/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Pond5 Contributor FTP Connection (ftp.pond5.com:21)
                    </h4>
                  </div>
                  <a
                    href="https://www.pond5.com/my-account/ftp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 underline font-medium"
                  >
                    <span>pond5.com Account &gt; FTP</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300">
                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                    <span className="font-bold text-amber-300">1. Pond5 Username</span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Enter your Pond5 contributor username / artist handle.
                    </p>
                  </div>

                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                    <span className="font-bold text-amber-300">2. Dedicated FTP Password</span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      <strong className="text-amber-200">Different from your login password!</strong> In Pond5, go to <em>Dashboard &gt; ACCOUNT &gt; FTP</em> and generate/set your 8+ character FTP password.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80 flex items-start gap-2 text-[11px] text-slate-400">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-300">Ingestion Details:</strong> Files stream directly to <strong className="text-white">ftp.pond5.com:21</strong>. Once received, they appear in your Pond5 <em>My Uploads</em> area for pricing and release attachment.
                  </span>
                </div>
              </div>
            )}

            {/* Dreamstime Specific Setup Guide */}
            {selectedAgencyKey === 'dreamstime' && (
              <div className="p-4 bg-sky-950/20 border border-sky-900/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sky-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Dreamstime Contributor FTP (upload.dreamstime.com:21)
                    </h4>
                  </div>
                  <a
                    href="https://www.dreamstime.com/uploadfile"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 underline font-medium"
                  >
                    <span>Dreamstime Upload Area</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300">
                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                    <span className="font-bold text-sky-300">1. Dreamstime Contributor ID</span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Your numerical Contributor ID (e.g. <code className="text-white">54647264</code>, displayed on Dreamstime under <em>Management Area &gt; FTP Upload</em>).
                    </p>
                  </div>

                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                    <span className="font-bold text-sky-300">2. Account / FTP Password</span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Your Dreamstime account login password (same password used for web login).
                    </p>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80 flex items-start gap-2 text-[11px] text-slate-400">
                  <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-300">Automated Video Subfolder Routing:</strong> Dreamstime strictly requires all video clips to be placed inside the <strong className="text-white font-mono">video/</strong> subfolder (uploading videos directly to root causes ProFTPD to reject with <strong className="text-rose-300 font-mono">550 Operation not permitted</strong>). StockSync Pro automatically discovers and navigates into <strong className="text-sky-300 font-mono">video/</strong>, cleans filenames into pure alphanumeric characters, and remuxes MOV to MP4 if needed. Uploaded files appear under <strong className="text-sky-300">Management Area &gt; Unfinished Files</strong> within 2 to 10 minutes.
                  </span>
                </div>
              </div>
            )}

            {/* 123RF Specific Setup Guide */}
            {selectedAgencyKey === '123rf' && (
              <div className="p-4 bg-orange-950/20 border border-orange-900/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      123RF Ingestion Architecture: Dual-Channel Video SFTP & Photo FTP
                    </h4>
                  </div>
                  <a
                    href="https://www.123rf.com/contributors/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-1 underline font-medium"
                  >
                    <span>123RF Contributor Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300">
                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300">1. Video Footage SFTP</span>
                      <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.2 rounded font-mono">Port 2022</span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-mono">Host: footage.ftp.123rf.com</p>
                    <p className="text-[11px] text-slate-400">
                      Protocol: <strong className="text-white">SFTP (SSH File Transfer Protocol)</strong>.
                      Videos uploaded here appear under <span className="text-amber-200">Manage Footage &gt; Drafts</span>.
                    </p>
                  </div>

                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-orange-300">2. Photo & Vector FTP</span>
                      <span className="text-[10px] bg-orange-950 text-orange-300 border border-orange-800 px-1.5 py-0.2 rounded font-mono">Port 21</span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-mono">Host: ftp.123rf.com</p>
                    <p className="text-[11px] text-slate-400">
                      Protocol: <strong className="text-white">FTP</strong>. JPEGs &amp; Vector ZIPs uploaded here populate your contributor <span className="text-orange-200">Drafts</span> tab.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80 flex items-start gap-2 text-[11px] text-slate-400">
                  <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-200">Automated Smart Ingestion:</strong> StockSync Pro detects file formats in your batch automatically. Video clips (.MP4, .MOV) are automatically routed via <strong className="text-white">SFTP to footage.ftp.123rf.com:2022</strong> (so they show up on 123rf.com instead of being dropped by the photo server), while images stream to <strong className="text-white">ftp.123rf.com:21</strong>. Enter your contributor login username and password once below.
                  </span>
                </div>
              </div>
            )}

            {/* Credential Inputs */}
            <div className="space-y-3 p-4 bg-slate-950/50 border border-slate-800 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  {selectedAgencyConfig.name} Contributor Credentials
                </span>
                {isRealCredActive ? (
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Real credentials saved</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-400">
                    Enter your live contributor login credentials
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>
                      {selectedAgencyKey === 'adobe'
                        ? 'Adobe Contributor ID (Numeric, e.g. 212126684)'
                        : selectedAgencyKey === 'shutterstock'
                        ? 'Shutterstock Contributor Email or Username'
                        : selectedAgencyKey === 'pond5'
                        ? 'Pond5 Username / Artist Handle'
                        : selectedAgencyKey === 'dreamstime'
                        ? 'Dreamstime Contributor Username or ID'
                        : selectedAgencyKey === '123rf'
                        ? '123RF Contributor Username or Email'
                        : selectedAgencyKey === 'alamy'
                        ? 'Alamy Contributor Username'
                        : `${selectedAgencyConfig.name} Contributor Username`}
                    </span>
                    {selectedAgencyKey === 'adobe' && (
                      <span className="text-[10px] text-indigo-400">Numeric Contributor ID</span>
                    )}
                    {selectedAgencyKey === 'shutterstock' && (
                      <span className="text-[10px] text-rose-400">Login Email or Username</span>
                    )}
                    {selectedAgencyKey === 'dreamstime' && (
                      <span className="text-[10px] text-sky-400">Numeric Account ID (from FTP Upload)</span>
                    )}
                    {selectedAgencyKey === '123rf' && (
                      <span className="text-[10px] text-orange-400">Contributor Handle (Not Email)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={selectedCred.username || ''}
                    onChange={(e) =>
                      onUpdateCredential({ ...selectedCred, username: e.target.value })
                    }
                    placeholder={
                      selectedAgencyKey === 'adobe'
                        ? 'e.g. 212126684'
                        : selectedAgencyKey === 'shutterstock'
                        ? 'e.g. your_email@domain.com or contributor_username'
                        : selectedAgencyKey === 'pond5'
                        ? 'e.g. pond5_creator'
                        : selectedAgencyKey === 'dreamstime'
                        ? 'e.g. 54647264 (Numeric User ID from Dreamstime FTP Upload)'
                        : selectedAgencyKey === '123rf'
                        ? 'e.g. your_contributor_username (from 123RF Profile, not email)'
                        : 'e.g. username'
                    }
                    className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-400">Target Host / Protocol (Read-Only)</label>
                    <input
                      type="text"
                      readOnly
                      value={selectedAgencyConfig.ftpHost}
                      className="w-full mt-1 bg-slate-900/50 border border-slate-800/80 rounded-lg px-3 py-1.5 text-xs text-slate-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>
                        {selectedAgencyKey === 'adobe'
                          ? 'Generated SFTP Password'
                          : selectedAgencyKey === 'shutterstock'
                          ? 'Shutterstock Account Password'
                          : selectedAgencyKey === 'pond5'
                          ? 'Pond5 Account FTP Password'
                          : selectedAgencyKey === 'dreamstime'
                          ? 'Dreamstime Account / FTP Password'
                          : selectedAgencyKey === '123rf'
                          ? '123RF Account Password'
                          : 'SFTP / FTP Password'}
                      </span>
                      {selectedAgencyKey === 'adobe' && (
                        <span className="text-[10px] text-amber-400">Not Adobe Account PW</span>
                      )}
                      {selectedAgencyKey === 'shutterstock' && (
                        <span className="text-[10px] text-rose-400">submit.shutterstock.com PW</span>
                      )}
                      {selectedAgencyKey === 'pond5' && (
                        <span className="text-[10px] text-amber-400">From Account &gt; FTP</span>
                      )}
                      {selectedAgencyKey === 'dreamstime' && (
                        <span className="text-[10px] text-sky-400">Account / FTP PW</span>
                      )}
                      {selectedAgencyKey === '123rf' && (
                        <span className="text-[10px] text-orange-400">Contributor PW</span>
                      )}
                    </label>
                    <input
                      type="password"
                      value={selectedCred.ftpPassword || ''}
                      onChange={(e) =>
                        onUpdateCredential({ ...selectedCred, ftpPassword: e.target.value })
                      }
                      placeholder="••••••••••••"
                      className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-800/60">
                <p className="text-[11px] text-slate-500 font-mono">
                  Stored securely in applet memory for your upload session
                </p>
                {selectedAgencyKey === '123rf' ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTestConnection('123rf', { host: 'footage.ftp.123rf.com', port: 2022, label: 'Video Footage SFTP' })}
                      disabled={testingAgency === '123rf'}
                      className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-800 text-xs rounded-lg transition-colors font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 text-amber-400 ${testingAgency === '123rf' ? 'animate-spin' : ''}`} />
                      <span>Verify Video SFTP (:2022)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestConnection('123rf', { host: 'ftp.123rf.com', port: 21, label: 'Image FTP' })}
                      disabled={testingAgency === '123rf'}
                      className="px-2.5 py-1 bg-orange-950/80 hover:bg-orange-900 text-orange-200 border border-orange-800 text-xs rounded-lg transition-colors font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 text-orange-400 ${testingAgency === '123rf' ? 'animate-spin' : ''}`} />
                      <span>Verify Photo FTP (:21)</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTestConnection(selectedAgencyKey)}
                    disabled={testingAgency === selectedAgencyKey}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 text-slate-400 ${testingAgency === selectedAgencyKey ? 'animate-spin' : ''}`} />
                    <span>Verify Connection Now</span>
                  </button>
                )}
              </div>
            </div>

            {/* Platform Specifications Cheat Sheet */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg space-y-2">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                <span>{selectedAgencyConfig.name} Requirements Summary</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                <div className="p-2 bg-slate-900/60 rounded">
                  <div className="text-[10px] text-slate-400">Min Megapixels</div>
                  <div className="text-white mt-0.5">{selectedAgencyConfig.minMegapixels} MP</div>
                </div>

                <div className="p-2 bg-slate-900/60 rounded">
                  <div className="text-[10px] text-slate-400">Keywords Bounds</div>
                  <div className="text-white mt-0.5">
                    {selectedAgencyConfig.minKeywords} – {selectedAgencyConfig.maxKeywords} tags
                  </div>
                </div>

                <div className="p-2 bg-slate-900/60 rounded">
                  <div className="text-[10px] text-slate-400">Formats</div>
                  <div className="text-white mt-0.5 truncate">
                    {selectedAgencyConfig.acceptedFormats.join(', ')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
