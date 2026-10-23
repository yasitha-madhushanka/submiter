import { AgencyKey, StockAsset } from '../types';

function escapeCsvField(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function generateAdobeStockCsv(assets: StockAsset[]): string {
  const header = ['Filename', 'Title', 'Keywords', 'Category', 'Releases'];
  const rows: string[] = [];

  assets
    .filter((a) => a.targetAgencies.includes('adobe'))
    .forEach((asset) => {
      const topKeywords = asset.metadata.keywords.slice(0, 49).join(', ');
      const releases = [
        ...asset.metadata.modelReleases,
        ...asset.metadata.propertyReleases,
      ].join('; ');
      const category = asset.metadata.adobeCategory || (asset.mediaType === 'vector' ? 'Graphic Resources' : 'Lifestyle');

      // 1. Primary filename
      rows.push([
        escapeCsvField(asset.filename),
        escapeCsvField(asset.metadata.title),
        escapeCsvField(topKeywords),
        escapeCsvField(category),
        escapeCsvField(releases),
      ].join(','));

      // 2. If vector or zip, generate alternate extension rows (.ai, .eps, .zip, .jpg)
      // This ensures 100% automatic metadata matching on contributor.stock.adobe.com whether
      // uploaded as native vector (.ai/.eps) or archived in a .zip!
      const baseName = asset.filename.replace(/\.[^/.]+$/, '');
      const isVec = asset.mediaType === 'vector' || asset.filename.endsWith('.ai') || asset.filename.endsWith('.eps') || asset.filename.endsWith('.zip');
      if (isVec) {
        const variants = [`${baseName}.ai`, `${baseName}.eps`, `${baseName}.zip`, `${baseName}.jpg`, `${baseName}`];
        for (const variant of variants) {
          if (variant.toLowerCase() !== asset.filename.toLowerCase()) {
            rows.push([
              escapeCsvField(variant),
              escapeCsvField(asset.metadata.title),
              escapeCsvField(topKeywords),
              escapeCsvField(category),
              escapeCsvField(releases),
            ].join(','));
          }
        }
      }
    });

  return [header.join(','), ...rows].join('\r\n');
}

export function generateShutterstockCsv(assets: StockAsset[]): string {
  const header = [
    'Filename',
    'Description',
    'Keywords',
    'Categories',
    'Illustration',
    'MatureContent',
    'Editorial',
  ];
  const rows = assets
    .filter((a) => a.targetAgencies.includes('shutterstock'))
    .map((asset) => {
      const keywords = asset.metadata.keywords.slice(0, 50).join(', ');
      const categories = [
        asset.metadata.shutterstockPrimaryCategory || 'Technology',
        asset.metadata.shutterstockSecondaryCategory || 'Business/Finance',
      ].join(', ');

      return [
        escapeCsvField(asset.filename),
        escapeCsvField(asset.metadata.title || asset.metadata.description),
        escapeCsvField(keywords),
        escapeCsvField(categories),
        escapeCsvField(asset.metadata.isAiGenerated ? 'yes' : 'no'),
        escapeCsvField('no'),
        escapeCsvField(asset.metadata.editorialRequired ? 'yes' : 'no'),
      ].join(',');
    });

  return [header.join(','), ...rows].join('\r\n');
}

export function generatePond5Csv(assets: StockAsset[]): string {
  const header = [
    'Filename',
    'Title',
    'Description',
    'Keywords',
    'Price',
    'Category',
    'ModelRelease',
    'PropertyRelease',
  ];
  const rows = assets
    .filter((a) => a.targetAgencies.includes('pond5'))
    .map((asset) => {
      const keywords = asset.metadata.keywords.join(', ');
      return [
        escapeCsvField(asset.filename),
        escapeCsvField(asset.metadata.title),
        escapeCsvField(asset.metadata.description),
        escapeCsvField(keywords),
        escapeCsvField(asset.metadata.pond5PriceUsd || (asset.mediaType === 'video' ? 79 : 19)),
        escapeCsvField(asset.metadata.pond5Category || 'Aerial & Drone'),
        escapeCsvField(asset.metadata.modelReleaseRequired ? 'Yes' : 'No'),
        escapeCsvField(asset.metadata.propertyReleaseRequired ? 'Yes' : 'No'),
      ].join(',');
    });

  return [header.join(','), ...rows].join('\r\n');
}

export function generateBlackBoxCsv(assets: StockAsset[]): string {
  const header = [
    'Filename',
    'Title',
    'Description',
    'Keywords',
    'CreatorShare',
    'CuratorShare',
  ];
  const rows = assets
    .filter((a) => a.mediaType === 'video')
    .map((asset) => {
      const keywords = asset.metadata.keywords.slice(0, 50).join(', ');
      return [
        escapeCsvField(asset.filename),
        escapeCsvField(asset.metadata.title),
        escapeCsvField(asset.metadata.description),
        escapeCsvField(keywords),
        escapeCsvField(asset.metadata.blackboxShare?.creatorPercentage || 100),
        escapeCsvField(asset.metadata.blackboxShare?.curatorPercentage || 0),
      ].join(',');
    });

  return [header.join(','), ...rows].join('\r\n');
}

export function generateUniversalJsonSidecar(assets: StockAsset[]): string {
  return JSON.stringify(
    assets.map((a) => ({
      filename: a.filename,
      mediaType: a.mediaType,
      specs: a.dimensions,
      iptc: {
        objectName: a.metadata.title,
        caption: a.metadata.description,
        keywords: a.metadata.keywords,
        categories: [a.metadata.adobeCategory, a.metadata.shutterstockPrimaryCategory],
        credit: 'StockSync Contributor',
        source: 'StockSync Pro Batch Pipeline',
      },
      agencies: a.targetAgencies,
      rights: {
        editorial: a.metadata.editorialRequired,
        modelReleases: a.metadata.modelReleases,
        propertyReleases: a.metadata.propertyReleases,
        isAiGenerated: a.metadata.isAiGenerated,
      },
    })),
    null,
    2
  );
}

export function triggerDownload(content: string, filename: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
