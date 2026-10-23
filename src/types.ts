export type AgencyKey = 
  | 'adobe'
  | 'shutterstock'
  | 'blackbox'
  | 'storyblocks'
  | 'getty'
  | 'pond5'
  | 'alamy'
  | 'depositphotos'
  | 'dreamstime'
  | '123rf';

export type MediaType = 'image' | 'video' | 'vector';

export interface AgencyInfo {
  key: AgencyKey;
  name: string;
  shortName: string;
  tagline: string;
  brandColor: string;
  supportsVideo: boolean;
  supportsPhoto: boolean;
  supportsVector: boolean;
  minKeywords: number;
  maxKeywords: number;
  minMegapixels: number;
  pricingControl: boolean; // e.g. Pond5
  requiresCategory: boolean;
  ftpHost: string;
  apiDocs: string;
  acceptedFormats: string[];
}

export interface AssetDimensions {
  width: number;
  height: number;
  megapixels: number;
  aspectRatio: string;
  duration?: number; // for video in seconds
  fps?: number;
  codec?: string;
}

export interface AssetMetadata {
  title: string;
  description: string;
  keywords: string[];
  adobeCategory: string;
  shutterstockPrimaryCategory: string;
  shutterstockSecondaryCategory: string;
  pond5Category: string;
  editorialRequired: boolean;
  editorialReason?: string;
  modelReleaseRequired: boolean;
  propertyReleaseRequired: boolean;
  isAiGenerated: boolean;
  modelReleases: string[]; // names or IDs
  propertyReleases: string[];
  pond5PriceUsd: number;
  blackboxShare: {
    creatorPercentage: number;
    curatorPercentage: number;
  };
  alamyEssentialKeywords: string[];
  complianceNotes?: string[];
}

export interface AgencySubmissionState {
  status: 'idle' | 'validating' | 'uploading' | 'submitted' | 'rejected' | 'submitted_sandbox';
  submissionId?: string;
  timestamp?: string;
  isRealUpload?: boolean;
  protocol?: string;
  message?: string;
  logs?: string[];
  bytesUploaded?: number;
  errors?: string[];
  warnings?: string[];
  reviewStatus?: 'under_review' | 'approved' | 'rejected' | 'sandbox_simulated';
}

export interface StockAsset {
  id: string;
  filename: string;
  fileSize: number; // in bytes
  mediaType: MediaType;
  previewUrl: string;
  serverFilePath?: string;
  fileUrl?: string;
  fileDataUrl?: string;
  dimensions: AssetDimensions;
  metadata: AssetMetadata;
  status: 'draft' | 'analyzing' | 'ready' | 'uploading' | 'submitted';
  targetAgencies: AgencyKey[];
  agencySubmissions: Partial<Record<AgencyKey, AgencySubmissionState>>;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyCredential {
  agencyKey: AgencyKey;
  connected: boolean;
  username: string;
  apiKey: string;
  apiSecret?: string;
  ftpHost?: string;
  ftpPassword?: string;
  latencyMs?: number;
  lastVerified?: string;
  dailyQuotaRemaining?: number;
}

export interface BatchSubmissionResult {
  batchId: string;
  processedCount: number;
  targetAgencies: AgencyKey[];
  results: {
    assetId: string;
    filename: string;
    agencies: Record<AgencyKey, {
      agencyName: string;
      submissionId: string;
      status: string;
      timestamp: string;
      errors: string[];
      warnings: string[];
      protocol: string;
    }>;
  }[];
}
