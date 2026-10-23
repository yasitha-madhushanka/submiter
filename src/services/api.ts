import { AgencyKey, StockAsset } from '../types';

// Supports optional external backend (e.g. when hosting frontend on Netlify / Vercel while backend runs on Render / Railway / VPS)
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export interface GenerateMetadataRequest {
  filename: string;
  mediaType: 'image' | 'video' | 'vector';
  fileSize?: number;
  dimensions?: {
    width: number;
    height: number;
    megapixels?: number;
    duration?: number;
  };
  customPrompt?: string;
  imageBase64?: string;
}

export interface GenerateMetadataResponse {
  success: boolean;
  source: string;
  metadata: {
    title: string;
    description: string;
    keywords: string[];
    adobeCategory: string;
    shutterstockPrimaryCategory: string;
    shutterstockSecondaryCategory?: string;
    pond5Category?: string;
    editorialRequired: boolean;
    editorialReason?: string;
    modelReleaseRequired: boolean;
    propertyReleaseRequired: boolean;
    isAiGenerated: boolean;
    alamyEssentialKeywords?: string[];
    suggestedPriceUsd?: number;
    complianceNotes?: string[];
  };
}

export async function requestAiMetadata(req: GenerateMetadataRequest): Promise<GenerateMetadataResponse> {
  const response = await fetch(`${API_BASE}/api/ai/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI Metadata failed: ${errorText || response.statusText}`);
  }

  return response.json();
}

export async function verifyAgency(agencyKey: AgencyKey, credentials: any) {
  const response = await fetch(`${API_BASE}/api/agencies/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agencyKey, credentials }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Verification failed for ${agencyKey}`);
  }

  return response.json();
}

export async function uploadMediaFile(file: File): Promise<{
  success: boolean;
  file: {
    filename: string;
    originalname: string;
    mimetype: string;
    size: number;
    path: string;
    url: string;
  };
}> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/api/media/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`File upload failed: ${errorText || response.statusText}`);
  }

  return response.json();
}

export async function testAgencySftpApi(
  agencyKey: AgencyKey,
  credentials: { username: string; password?: string; host?: string; port?: number }
) {
  const response = await fetch(`${API_BASE}/api/agencies/test-sftp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agencyKey,
      username: credentials.username,
      password: credentials.password,
      host: credentials.host,
      port: credentials.port,
    }),
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const err = await response.json();
      errorDetail = err.message || err.error;
    } catch {
      const rawText = await response.text().catch(() => '');
      if (rawText.includes('<!DOCTYPE') || rawText.includes('<html') || response.status === 404 || response.status === 502) {
        errorDetail = `Backend server not reachable (${response.status} ${response.statusText}). Netlify only hosts static frontend files and cannot run the Node.js SFTP/FTPS server (server.ts). To connect to microstock agencies, deploy the full-stack app to a Node.js platform like Render, Railway, Docker, or a VPS with "npm start", or configure VITE_API_URL in Netlify environment variables pointing to your backend.`;
      } else {
        errorDetail = rawText;
      }
    }
    throw new Error(errorDetail || `Connection test failed (${response.status} ${response.statusText})`);
  }

  return response.json();
}

export async function uploadSingleSftpApi(
  asset: StockAsset,
  agencyKey: AgencyKey,
  credentials: { username: string; ftpPassword?: string; apiKey?: string }
) {
  const response = await fetch(`${API_BASE}/api/agencies/upload-sftp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset, agencyKey, credentials }),
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const err = await response.json();
      errorDetail = err.message || err.error;
    } catch {
      const rawText = await response.text().catch(() => '');
      errorDetail = rawText;
    }
    throw new Error(errorDetail || `Upload failed (${response.status} ${response.statusText})`);
  }

  return response.json();
}

export async function submitBatchApi(
  assets: StockAsset[],
  targetAgencies: AgencyKey[],
  credentials: Record<AgencyKey, any> = {} as any
) {
  const response = await fetch(`${API_BASE}/api/agencies/submit-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assets, targetAgencies, credentials }),
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const err = await response.json();
      errorDetail = err.message || err.error;
    } catch {
      const rawText = await response.text().catch(() => '');
      errorDetail = rawText;
    }
    throw new Error(errorDetail || `Batch submission failed (${response.status} ${response.statusText})`);
  }

  return response.json();
}

export interface CategorizeCsvItem {
  filename: string;
  title: string;
  description?: string;
  keywords: string[] | string;
}

export interface CategorizeCsvResult {
  filename: string;
  adobeCategory: string;
  shutterstockPrimaryCategory: string;
  shutterstockSecondaryCategory?: string;
  pond5Category?: string;
  editorialRequired?: boolean;
}

export async function categorizeCsvItemsApi(items: CategorizeCsvItem[]): Promise<{
  success: boolean;
  source: string;
  results: CategorizeCsvResult[];
}> {
  const response = await fetch(`${API_BASE}/api/metadata/categorize-csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'CSV Categorization failed');
  }

  return response.json();
}
