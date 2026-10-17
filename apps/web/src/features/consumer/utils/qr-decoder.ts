import jsQR from 'jsqr';

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
}

interface BarcodeDetectorConstructorLike {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const globalWithDetector = globalThis as unknown as {
    BarcodeDetector?: BarcodeDetectorConstructorLike;
  };
  if (typeof globalWithDetector.BarcodeDetector !== 'function') {
    return null;
  }
  try {
    return new globalWithDetector.BarcodeDetector({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

export async function decodeQrFromVideoElement(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  if (
    video.readyState < 2 ||
    video.videoWidth === 0 ||
    video.videoHeight === 0
  ) {
    return null;
  }

  const detector = getBarcodeDetector();
  if (detector) {
    try {
      const results = await detector.detect(video);
      const rawValue = results[0]?.rawValue?.trim();
      if (rawValue) {
        return rawValue;
      }
    } catch {
      // Fallback to jsQR canvas decoding below
    }
  }

  const width = video.videoWidth;
  const height = video.videoHeight;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return null;
  }

  ctx.drawImage(video, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'dontInvert',
  });
  return decoded?.data?.trim() || null;
}

export async function decodeQrFromImageFile(
  file: File,
): Promise<string | null> {
  const detector = getBarcodeDetector();
  if (detector && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const results = await detector.detect(bitmap);
        const rawValue = results[0]?.rawValue?.trim();
        if (rawValue) {
          return rawValue;
        }
      } finally {
        bitmap.close?.();
      }
    } catch {
      // Fallback to HTMLImageElement + jsQR below
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const imageElement = new Image();
      imageElement.onload = () => resolve(imageElement);
      imageElement.onerror = () =>
        reject(new Error('ไม่สามารถโหลดไฟล์รูปภาพได้'));
      imageElement.src = objectUrl;
    });

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    return decoded?.data?.trim() || null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
