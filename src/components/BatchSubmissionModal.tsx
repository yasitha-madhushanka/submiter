import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Terminal,
  FileCheck,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Settings,
  Sparkles,
  Info,
  Download,
  RotateCcw,
  Check,
  XCircle,
  Upload
} from 'lucide-react';
import { StockAsset, AgencyKey, AgencyCredential, BatchSubmissionResult } from '../types';
import { MICROSTOCK_AGENCIES } from '../constants/agencies';
import { submitBatchApi, uploadMediaFile } from '../services/api';
import { generateAdobeStockCsv, generateShutterstockCsv } from '../utils/csvExport';

interface BatchSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: StockAsset[];
  activeTargetAgencies: AgencyKey[];
  credentials: Record<AgencyKey, AgencyCredential>;
  onSubmissionComplete: (updatedAssets: StockAsset[]) => void;
  onOpenAgencyManager?: () => void;
}

export const BatchSubmissionModal: React.FC<BatchSubmissionModalProps> = ({
  isOpen,
  onClose,
  assets,
  activeTargetAgencies,
  credentials,
  onSubmissionComplete,
  onOpenAgencyManager,
}) => {
  const [selectedAgencyKeys, setSelectedAgencyKeys] = useState<AgencyKey[]>(activeTargetAgencies);
  const [submissionStep, setSubmissionStep] = useState<'review' | 'uploading' | 'completed' | 'failed'>('review');
  const [logs, setLogs] = useState<string[]>([]);
  const [agencyProgress, setAgencyProgress] = useState<Record<AgencyKey, number>>({} as any);
  const [submissionResult, setSubmissionResult] = useState<BatchSubmissionResult | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [isReattachingFile, setIsReattachingFile] = useState(false);

  useEffect(() => {
    setSelectedAgencyKeys(activeTargetAgencies);
  }, [activeTargetAgencies]);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const isAdobeTarget = selectedAgencyKeys.includes('adobe');
  const isShutterstockTarget = selectedAgencyKeys.includes('shutterstock');
  const isDepositphotosTarget = selectedAgencyKeys.includes('depositphotos');
  const isDreamstimeTarget = selectedAgencyKeys.includes('dreamstime');
  const is123rfTarget = selectedAgencyKeys.includes('123rf');
  const adobeCred = credentials?.adobe;
  const isAdobeReal = Boolean(
    adobeCred?.username &&
    adobeCred?.ftpPassword &&
    !adobeCred.username.toLowerCase().includes('demo') &&
    !adobeCred.ftpPassword.toLowerCase().includes('demo')
  );

  const triggerDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStartSubmission = async () => {
    if (selectedAgencyKeys.length === 0 || assets.length === 0) return;

    setSubmissionStep('uploading');
    setLogs([]);
    setErrorDetails([]);
    addLog(`Initiating multi-agency submission pipeline for ${assets.length} assets...`);
    addLog(`Targeting: ${selectedAgencyKeys.map((k) => MICROSTOCK_AGENCIES[k].name).join(', ')}`);

    if (isAdobeTarget) {
      if (isAdobeReal) {
        addLog(`[Adobe Stock] Real SFTP stream enabled. Ingestion target: sftp.contributor.adobestock.com:22 as Contributor ID "${adobeCred?.username}"`);
      } else {
        addLog(`[Adobe Stock] Notice: Running in Sandbox Simulation mode. Configure real SFTP credentials in Agency Settings to have files appear on contributor.stock.adobe.com.`);
      }
    }

    // Initialize progress
    const initialProg: Record<AgencyKey, number> = {} as any;
    selectedAgencyKeys.forEach((k) => (initialProg[k] = 15));
    setAgencyProgress(initialProg);

    try {
      addLog('Verifying technical preflight compliance (megapixels, keywords count, codecs)...');
      await new Promise((r) => setTimeout(r, 400));

      const updated1: Record<AgencyKey, number> = {} as any;
      selectedAgencyKeys.forEach((k) => (updated1[k] = 45));
      setAgencyProgress(updated1);

      addLog('Streaming binary payloads to agency endpoints & embedding standard XMP/IPTC metadata...');

      // Call backend submit endpoint with real credentials
      const result = await submitBatchApi(assets, selectedAgencyKeys, credentials);
      setSubmissionResult(result);

      // Extract server logs and verify true outcomes
      const collectedErrors: string[] = [];
      let successCount = 0;
      let failureCount = 0;

      if (result && result.results) {
        result.results.forEach((item: any) => {
          Object.keys(item.agencies || {}).forEach((k) => {
            const agRes = item.agencies[k];
            if (agRes.logs && Array.isArray(agRes.logs)) {
              agRes.logs.forEach((l: string) => addLog(l));
            }

            const isFail = agRes.status === 'rejected_sftp' || agRes.status === 'rejected_preflight' || (agRes.errors && agRes.errors.length > 0);
            if (isFail) {
              failureCount++;
              const agencyDisplayName = MICROSTOCK_AGENCIES[k as AgencyKey]?.name || k;
              if (agRes.errors && agRes.errors.length > 0) {
                agRes.errors.forEach((e: string) => {
                  collectedErrors.push(`[${agencyDisplayName}] ${e}`);
                });
              } else if (agRes.message) {
                collectedErrors.push(`[${agencyDisplayName}] ${agRes.message}`);
              } else {
                collectedErrors.push(`[${agencyDisplayName}] Transmission rejected.`);
              }
            } else if (agRes.status === 'submitted' || agRes.status === 'submitted_sandbox') {
              successCount++;
            }
          });
        });
      }

      setErrorDetails(collectedErrors);

      const finalProg: Record<AgencyKey, number> = {} as any;
      selectedAgencyKeys.forEach((k) => (finalProg[k] = 100));
      setAgencyProgress(finalProg);

      if (failureCount > 0 && successCount === 0) {
        collectedErrors.forEach((e) => addLog(`[ERROR] ${e}`));
        addLog('FAILED: Transmission could not be completed. Check errors above.');
        setSubmissionStep('failed');
      } else if (failureCount > 0) {
        collectedErrors.forEach((e) => addLog(`[WARNING] ${e}`));
        addLog('Partial completion: Some agencies failed to ingest media.');
        setSubmissionStep('completed');
      } else {
        addLog('Batch transmission completed successfully!');
        setSubmissionStep('completed');
      }

      // Update assets state with real submission data
      const updated = assets.map((a) => {
        const agencySubmissions = { ...a.agencySubmissions };
        const assetRes = result?.results?.find((r: any) => r.assetId === a.id);
        let hasAnySubmitted = false;

        let hasAnyRealSubmitted = false;
        let hasAnySandboxSubmitted = false;

        selectedAgencyKeys.forEach((k) => {
          const remoteAgencyRes = assetRes?.agencies?.[k];
          const isFail = remoteAgencyRes?.status === 'rejected_sftp' || remoteAgencyRes?.status === 'rejected_preflight';
          const isReal = Boolean(remoteAgencyRes?.isRealUpload);
          const isSandbox = remoteAgencyRes?.status === 'submitted_sandbox';

          if (!isFail && isReal) {
            hasAnyRealSubmitted = true;
          } else if (!isFail && isSandbox) {
            hasAnySandboxSubmitted = true;
          }

          agencySubmissions[k] = {
            status: isFail ? 'rejected' : isSandbox ? 'submitted_sandbox' : 'submitted',
            submissionId: remoteAgencyRes?.submissionId || `${k.toUpperCase()}-${Math.random().toString(36).substring(2, 8)}`,
            timestamp: new Date().toISOString(),
            isRealUpload: isReal,
            protocol: remoteAgencyRes?.protocol,
            message: remoteAgencyRes?.message,
            bytesUploaded: remoteAgencyRes?.bytesUploaded,
            reviewStatus: isFail ? undefined : isReal ? 'under_review' : 'sandbox_simulated',
            errors: remoteAgencyRes?.errors,
          };
        });

        return {
          ...a,
          status: hasAnyRealSubmitted ? ('submitted' as const) : hasAnySandboxSubmitted ? ('ready' as const) : ('draft' as const),
          agencySubmissions,
        };
      });

      onSubmissionComplete(updated);
    } catch (err: any) {
      const errMsg = err.message || 'Unknown network error during submission';
      addLog(`[FATAL ERROR] ${errMsg}`);
      setErrorDetails([errMsg]);
      setSubmissionStep('failed');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-400" />
              <span>Multi-Platform Batch Submission</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Simultaneous transmission to Adobe Stock, Shutterstock, BlackBox, Storyblocks, Getty, Pond5, Alamy & Depositphotos
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 space-y-5 overflow-y-auto">
          {submissionStep === 'review' && (
            <div className="space-y-5">
              {/* Asset Summary */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400">Assets Queued for Submission</span>
                  <div className="text-lg font-bold text-white font-mono mt-0.5">
                    {assets.length} Selected Files
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                  <span>
                    Photos: {assets.filter((a) => a.mediaType === 'image').length}
                  </span>
                  <span>·</span>
                  <span>
                    Videos: {assets.filter((a) => a.mediaType === 'video').length}
                  </span>
                  {assets.some((a) => a.mediaType === 'vector') && (
                    <>
                      <span>·</span>
                      <span className="text-amber-300 font-medium">
                        Vectors: {assets.filter((a) => a.mediaType === 'vector').length}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Adobe Stock Live SFTP Status Alert */}
              {isAdobeTarget && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3.5 transition-all ${
                    isAdobeReal
                      ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                      : 'bg-amber-950/30 border-amber-800/60 text-amber-200'
                  }`}
                >
                  {isAdobeReal ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  )}

                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {isAdobeReal
                          ? 'Adobe Stock: Live SFTP Transmission Ready'
                          : 'Adobe Stock: Running in Sandbox Mode'}
                      </span>

                      {onOpenAgencyManager && (
                        <button
                          type="button"
                          onClick={onOpenAgencyManager}
                          className="text-[11px] font-medium underline flex items-center gap-1 hover:opacity-80 transition-opacity"
                        >
                          <Settings className="w-3 h-3" />
                          <span>Agency Settings</span>
                        </button>
                      )}
                    </div>

                    <p className="text-xs leading-relaxed opacity-90">
                      {isAdobeReal ? (
                        <>
                          Authenticated with Contributor ID{' '}
                          <strong className="font-mono text-emerald-300">"{adobeCred?.username}"</strong>.
                          Images will be streamed directly into your live Adobe Stock Contributor Portal via SFTP with embedded IPTC & Adobe XMP metadata.
                        </>
                      ) : (
                        <>
                          You do not have real Adobe Stock SFTP credentials saved. Files will be validated in local Sandbox Simulation mode. To upload to your actual Adobe Stock dashboard, add your Contributor ID and SFTP Password.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Agency Selection Checkboxes */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Target Agencies for Batch Pipeline
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {(Object.keys(MICROSTOCK_AGENCIES) as AgencyKey[]).map((key) => {
                    const agency = MICROSTOCK_AGENCIES[key];
                    const isSelected = selectedAgencyKeys.includes(key);
                    const cred = credentials[key];
                    const isCredReal = Boolean(
                      cred?.connected &&
                      cred?.username &&
                      !cred.username.toLowerCase().includes('demo') &&
                      cred?.ftpPassword &&
                      !cred.ftpPassword.toLowerCase().includes('demo')
                    );
                    const isReal = key === 'adobe' ? isAdobeReal : isCredReal;

                    return (
                      <div
                        key={key}
                        onClick={() => {
                          setSelectedAgencyKeys((prev) =>
                            prev.includes(key)
                              ? prev.filter((k) => k !== key)
                              : [...prev, key]
                          );
                        }}
                        className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-950/30 border-indigo-600/60 shadow-sm'
                            : 'bg-slate-950/30 border-slate-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-700 bg-slate-900'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                              <span>{agency.name}</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-medium ${
                                  isReal
                                    ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60'
                                    : 'bg-amber-950/60 text-amber-300/90 border border-amber-800/60'
                                }`}
                              >
                                {isReal ? 'Live SFTP' : 'Sandbox'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {agency.ftpHost || (agency as any).apiEndpoint || 'Direct Ingestion'}
                            </span>
                          </div>
                        </div>

                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: agency.brandColor }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Automatic Preflight Information */}
              <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-lg flex items-start gap-2.5 text-xs text-slate-400">
                <FileCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-slate-200 font-medium">Automatic Ingestion Preflight:</span>
                  <p className="text-[11px] text-slate-400">
                    StockSync Pro embeds XMP/IPTC headers, verifies minimum megapixel thresholds, validates keyword counts against each agency's limits, and generates agency-formatted CSV sidecars.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* UPLOADING STATE */}
          {submissionStep === 'uploading' && (
            <div className="space-y-5">
              <div className="text-center py-4">
                <div className="inline-flex p-3 rounded-full bg-indigo-600/10 text-indigo-400 mb-3 animate-pulse">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <h3 className="text-sm font-semibold text-white">Transmitting Media Assets...</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Connecting to stock agency SFTP servers and streaming binaries with embedded IPTC/XMP metadata
                </p>
              </div>

              {/* Agency Progress Bars */}
              <div className="space-y-2 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="text-xs font-semibold text-slate-300 mb-2">Platform Upload Status</div>
                <div className="space-y-2">
                  {selectedAgencyKeys.map((key) => {
                    const agency = MICROSTOCK_AGENCIES[key];
                    const prog = agencyProgress[key] || 0;
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-300 font-medium">{agency.name}</span>
                          <span className="text-indigo-400">{prog}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                            style={{ width: `${prog}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Terminal Output */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Terminal className="w-3.5 h-3.5 text-slate-400" />
                  <span>Live Network & Ingestion Console</span>
                </div>
                <div className="p-3 bg-black/90 border border-slate-800 rounded-lg h-48 overflow-y-auto font-mono text-[11px] text-emerald-400 space-y-1">
                  {logs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`leading-relaxed whitespace-pre-wrap ${
                        log.includes('ERROR') || log.includes('failed')
                          ? 'text-rose-400 font-bold'
                          : log.includes('Notice') || log.includes('WARNING')
                          ? 'text-amber-300'
                          : log.includes('successfully') || log.includes('verified')
                          ? 'text-emerald-300'
                          : 'text-slate-300'
                      }`}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* FAILED STATE */}
          {submissionStep === 'failed' && (
            <div className="space-y-5 text-center py-2">
              <div className="inline-flex p-3 rounded-full bg-rose-950 text-rose-400 border border-rose-800/80 mb-2">
                <XCircle className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white">Upload Could Not Be Completed</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-lg mx-auto">
                  The SFTP transmission encountered an error. Please see the diagnostic feedback below.
                </p>
              </div>

              {/* Error messages box */}
              {errorDetails.length > 0 && (
                <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl text-left max-w-2xl mx-auto space-y-2">
                  <div className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Error Diagnostic Reasons:</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-rose-200">
                    {errorDetails.map((err, i) => (
                      <li key={i} className="flex items-start gap-1.5 font-mono">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{err}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-2 border-t border-rose-900/40 text-[11px] text-slate-300 space-y-2">
                    <p className="font-semibold text-white">How to fix:</p>
                    {selectedAgencyKeys.includes('dreamstime') && (
                      <p>
                        • <strong>Dreamstime (upload.dreamstime.com:21)</strong>: Connects via IPv4 Passive FTP (port 21). Your username must be your <strong>numeric Contributor ID</strong> (e.g.{' '}
                        <span className="font-mono text-sky-300">54647264</span>, found under Dreamstime <em>Management Area &gt; FTP Upload</em>). Dreamstime's ProFTPD server strictly requires video files to be uploaded into the <span className="font-mono text-amber-300">video/</span> subfolder, and rejects videos written to root with <span className="font-mono text-rose-300">550 Operation not permitted</span>. StockSync Pro now automatically navigates into <span className="font-mono text-amber-300">video/</span>, sanitizes filenames to alphanumeric characters, and remuxes MOV to MP4. Uploaded files appear under <em>Management Area &gt; Unfinished Files</em> in <strong>2 to 10 minutes</strong>.
                      </p>
                    )}
                    {selectedAgencyKeys.includes('123rf') && (
                      <p>
                        • <strong>123RF (Dual-Channel Ingestion)</strong>: Video footage is strictly routed to <span className="font-mono text-amber-300">footage.ftp.123rf.com:2022</span> (SFTP), while photos/vectors stream to <span className="font-mono text-orange-300">ftp.123rf.com:21</span> (FTP). Your username must be your <strong>123RF Contributor Username</strong> (your handle from your 123RF contributor profile, <em>NOT your email address</em>). Note: Uploaded media takes <strong>5 to 15 minutes</strong> for 123RF to process into your Contributor Dashboard under <strong>Drafts</strong> (<span className="text-amber-200">Manage Footage</span> for videos, <span className="text-orange-200">Manage Content</span> for photos) before they can be published live.
                      </p>
                    )}
                    {selectedAgencyKeys.includes('shutterstock') && (
                      <p>
                        • <strong>Shutterstock (ftps.shutterstock.com:21)</strong>: Connects via FTPS (port 21, TLS). Use your Shutterstock contributor login email (or username) and your regular account password from{' '}
                        <a
                          href="https://submit.shutterstock.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-rose-400 underline font-medium"
                        >
                          submit.shutterstock.com
                        </a>. Ensure at least 7 keywords.
                      </p>
                    )}
                    {selectedAgencyKeys.includes('pond5') && (
                      <p>
                        • <strong>Pond5 (ftp.pond5.com:21)</strong>: In Pond5, your FTP password is <strong>different</strong> from your Pond5 login password! Set your 8+ character FTP password in your Pond5 account dashboard under{' '}
                        <a
                          href="https://www.pond5.com/my-account/ftp"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-400 underline font-medium"
                        >
                          Account &gt; FTP
                        </a>. Ensure at least 10 keywords.
                      </p>
                    )}
                    {selectedAgencyKeys.includes('adobe') && (
                      <p>
                        • <strong>Adobe Stock (sftp.contributor.adobestock.com:22)</strong>: Your SFTP password is a separate 12-char password generated at{' '}
                        <a
                          href="https://contributor.stock.adobe.com/en/uploads"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 underline font-medium"
                        >
                          contributor.stock.adobe.com
                        </a>{' '}
                        under Upload &gt; SFTP (use your numeric Contributor ID).
                      </p>
                    )}
                    <p>
                      • <strong>Missing Media Bytes</strong>: If the error says "Local media file was not found", click the re-attach button below or use <strong>Add Media</strong> to ensure the real binary file is on the server.
                    </p>
                  </div>
                </div>
              )}

              {/* Quick Inline File Re-attach & Auto-Resume */}
              {errorDetails.some((err) => err.includes('was not found on server storage') || err.includes('Local media file') || err.includes('Local file')) && (
                <div className="p-4 bg-indigo-950/40 border border-indigo-500/50 rounded-xl text-left max-w-2xl mx-auto space-y-3 shadow-lg shadow-indigo-950/40">
                  <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
                    <Upload className="w-4 h-4 text-indigo-400" />
                    <span>Upload Missing Media File to Resume Submission Immediately</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    The agency servers require the actual image/video bytes of <strong className="text-white font-mono">{assets[0]?.filename}</strong>. Click below to select it from your device — it will upload to the server cache and immediately continue streaming to {selectedAgencyKeys.map((k) => MICROSTOCK_AGENCIES[k]?.name).join(', ')}:
                  </p>
                  <div>
                    <input
                      type="file"
                      id="batch-modal-reattach-input"
                      className="hidden"
                      accept="image/*,video/*,.ai,.eps,application/postscript,application/illustrator,image/x-eps"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsReattachingFile(true);
                        try {
                          addLog(`Uploading "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB) to server storage...`);
                          const res = await uploadMediaFile(file);
                          if (res.success) {
                            addLog(`"${file.name}" stored in server cache! Resuming agency transmission...`);
                            assets.forEach((a) => {
                              if (a.filename === file.name || assets.length === 1) {
                                a.serverFilePath = res.file.path;
                                a.filename = file.name;
                              }
                            });
                            // Automatically restart submission!
                            handleStartSubmission();
                          }
                        } catch (upErr: any) {
                          addLog(`Upload error: ${upErr.message}`);
                        } finally {
                          setIsReattachingFile(false);
                        }
                      }}
                    />
                    <label
                      htmlFor="batch-modal-reattach-input"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg cursor-pointer transition-colors shadow-lg shadow-indigo-600/30"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{isReattachingFile ? 'Uploading to Server Storage...' : `Select "${assets[0]?.filename || 'File'}" & Resume`}</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Live Terminal Log */}
              <div className="space-y-1.5 text-left max-w-2xl mx-auto">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <Terminal className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ingestion Console Log</span>
                </div>
                <div className="p-3 bg-black/90 border border-slate-800 rounded-lg h-36 overflow-y-auto font-mono text-[11px] space-y-1">
                  {logs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`leading-relaxed whitespace-pre-wrap ${
                        log.includes('ERROR') || log.includes('failed')
                          ? 'text-rose-400 font-bold'
                          : 'text-slate-400'
                      }`}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleStartSubmission}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Retry Submission</span>
                </button>

                {onOpenAgencyManager && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAgencyManager();
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 cursor-pointer border border-slate-700"
                  >
                    <Settings className="w-4 h-4 text-indigo-400" />
                    <span>Check Agency Credentials</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* COMPLETED STATE */}
          {submissionStep === 'completed' && (() => {
            const hasAnyRealTransmission = selectedAgencyKeys.some((k) => {
              const res = submissionResult?.results?.[0]?.agencies?.[k];
              if (res && (res as any).isRealUpload) return true;
              const cred = credentials[k];
              const isCredReal = Boolean(
                cred?.connected &&
                cred?.username &&
                !cred.username.toLowerCase().includes('demo') &&
                cred?.ftpPassword &&
                !cred.ftpPassword.toLowerCase().includes('demo')
              );
              return k === 'adobe' ? isAdobeReal : isCredReal;
            });
            const hasVector = assets.some((a) => a.mediaType === 'vector');

            return (
              <div className="space-y-5 text-center py-2">
                <div
                  className={`inline-flex p-3 rounded-full border mb-2 ${
                    hasAnyRealTransmission
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800/80'
                      : 'bg-amber-950 text-amber-400 border-amber-800/80'
                  }`}
                >
                  {hasAnyRealTransmission ? <CheckCircle2 className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                </div>

                <div>
                  <h3 className="text-base font-bold text-white">
                    {hasAnyRealTransmission ? 'Live Microstock Transmission Confirmed!' : 'Sandbox Validation Completed (Simulation Mode)'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-lg mx-auto">
                    {hasAnyRealTransmission ? (
                      <span className="text-emerald-300 font-medium">
                        Files were successfully streamed via SFTP/FTPS to your connected stock agency accounts!
                      </span>
                    ) : (
                      <span className="text-amber-300/90 font-medium">
                        Notice: Assets were validated locally, but <strong>NOT uploaded to real platforms</strong> because live contributor credentials are not connected.
                      </span>
                    )}
                  </p>
                </div>

                {/* Sandbox Notice Banner if in simulation mode */}
                {!hasAnyRealTransmission && (
                  <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-xl text-left max-w-2xl mx-auto space-y-3">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Why were files not uploaded to Adobe Stock / Shutterstock?</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      You are currently in <strong>Sandbox Mode</strong>. To have files appear in your real <strong className="text-white">Adobe Stock</strong>, <strong className="text-white">Shutterstock</strong>, or other agency contributor portals, you must connect your real Contributor username and SFTP password in Agency Settings.
                    </p>
                    <div className="pt-1 flex items-center gap-3">
                      {onOpenAgencyManager && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenAgencyManager();
                          }}
                          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>Connect Real Contributor Credentials</span>
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] text-amber-300/80 pt-2 border-t border-amber-900/40">
                      <strong>සිංහල:</strong> ඔබ Agency Settings හි Contributor ID සහ SFTP password සම්බන්ධ කර නොමැති බැවින් මෙය Simulation එකක් පමණි. සැබෑ ලෙස platform වෙත යැවීමට Settings වෙත ගොස් ඔබගේ credentials ඇතුළත් කරන්න.
                    </div>
                  </div>
                )}

                {/* Vector Specific Ingestion Guidance */}
                {hasVector && (
                  <div className="p-4 bg-indigo-950/40 border border-indigo-800/80 rounded-xl text-left max-w-2xl mx-auto space-y-2">
                    <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
                      <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>Microstock Vector Format & Submission Requirements (.AI / .EPS)</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-300">
                      <p>
                        • <strong>Adobe Stock</strong>: Accepts standalone <strong>.AI</strong> and <strong>.EPS</strong> vector files directly with embedded Adobe DocumentXMP &amp; DSC metadata (Adobe Stock discontinued ZIP submissions and automatically renders previews natively!).
                      </p>
                      <p>
                        • <strong>Shutterstock</strong>: Strictly requires <strong>.EPS format only</strong> (Illustrator 8/10). Direct .AI files are not accepted by Shutterstock FTPS. Vectors are automatically tagged with <code className="text-amber-300 font-mono">Illustration="yes"</code> and Category <code className="text-amber-300 font-mono">"Vectors"</code>.
                      </p>
                      <p className="text-[11px] text-indigo-300/90 bg-indigo-900/20 p-2 rounded border border-indigo-800/40">
                        💡 <strong>Zip File Title &amp; Keyword Tip:</strong> Adobe Stock portal discontinued reading metadata from ZIP archives. If you upload a ZIP or if keywords don't auto-appear in Adobe Stock, click <strong className="text-white">"Download Adobe CSV"</strong> below and upload it to <a href="https://contributor.stock.adobe.com/en/uploads" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline font-medium">contributor.stock.adobe.com</a> via the <strong>"Upload CSV"</strong> button to instantly fill all titles, categories, and keywords with 0 manual typing!
                      </p>
                    </div>
                  </div>
                )}

              {/* Adobe Stock Ingestion Notice & Final Submission Guide */}
              {isAdobeTarget && (
                <div className="p-4 bg-indigo-950/40 border border-indigo-900/60 rounded-xl text-left max-w-2xl mx-auto space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <span>Adobe Stock Contributor Ingestion & Publishing Status</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const csv = generateAdobeStockCsv(assets);
                          triggerDownload(csv, 'adobe_stock_metadata.csv');
                        }}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-indigo-300 hover:text-white border border-indigo-800/60 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Download official CSV to drag & drop into Adobe Stock's Upload CSV button"
                      >
                        <Download className="w-3 h-3 text-indigo-400" />
                        <span>Download Adobe CSV</span>
                      </button>

                      <a
                        href="https://contributor.stock.adobe.com/en/uploads"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <span>Open Adobe Dashboard</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {isAdobeReal ? (
                    <div className="space-y-2 text-xs text-slate-300">
                      <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-lg space-y-1">
                        <div className="text-emerald-300 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Embedded Adobe XMP & IPTC (Record 2:00) Metadata Transferred</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Your commercial Title, Category, and all ranked Keywords were embedded directly into the image binary (standard Exif + XMP Core + IPTC-IIM Version 4) and uploaded with companion <code className="text-emerald-300 font-mono">adobe_stock_metadata.csv</code>.
                        </p>
                      </div>

                      <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1.5">
                        <div className="text-amber-300 font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span>Why do files appear in "Uploaded Files" awaiting 1 final click?</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          By Adobe Stock policy, every contributor must do the final 1-click on the blue <strong className="text-white">"Submit (X)"</strong> button inside <a href="https://contributor.stock.adobe.com/en/uploads" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline font-medium">contributor.stock.adobe.com</a>. This is because Adobe legally requires you to certify copyright ownership and confirm model/property releases.
                        </p>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          <strong className="text-slate-100">Zero typing required:</strong> Because StockSync Pro embedded all metadata, your files will show with a green checkmark and pre-filled fields. Simply click <strong className="text-indigo-300">"Submit All"</strong> in Adobe Stock to publish for curator review!
                        </p>

                        {/* Sinhala Guidance Card */}
                        <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-indigo-300/90 leading-relaxed bg-indigo-950/20 p-2 rounded">
                          <strong>සිංහල උපදෙස්:</strong> Adobe Stock SFTP වෙත file එක upload වූ පසු contributor dashboard එකේ <span className="text-white font-mono">"Uploaded files"</span> tab එකේ දිස්වේ (මිනිත්තු 2-5ක් ගතවිය හැක). SFTP මගින් කෙලින්ම review එකට submit කළ නොහැක — Adobe Stock නීතිය අනුව ඔබ portal එකට ගොස් blue පාට <span className="text-white font-semibold">"Submit all"</span> බොත්තම click කළ යුතුය. සියලු Keywords සහ Title ස්වයංක්‍රීයව pre-fill වී ඇත.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-300">
                      <p className="leading-relaxed">
                        This submission ran in <strong className="text-amber-300">Sandbox Simulation Mode</strong> because no real Adobe SFTP credentials were entered.
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        To see files appear in your live Adobe Stock account, open <strong className="text-white">Agency Connection Hub</strong>, enter your Contributor ID and dedicated SFTP password, and submit again.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Shutterstock Ingestion Notice & Category Auto-Application Guide */}
              {isShutterstockTarget && (
                <div className="p-4 bg-rose-950/30 border border-rose-900/60 rounded-xl text-left max-w-2xl mx-auto space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-rose-400" />
                      <span>Shutterstock Category & Submission Status</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const csv = generateShutterstockCsv(assets);
                          triggerDownload(csv, 'shutterstock_metadata.csv');
                        }}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-rose-300 hover:text-white border border-rose-800/60 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Download Shutterstock CSV with auto-assigned Categories"
                      >
                        <Download className="w-3 h-3 text-rose-400" />
                        <span>Download Shutterstock CSV</span>
                      </button>

                      <a
                        href="https://submit.shutterstock.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <span>Open submit.shutterstock.com</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-lg space-y-1">
                      <div className="text-emerald-300 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Title & Keywords Successfully Embedded in Image File</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Shutterstock's ingestion server reads the commercial Title and all Keywords directly from the image's embedded IPTC/XMP tags. They will appear pre-filled in your Shutterstock dashboard.
                      </p>
                    </div>

                    <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1.5">
                      <div className="text-amber-300 font-semibold flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-amber-400" />
                        <span>Why are Categories not auto-extracted from JPEG tags by Shutterstock?</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Shutterstock's server only recognizes their proprietary 26 category list (e.g. <em>Backgrounds/Textures, Nature, Technology</em>). Standard JPEG metadata tags cannot automatically set Shutterstock's proprietary category dropdown.
                      </p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        <strong className="text-white">Instant Solution:</strong> Click <strong className="text-rose-300">"Download Shutterstock CSV"</strong> above. Then on <a href="https://submit.shutterstock.com" target="_blank" rel="noopener noreferrer" className="text-rose-400 underline font-medium">submit.shutterstock.com</a>, click the <strong className="text-white">"Upload CSV"</strong> button. Shutterstock matches your filenames and auto-fills all Categories instantly with zero manual typing!
                      </p>

                      {/* Sinhala Guidance Card */}
                      <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-rose-300/90 leading-relaxed bg-rose-950/20 p-2 rounded">
                        <strong>සිංහල උපදෙස්:</strong> Shutterstock වෙත image එක upload වූ පසු Title සහ Keywords ස්වයංක්‍රීයව pre-fill වේ. එහෙත් Shutterstock හි ප්‍රතිපත්තිය අනුව image එක තුළ ඇති Category tags ඔවුන්ගේ server එක මගින් direct කියවන්නේ නැත. Category එක ස්වයංක්‍රීයව වැටීමට, උඩ ඇති <span className="text-white font-semibold">"Download Shutterstock CSV"</span> බොත්තම click කර, <span className="text-white font-mono">submit.shutterstock.com</span> හි ඇති <span className="text-white font-semibold">"Upload CSV"</span> බොත්තමෙන් එම CSV එක upload කරන්න (නැතහොත් Category dropdown එකෙන් තෝරන්න).
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Depositphotos Ingestion Notice */}
              {isDepositphotosTarget && (
                <div className="p-4 bg-pink-950/30 border border-pink-900/60 rounded-xl text-left max-w-2xl mx-auto space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-pink-400" />
                      <span>Depositphotos Ingestion Status</span>
                    </span>

                    <a
                      href="https://depositphotos.com/upload.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-pink-600 hover:bg-pink-500 text-white rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <span>Open Depositphotos Dashboard</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-lg space-y-1 text-xs text-slate-300">
                    <div className="text-emerald-300 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Binary Stream Transmitted to ftp.depositphotos.com:21</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Files are delivered directly to Depositphotos' FTP ingestion storage with embedded XMP/IPTC metadata. Depositphotos processes incoming files in 5 to 15 minutes, after which they will appear in your Contributor portal under "Uploaded" files for review.
                    </p>
                  </div>
                </div>
              )}

              {/* Dreamstime Ingestion Notice */}
              {isDreamstimeTarget && (
                <div className="p-4 bg-sky-950/30 border border-sky-900/60 rounded-xl text-left max-w-2xl mx-auto space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-sky-400" />
                      <span>Dreamstime Ingestion Status</span>
                    </span>

                    <a
                      href="https://www.dreamstime.com/uploadfile"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <span>Open Dreamstime Upload Area</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-lg space-y-1 text-xs text-slate-300">
                    <div className="text-emerald-300 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Binary Stream Transmitted to upload.dreamstime.com:21</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Files are delivered directly to Dreamstime's FTP storage with IPTC/XMP metadata. In 2 to 10 minutes, files appear under <em>Management Area &gt; Unfinished Files</em> with Title and Keywords already pre-filled.
                    </p>
                    <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-sky-300/90 leading-relaxed bg-sky-950/30 p-2 rounded">
                      <strong>සිංහල උපදෙස්:</strong> Dreamstime වෙත FTP මගින් file එක ලැබුණු පසු ඔබගේ <span className="text-white font-semibold">Dreamstime Management Area &gt; Unfinished Files</span> වෙත ගොස් categories තහවුරු කර submit කරන්න.
                    </div>
                  </div>
                </div>
              )}

              {/* 123RF Ingestion Notice */}
              {is123rfTarget && (
                <div className="p-4 bg-orange-950/30 border border-orange-900/60 rounded-xl text-left max-w-2xl mx-auto space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-orange-400" />
                      <span>123RF Ingestion Status</span>
                    </span>

                    <a
                      href="https://www.123rf.com/contributors/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <span>Open 123RF Contributor Portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-lg space-y-1 text-xs text-slate-300">
                    <div className="text-emerald-300 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Smart Routing: Video SFTP (footage.ftp.123rf.com:2022) &amp; Photo FTP (ftp.123rf.com:21)</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      StockSync Pro automatically routes video footage (.MP4/.MOV) to 123RF's dedicated SFTP server (<strong>footage.ftp.123rf.com:2022</strong>) so videos appear under <em>Manage Footage &gt; Drafts</em>, while photos and vectors are delivered to <strong>ftp.123rf.com:21</strong>.
                    </p>
                    <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-orange-300/90 leading-relaxed bg-orange-950/30 p-2 rounded">
                      <strong>සිංහල උපදෙස්:</strong> 123RF හි Videos සඳහා <span className="text-white font-semibold">footage.ftp.123rf.com:2022 (SFTP)</span> භාවිතා වන අතර Photos සඳහා <span className="text-white font-semibold">ftp.123rf.com:21</span> ක්‍රියාත්මක වේ. Upload වූ පසු <span className="text-white font-semibold">123RF Contributor Portal &gt; Manage Footage / Drafts</span> වෙතින් review කර submit කරන්න.
                    </div>
                  </div>
                </div>
              )}

              {/* Agency Results Table */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-left max-w-2xl mx-auto space-y-2">
                <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Agency Submission Audit
                </div>

                <div className="space-y-1.5 font-mono text-xs">
                  {selectedAgencyKeys.map((key) => {
                    const agency = MICROSTOCK_AGENCIES[key];
                    const assetRes = submissionResult?.results?.[0]?.agencies?.[key];
                    const cred = credentials[key];
                    const isCredReal = Boolean(
                      cred?.connected &&
                      cred?.username &&
                      !cred.username.toLowerCase().includes('demo') &&
                      cred?.ftpPassword &&
                      !cred.ftpPassword.toLowerCase().includes('demo')
                    );
                    const isReal = Boolean((assetRes as any)?.isRealUpload ?? (key === 'adobe' ? isAdobeReal : isCredReal));
                    const isFailed = assetRes?.status === 'rejected_sftp' || assetRes?.status === 'rejected_preflight';

                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between p-2 bg-slate-900/60 rounded border border-slate-800/60"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: agency.brandColor }}
                          />
                          <span className="text-white font-medium">{agency.name}</span>
                          <span className="text-[10px] text-slate-400">
                            ({isReal ? 'Live SFTP Ingest' : 'Sandbox Audit'})
                          </span>
                        </div>

                        {isFailed ? (
                          <span className="text-rose-400 flex items-center gap-1 font-semibold text-[11px]">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Failed ({(assetRes as any)?.message || 'Error'})</span>
                          </span>
                        ) : isReal ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Live Transmitted</span>
                          </span>
                        ) : (
                          <span className="text-amber-400 flex items-center gap-1 font-semibold text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Sandbox Audited (Not Uploaded)</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          {submissionStep === 'review' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleStartSubmission}
                disabled={selectedAgencyKeys.length === 0 || assets.length === 0}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/50 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                <span>Confirm & Dispatch Batch</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {submissionStep === 'uploading' && (
            <div className="w-full flex justify-center text-xs text-slate-400 font-mono animate-pulse">
              Streaming media bytes to agency SFTP & API endpoints...
            </div>
          )}

          {submissionStep === 'failed' && (
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleStartSubmission}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
            </div>
          )}

          {submissionStep === 'completed' && (
            <div className="w-full flex items-center justify-between">
              <a
                href="https://contributor.stock.adobe.com/en/uploads"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 underline font-medium"
              >
                <span>Check Adobe Stock Ingestion Queue</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
