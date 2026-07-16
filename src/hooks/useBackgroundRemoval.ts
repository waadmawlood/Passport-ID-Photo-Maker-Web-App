import { useState, useCallback } from 'react';
import { removeBackground } from '@imgly/background-removal';

export function useBackgroundRemoval() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const removeBg = useCallback(async (imageUrl: string): Promise<string> => {
    setIsProcessing(true);
    setProgress(0);

    try {
      // Convert data URL to blob
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      setProgress(20);

      // Remove background using @imgly/background-removal
      const result = await removeBackground(blob, {
        progress: (_key: string, current: number, total: number) => {
          if (total > 0) {
            const percent = Math.round((current / total) * 80) + 20;
            setProgress(Math.min(percent, 99));
          }
        },
      });

      setProgress(100);

      // Convert result blob to data URL
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(result);
      });
    } catch (error) {
      console.error('Background removal error:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { removeBackground: removeBg, isProcessing, progress };
}