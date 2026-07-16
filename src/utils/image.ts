import type { AppState, BackgroundColor } from '../store/AppContext';

export const BG_COLOR_MAP: Record<BackgroundColor, string> = {
  white: '#ffffff',
  lightGray: '#f3f4f6',
  lightBlue: '#dbeafe',
  red: '#fee2e2',
  custom: '#ffffff',
};

export function getBackgroundColorValue(state: AppState): string {
  if (state.backgroundColor === 'custom') return state.customColor;
  return BG_COLOR_MAP[state.backgroundColor];
}

/** Composite an (optionally transparent) image over a solid background color. */
export function compositeImageWithBackground(
  imageUrl: string,
  bgColor: string,
  quality = 0.95
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get 2d context'));
        return;
      }
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob());
}
