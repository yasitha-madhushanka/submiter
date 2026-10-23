import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';
import { testAgencySftp, uploadMediaToAgencySftp } from './server/sftpService.ts';
import { ensureSampleFilesExist } from './server/mediaSeed.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
ensureSampleFilesExist(uploadsDir);

// Static uploads serving
app.use('/uploads', express.static(uploadsDir));

// Multer storage for incoming contributor media
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, cleanName);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB support
});

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Initialize Gemini SDK with User-Agent header per skill guidelines
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Agency configurations & specifications
export const AGENCY_CONFIGS: Record<string, {
  name: string;
  key: string;
  category: 'direct' | 'syndication';
  minKeywords: number;
  maxKeywords: number;
  minMegapixels: number;
  requiresCategory: boolean;
  supportsVideo: boolean;
  supportsPhoto: boolean;
  supportsVector: boolean;
  ftpHost: string;
  apiEndpoint: string;
}> = {
  adobe: {
    name: 'Adobe Stock',
    key: 'adobe',
    category: 'direct',
    minKeywords: 5,
    maxKeywords: 49,
    minMegapixels: 4.0,
    requiresCategory: true,
    supportsVideo: true,
    supportsPhoto: true,
    supportsVector: true,
    ftpHost: 'sftp.contributor.adobestock.com:22',
    apiEndpoint: 'https://stock.adobe.io/Rest/Libraries/Contributor/v1',
  },
  shutterstock: {
    name: 'Shutterstock',
    key: 'shutterstock',
    category: 'direct',
    minKeywords: 7,
    maxKeywords: 50,
    minMegapixels: 4.0,
    requiresCategory: true,
    supportsVideo: true,
    supportsPhoto: true,
    supportsVector: true,
    ftpHost: 'ftps.shutterstock.com:21',
    apiEndpoint: 'https://api.shutterstock.com/v2/contributors',
  },
  blackbox: {
    name: 'BlackBox',
    key: 'blackbox',
    category: 'syndication',
    minKeywords: 40,
    maxKeywords: 50,
    minMegapixels: 8.0,
    requiresCategory: false,
    supportsVideo: true,
    supportsPhoto: false,
    supportsVector: false,
    ftpHost: 'portal.blackbox.global:21',
    apiEndpoint: 'https://portal.blackbox.global/api/v1/footage',
  },
  storyblocks: {
    name: 'Storyblocks',
    key: 'storyblocks',
    category: 'direct',
    minKeywords: 10,
    maxKeywords: 45,
    minMegapixels: 4.0,
    requiresCategory: true,
    supportsVideo: true,
    supportsPhoto: true,
    supportsVector: true,
    ftpHost: 'ftp.storyblocks.com:21',
    apiEndpoint: 'https://api.storyblocks.com/v2/contributor',
  },
  getty: {
    name: 'Getty Images / iStock',
    key: 'getty',
    category: 'direct',
    minKeywords: 5,
    maxKeywords: 50,
    minMegapixels: 3.0,
    requiresCategory: true,
    supportsVideo: true,
    supportsPhoto: true,
    supportsVector: true,
    ftpHost: 'sftp.gettyimages.com:22',
    apiEndpoint: 'https://api.gettyimages.com/v3/esp/submissions',
  },
  pond5: {
    name: 'Pond5',
    key: 'pond5',
    category: 'direct',
    minKeywords: 10,
    maxKeywords: 50,
    minMegapixels: 2.0,
    requiresCategory: true,
    supportsVideo: true,
    supportsPhoto: true,
    supportsVector: true,
    ftpHost: 'ftp.pond5.com:21',
    apiEndpoint: 'https://api.pond5.com/v1/contributor/uploads',
  },
  alamy: {
    name: 'Alamy',
    key: 'alamy',
    category: 'direct',
    minKeywords: 10,
    maxKeywords: 50,
    minMegapixels: 6.0,
    requiresCategory: false,
    supportsVideo: true,
    supportsPhoto: true,
    supportsVector: true,
    ftpHost: 'upload.alamy.com:21',
    apiEndpoint: 'https://api.alamy.com/v1/submissions',
  },
  depositphotos: {
    name: 'Depositphotos',
    key: 'depositphotos',
    category: 'direct',
    minKeywords: 7,
    maxKeywords: 50,
    minMegapixels: 3.8,
    requiresCategory: true,
    supportsVideo: true,
    supportsPhoto: true,
    supportsVector: true,
    ftpHost: 'ftp.depositphotos.com:21',
    apiEndpoint: 'https://api.depositphotos.com/v3/contributor',
  },
  dreamstime: {
    name: 'Dreamstime',
    key: 'dreamstime',
    category: 'direct',
    minKeywords: 5,
    maxKeywords: 80,
    minMegapixels: 3.0,
    requiresCategory: true,
    supportsVideo: true,
    supportsPhoto: true,
    supportsVector: true,
    ftpHost: 'upload.dreamstime.com:21',
    apiEndpoint: 'https://www.dreamstime.com/uploadfile',
  },
  '123rf': {
    name: '123RF',
    key: '123rf',
    category: 'direct',
    minKeywords: 7,
    maxKeywords: 50,
    minMegapixels: 4.0,
    requiresCategory: false,
    supportsVideo: true,
    supportsPhoto: true,
    supportsVector: true,
    ftpHost: 'footage.ftp.123rf.com:2022 (Video SFTP) / ftp.123rf.com:21 (Images FTP)',
    apiEndpoint: 'https://www.123rf.com/contributors',
  },
};

// AI Metadata Generation Endpoint
app.post('/api/ai/metadata', async (req, res) => {
  try {
    const {
      filename,
      mediaType,
      fileSize,
      dimensions,
      customPrompt,
      imageBase64,
    } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const contents: any[] = [];
        
        let promptText = `You are a world-class professional microstock metadata & SEO specialist for Adobe Stock, Shutterstock, BlackBox, Storyblocks, Getty Images, Pond5, Alamy, and Depositphotos.
Analyze this ${mediaType === 'vector' ? 'scalable vector graphic illustration (.ai / .eps)' : mediaType} file named "${filename || 'stock_media'}".
${customPrompt ? `Context / Creator Notes: ${customPrompt}` : ''}
${dimensions ? `Dimensions: ${dimensions.width}x${dimensions.height}, Megapixels: ${dimensions.megapixels || 'N/A'}, Duration: ${dimensions.duration || 'N/A'}s` : ''}

Generate high-converting, compliant microstock submission metadata in JSON format:
1. title: 8 to 15 words, commercial stock search intent. Avoid clickbait, vague words like "best" or brand names.
2. description: 2-3 detailed sentences describing the scene, visual elements, composition, mood, subject, and commercial use.
3. keywords: Array of 45-50 distinct, highly relevant keywords. Sort in descending order of importance (the top 10 keywords are used by Adobe Stock and Alamy algorithms for primary search ranking!). Include synonyms, concepts, environment, technique, and mood.${mediaType === 'vector' ? ' Include vector-specific terms like "vector", "illustration", "graphic", "clipart", "eps", "scalable", "design element".' : ''}
4. adobeCategory: ${mediaType === 'vector' ? 'Must be "Graphic Resources"' : 'Choose strictly from: "Animals", "Buildings and Architecture", "Business", "Drinks", "The Environment", "States of Mind", "Food", "Graphic Resources", "Hobbies and Leisure", "Industry", "Landscape", "Lifestyle", "People", "Plants and Flowers", "Culture and Religion", "Science", "Social Issues", "Sports", "Technology", "Transport", "Travel"'}.
5. shutterstockPrimaryCategory: ${mediaType === 'vector' ? 'Must be "Vectors"' : 'Choose from Shutterstock taxonomy (e.g., "Technology", "Business/Finance", "Nature", "People", "Backgrounds/Textures", "Animals/Wildlife", "Buildings/Landmarks", "Food and Drink", "Industrial")'}.
6. shutterstockSecondaryCategory: Secondary appropriate category.
7. pond5Category: Pond5 category.
8. editorialRequired: boolean (true if recognizable real people in public without release, non-isolated trademarks, sports events, editorial context).
9. editorialReason: string explanation if editorial, or "" if commercial.
10. modelReleaseRequired: boolean (true if recognizable faces).
11. propertyReleaseRequired: boolean (true if private property, modern architecture, distinctive artwork).
12. isAiGenerated: boolean (false by default for photo/video uploads unless prompt specified).
13. alamyEssentialKeywords: Array of 5-8 topmost essential keywords for Alamy weighting.
14. suggestedPriceUsd: estimated USD price for Pond5 (e.g. 79 for 4K video, 15 for photo).
15. complianceNotes: Array of 2-3 inspection tips (e.g., "Ensure no trademark on laptop lid", "Check sensor noise in shadows").`;

        if (imageBase64 && imageBase64.includes('base64,')) {
          const splitData = imageBase64.split('base64,');
          const mime = splitData[0].split(':')[1].split(';')[0];
          const rawBase64 = splitData[1];
          contents.push({
            parts: [
              {
                inlineData: {
                  mimeType: mime || 'image/jpeg',
                  data: rawBase64,
                },
              },
              { text: promptText },
            ],
          });
        } else {
          contents.push(promptText);
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: contents[0],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                keywords: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                adobeCategory: { type: Type.STRING },
                shutterstockPrimaryCategory: { type: Type.STRING },
                shutterstockSecondaryCategory: { type: Type.STRING },
                pond5Category: { type: Type.STRING },
                editorialRequired: { type: Type.BOOLEAN },
                editorialReason: { type: Type.STRING },
                modelReleaseRequired: { type: Type.BOOLEAN },
                propertyReleaseRequired: { type: Type.BOOLEAN },
                isAiGenerated: { type: Type.BOOLEAN },
                alamyEssentialKeywords: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                suggestedPriceUsd: { type: Type.NUMBER },
                complianceNotes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: [
                'title',
                'description',
                'keywords',
                'adobeCategory',
                'shutterstockPrimaryCategory',
                'editorialRequired',
                'modelReleaseRequired',
              ],
            },
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text.trim());
          return res.json({
            success: true,
            source: 'gemini-3.8-flash',
            metadata: parsed,
          });
        }
      } catch (geminiErr: any) {
        console.warn('Gemini API call failed, switching to local smart heuristics:', geminiErr?.message);
      }
    }

    // Heuristic fallback for offline/preview or key missing
    const baseName = (filename || 'Commercial Stock Media')
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]/g, ' ')
      .trim();

    const fallbackKeywords = [
      'stock footage',
      'commercial photography',
      'high resolution',
      'creative concept',
      'modern lifestyle',
      'professional',
      'cinematic lighting',
      'copy space',
      'detail',
      'studio quality',
      'urban environment',
      'digital technology',
      'contemporary',
      'minimalist design',
      'vibrant colors',
      'textured surface',
      'industry',
      'business concept',
      'atmosphere',
      'depth of field',
      'authentic',
      'horizontal orientation',
      'visual storytelling',
      'creative asset',
      'editorial and commercial',
      '4k production',
      'premium quality',
      'motion',
      'energy',
      'clean background',
      'abstract composition',
      'sharp focus',
      'inspiring',
      'productivity',
      'workspace',
      'architecture',
      'nature and outdoors',
      'lighting contrast',
      'creative vision',
      'content creation',
      'agency ready',
      'microstock collection',
    ];

    const isVec = mediaType === 'vector';
    const fallbackMetadata = {
      title: `${baseName.charAt(0).toUpperCase() + baseName.slice(1)} - Professional Stock ${isVec ? 'Vector' : 'Asset'}`,
      description: isVec
        ? `Clean scalable vector graphic illustration of ${baseName.toLowerCase()} with editable paths, organized layers, and commercial copy space.`
        : `High-quality ${mediaType} production capturing ${baseName.toLowerCase()} with cinematic lighting, balanced composition, and commercial copy space.`,
      keywords: isVec ? ['vector', 'illustration', 'graphic', 'eps', 'design', ...fallbackKeywords] : fallbackKeywords,
      adobeCategory: isVec ? 'Graphic Resources' : mediaType === 'video' ? 'Technology' : 'Lifestyle',
      shutterstockPrimaryCategory: isVec ? 'Vectors' : 'Technology',
      shutterstockSecondaryCategory: isVec ? 'Backgrounds/Textures' : 'Business/Finance',
      pond5Category: isVec ? 'Illustrations & Vectors' : mediaType === 'video' ? 'Aerial & Landscape' : 'Business & Office',
      editorialRequired: false,
      editorialReason: '',
      modelReleaseRequired: false,
      propertyReleaseRequired: false,
      isAiGenerated: false,
      alamyEssentialKeywords: isVec ? ['vector', 'illustration', 'graphic', 'eps'] : fallbackKeywords.slice(0, 6),
      suggestedPriceUsd: mediaType === 'video' ? 79 : isVec ? 25 : 15,
      complianceNotes: [
        'Ensure all commercial logos and vehicle license plates are scrubbed',
        'Verify minimum resolution and 100% pixel sharpness before submission',
      ],
    };

    return res.json({
      success: true,
      source: 'heuristic-engine',
      metadata: fallbackMetadata,
    });
  } catch (err: any) {
    console.error('Metadata generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate metadata' });
  }
});

// Microstock Category Auto-Deduction from User CSV Title/Keywords
app.post('/api/metadata/categorize-csv', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided for categorization' });
    }

    // Attempt AI categorization using Gemini 3.8 Flash
    if (process.env.GEMINI_API_KEY) {
      try {
        const promptText = `Analyze the stock media titles and keywords below and assign the most accurate agency category according to standard microstock taxonomy:
1. adobeCategory: Must be strictly one of: "Animals", "Buildings and Architecture", "Business", "Drinks", "The Environment", "States of Mind", "Food", "Graphic Resources", "Hobbies and Leisure", "Industry", "Landscape", "Lifestyle", "People", "Plants and Flowers", "Culture and Religion", "Science", "Social Issues", "Sports", "Technology", "Transport", "Travel".
2. shutterstockPrimaryCategory: Choose from: "Animals/Wildlife", "Buildings/Landmarks", "Backgrounds/Textures", "Business/Finance", "Education", "Food and Drink", "Healthcare/Medical", "Holidays", "Industrial", "Nature", "People", "Religion", "Science", "Technology", "Signs/Symbols", "Sports/Recreation", "Transportation", "Vectors", "Vintage", "Parks/Outdoor", "Interiors", "Miscellaneous".
3. shutterstockSecondaryCategory: Secondary category.
4. pond5Category: Choose from: "Nature & Wildlife", "City & Architecture", "Business & Office", "Aerial & Drone", "People & Lifestyle", "Technology & Science", "Food & Hospitality", "Sports & Action", "Travel & Recreation".

Input items to categorize:
${JSON.stringify(
  items.slice(0, 50).map((it) => ({
    filename: it.filename,
    title: it.title,
    description: it.description || '',
    keywords: Array.isArray(it.keywords) ? it.keywords.slice(0, 20).join(', ') : it.keywords,
  }))
)}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: promptText,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  filename: { type: Type.STRING },
                  adobeCategory: { type: Type.STRING },
                  shutterstockPrimaryCategory: { type: Type.STRING },
                  shutterstockSecondaryCategory: { type: Type.STRING },
                  pond5Category: { type: Type.STRING },
                  editorialRequired: { type: Type.BOOLEAN },
                },
                required: ['filename', 'adobeCategory', 'shutterstockPrimaryCategory'],
              },
            },
          },
        });

        if (response.text) {
          const categorized = JSON.parse(response.text.trim());
          return res.json({
            success: true,
            source: 'gemini-3.8-flash',
            results: categorized,
          });
        }
      } catch (geminiErr: any) {
        console.warn('Gemini categorization failed, using smart taxonomy engine:', geminiErr?.message);
      }
    }

    // Smart Microstock Taxonomy Engine fallback
    const heuristicResults = items.map((it) => {
      const kwStr = Array.isArray(it.keywords) ? it.keywords.join(' ') : String(it.keywords || '');
      const text = `${it.title || ''} ${it.description || ''} ${kwStr}`.toLowerCase();

      let adobeCategory = 'Landscape';
      let shutterstockPrimaryCategory = 'Nature';
      let shutterstockSecondaryCategory = 'Parks/Outdoor';
      let pond5Category = 'Nature & Wildlife';

      if (
        text.includes('mountain') ||
        text.includes('landscape') ||
        text.includes('valley') ||
        text.includes('hills') ||
        text.includes('horizon') ||
        text.includes('sky') ||
        text.includes('cloud') ||
        text.includes('scenic')
      ) {
        adobeCategory = 'Landscape';
        shutterstockPrimaryCategory = 'Nature';
        shutterstockSecondaryCategory = 'Parks/Outdoor';
        pond5Category = 'Aerial & Drone';
      } else if (
        text.includes('tree') ||
        text.includes('forest') ||
        text.includes('flower') ||
        text.includes('plant') ||
        text.includes('foliage') ||
        text.includes('leaf')
      ) {
        adobeCategory = 'Plants and Flowers';
        shutterstockPrimaryCategory = 'Nature';
        shutterstockSecondaryCategory = 'Backgrounds/Textures';
        pond5Category = 'Nature & Wildlife';
      } else if (
        text.includes('animal') ||
        text.includes('dog') ||
        text.includes('cat') ||
        text.includes('bird') ||
        text.includes('wildlife') ||
        text.includes('safari')
      ) {
        adobeCategory = 'Animals';
        shutterstockPrimaryCategory = 'Animals/Wildlife';
        shutterstockSecondaryCategory = 'Nature';
        pond5Category = 'Nature & Wildlife';
      } else if (
        text.includes('business') ||
        text.includes('office') ||
        text.includes('meeting') ||
        text.includes('finance') ||
        text.includes('corporate') ||
        text.includes('currency')
      ) {
        adobeCategory = 'Business';
        shutterstockPrimaryCategory = 'Business/Finance';
        shutterstockSecondaryCategory = 'People';
        pond5Category = 'Business & Office';
      } else if (
        text.includes('tech') ||
        text.includes('computer') ||
        text.includes('software') ||
        text.includes('code') ||
        text.includes('screen') ||
        text.includes('ai') ||
        text.includes('digital')
      ) {
        adobeCategory = 'Technology';
        shutterstockPrimaryCategory = 'Technology';
        shutterstockSecondaryCategory = 'Business/Finance';
        pond5Category = 'Technology & Science';
      } else if (
        text.includes('food') ||
        text.includes('coffee') ||
        text.includes('meal') ||
        text.includes('dish') ||
        text.includes('cooking') ||
        text.includes('restaurant') ||
        text.includes('drink')
      ) {
        adobeCategory = text.includes('coffee') || text.includes('drink') ? 'Drinks' : 'Food';
        shutterstockPrimaryCategory = 'Food and Drink';
        shutterstockSecondaryCategory = 'Still Life';
        pond5Category = 'Food & Hospitality';
      } else if (
        text.includes('building') ||
        text.includes('architecture') ||
        text.includes('city') ||
        text.includes('street') ||
        text.includes('urban') ||
        text.includes('house')
      ) {
        adobeCategory = 'Buildings and Architecture';
        shutterstockPrimaryCategory = 'Buildings/Landmarks';
        shutterstockSecondaryCategory = 'Interiors';
        pond5Category = 'City & Architecture';
      } else if (
        text.includes('travel') ||
        text.includes('beach') ||
        text.includes('ocean') ||
        text.includes('sea') ||
        text.includes('vacation') ||
        text.includes('tourism')
      ) {
        adobeCategory = 'Travel';
        shutterstockPrimaryCategory = 'Parks/Outdoor';
        shutterstockSecondaryCategory = 'People';
        pond5Category = 'Travel & Recreation';
      } else if (
        text.includes('people') ||
        text.includes('person') ||
        text.includes('portrait') ||
        text.includes('woman') ||
        text.includes('man') ||
        text.includes('family') ||
        text.includes('child')
      ) {
        adobeCategory = 'People';
        shutterstockPrimaryCategory = 'People';
        shutterstockSecondaryCategory = 'Lifestyle';
        pond5Category = 'People & Lifestyle';
      }

      return {
        filename: it.filename,
        adobeCategory,
        shutterstockPrimaryCategory,
        shutterstockSecondaryCategory,
        pond5Category,
        editorialRequired: false,
      };
    });

    return res.json({
      success: true,
      source: 'smart-taxonomy-engine',
      results: heuristicResults,
    });
  } catch (err: any) {
    console.error('Categorize CSV error:', err);
    res.status(500).json({ error: err.message || 'Failed to categorize CSV items' });
  }
});

// Media upload endpoint (stores contributor image/video on server)
app.post('/api/media/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file received' });
    }

    let previewDataUrl: string | undefined = undefined;
    let isZipArchive = false;
    let detectedMediaType: 'image' | 'video' | 'vector' | undefined = undefined;
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === '.zip' || req.file.mimetype.includes('zip')) {
      isZipArchive = true;
      detectedMediaType = 'vector';
      try {
        const AdmZip = (await import('adm-zip')).default;
        const zip = new AdmZip(req.file.path);
        const entries = zip.getEntries();
        const jpgEntry = entries.find(
          (e) => /\.(jpg|jpeg)$/i.test(e.entryName) && !e.entryName.startsWith('__MACOSX')
        );
        if (jpgEntry) {
          const imgBuf = jpgEntry.getData();
          if (imgBuf.length > 4 && imgBuf[0] === 0xff && imgBuf[1] === 0xd8) {
            previewDataUrl = `data:image/jpeg;base64,${imgBuf.toString('base64')}`;
          }
        }
      } catch (zipErr) {
        console.warn('Could not inspect uploaded zip preview:', zipErr);
      }
    }

    return res.json({
      success: true,
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        url: `/uploads/${req.file.filename}`,
      },
      previewDataUrl,
      isZipArchive,
      mediaType: detectedMediaType,
    });
  } catch (err: any) {
    console.error('Media upload error:', err);
    res.status(500).json({ error: err.message || 'Media upload failed' });
  }
});

// Agency Credential Verification / Handshake
app.post('/api/agencies/verify', async (req, res) => {
  const { agencyKey, credentials } = req.body;
  const config = AGENCY_CONFIGS[agencyKey];

  if (!config) {
    return res.status(404).json({ error: `Unknown agency: ${agencyKey}` });
  }

  // If user provided SFTP credentials for an agency, test real SFTP connection
  if (credentials?.username && credentials?.ftpPassword && !credentials.username.includes('demo')) {
    const sftpTest = await testAgencySftp(agencyKey, {
      username: credentials.username,
      password: credentials.ftpPassword,
    });

    if (sftpTest.success) {
      return res.json({
        success: true,
        agency: config.name,
        agencyKey,
        status: 'connected',
        isRealConnection: true,
        latencyMs: sftpTest.latencyMs || 150,
        ftpHost: config.ftpHost,
        apiEndpoint: config.apiEndpoint,
        message: sftpTest.message,
        details: {
          accountTier: 'Live Verified Contributor',
          dailyQuotaRemaining: 150,
          verifiedAt: new Date().toISOString(),
        },
      });
    } else {
      return res.status(401).json({
        success: false,
        agency: config.name,
        agencyKey,
        status: sftpTest.status,
        message: sftpTest.message,
      });
    }
  }

  // Otherwise simulate handshake for demo credentials
  const latency = Math.floor(Math.random() * 180) + 100;
  await new Promise((r) => setTimeout(r, latency));

  const isValid = Boolean(
    credentials &&
    (credentials.apiKey || credentials.ftpPassword || credentials.token || credentials.autoAuth)
  );

  if (!isValid && !credentials?.allowDemo) {
    return res.status(401).json({
      success: false,
      agency: config.name,
      status: 'authentication_failed',
      message: 'Invalid credentials or API token missing.',
    });
  }

  return res.json({
    success: true,
    agency: config.name,
    agencyKey,
    status: 'connected',
    isRealConnection: false,
    latencyMs: latency,
    ftpHost: config.ftpHost,
    apiEndpoint: config.apiEndpoint,
    details: {
      accountTier: 'Sandbox Simulation Contributor',
      dailyQuotaRemaining: 150,
      activeSubmissions: 12,
      approvalRate: '94.8%',
      lastSync: new Date().toISOString(),
    },
  });
});

// Dedicated SFTP Connection Tester
app.post('/api/agencies/test-sftp', async (req, res) => {
  try {
    const agencyKey = req.body.agencyKey;
    const username = req.body.username || req.body.credentials?.username;
    const password = req.body.password || req.body.credentials?.password || req.body.credentials?.ftpPassword;
    const host = req.body.host || req.body.credentials?.host;
    const port = req.body.port || req.body.credentials?.port;

    if (!agencyKey) {
      return res.status(400).json({ success: false, error: 'Missing agencyKey', message: 'Missing agencyKey' });
    }

    const result = await testAgencySftp(agencyKey, {
      host,
      port,
      username,
      password,
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Connection test route exception:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Connection test failed',
      message: err.message || 'Connection test failed',
    });
  }
});

// Single Direct SFTP Upload Route
app.post('/api/agencies/upload-sftp', async (req, res) => {
  try {
    const { asset, agencyKey, credentials } = req.body;
    if (!asset || !agencyKey || !credentials) {
      return res.status(400).json({ error: 'Missing asset, agencyKey, or credentials' });
    }

    // Locate local file on disk
    let localFilePath = asset.serverFilePath;
    if (!localFilePath || !fs.existsSync(localFilePath)) {
      const candidate1 = path.join(uploadsDir, asset.filename);
      const candidate2 = path.join(uploadsDir, asset.filename.replace(/\.[^/.]+$/, '') + '.jpg');
      if (fs.existsSync(candidate1)) {
        localFilePath = candidate1;
      } else if (fs.existsSync(candidate2)) {
        localFilePath = candidate2;
      }
    }

    const uploadResult = await uploadMediaToAgencySftp({
      agencyKey,
      localFilePath,
      remoteFilename: asset.filename,
      credentials,
      mediaType: asset.mediaType,
      previewBase64: asset.fileDataUrl || asset.previewUrl,
      metadata: {
        title: asset.metadata?.title,
        description: asset.metadata?.description || asset.metadata?.title,
        keywords: asset.metadata?.keywords,
        adobeCategory: asset.metadata?.adobeCategory,
        shutterstockPrimaryCategory: asset.metadata?.shutterstockPrimaryCategory,
        shutterstockSecondaryCategory: asset.metadata?.shutterstockSecondaryCategory,
        releases: asset.metadata?.modelReleases,
      },
    });

    return res.json(uploadResult);
  } catch (err: any) {
    console.error('Direct SFTP upload error:', err);
    res.status(500).json({ error: err.message || 'Direct SFTP upload failed' });
  }
});

// Batch Submission Endpoint (Supports Real SFTP + Preflight Validation)
app.post('/api/agencies/submit-batch', async (req, res) => {
  try {
    const { assets, targetAgencies, credentials = {} } = req.body;

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({ error: 'No assets provided for batch submission' });
    }

    if (!targetAgencies || !Array.isArray(targetAgencies) || targetAgencies.length === 0) {
      return res.status(400).json({ error: 'No target agencies specified' });
    }

    const submissionResults: any[] = [];

    for (const asset of assets) {
      const assetResults: Record<string, any> = {};

      for (const agencyKey of targetAgencies) {
        const config = AGENCY_CONFIGS[agencyKey];
        if (!config) continue;

        // Perform agency compliance checks
        const warnings: string[] = [];
        const errors: string[] = [];

        // Media type check
        if (asset.mediaType === 'video' && !config.supportsVideo) {
          errors.push(`${config.name} does not accept video via this channel.`);
        }
        if (asset.mediaType === 'image' && !config.supportsPhoto) {
          errors.push(`${config.name} (BlackBox) exclusively accepts stock video / 4K footage.`);
        }
        if (asset.mediaType === 'vector') {
          if (!config.supportsVector) {
            errors.push(`${config.name} (BlackBox) exclusively accepts stock video / 4K footage.`);
          }
          if (agencyKey === 'shutterstock' && !asset.filename.toLowerCase().endsWith('.eps')) {
            errors.push('Shutterstock Contributor FTPS strictly requires vector submissions in .EPS format (compatible with Illustrator 8/10). Direct .AI files are rejected by Shutterstock. Please convert your artwork to .EPS or submit to Adobe Stock.');
          }
        }

        // Keywords check
        const kwCount = asset.metadata?.keywords?.length || 0;
        if (kwCount < config.minKeywords) {
          errors.push(`Requires at least ${config.minKeywords} keywords (current: ${kwCount}).`);
        }
        if (kwCount > config.maxKeywords) {
          warnings.push(`Keywords truncated from ${kwCount} to agency maximum ${config.maxKeywords}.`);
        }

        // Title check
        if (!asset.metadata?.title || asset.metadata.title.length < 5) {
          errors.push('Title must be at least 5 characters.');
        }

        // Resolution / MP check (scalable for vector)
        if (asset.mediaType !== 'vector' && asset.dimensions?.megapixels && asset.dimensions.megapixels < config.minMegapixels) {
          errors.push(`Resolution is ${asset.dimensions.megapixels.toFixed(1)}MP; ${config.name} requires minimum ${config.minMegapixels}MP.`);
        }

        const isApproved = errors.length === 0;
        const agencyCred = credentials[agencyKey] || {};
        const isRealCreds = Boolean(
          agencyCred.username &&
          agencyCred.ftpPassword &&
          !agencyCred.username.toLowerCase().includes('demo') &&
          !agencyCred.ftpPassword.toLowerCase().includes('demo')
        );

        let sftpDispatch: any = null;

        // If preflight passed AND real credentials exist, execute real SFTP transfer!
        if (isApproved && isRealCreds) {
          let localFilePath = asset.serverFilePath;
          if (!localFilePath || !fs.existsSync(localFilePath)) {
            const ext = path.extname(asset.filename).toLowerCase();
            const candidates = [
              path.join(uploadsDir, asset.filename),
              path.join(uploadsDir, path.basename(asset.filename)),
              path.join(uploadsDir, asset.filename.replace(/[^a-zA-Z0-9._-]/g, '_')),
              ...(asset.mediaType === 'vector'
                ? [
                    path.join(uploadsDir, asset.filename.replace(/\.[^/.]+$/, '') + '.eps'),
                    path.join(uploadsDir, asset.filename.replace(/\.[^/.]+$/, '') + '.ai'),
                    path.join(uploadsDir, asset.filename.replace(/\.[^/.]+$/, '') + '.zip'),
                  ]
                : [
                    path.join(uploadsDir, asset.filename.replace(/\.[^/.]+$/, '') + '.jpg'),
                    path.join(uploadsDir, asset.filename.replace(/\.[^/.]+$/, '') + '.zip'),
                  ]),
            ];
            for (const cand of candidates) {
              if (fs.existsSync(cand)) {
                localFilePath = cand;
                break;
              }
            }
            if (!localFilePath || !fs.existsSync(localFilePath)) {
              try {
                const files = fs.readdirSync(uploadsDir);
                const baseName = path.parse(asset.filename).name.toLowerCase();
                const matched = files.find((f) => f.toLowerCase().includes(baseName) || baseName.includes(path.parse(f).name.toLowerCase()));
                if (matched) {
                  localFilePath = path.join(uploadsDir, matched);
                }
              } catch (e) {
                // Ignore readdir error
              }
            }
          }

          // Cache companion JPEG preview for vector packaging if available
          if (asset.mediaType === 'vector' && asset.previewUrl && typeof asset.previewUrl === 'string' && asset.previewUrl.startsWith('data:image/')) {
            try {
              const commaIdx = asset.previewUrl.indexOf(',');
              if (commaIdx !== -1) {
                const base64Str = asset.previewUrl.slice(commaIdx + 1);
                const buf = Buffer.from(base64Str, 'base64');
                const baseName = path.parse(asset.filename).name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const companionJpg = path.join(uploadsDir, `${baseName}.jpg`);
                if (!fs.existsSync(companionJpg)) {
                  fs.writeFileSync(companionJpg, buf);
                }
              }
            } catch (err) {
              console.warn('[Server] Could not cache companion preview JPEG:', err);
            }
          }

          // If photo/video file not found on disk, attempt automatic recovery from data URL payload
          if ((!localFilePath || !fs.existsSync(localFilePath)) && asset.mediaType !== 'vector') {
            const rawDataUrl = (asset as any).fileDataUrl || asset.previewUrl;
            if (rawDataUrl && typeof rawDataUrl === 'string' && rawDataUrl.startsWith('data:')) {
              try {
                const commaIdx = rawDataUrl.indexOf(',');
                if (commaIdx !== -1) {
                  const base64Str = rawDataUrl.slice(commaIdx + 1);
                  const buf = Buffer.from(base64Str, 'base64');
                  if (buf.length > 500) {
                    const cleanTargetName = asset.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const savePath = path.join(uploadsDir, cleanTargetName);
                    fs.writeFileSync(savePath, buf);
                    localFilePath = savePath;
                    console.log(`[Server] Successfully recovered "${asset.filename}" (${buf.length} bytes) from client data URL!`);
                  }
                }
              } catch (recovErr) {
                console.warn('[Server] Could not recover from data URL:', recovErr);
              }
            }
          }

          if (!localFilePath || !fs.existsSync(localFilePath)) {
            const missingMsg = `Local media file "${asset.filename}" was not found on server storage. Please upload the media file via "Add Media" so real bytes exist to stream to ${config.name}.`;
            errors.push(missingMsg);
            sftpDispatch = {
              success: false,
              isRealUpload: true,
              agencyKey,
              remoteFilename: asset.filename,
              timestamp: new Date().toISOString(),
              protocol: config.ftpHost.includes('22') ? 'Real SFTP Stream' : 'Real FTPS/FTP Stream',
              message: missingMsg,
              logs: [`[${new Date().toLocaleTimeString()}] Local file not found on server disk: ${asset.filename}`],
              error: missingMsg,
            };
          } else {
            try {
              sftpDispatch = await uploadMediaToAgencySftp({
                agencyKey,
                localFilePath,
                remoteFilename: asset.filename,
                credentials: {
                  username: agencyCred.username,
                  ftpPassword: agencyCred.ftpPassword,
                },
                mediaType: asset.mediaType,
                previewBase64: (asset as any).fileDataUrl || asset.previewUrl,
                metadata: {
                  title: asset.metadata?.title,
                  description: asset.metadata?.description || asset.metadata?.title,
                  keywords: asset.metadata?.keywords,
                  adobeCategory: asset.metadata?.adobeCategory,
                  shutterstockPrimaryCategory: asset.metadata?.shutterstockPrimaryCategory,
                  shutterstockSecondaryCategory: asset.metadata?.shutterstockSecondaryCategory,
                  releases: asset.metadata?.modelReleases,
                },
              });
            } catch (dispatchErr: any) {
              const errMsg = dispatchErr.message || String(dispatchErr);
              errors.push(errMsg);
              sftpDispatch = {
                success: false,
                isRealUpload: true,
                agencyKey,
                remoteFilename: asset.filename,
                timestamp: new Date().toISOString(),
                protocol: config.ftpHost.includes('22') ? 'Real SFTP Stream' : 'Real FTPS/FTP Stream',
                message: errMsg,
                logs: [`[${new Date().toLocaleTimeString()}] Ingestion Exception: ${errMsg}`],
                error: errMsg,
              };
            }
          }
        }

        const submissionId = `${agencyKey.toUpperCase()}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

        const allErrors = [
          ...errors,
          ...(sftpDispatch?.error && !errors.includes(sftpDispatch.error) ? [sftpDispatch.error] : []),
        ];

        let status: 'submitted' | 'submitted_sandbox' | 'rejected_preflight' | 'rejected_sftp';
        let statusMessage: string;

        if (!isApproved) {
          status = 'rejected_preflight';
          statusMessage = allErrors[0] || `Preflight compliance check failed for ${config.name}.`;
        } else if (isRealCreds && sftpDispatch?.success) {
          status = 'submitted';
          statusMessage = sftpDispatch.message || `Uploaded successfully to ${config.name}!`;
        } else if (isRealCreds && sftpDispatch && !sftpDispatch.success) {
          status = 'rejected_sftp';
          statusMessage = sftpDispatch.error || sftpDispatch.message || allErrors[0] || `Transmission to ${config.name} failed.`;
        } else {
          status = 'submitted_sandbox';
          statusMessage = `Validated in Sandbox Mode. To see files in your ${config.name} Contributor dashboard, configure your real Contributor ID and password in Agency Settings.`;
        }

        const isRealSftp = Boolean(config.ftpHost && config.ftpHost.includes(':22'));
        const protocolStr = isRealCreds
          ? (isRealSftp ? 'Real SFTP Stream' : 'Real FTPS/FTP Stream')
          : 'Preflight Sandbox';

        assetResults[agencyKey] = {
          agencyName: config.name,
          submissionId,
          status,
          isRealUpload: isRealCreds && Boolean(sftpDispatch?.isRealUpload),
          bytesUploaded: sftpDispatch?.bytesUploaded,
          timestamp: new Date().toISOString(),
          errors: allErrors,
          warnings,
          message: statusMessage,
          logs: sftpDispatch?.logs || (allErrors.length > 0 ? allErrors.map((e) => `[${new Date().toLocaleTimeString()}] Preflight: ${e}`) : []),
          protocol: protocolStr,
          estimatedReviewDays: agencyKey === 'adobe' ? 3 : agencyKey === 'shutterstock' ? 2 : 5,
        };
      }

      submissionResults.push({
        assetId: asset.id,
        filename: asset.filename,
        agencies: assetResults,
      });
    }

    return res.json({
      success: true,
      batchId: `BATCH-${Date.now()}`,
      processedCount: assets.length,
      targetAgencies,
      results: submissionResults,
    });
  } catch (err: any) {
    console.error('Batch submission error:', err);
    res.status(500).json({ error: err.message || 'Batch submission failed' });
  }
});

// Applet health / info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    agenciesSupported: Object.keys(AGENCY_CONFIGS),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Start Express + Vite middleware
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StockSync Pro Server running at http://0.0.0.0:${PORT}`);
  });
}

start();
