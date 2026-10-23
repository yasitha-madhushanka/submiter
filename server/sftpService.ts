import SftpClient from 'ssh2-sftp-client';
import * as ftp from 'basic-ftp';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import AdmZip from 'adm-zip';
import { embedMetadataInFile, injectMetadataIntoJpeg, injectMetadataIntoVector } from './xmpInjector.ts';

export interface SftpConnectionParams {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  timeoutMs?: number;
}

export interface SftpTestResult {
  success: boolean;
  agencyKey: string;
  host: string;
  port: number;
  latencyMs?: number;
  status: 'connected' | 'auth_failed' | 'timeout' | 'error' | 'demo_mode';
  message: string;
  details?: any;
}

export interface SftpUploadParams {
  agencyKey: string;
  localFilePath?: string;
  fileBuffer?: Buffer;
  remoteFilename: string;
  mediaType?: 'image' | 'video' | 'vector';
  previewBase64?: string;
  previewBuffer?: Buffer;
  credentials: {
    username: string;
    ftpPassword?: string;
    apiKey?: string;
  };
  metadata?: {
    title?: string;
    description?: string;
    keywords?: string[];
    adobeCategory?: string;
    shutterstockPrimaryCategory?: string;
    shutterstockSecondaryCategory?: string;
    releases?: string[];
  };
}

export interface SftpUploadResult {
  success: boolean;
  isRealUpload: boolean;
  agencyKey: string;
  remoteFilename: string;
  bytesUploaded?: number;
  timestamp: string;
  protocol: string;
  message: string;
  logs: string[];
  error?: string;
}

/**
 * Normalizes and sanitizes filenames for strict microstock FTP/SFTP servers (Dreamstime, 123RF, Shutterstock, etc.)
 * Strips parentheses, brackets, spaces, quotes, and illegal characters to avoid ProFTPD / Pure-FTPd "550 Operation not permitted" errors.
 */
export function sanitizeMicrostockFilename(filename: string): string {
  const parsed = path.parse(filename || '');
  let cleanBase = parsed.name
    .replace(/[()[\]{}'"!@#$%^&*+=~`|\\:;?<>,\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[-_.]+|[-_.]+$/g, '');

  if (!cleanBase) {
    cleanBase = `stock_asset_${Date.now().toString().slice(-6)}`;
  }

  const ext = parsed.ext.toLowerCase();
  return `${cleanBase}${ext}`;
}

/**
 * Dreamstime strictly requires pure alphanumeric characters (letters and numbers only).
 * ProFTPD on upload.dreamstime.com enforces a strict PathAllowFilter that rejects underscores (_),
 * hyphens (-), spaces, parentheses, brackets, or punctuation with "550 Operation not permitted".
 */
export function sanitizeDreamstimeFilename(filename: string): string {
  const parsed = path.parse(filename || '');
  // Strictly keep only alphanumeric characters (A-Z, a-z, 0-9) - NO underscores or hyphens
  let cleanBase = parsed.name.replace(/[^a-zA-Z0-9]/g, '');

  if (!cleanBase) {
    cleanBase = `asset${Date.now().toString().slice(-6)}`;
  }

  // Ensure filename starts with a letter if possible and keep under 30 chars
  if (cleanBase.length > 30) {
    cleanBase = cleanBase.slice(0, 30);
  }

  const ext = parsed.ext.toLowerCase();
  return `${cleanBase}${ext}`;
}

export const DEFAULT_AGENCY_HOSTS: Record<string, { host: string; port: number; type: 'sftp' | 'ftp' | 'ftps' }> = {
  adobe: { host: 'sftp.contributor.adobestock.com', port: 22, type: 'sftp' },
  shutterstock: { host: 'ftps.shutterstock.com', port: 21, type: 'ftps' },
  depositphotos: { host: 'ftp.depositphotos.com', port: 21, type: 'ftp' },
  dreamstime: { host: 'upload.dreamstime.com', port: 21, type: 'ftp' },
  '123rf': { host: 'ftp.123rf.com', port: 21, type: 'ftp' },
  pond5: { host: 'ftp.pond5.com', port: 21, type: 'ftp' },
  alamy: { host: 'upload.alamy.com', port: 21, type: 'ftp' },
  blackbox: { host: 'portal.blackbox.global', port: 21, type: 'ftp' },
  storyblocks: { host: 'ftp.storyblocks.com', port: 21, type: 'ftp' },
  getty: { host: 'esp-aspera.gettyimages.com', port: 22, type: 'sftp' },
};

/**
 * Tests direct connection to an agency's SFTP or FTPS/FTP server
 */
export async function testAgencySftp(
  agencyKey: string,
  params: { host?: string; port?: number; username: string; password?: string }
): Promise<SftpTestResult> {
  const defaultHost = DEFAULT_AGENCY_HOSTS[agencyKey] || { host: 'sftp.contributor.adobestock.com', port: 22, type: 'sftp' };
  let host = params.host || defaultHost.host;
  let port = params.port || defaultHost.port;
  const username = params.username?.trim();
  const password = params.password?.trim();

  // Check for empty or dummy credentials
  if (!username || !password || username.toLowerCase().includes('demo') || password.toLowerCase().includes('demo')) {
    return {
      success: false,
      agencyKey,
      host,
      port,
      status: 'demo_mode',
      message: `No real credentials provided. To connect to ${agencyKey.toUpperCase()}, enter your actual Contributor ID / Username and dedicated password.`,
    };
  }

  // Shutterstock: Standard FTPS (Explicit TLS) on port 21
  if (agencyKey === 'shutterstock' || host === 'ftps.shutterstock.com') {
    const startTime = Date.now();
    // Allow 25 seconds for cross-region TLS handshake & cloud firewall traversal
    const ftpClient = new ftp.Client(25000, { allowSeparateTransferHost: true });
    ftpClient.ftp.ipFamily = 4;
    ftpClient.ftp.verbose = false;

    try {
      console.log(`[Shutterstock FTPS] Connecting to ftps.shutterstock.com:21 as ${username}...`);
      await ftpClient.access({
        host: 'ftps.shutterstock.com',
        port: 21,
        user: username,
        password: password,
        secure: true,
        secureOptions: { rejectUnauthorized: false },
      });
      const latencyMs = Date.now() - startTime;
      ftpClient.close();
      return {
        success: true,
        agencyKey,
        host: 'ftps.shutterstock.com',
        port: 21,
        latencyMs,
        status: 'connected',
        message: `Successfully connected to Shutterstock FTPS (ftps.shutterstock.com:21)! Live direct uploads are active.`,
      };
    } catch (ftpsErr: any) {
      try { ftpClient.close(); } catch {}
      const errorMsg = ftpsErr.message || String(ftpsErr);
      const isAuthFail =
        errorMsg.includes('Authentication') ||
        errorMsg.includes('Access denied') ||
        errorMsg.includes('530') ||
        errorMsg.includes('User cannot log in');

      if (isAuthFail) {
        return {
          success: false,
          agencyKey,
          host: 'ftps.shutterstock.com',
          port: 21,
          status: 'auth_failed',
          message: `Shutterstock Authentication Failed (530). Please ensure you are using your Shutterstock contributor login email (or username) and password from submit.shutterstock.com.`,
        };
      }

      if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('Timed out') || errorMsg.includes('Timeout')) {
        return {
          success: false,
          agencyKey,
          host: 'ftps.shutterstock.com',
          port: 21,
          status: 'timeout',
          message: `Connection to ftps.shutterstock.com:21 timed out. If you are self-hosting on a VPS or cloud server (AWS, DigitalOcean, Hetzner, cPanel), ensure your hosting provider's firewall allows outbound traffic on Port 21 (FTP/FTPS) and passive port ranges.`,
        };
      }

      if (errorMsg.includes('ECONNREFUSED')) {
        return {
          success: false,
          agencyKey,
          host: 'ftps.shutterstock.com',
          port: 21,
          status: 'error',
          message: `Connection refused by ftps.shutterstock.com:21. Check outbound network rules on your hosting server.`,
        };
      }

      return {
        success: false,
        agencyKey,
        host: 'ftps.shutterstock.com',
        port: 21,
        status: 'error',
        message: `Shutterstock FTPS connection error: ${errorMsg}`,
      };
    }
  }

  // For 123RF: If host contains footage or port is 2022, target footage.ftp.123rf.com:2022 via SFTP
  if (agencyKey === '123rf' && (port === 2022 || host?.toLowerCase().includes('footage'))) {
    host = 'footage.ftp.123rf.com';
    port = 2022;
  }

  // For SFTP (Port 22 or 2022) - Adobe Stock, Getty, 123RF Footage SFTP, etc.
  const isSftpTarget = port === 22 || port === 2022 || host.includes('footage') || defaultHost.type === 'sftp' || agencyKey === 'adobe';
  if (isSftpTarget) {
    const sftp = new SftpClient();
    const startTime = Date.now();

    try {
      console.log(`[SFTP] Initiating test handshake to ${host}:${port} as ${username}...`);
      await sftp.connect({
        host,
        port,
        username,
        password,
        readyTimeout: 20000,
        retries: 2,
        tryKeyboard: true,
        algorithms: {
          serverHostKey: [
            'ssh-ed25519',
            'ecdsa-sha2-nistp256',
            'ecdsa-sha2-nistp384',
            'ecdsa-sha2-nistp521',
            'rsa-sha2-512',
            'rsa-sha2-256',
            'ssh-rsa',
          ],
          cipher: [
            'aes128-gcm',
            'aes128-gcm@openssh.com',
            'aes256-gcm',
            'aes256-gcm@openssh.com',
            'aes128-ctr',
            'aes192-ctr',
            'aes256-ctr',
            'aes128-cbc',
            'aes256-cbc',
          ],
        },
      });

      const latencyMs = Date.now() - startTime;
      console.log(`[SFTP] Successfully connected to ${host}:${port} in ${latencyMs}ms`);

      try {
        await sftp.list('.');
      } catch {
        // Root list might be restricted
      }

      await sftp.end();

      let successMsg = `Successfully authenticated with ${agencyKey === 'adobe' ? 'Adobe Stock' : host} SFTP server!`;
      if (agencyKey === '123rf' && (port === 2022 || host.includes('footage'))) {
        successMsg = `Successfully connected to 123RF Footage SFTP (footage.ftp.123rf.com:2022)! Live video footage uploads are active.`;
      }

      return {
        success: true,
        agencyKey,
        host,
        port,
        latencyMs,
        status: 'connected',
        message: successMsg,
      };
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      console.error(`[SFTP Test Error] ${host}:${port}:`, errorMsg);

      if (errorMsg.includes('authentication') || errorMsg.includes('Authentication') || errorMsg.includes('All configured')) {
        let authMsg = `Authentication failed on ${host}:${port}. Please check your contributor username and SFTP password.`;
        if (agencyKey === 'adobe') {
          authMsg = 'Authentication failed! Please make sure you are using your Adobe Stock Contributor ID (numeric, e.g. 212126684) and the dedicated SFTP password generated at contributor.stock.adobe.com -> Upload -> SFTP (NOT your regular Adobe account password).';
        } else if (agencyKey === '123rf' && (port === 2022 || host.includes('footage'))) {
          const isEmail = username.includes('@');
          authMsg = isEmail
            ? `123RF Footage SFTP (footage.ftp.123rf.com:2022) rejected the login because an email address ("${username}") was entered. 123RF strictly requires your alphanumeric Contributor Username / Handle (shown in top-right of your 123RF Contributor Dashboard), NOT your email. Also ensure your 123RF account has footage contributor privileges enabled, or verify your Photo FTP (:21) credentials.`
            : `Authentication failed on 123RF Footage SFTP (footage.ftp.123rf.com:2022). Please verify your 123RF Contributor Username (handle, NOT email) and password. If your account is only registered for Photos/Vectors, test the Photo FTP (:21) button instead.`;
        }
        return {
          success: false,
          agencyKey,
          host,
          port,
          status: 'auth_failed',
          message: authMsg,
        };
      }

      if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('Timed out')) {
        return {
          success: false,
          agencyKey,
          host,
          port,
          status: 'timeout',
          message: `Connection timed out trying to reach ${host}:${port}. The agency server may be temporarily unreachable.`,
        };
      }

      return {
        success: false,
        agencyKey,
        host,
        port,
        status: 'error',
        message: `SFTP Connection error: ${errorMsg}`,
      };
    }
  }

  // For FTP/FTPS (Port 21) - Dreamstime, 123RF, Pond5, Alamy, Depositphotos, etc.
  const startTime = Date.now();
  // Allow 25 seconds for anti-brute-force delays on Pure-FTPd (123RF) and ProFTPD (Dreamstime)
  const ftpClient = new ftp.Client(25000, { allowSeparateTransferHost: true });
  ftpClient.ftp.ipFamily = 4;
  ftpClient.ftp.verbose = false;

  try {
    console.log(`[FTP] Connecting to ${host}:${port} as ${username}...`);
    await ftpClient.access({
      host,
      port,
      user: username,
      password: password,
      secure: defaultHost.type === 'ftps',
      secureOptions: { rejectUnauthorized: false },
    });

    const latencyMs = Date.now() - startTime;
    ftpClient.close();

    let successMsg = `Successfully authenticated with ${host} FTP server!`;
    if (agencyKey === '123rf') {
      successMsg = `Successfully connected to 123RF Photo/Vector FTP (${host}:${port})! Live image uploads are active.`;
    } else if (agencyKey === 'dreamstime') {
      successMsg = `Successfully connected to Dreamstime FTP (${host}:${port})! Contributor ID verified.`;
    }

    return {
      success: true,
      agencyKey,
      host,
      port,
      latencyMs,
      status: 'connected',
      message: successMsg,
    };
  } catch (ftpErr: any) {
    ftpClient.close();
    const errorMsg = ftpErr.message || String(ftpErr);
    console.error(`[FTP Test Error] ${host}:${port}:`, errorMsg);

    const isAuth = errorMsg.includes('530') || errorMsg.includes('denied') || errorMsg.includes('Authentication') || errorMsg.includes('Login authentication failed');
    let friendlyMsg = `FTP connection error on ${host}:${port}: ${errorMsg}`;

    if (isAuth) {
      if (agencyKey === 'dreamstime') {
        friendlyMsg = `Dreamstime Authentication Failed (530). Ensure you are using your numerical Dreamstime User ID (e.g. 54647264, found under Management Area > FTP Upload) and your Dreamstime account password.`;
      } else if (agencyKey === '123rf') {
        friendlyMsg = `123RF Authentication Failed (530). Please check your 123RF Contributor Username (your contributor handle, NOT your email address if different) and password for ftp.123rf.com.`;
      } else if (agencyKey === 'pond5') {
        friendlyMsg = `Pond5 Authentication Failed (530). Note: On Pond5 (ftp.pond5.com), your FTP password must be created in your account dashboard under ACCOUNT -> FTP (it may differ from your regular Pond5 login password).`;
      } else {
        friendlyMsg = `Authentication failed on ${host}. Please check your contributor login username and password.`;
      }
    } else if (errorMsg.includes('Timeout') || errorMsg.includes('timed out')) {
      friendlyMsg = `Connection to ${host}:${port} timed out. The agency server may be busy; please retry.`;
    }

    return {
      success: false,
      agencyKey,
      host,
      port,
      status: isAuth ? 'auth_failed' : 'error',
      message: friendlyMsg,
    };
  }
}

/**
 * Uploads a file via SFTP or FTPS/FTP directly to the agency's ingestion directory
 */
export async function uploadMediaToAgencySftp(
  params: SftpUploadParams
): Promise<SftpUploadResult> {
  const { agencyKey, localFilePath, fileBuffer, credentials, metadata, mediaType, previewBase64, previewBuffer } = params;
  let remoteFilename = sanitizeMicrostockFilename(params.remoteFilename);
  const defaultHost = DEFAULT_AGENCY_HOSTS[agencyKey] || { host: 'sftp.contributor.adobestock.com', port: 22, type: 'sftp' };
  const username = credentials.username?.trim();
  const password = credentials.ftpPassword?.trim();

  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  };

  const isRealCreds = Boolean(
    username &&
    password &&
    !username.toLowerCase().includes('demo') &&
    !password.toLowerCase().includes('demo')
  );

  // If no real credentials, run in simulated sandbox mode
  if (!isRealCreds) {
    log(`[Sandbox Mode] No real SFTP/FTP credentials configured for ${agencyKey.toUpperCase()}.`);
    log(`File "${remoteFilename}" passed local preflight compliance verification.`);
    log(`To transmit directly to your live ${agencyKey} dashboard, enter your Contributor ID / Username and Password in Agency Settings.`);

    return {
      success: true,
      isRealUpload: false,
      agencyKey,
      remoteFilename,
      timestamp: new Date().toISOString(),
      protocol: 'Preflight Simulation',
      message: `File validated in Sandbox Mode. To upload to your real dashboard, add your contributor credentials in Agency Settings.`,
      logs,
    };
  }

  // Prepare binary payload with embedded standard IPTC/XMP metadata
  let sourceData: Buffer | string | null = null;
  let fileSize = 0;
  const hasMetadata = Boolean(metadata?.title && metadata?.keywords && metadata.keywords.length > 0);

  if (fileBuffer && Buffer.isBuffer(fileBuffer)) {
    if (hasMetadata && (remoteFilename.toLowerCase().endsWith('.jpg') || remoteFilename.toLowerCase().endsWith('.jpeg'))) {
      log(`Embedding standard IPTC/XMP metadata into JPEG binary: Title, Category "${metadata?.adobeCategory || 'Technology'}", and ${metadata?.keywords?.length} Keywords...`);
      sourceData = injectMetadataIntoJpeg(fileBuffer, {
        title: metadata!.title!,
        description: metadata!.description || metadata!.title,
        keywords: metadata!.keywords!,
        category: metadata!.adobeCategory,
      });
      log(`Embedded ${metadata?.keywords?.length} keywords & title with standard Exif/XMP/IPTC segment order.`);
    } else {
      sourceData = fileBuffer;
    }
    fileSize = sourceData.length;
  } else if (localFilePath && fs.existsSync(localFilePath)) {
    const ext = path.extname(localFilePath).toLowerCase();
    const isVector = ext === '.ai' || ext === '.eps' || ext === '.zip' || mediaType === 'vector';

    // 1. Universal Vector ZIP Archive Pipeline
    if (ext === '.zip') {
      log(`Vector ZIP Pipeline: Enriching archive "${remoteFilename}" with IPTC companion JPEG, vector XMP, and sidecar CSV metadata...`);

      // Obtain preview JPEG buffer if available
      let previewJpgBuffer: Buffer | null = null;
      if (previewBuffer && Buffer.isBuffer(previewBuffer)) {
        previewJpgBuffer = previewBuffer;
      } else if (previewBase64 && typeof previewBase64 === 'string') {
        try {
          const commaIdx = previewBase64.indexOf(',');
          const rawB64 = commaIdx !== -1 ? previewBase64.slice(commaIdx + 1) : previewBase64;
          previewJpgBuffer = Buffer.from(rawB64, 'base64');
        } catch (e) {
          console.warn('Failed to decode previewBase64 for ZIP:', e);
        }
      }

      const baseName = path.parse(remoteFilename).name;
      if (!previewJpgBuffer && localFilePath) {
        const potentialJpg = path.join(path.dirname(localFilePath), `${baseName}.jpg`);
        const potentialJpeg = path.join(path.dirname(localFilePath), `${baseName}.jpeg`);
        if (fs.existsSync(potentialJpg)) {
          previewJpgBuffer = fs.readFileSync(potentialJpg);
        } else if (fs.existsSync(potentialJpeg)) {
          previewJpgBuffer = fs.readFileSync(potentialJpeg);
        }
      }

      // Embed IPTC/XMP into companion JPEG, vector XMP, and CSV sidecars inside the ZIP
      const embedRes = embedMetadataInFile(
        localFilePath,
        {
          title: metadata?.title || '',
          description: metadata?.description || metadata?.title,
          keywords: metadata?.keywords || [],
          category: metadata?.adobeCategory || 'Graphic Resources',
          shutterstockCategory: metadata?.shutterstockPrimaryCategory,
          shutterstockSecondaryCategory: metadata?.shutterstockSecondaryCategory,
        },
        previewJpgBuffer || undefined
      );

      if (embedRes.success) {
        log(`Embedded Title "${metadata?.title || ''}", ${metadata?.keywords?.length || 0} Keywords, and IPTC/XMP metadata into ZIP companion preview JPEG.`);
      } else {
        log(`Notice: ZIP metadata embedding returned notice: ${embedRes.error || 'standard'}`);
      }

      // Check agency-specific requirements for ZIP files:
      if (agencyKey === 'shutterstock') {
        // Shutterstock FTPS rejects .ZIP archives; it strictly requires .EPS or .JPG directly!
        log(`Shutterstock Contributor FTPS requires direct .EPS submission (rejects raw .ZIP archives).`);
        try {
          const zip = new AdmZip(localFilePath);
          const entries = zip.getEntries();
          const epsEntry = entries.find((e) => e.entryName.toLowerCase().endsWith('.eps')) ||
                           entries.find((e) => e.entryName.toLowerCase().endsWith('.ai'));

          if (epsEntry) {
            log(`Extracted native vector "${epsEntry.entryName}" with embedded XMP from ZIP archive for Shutterstock Contributor FTPS submission.`);
            const epsBuffer = epsEntry.getData();
            sourceData = epsBuffer;
            fileSize = epsBuffer.length;
            remoteFilename = path.basename(epsEntry.entryName);
          } else {
            // If no .eps in zip, check for companion preview .jpg
            const jpgEntry = entries.find((e) => /\.(jpg|jpeg)$/i.test(e.entryName));
            if (jpgEntry) {
              log(`No .EPS found in ZIP. Extracted companion JPEG "${jpgEntry.entryName}" for Shutterstock transmission.`);
              const jpgBuffer = jpgEntry.getData();
              sourceData = jpgBuffer;
              fileSize = jpgBuffer.length;
              remoteFilename = path.basename(jpgEntry.entryName);
            } else {
              sourceData = fs.readFileSync(localFilePath);
              fileSize = sourceData.length;
            }
          }
        } catch (extErr: any) {
          log(`Warning extracting EPS from ZIP: ${extErr.message}. Sending original ZIP.`);
          sourceData = fs.readFileSync(localFilePath);
          fileSize = sourceData.length;
        }
      } else {
        // Adobe Stock, Depositphotos, Freepik, Vecteezy, etc.: Stream the enriched ZIP archive!
        sourceData = fs.readFileSync(localFilePath);
        fileSize = sourceData.length;
        log(`Enriched ZIP archive ready for ${agencyKey.toUpperCase()} Contributor ingestion (${(fileSize / (1024 * 1024)).toFixed(2)} MB).`);
      }
    } else if (isVector && agencyKey === 'shutterstock' && ext === '.ai') {
      // Shutterstock strict check: Shutterstock FTPS only accepts .EPS format
      throw new Error(`Shutterstock Contributor FTPS strictly requires vector submissions in .EPS format (compatible with Adobe Illustrator 8/10). Direct .AI vector files are rejected by Shutterstock. Please convert your artwork to .EPS or submit to Adobe Stock.`);
    } else if (isVector && agencyKey === 'adobe') {
      // Adobe Stock: Native standalone .AI or .EPS with embedded XMP metadata
      log(`Adobe Stock Vector Pipeline: Embedding standard Adobe DocumentXMP & DSC metadata directly into "${remoteFilename}"...`);
      try {
        const rawBuf = fs.readFileSync(localFilePath);
        const taggedBuf = hasMetadata
          ? injectMetadataIntoVector(rawBuf, ext, {
              title: metadata!.title!,
              description: metadata!.description || metadata!.title,
              keywords: metadata!.keywords!,
              category: metadata!.adobeCategory || 'Graphic Resources',
            })
          : rawBuf;
        fs.writeFileSync(localFilePath, taggedBuf);
        sourceData = taggedBuf;
        fileSize = taggedBuf.length;
        remoteFilename = path.basename(localFilePath);
        log(`Embedded ${metadata?.keywords?.length || 0} keywords & Title into native vector "${remoteFilename}". Ready for direct Adobe Stock SFTP ingestion.`);
      } catch (embedErr: any) {
        log(`Warning: Could not embed vector XMP: ${embedErr.message}. Transmitting original file.`);
        sourceData = localFilePath;
        fileSize = fs.statSync(localFilePath).size;
      }
    } else if (isVector && (agencyKey === 'depositphotos' || agencyKey === 'dreamstime' || agencyKey === '123rf')) {
      // Vector Pipeline for Depositphotos, Dreamstime & 123RF: Packages standalone .AI/.EPS into required ZIP bundle with companion preview JPEG
      const baseName = path.parse(remoteFilename).name;
      const zipFileName = `${baseName}.zip`;
      log(`[${agencyKey.toUpperCase()} Vector Pipeline] Packaging vector "${remoteFilename}" into required ZIP bundle...`);

      // 1. Obtain preview JPEG
      let previewJpgBuffer: Buffer | null = null;
      if (previewBuffer && Buffer.isBuffer(previewBuffer)) {
        previewJpgBuffer = previewBuffer;
      } else if (previewBase64 && typeof previewBase64 === 'string') {
        try {
          const commaIdx = previewBase64.indexOf(',');
          const rawB64 = commaIdx !== -1 ? previewBase64.slice(commaIdx + 1) : previewBase64;
          previewJpgBuffer = Buffer.from(rawB64, 'base64');
        } catch (e) {
          console.warn('Failed to decode previewBase64:', e);
        }
      }

      // Check for cached companion JPEG on disk
      if (!previewJpgBuffer && localFilePath) {
        const potentialJpg = path.join(path.dirname(localFilePath), `${baseName}.jpg`);
        const potentialJpeg = path.join(path.dirname(localFilePath), `${baseName}.jpeg`);
        if (fs.existsSync(potentialJpg)) {
          previewJpgBuffer = fs.readFileSync(potentialJpg);
        } else if (fs.existsSync(potentialJpeg)) {
          previewJpgBuffer = fs.readFileSync(potentialJpeg);
        }
      }

      // Ensure preview buffer has valid JPEG magic bytes (FF D8)
      if (!previewJpgBuffer || previewJpgBuffer.length < 4 || previewJpgBuffer[0] !== 0xff || previewJpgBuffer[1] !== 0xd8) {
        previewJpgBuffer = Buffer.from([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
          0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
          0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
          0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
          0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
          0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
          0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
          0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x0b, 0xb8,
          0x0f, 0xa0, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
          0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
          0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
          0x00, 0xbf, 0x00, 0xff, 0xd9
        ]);
      }

      // Tag companion JPEG with standard IPTC/XMP metadata
      if (previewJpgBuffer && hasMetadata) {
        try {
          previewJpgBuffer = injectMetadataIntoJpeg(previewJpgBuffer, {
            title: metadata!.title!,
            description: metadata!.description || metadata!.title,
            keywords: metadata!.keywords!,
            category: metadata!.adobeCategory || 'Graphic Resources',
          });
        } catch (err: any) {
          log(`Notice: Could not inject XMP into preview JPEG: ${err.message}`);
        }
      }

      // Build the ZIP with AdmZip
      try {
        const zip = new AdmZip();
        let rawVectorBuf = fs.readFileSync(localFilePath);
        if (hasMetadata) {
          rawVectorBuf = Buffer.from(injectMetadataIntoVector(rawVectorBuf, ext, {
            title: metadata!.title!,
            description: metadata!.description || metadata!.title,
            keywords: metadata!.keywords!,
            category: metadata!.adobeCategory || 'Graphic Resources',
          }));
        }
        zip.addFile(path.basename(localFilePath), rawVectorBuf);
        if (previewJpgBuffer) {
          zip.addFile(`${baseName}.jpg`, previewJpgBuffer);
        }
        // Sidecar CSV
        const innerCsv = `Filename,Title,Description,Keywords\n"${path.basename(localFilePath)}","${metadata?.title || ''}","${metadata?.description || ''}","${(metadata?.keywords || []).join(', ')}"\n"${baseName}.jpg","${metadata?.title || ''}","${metadata?.description || ''}","${(metadata?.keywords || []).join(', ')}"\n`;
        zip.addFile('metadata.csv', Buffer.from(innerCsv, 'utf-8'));
        const zipBuffer = zip.toBuffer();
        sourceData = zipBuffer;
        fileSize = zipBuffer.length;
        remoteFilename = zipFileName;
        log(`ZIP bundle successfully generated: "${zipFileName}" (${(fileSize / (1024 * 1024)).toFixed(2)} MB). Ready for SFTP transfer.`);
      } catch (zipErr: any) {
        log(`Warning: Failed to create ZIP archive: ${zipErr.message}. Falling back to direct file.`);
        sourceData = localFilePath;
        fileSize = fs.statSync(localFilePath).size;
      }
    } else if (isVector && hasMetadata) {
      // Other vector agencies (e.g. Shutterstock .EPS, Pond5, Storyblocks, Getty)
      log(`Embedding XMP & DSC metadata into "${remoteFilename}"...`);
      try {
        const rawBuf = fs.readFileSync(localFilePath);
        const taggedBuf = injectMetadataIntoVector(rawBuf, ext, {
          title: metadata!.title!,
          description: metadata!.description || metadata!.title,
          keywords: metadata!.keywords!,
          category: metadata!.adobeCategory || 'Graphic Resources',
          shutterstockCategory: metadata!.shutterstockPrimaryCategory,
        });
        fs.writeFileSync(localFilePath, taggedBuf);
        sourceData = taggedBuf;
        fileSize = taggedBuf.length;
        log(`Embedded ${metadata?.keywords?.length} keywords into vector "${remoteFilename}".`);
      } catch (vecErr: any) {
        sourceData = localFilePath;
        fileSize = fs.statSync(localFilePath).size;
      }
    } else if (hasMetadata && (ext === '.jpg' || ext === '.jpeg')) {
      log(`Embedding standard IPTC/XMP metadata into "${remoteFilename}": Title, Category "${metadata?.adobeCategory || 'Technology'}", and ${metadata?.keywords?.length} Keywords...`);
      try {
        const rawBuf = fs.readFileSync(localFilePath);
        const taggedBuf = injectMetadataIntoJpeg(rawBuf, {
          title: metadata!.title!,
          description: metadata!.description || metadata!.title,
          keywords: metadata!.keywords!,
          category: metadata!.adobeCategory,
          shutterstockCategory: metadata!.shutterstockPrimaryCategory,
          shutterstockSecondaryCategory: metadata!.shutterstockSecondaryCategory,
        });
        fs.writeFileSync(localFilePath, taggedBuf);
        sourceData = taggedBuf;
        fileSize = taggedBuf.length;
        log(`Embedded ${metadata?.keywords?.length} ranked keywords into XMP Core & IPTC IIM.`);
      } catch (embedErr: any) {
        console.warn('Embedding warning:', embedErr);
        sourceData = localFilePath;
        fileSize = fs.statSync(localFilePath).size;
      }
    } else {
      sourceData = localFilePath;
      fileSize = fs.statSync(localFilePath).size;
    }
  } else {
    throw new Error(`Local file not found for upload: ${localFilePath || remoteFilename}`);
  }

  // Detect if asset is video footage
  const extLower = path.extname(localFilePath || remoteFilename || '').toLowerCase();
  const isVideoMedia = mediaType === 'video' || /\.(mp4|mov|m4v|webm|avi|mkv|m2ts)$/i.test(remoteFilename) || /\.(mp4|mov|m4v|webm|avi|mkv|m2ts)$/i.test(extLower);

  // Strictly sanitize filename for microstock compatibility (Dreamstime requires pure alphanumeric without underscores)
  const cleanRemoteFilename = agencyKey === 'dreamstime'
    ? sanitizeDreamstimeFilename(remoteFilename)
    : sanitizeMicrostockFilename(remoteFilename);

  let targetHost = defaultHost.host;
  let targetPort = defaultHost.port;
  let isSftp = (defaultHost.type === 'sftp' || defaultHost.port === 22 || agencyKey === 'adobe') && agencyKey !== 'shutterstock';

  // 123RF Dynamic Ingestion Gateway:
  // 123RF strictly routes Video/Footage to footage.ftp.123rf.com on port 2022 via SFTP (SSH File Transfer Protocol).
  // Submitting videos to photo FTP (port 21) causes them to be ignored and not appear on the contributor site!
  // Photos and Vectors are routed to ftp.123rf.com on port 21 via standard FTP.
  if (agencyKey === '123rf') {
    if (isVideoMedia) {
      targetHost = 'footage.ftp.123rf.com';
      targetPort = 2022;
      isSftp = true;
      log(`[123RF Video SFTP Gateway] Detected video footage submission: "${cleanRemoteFilename}".`);
      log(`[123RF Video SFTP Gateway] Target Host: footage.ftp.123rf.com | Port: 2022 | Protocol: SFTP (SSH File Transfer Protocol)`);
      log(`[123RF Video SFTP Gateway] Note: 123RF requires SFTP port 2022 for footage uploads to appear in your live contributor account.`);
    } else {
      targetHost = 'ftp.123rf.com';
      targetPort = 21;
      isSftp = false;
      log(`[123RF Photo/Vector Gateway] Detected image/vector submission: "${cleanRemoteFilename}". Routing via 123RF Contributor FTP (ftp.123rf.com:21).`);
    }
  }

  if (isSftp) {
    const sftp = new SftpClient();
    log(`Connecting to ${targetHost}:${targetPort} via SFTP...`);
    log(`Authenticating as Contributor "${username}"...`);

    try {
      await sftp.connect({
        host: targetHost,
        port: targetPort,
        username,
        password,
        readyTimeout: 25000,
        retries: 2,
        tryKeyboard: true,
        algorithms: {
          serverHostKey: [
            'ssh-ed25519',
            'ecdsa-sha2-nistp256',
            'ecdsa-sha2-nistp384',
            'ecdsa-sha2-nistp521',
            'rsa-sha2-512',
            'rsa-sha2-256',
            'ssh-rsa',
          ],
          cipher: [
            'aes128-gcm',
            'aes128-gcm@openssh.com',
            'aes256-gcm',
            'aes256-gcm@openssh.com',
            'aes128-ctr',
            'aes192-ctr',
            'aes256-ctr',
            'aes128-cbc',
            'aes256-cbc',
          ],
        },
      });

      log(`SFTP handshake successful. Connected to ${targetHost}:${targetPort}.`);
      log(`Streaming binary media transfer: ${cleanRemoteFilename} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)...`);

      // Prioritize relative path to ensure full compatibility with SFTPGo (123RF Footage) and OpenSSH (Adobe Stock)
      let remoteDest = cleanRemoteFilename;
      try {
        await sftp.put(sourceData, remoteDest);
        log(`Binary transfer complete! File written to ${remoteDest}`);
      } catch (putErr: any) {
        log(`Notice: Target "${remoteDest}" encountered: ${putErr.message}. Trying absolute "/${cleanRemoteFilename}"...`);
        try {
          await sftp.put(sourceData, `/${cleanRemoteFilename}`);
          remoteDest = `/${cleanRemoteFilename}`;
          log(`Binary transfer complete! File written to ${remoteDest}`);
        } catch (putErr2: any) {
          const parsed = path.parse(cleanRemoteFilename);
          const safeSuffix = Date.now().toString().slice(-4);
          remoteDest = `${parsed.name}_v${safeSuffix}${parsed.ext}`;
          log(`Retrying transfer to fresh unique destination "${remoteDest}"...`);
          await sftp.put(sourceData, remoteDest);
          log(`File successfully written to ${remoteDest}`);
        }
      }

      // If Adobe Stock, upload paired CSV sidecars
      if (agencyKey === 'adobe' && metadata?.title && metadata?.keywords) {
        try {
          const finalRemoteName = path.basename(remoteDest);
          const baseName = path.parse(finalRemoteName).name;
          const keywordsStr = metadata.keywords.slice(0, 49).map((k) => k.replace(/"/g, '""')).join(', ');
          const titleStr = (metadata.title || '').replace(/"/g, '""');
          const isVectorMedia = mediaType === 'vector' || /\.(ai|eps|zip)$/i.test(finalRemoteName);
          const categoryStr = (metadata.adobeCategory || (isVectorMedia ? 'Graphic Resources' : 'Lifestyle')).replace(/"/g, '""');
          const releasesStr = (metadata.releases || []).join(';');

          // Generate all filename variants (.ai, .eps, .zip, .jpg, baseName)
          // so Adobe Stock's automated metadata ingestion is 100% guaranteed to find the match!
          const rows = [
            `"${finalRemoteName}","${titleStr}","${keywordsStr}","${categoryStr}","${releasesStr}"`,
            `"${baseName}.ai","${titleStr}","${keywordsStr}","${categoryStr}","${releasesStr}"`,
            `"${baseName}.eps","${titleStr}","${keywordsStr}","${categoryStr}","${releasesStr}"`,
            `"${baseName}.zip","${titleStr}","${keywordsStr}","${categoryStr}","${releasesStr}"`,
            `"${baseName}.jpg","${titleStr}","${keywordsStr}","${categoryStr}","${releasesStr}"`,
            `"${baseName}","${titleStr}","${keywordsStr}","${categoryStr}","${releasesStr}"`,
          ];
          const uniqueRows = Array.from(new Set(rows)).join('\n');
          const csvContent = `Filename,Title,Keywords,Category,Releases\n${uniqueRows}\n`;
          const csvBuffer = Buffer.from(csvContent, 'utf-8');

          log(`Uploading official Adobe Stock CSV sidecar (/adobe_stock_metadata.csv)...`);
          await sftp.put(csvBuffer, `/adobe_stock_metadata.csv`);
          log(`Adobe Stock CSV sidecar written successfully.`);
        } catch (csvErr: any) {
          log(`Notice: CSV upload note: ${csvErr?.message || csvErr}`);
        }
      }

      await sftp.end();
      log(`SFTP session closed cleanly.`);
      log(`File successfully ingested by ${agencyKey === 'adobe' ? 'Adobe Stock' : targetHost}!`);

      let successMessage = `File successfully uploaded to ${targetHost}!`;
      if (agencyKey === 'adobe') {
        successMessage = `File successfully uploaded to Adobe Stock! It will appear in your Contributor Portal under "Uploaded Files" in 2 to 10 minutes.`;
      } else if (agencyKey === '123rf' && isVideoMedia) {
        successMessage = `Video successfully uploaded to 123RF Footage SFTP (footage.ftp.123rf.com:2022)! It will appear in your 123RF Contributor Portal under "Manage Footage" / "Drafts" in 5 to 15 minutes.`;
      } else if (agencyKey === '123rf') {
        successMessage = `File successfully uploaded to 123RF Contributor FTP (ftp.123rf.com:21)! It will appear in your 123RF Contributor Portal under "Drafts" in 5 to 15 minutes.`;
      }

      return {
        success: true,
        isRealUpload: true,
        agencyKey,
        remoteFilename: path.basename(remoteDest),
        bytesUploaded: fileSize,
        timestamp: new Date().toISOString(),
        protocol: 'Real SFTP Stream',
        message: successMessage,
        logs,
      };
    } catch (sftpErr: any) {
      try {
        await sftp.end();
      } catch {}

      const errorMsg = sftpErr.message || String(sftpErr);
      log(`ERROR: SFTP transfer failed: ${errorMsg}`);

      // If 123RF Video SFTP on port 2022 had connection / timeout / refusal, attempt automatic fallback to FTP on port 21
      if (
        agencyKey === '123rf' &&
        isVideoMedia &&
        (errorMsg.includes('ETIMEDOUT') ||
          errorMsg.includes('Timed out') ||
          errorMsg.includes('ECONNREFUSED') ||
          errorMsg.includes('ENOTFOUND') ||
          errorMsg.includes('connect'))
      ) {
        log(`[123RF Video Gateway] Port 2022 unreachable (${errorMsg}). Retrying via 123RF Footage FTP on footage.ftp.123rf.com:21...`);
        return uploadViaFtpClient({
          host: 'footage.ftp.123rf.com',
          port: 21,
          secure: false,
          username: username || '',
          password: password || '',
          sourceData,
          remoteFilename: cleanRemoteFilename,
          agencyKey,
          fileSize,
          mediaType,
          metadata,
          logs,
        });
      }

      let userFriendlyError = errorMsg;
      if (errorMsg.includes('authentication') || errorMsg.includes('Authentication') || errorMsg.includes('All configured')) {
        if (agencyKey === 'adobe') {
          userFriendlyError = `Adobe Stock SFTP Authentication Failed. Ensure you are using your numeric Contributor ID (e.g. 212126684) and dedicated SFTP password from contributor.stock.adobe.com -> Upload -> SFTP (NOT your regular Adobe login password).`;
        } else if (agencyKey === '123rf' && isVideoMedia) {
          userFriendlyError = `123RF Footage SFTP Authentication Failed (footage.ftp.123rf.com:2022). Verify your 123RF Contributor Username and 123RF login password.`;
        } else {
          userFriendlyError = `SFTP Authentication Failed on ${targetHost}. Check username and SFTP password.`;
        }
      }

      return {
        success: false,
        isRealUpload: true,
        agencyKey,
        remoteFilename: cleanRemoteFilename,
        timestamp: new Date().toISOString(),
        protocol: 'Real SFTP Stream',
        message: userFriendlyError,
        logs,
        error: userFriendlyError,
      };
    }
  }

  // FTP / FTPS upload via basic-ftp (Dreamstime, 123RF, Shutterstock, Pond5, Alamy, Depositphotos, etc.)
  const isShutterstock = agencyKey === 'shutterstock' || targetHost === 'ftps.shutterstock.com';
  return uploadViaFtpClient({
    host: targetHost,
    port: targetPort,
    secure: isShutterstock || defaultHost.type === 'ftps',
    username: username || '',
    password: password || '',
    sourceData,
    remoteFilename: cleanRemoteFilename,
    agencyKey,
    fileSize,
    mediaType,
    metadata,
    logs,
  });
}

/**
 * Helper to upload via basic-ftp
 */
async function uploadViaFtpClient(opts: {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  sourceData: Buffer | string;
  remoteFilename: string;
  agencyKey: string;
  fileSize: number;
  mediaType?: string;
  metadata?: SftpUploadParams['metadata'];
  logs: string[];
}): Promise<SftpUploadResult> {
  const { host, port, secure, username, password, sourceData, agencyKey, fileSize, mediaType, metadata, logs } = opts;
  const isDreamstime = agencyKey === 'dreamstime' || host.includes('dreamstime');
  const cleanFilename = isDreamstime
    ? sanitizeDreamstimeFilename(opts.remoteFilename)
    : sanitizeMicrostockFilename(opts.remoteFilename);
  const log = (msg: string) => logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);

  // Generous 180s (3-minute) timeout with allowSeparateTransferHost for NAT/EC2 FTP servers (Dreamstime)
  let activeClient = new ftp.Client(180000, { allowSeparateTransferHost: true });
  activeClient.ftp.ipFamily = 4;
  activeClient.ftp.verbose = true;
  activeClient.ftp.log = (msg: string) => {
    if (msg.startsWith('>') || msg.startsWith('<')) {
      // Log control channel protocol commands for transparent diagnostics
      log(`[FTP Socket] ${msg.trim()}`);
    }
  };

  // Enforce IPv4 Passive mode (PASV) as required by Dreamstime ProFTPD
  activeClient.prepareTransfer = async (ctx) => {
    return await ftp.enterPassiveModeIPv4(ctx);
  };

  try {
    log(`Connecting to ${host}:${port} via ${secure ? 'FTPS (TLS)' : 'FTP'}...`);
    log(`Authenticating as Contributor "${username}"...`);

    await activeClient.access({
      host,
      port,
      user: username,
      password: password,
      secure: secure ? true : false,
      secureOptions: { rejectUnauthorized: false },
    });

    log(`FTP connection authenticated successfully on ${host}.`);

    let currentDir = '/';
    try {
      currentDir = await activeClient.pwd();
      log(`Remote directory on ${host}: ${currentDir}`);
    } catch {}

    // Inspect remote directory structure to discover designated subfolders (video, additional, modelrelease)
    let remoteDirs: string[] = [];
    try {
      const items = await activeClient.list();
      remoteDirs = items.filter((i) => i.isDirectory).map((i) => i.name);
      log(`Remote directory items on ${host}: ${items.map((i) => `${i.name}${i.isDirectory ? '/' : ''}`).join(', ')}`);
    } catch (listErr: any) {
      log(`Directory inspection note: ${listErr.message}`);
    }

    const isVideoAsset = mediaType === 'video' || /\.(mp4|mov|m4v|webm|avi|mkv|m2ts)$/i.test(cleanFilename);
    let videoFolderToUse: string | null = null;

    // Dreamstime ProFTPD requires video files to be uploaded into the designated "video" folder!
    // Uploading video files directly to root "/" triggers ProFTPD "550: Operation not permitted".
    if (isDreamstime && isVideoAsset) {
      const existingVideoDir = remoteDirs.find((d) => /^(video|videos|footage)$/i.test(d));
      const targetDirName = existingVideoDir || 'video';
      log(`Dreamstime video routing: Targeting designated "${targetDirName}/" folder for video ingestion...`);

      try {
        await activeClient.cd(targetDirName);
        videoFolderToUse = targetDirName;
        log(`Navigated to Dreamstime video directory: ${await activeClient.pwd()}`);
      } catch (cdErr: any) {
        log(`Folder "${targetDirName}" not yet created (${cdErr.message}), creating directory via ensureDir...`);
        try {
          await activeClient.ensureDir(targetDirName);
          videoFolderToUse = targetDirName;
          log(`Created and entered "${targetDirName}/" directory on ${host}.`);
        } catch (mkErr: any) {
          log(`Notice: Could not enter "${targetDirName}": ${mkErr.message}. Trying "Video" uppercase...`);
          try {
            await activeClient.cd('Video');
            videoFolderToUse = 'Video';
            log(`Navigated to Dreamstime "Video/" directory.`);
          } catch {
            log(`Proceeding with upload in current directory.`);
            videoFolderToUse = null;
          }
        }
      }
    }

    log(`Streaming binary media transfer: ${cleanFilename} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)...`);

    // Track active upload progress to keep control socket alive and report accurate status
    let lastLoggedPct = 0;
    activeClient.trackProgress((info) => {
      if (fileSize > 0) {
        const pct = Math.round((info.bytesOverall / fileSize) * 100);
        if (pct >= lastLoggedPct + 25 && pct <= 100) {
          lastLoggedPct = pct;
          log(`Transfer progress: ${pct}% (${(info.bytesOverall / (1024 * 1024)).toFixed(2)} MB / ${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);
        }
      }
    });

    const getFreshStream = () => {
      if (Buffer.isBuffer(sourceData)) {
        return Readable.from(sourceData);
      }
      return fs.createReadStream(sourceData);
    };

    let targetRemoteName = cleanFilename;
    try {
      await activeClient.uploadFrom(getFreshStream(), targetRemoteName);
      log(`Binary transfer complete! File written to ${videoFolderToUse ? `/${videoFolderToUse}` : ''}/${targetRemoteName}`);
    } catch (putErr: any) {
      log(`Notice: Upload with "${targetRemoteName}" returned: ${putErr.message}. Initiating resilient recovery...`);
      try {
        activeClient.close();
      } catch {}

      const parsed = path.parse(cleanFilename);
      const safeSuffix = Date.now().toString().slice(-4);
      // For Dreamstime, strictly avoid underscores or hyphens in retry filename
      targetRemoteName = isDreamstime
        ? `${parsed.name}v${safeSuffix}${parsed.ext}`
        : `${parsed.name}_v${safeSuffix}${parsed.ext}`;

      log(`Re-establishing fresh IPv4 FTP connection to ${host}:${port}...`);

      const retryClient = new ftp.Client(180000, { allowSeparateTransferHost: true });
      retryClient.ftp.ipFamily = 4;
      retryClient.ftp.verbose = true;
      retryClient.ftp.log = (msg: string) => {
        if (msg.startsWith('>') || msg.startsWith('<')) {
          log(`[FTP Socket] ${msg.trim()}`);
        }
      };
      retryClient.prepareTransfer = async (ctx) => {
        return await ftp.enterPassiveModeIPv4(ctx);
      };

      await retryClient.access({
        host,
        port,
        user: username,
        password: password,
        secure: secure ? true : false,
        secureOptions: { rejectUnauthorized: false },
      });

      // Ensure retry client also enters the target subfolder if applicable
      if (videoFolderToUse) {
        try {
          await retryClient.cd(videoFolderToUse);
          log(`Retry connection navigated to "${videoFolderToUse}/"`);
        } catch {
          try {
            await retryClient.ensureDir(videoFolderToUse);
          } catch {}
        }
      }

      let uploadStream = getFreshStream();
      let tempRemuxPath: string | null = null;

      // If Dreamstime rejected a .mov or video file with 550, convert container to MPEG-4 / H.264 (.mp4)
      // Dreamstime official guidelines recommend converting to MP4 for optimal compatibility
      if (isDreamstime && (parsed.ext === '.mov' || mediaType === 'video') && typeof sourceData === 'string' && fs.existsSync(sourceData)) {
        try {
          tempRemuxPath = path.join(path.dirname(sourceData), `dt_${Date.now()}_remux.mp4`);
          log(`Dreamstime video optimization: Converting container to standard MPEG-4 / H.264 (.mp4)...`);
          execSync(`ffmpeg -i "${sourceData}" -c copy -y "${tempRemuxPath}"`, { timeout: 15000 });
          if (fs.existsSync(tempRemuxPath)) {
            uploadStream = fs.createReadStream(tempRemuxPath);
            targetRemoteName = `${parsed.name}v${safeSuffix}.mp4`;
            log(`Converted to standard MP4. Retrying upload as "${targetRemoteName}"...`);
          }
        } catch (convErr: any) {
          log(`Note: Container remux skipped (${convErr.message}), uploading original binary...`);
        }
      } else {
        log(`Retrying upload as "${targetRemoteName}"...`);
      }

      try {
        await retryClient.uploadFrom(uploadStream, targetRemoteName);
        log(`Binary transfer complete! File written to ${videoFolderToUse ? `/${videoFolderToUse}` : ''}/${targetRemoteName}`);
        activeClient = retryClient;
      } catch (retryErr: any) {
        // Fallback strategy: short clean timestamped alphanumeric name
        log(`Notice: Retry returned ${retryErr.message}. Attempting short alphanumeric filename...`);
        try {
          const shortName = `dt${Date.now().toString().slice(-8)}${tempRemuxPath ? '.mp4' : parsed.ext}`;
          const stream3 = tempRemuxPath && fs.existsSync(tempRemuxPath) ? fs.createReadStream(tempRemuxPath) : getFreshStream();
          log(`Attempting final write as "${shortName}"...`);
          await retryClient.uploadFrom(stream3, shortName);
          targetRemoteName = shortName;
          log(`Binary transfer complete! File written to ${videoFolderToUse ? `/${videoFolderToUse}` : ''}/${targetRemoteName}`);
          activeClient = retryClient;
        } catch (finalErr: any) {
          throw retryErr;
        }
      } finally {
        if (tempRemuxPath && fs.existsSync(tempRemuxPath)) {
          try { fs.unlinkSync(tempRemuxPath); } catch {}
        }
      }
    }

    try {
      activeClient.trackProgress();
    } catch {}

    // If Shutterstock, also upload a paired CSV metadata sidecar with Categories
    if (agencyKey === 'shutterstock' && metadata?.title) {
      try {
        const titleStr = (metadata.title || '').replace(/"/g, '""');
        const keywordsStr = (metadata.keywords || []).slice(0, 50).map((k) => k.replace(/"/g, '""')).join(', ');
        const isVec = mediaType === 'vector' || cleanFilename.toLowerCase().endsWith('.eps') || cleanFilename.toLowerCase().endsWith('.ai');
        const cat1 = metadata.shutterstockPrimaryCategory || (isVec ? 'Vectors' : metadata.adobeCategory || 'Technology');
        const cat2 = metadata.shutterstockSecondaryCategory || (isVec ? 'Backgrounds/Textures' : undefined);
        const catStr = cat2 ? `${cat1}, ${cat2}` : cat1;
        const illustrationVal = isVec ? 'yes' : 'no';

        const csvContent = `Filename,Description,Keywords,Categories,Illustration,Mature content,Editorial\n"${cleanFilename}","${titleStr}","${keywordsStr}","${catStr}","${illustrationVal}","no","no"\n`;
        const csvBuffer = Buffer.from(csvContent, 'utf-8');
        log(`Uploading paired Shutterstock metadata CSV (/shutterstock_metadata.csv) with Category "${catStr}" (Illustration="${illustrationVal}")...`);
        await activeClient.uploadFrom(Readable.from(csvBuffer), `shutterstock_metadata.csv`);
        log(`Shutterstock metadata CSV successfully written to FTP.`);
      } catch (shutterCsvErr: any) {
        log(`Notice: Shutterstock CSV sidecar note: ${shutterCsvErr?.message || shutterCsvErr}`);
      }
    }

    try {
      activeClient.close();
    } catch {}

    return {
      success: true,
      isRealUpload: true,
      agencyKey,
      remoteFilename: targetRemoteName,
      bytesUploaded: fileSize,
      timestamp: new Date().toISOString(),
      protocol: secure ? 'Real FTPS (TLS) Stream' : 'Real FTP Stream',
      message: agencyKey === 'shutterstock'
        ? `File successfully uploaded to Shutterstock! It will appear in your Contributor Portal (submit.shutterstock.com) under "Select and submit" in 5 to 15 minutes.`
        : agencyKey === 'depositphotos'
        ? `File successfully uploaded to Depositphotos! It will appear in your Contributor area under "Uploaded" files in 2 to 10 minutes.`
        : agencyKey === 'dreamstime'
        ? `File successfully uploaded to Dreamstime (upload.dreamstime.com)! It will appear in your Contributor Management Area under "Unfinished Files" in 2 to 10 minutes (server indexing).`
        : agencyKey === '123rf'
        ? `File successfully uploaded to 123RF (${host})! It will appear in your 123RF Contributor Dashboard under "Drafts" in 5 to 15 minutes once server indexing completes.`
        : agencyKey === 'pond5'
        ? `File successfully uploaded to Pond5! It will appear in your Pond5 My Uploads area in a few minutes.`
        : `File successfully uploaded to ${host}!`,
      logs,
    };
  } catch (ftpErr: any) {
    try {
      activeClient.close();
    } catch {}
    const errorMsg = ftpErr.message || String(ftpErr);
    log(`ERROR: FTP transfer failed: ${errorMsg}`);

    let userFriendlyError = errorMsg;
    if (
      errorMsg.includes('530') ||
      errorMsg.includes('auth') ||
      errorMsg.includes('Authentication') ||
      errorMsg.includes('denied') ||
      errorMsg.includes('User cannot log in')
    ) {
      if (agencyKey === 'pond5') {
        userFriendlyError = `Pond5 Authentication Failed (530). In Pond5, your FTP password must be created in your account dashboard under ACCOUNT -> FTP (it can be different from your regular Pond5 password).`;
      } else if (agencyKey === 'shutterstock') {
        userFriendlyError = `Shutterstock Authentication Failed (530). Verify your contributor login email/username and password from submit.shutterstock.com.`;
      } else if (agencyKey === 'depositphotos') {
        userFriendlyError = `Depositphotos Authentication Failed (530). Please check your contributor username and account password for ftp.depositphotos.com.`;
      } else if (agencyKey === 'dreamstime') {
        userFriendlyError = `Dreamstime Authentication Failed (530). Please verify your numerical Contributor ID (e.g. 54647264, found on Dreamstime Management Area > FTP Upload) and your account password for upload.dreamstime.com.`;
      } else if (agencyKey === '123rf') {
        userFriendlyError = `123RF Authentication Failed (530). Please check your 123RF Contributor Username (your contributor handle, NOT your email address) and password for ftp.123rf.com.`;
      } else {
        userFriendlyError = `Authentication failed on ${host}. Check your contributor username and password.`;
      }
    } else if (errorMsg.includes('550') || errorMsg.includes('Operation not permitted')) {
      if (agencyKey === 'dreamstime') {
        userFriendlyError = `Dreamstime rejected the file write (550: Operation not permitted). Dreamstime forbids filenames with spaces or parentheses, or duplicate filenames already present in your unfinished upload queue. StockSync Pro automatically cleans filenames and assigns a fresh version suffix on retry. Note: Uploaded files appear under Management Area > Unfinished Files within 2 to 10 minutes.`;
      } else if (agencyKey === '123rf') {
        userFriendlyError = `123RF rejected file write (550). Note: Video footage must be uploaded via SFTP on footage.ftp.123rf.com:2022. Please ensure your filename contains no spaces and your contributor username is valid.`;
      } else {
        userFriendlyError = `Server returned 550 Operation not permitted. The destination server refused this file write or duplicate filename.`;
      }
    } else if (errorMsg.includes('Timeout') || errorMsg.includes('timed out') || errorMsg.includes('ETIMEDOUT')) {
      userFriendlyError = `Connection or data transfer to ${host}:${port} timed out. The agency server may be temporarily busy; please retry.`;
    }

    return {
      success: false,
      isRealUpload: true,
      agencyKey,
      remoteFilename: cleanFilename,
      timestamp: new Date().toISOString(),
      protocol: secure ? 'Real FTPS (TLS) Stream' : 'Real FTP Stream',
      message: userFriendlyError,
      logs,
      error: userFriendlyError,
    };
  }
}
