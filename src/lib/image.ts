const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.8;
const MAX_FILE_SIZE_MB = 5;

/**
 * Compress and resize an image file to a base64 data URL.
 * Caps at 1200px max dimension, outputs JPEG at 0.8 quality.
 * PNGs with transparency are preserved as PNG.
 */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      // Still process it — the resize/compress will shrink it
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if either dimension exceeds max
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not create canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Use PNG for transparency-capable formats, JPEG otherwise
      const isPng = file.type === 'image/png';
      const mimeType = isPng ? 'image/png' : 'image/jpeg';
      const quality = isPng ? undefined : JPEG_QUALITY;

      const dataUrl = canvas.toDataURL(mimeType, quality);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
