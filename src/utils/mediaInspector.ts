import { AssetDimensions, StockAsset } from '../types';

export async function inspectMediaFile(file: File): Promise<{
  dimensions: AssetDimensions;
  previewUrl: string;
  mediaType: 'image' | 'video' | 'vector';
}> {
  const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
  const isZip = ext === 'zip' || file.type.includes('zip') || file.type.includes('compressed');
  const isVector = ext === 'ai' || ext === 'eps' || isZip || file.type.includes('postscript') || file.type.includes('illustrator');

  // Vector (.ai, .eps, .zip) inspection
  if (isVector) {
    const isAi = ext === 'ai';
    let width = 5000;
    let height = 3500;
    let codec = isZip ? 'Vector ZIP Archive (.zip)' : isAi ? 'Adobe Illustrator (.ai)' : 'Encapsulated PostScript (.eps)';

    try {
      const slice = file.slice(0, 65536);
      const text = await slice.text();

      // Check for EPS BoundingBox (%%BoundingBox: llx lly urx ury)
      const bboxMatch =
        text.match(/%%BoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i) ||
        text.match(/%%HiResBoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i);

      if (bboxMatch) {
        const parsedW = Math.abs(parseFloat(bboxMatch[3]) - parseFloat(bboxMatch[1]));
        const parsedH = Math.abs(parseFloat(bboxMatch[4]) - parseFloat(bboxMatch[2]));
        if (parsedW > 0 && parsedH > 0) {
          const scale = parsedW < 2000 ? Math.max(1, Math.round(4000 / parsedW)) : 1;
          width = Math.round(parsedW * scale);
          height = Math.round(parsedH * scale);
        }
      } else {
        const mediaBoxMatch = text.match(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/i);
        if (mediaBoxMatch) {
          const parsedW = Math.abs(parseFloat(mediaBoxMatch[3]) - parseFloat(mediaBoxMatch[1]));
          const parsedH = Math.abs(parseFloat(mediaBoxMatch[4]) - parseFloat(mediaBoxMatch[2]));
          if (parsedW > 0 && parsedH > 0) {
            const scale = parsedW < 2000 ? Math.max(1, Math.round(4000 / parsedW)) : 1;
            width = Math.round(parsedW * scale);
            height = Math.round(parsedH * scale);
          }
        }
      }

      const creatorMatch = text.match(/%%Creator:\s*([^\r\n]+)/i);
      if (creatorMatch) {
        codec = `${creatorMatch[1].trim()} (${isAi ? '.ai' : '.eps'})`;
      }
    } catch {
      // Fallback to default vector bounds
    }

    const megapixels = Number(((width * height) / 1000000).toFixed(2));
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height) || 1;
    const aspectRatio = `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;

    const previewUrl = generateVectorThumbnail(file.name, isZip ? 'zip' : isAi ? 'ai' : 'eps', width, height);

    return {
      dimensions: {
        width,
        height,
        megapixels,
        aspectRatio,
        codec,
      },
      previewUrl,
      mediaType: 'vector',
    };
  }

  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(file.name);

  if (isVideo) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const fileUrl = URL.createObjectURL(file);
      video.src = fileUrl;

      video.onloadedmetadata = () => {
        const width = video.videoWidth || 1920;
        const height = video.videoHeight || 1080;
        const megapixels = Number(((width * height) / 1000000).toFixed(2));
        const duration = Number(video.duration.toFixed(1));
        const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
        const divisor = gcd(width, height);
        const aspectRatio = `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;

        // Seek slightly to capture frame for preview thumbnail
        video.currentTime = Math.min(1.0, duration / 2);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const previewUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve({
              dimensions: {
                width: video.videoWidth || 1920,
                height: video.videoHeight || 1080,
                megapixels: Number(((video.videoWidth * video.videoHeight) / 1000000).toFixed(2)),
                aspectRatio: '16:9',
                duration: Number(video.duration.toFixed(1)),
                fps: 30,
                codec: 'H.264 / MP4',
              },
              previewUrl,
              mediaType: 'video',
            });
            return;
          }
        } catch {
          // Fallback if canvas capture fails
        }

        resolve({
          dimensions: {
            width: video.videoWidth || 1920,
            height: video.videoHeight || 1080,
            megapixels: Number(((video.videoWidth * video.videoHeight) / 1000000).toFixed(2)),
            aspectRatio: '16:9',
            duration: Number(video.duration.toFixed(1)),
            fps: 30,
            codec: 'H.264 / MP4',
          },
          previewUrl: fileUrl,
          mediaType: 'video',
        });
      };

      video.onerror = () => {
        resolve({
          dimensions: {
            width: 1920,
            height: 1080,
            megapixels: 2.07,
            aspectRatio: '16:9',
            duration: 10.0,
            fps: 30,
            codec: 'MP4 Video',
          },
          previewUrl: fileUrl,
          mediaType: 'video',
        });
      };
    });
  }

  // Image inspection with binary JPEG SOF scanning for true full resolution
  return new Promise(async (resolve) => {
    let trueDimensions: { width: number; height: number; megapixels: number } | null = null;

    try {
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let maxW = 0;
      let maxH = 0;
      let i = 2;
      while (i < bytes.length - 8) {
        if (bytes[i] === 0xff && (bytes[i + 1] === 0xc0 || bytes[i + 1] === 0xc2)) {
          const h = (bytes[i + 5] << 8) | bytes[i + 6];
          const w = (bytes[i + 7] << 8) | bytes[i + 8];
          if (w * h > maxW * maxH) {
            maxW = w;
            maxH = h;
          }
        }
        i++;
      }
      if (maxW > 0 && maxH > 0) {
        trueDimensions = {
          width: maxW,
          height: maxH,
          megapixels: Number(((maxW * maxH) / 1000000).toFixed(2)),
        };
      }
    } catch {
      // Fallback to Image() DOM loader
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const width = trueDimensions ? trueDimensions.width : img.naturalWidth;
        const height = trueDimensions ? trueDimensions.height : img.naturalHeight;
        const megapixels = trueDimensions
          ? trueDimensions.megapixels
          : Number(((width * height) / 1000000).toFixed(2));
        const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
        const divisor = gcd(width, height) || 1;
        const aspectRatio = `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;

        resolve({
          dimensions: {
            width,
            height,
            megapixels,
            aspectRatio,
          },
          previewUrl: dataUrl,
          mediaType: 'image',
        });
      };

      img.onerror = () => {
        const width = trueDimensions ? trueDimensions.width : 4000;
        const height = trueDimensions ? trueDimensions.height : 3000;
        const megapixels = trueDimensions
          ? trueDimensions.megapixels
          : Number(((width * height) / 1000000).toFixed(2));
        resolve({
          dimensions: {
            width,
            height,
            megapixels,
            aspectRatio: '4:3',
          },
          previewUrl: dataUrl,
          mediaType: 'image',
        });
      };

      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function generateVectorThumbnail(
  filename: string,
  ext: 'ai' | 'eps' | 'zip',
  width: number,
  height: number
): string {
  const scale = 4;
  const canvas = document.createElement('canvas');
  canvas.width = 640 * scale; // 2560px
  canvas.height = 400 * scale; // 1600px -> 4.1 Megapixels (Satisfies Adobe Stock minimum threshold)
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(scale, scale);

  // Background
  const gradient = ctx.createLinearGradient(0, 0, 640, 400);
  gradient.addColorStop(0, '#090d16');
  gradient.addColorStop(1, '#020617');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 640, 400);

  // Subtle isometric vector grid
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 0.8;
  const step = 20;
  for (let x = 0; x < 640; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 400);
    ctx.stroke();
  }
  for (let y = 0; y < 400; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(640, y);
    ctx.stroke();
  }

  // Centered artboard representation
  const abW = 440;
  const abH = 260;
  const abX = (640 - abW) / 2;
  const abY = (400 - abH) / 2;

  // Artboard drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(abX + 6, abY + 6, abW, abH);

  // Artboard background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(abX, abY, abW, abH);
  ctx.strokeStyle = ext === 'ai' ? '#f59e0b' : '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(abX, abY, abW, abH);

  // Vector Bezier Spline
  ctx.beginPath();
  ctx.moveTo(abX + 50, abY + 170);
  ctx.bezierCurveTo(abX + 130, abY + 50, abX + 310, abY + 220, abX + 380, abY + 90);
  ctx.strokeStyle = ext === 'ai' ? '#fbbf24' : '#60a5fa';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Control handles
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(abX + 50, abY + 170);
  ctx.lineTo(abX + 130, abY + 50);
  ctx.moveTo(abX + 380, abY + 90);
  ctx.lineTo(abX + 310, abY + 220);
  ctx.stroke();

  // Anchor points (small squares)
  const drawAnchor = (x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 4, y - 4, 8, 8);
  };

  drawAnchor(abX + 50, abY + 170, '#3b82f6');
  drawAnchor(abX + 130, abY + 50, '#f59e0b');
  drawAnchor(abX + 310, abY + 220, '#f59e0b');
  drawAnchor(abX + 380, abY + 90, '#3b82f6');

  // Vector Badge
  ctx.fillStyle = ext === 'ai' ? '#d97706' : ext === 'zip' ? '#8b5cf6' : '#0284c7';
  ctx.beginPath();
  ctx.roundRect(abX + 18, abY + 18, 64, 28, 5);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ext.toUpperCase(), abX + 50, abY + 32);

  // "VECTOR GRAPHIC ARTBOARD" label
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(ext === 'zip' ? 'VECTOR ZIP PACKAGE' : 'VECTOR ARTBOARD', abX + 92, abY + 32);

  // Filename label at bottom of artboard
  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 13px sans-serif';
  const cleanDispName = filename.length > 34 ? filename.slice(0, 32) + '...' : filename;
  ctx.fillText(cleanDispName, abX + 20, abY + abH - 32);

  // Scalable resolution tag
  ctx.fillStyle = '#64748b';
  ctx.font = '11px monospace';
  ctx.fillText(`${width} x ${height} pt · Scalable Vector Graphics`, abX + 20, abY + abH - 14);

  return canvas.toDataURL('image/jpeg', 0.95);
}
