/**
 * Converts Google Drive sharing links to direct image URLs.
 * 
 * Google Drive links like:
 *   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * 
 * Cannot be used as <img> src because they point to an HTML viewer page.
 * This function converts them to a direct image/thumbnail URL:
 *   https://drive.google.com/thumbnail?id=FILE_ID&sz=w800
 *
 * Non-Drive URLs are returned unchanged.
 * 
 * @param {string} url - The image URL (may be a Google Drive link)
 * @param {number} [width=800] - Desired width for Google Drive thumbnails
 * @returns {string} A direct image URL
 */
export function resolveImageUrl(url, width = 800) {
  if (!url || typeof url !== 'string') return url;

  // Match Google Drive file links: /file/d/FILE_ID/...
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w${width}`;
  }

  // Match Google Drive open links: ?id=FILE_ID
  const driveOpenMatch = url.match(/drive\.google\.com\/(?:uc|open)\?.*id=([a-zA-Z0-9_-]+)/);
  if (driveOpenMatch) {
    return `https://drive.google.com/thumbnail?id=${driveOpenMatch[1]}&sz=w${width}`;
  }

  return url;
}

/**
 * Converts Google Drive sharing links to embeddable video URLs.
 * 
 * Google Drive links like:
 *   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * 
 * Are converted to the embeddable preview format:
 *   https://drive.google.com/file/d/FILE_ID/preview
 * 
 * Non-Drive URLs are returned unchanged.
 */
export function resolveVideoUrl(url) {
  if (!url || typeof url !== 'string') return url;

  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }

  return url;
}

/**
 * Checks if a URL is a Google Drive link.
 */
export function isGoogleDriveUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /drive\.google\.com/.test(url);
}
