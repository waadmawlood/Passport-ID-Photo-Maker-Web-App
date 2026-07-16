import { useCallback, useRef, useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { useI18n } from '../../hooks/useI18n';

export function Upload() {
  const { dispatch } = useApp();
  const { t } = useI18n();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showWebcam, setShowWebcam] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    if (showWebcam && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [showWebcam, stream]);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        alert(t('upload.title') + ': ' + t('common.error'));
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(t('upload.maxSize'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        dispatch({ type: 'SET_ORIGINAL_IMAGE', payload: result });
        dispatch({ type: 'SET_CURRENT_STEP', payload: 'edit' });
      };
      reader.readAsDataURL(file);
    },
    [dispatch, t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const startWebcam = useCallback(async () => {
    try {
      setVideoReady(false);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      setStream(mediaStream);
      setShowWebcam(true);
    } catch (error) {
      console.error('Error accessing webcam:', error);
      alert('Could not access webcam. Please check permissions.');
    }
  }, []);

  const handleVideoLoadedMetadata = useCallback(() => {
    setVideoReady(true);
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !videoReady) return;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      alert(t('common.loading'));
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      dispatch({ type: 'SET_ORIGINAL_IMAGE', payload: dataUrl });
      dispatch({ type: 'SET_CURRENT_STEP', payload: 'edit' });
      stopWebcam();
    }
  }, [dispatch, videoReady, t]);

  const stopWebcam = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowWebcam(false);
    setVideoReady(false);
  }, [stream]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <h2 className="text-2xl font-semibold mb-2 text-gray-800">{t('upload.title')}</h2>
      <p className="text-gray-500 mb-8 text-center">{t('upload.dragDrop')} {t('upload.or')} {t('upload.webcam').toLowerCase()}</p>

      {showWebcam ? (
        <div className="flex flex-col items-center gap-4">
          <div className="relative rounded-xl overflow-hidden shadow-lg border-2 border-blue-500">
            <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={handleVideoLoadedMetadata}
              className="w-[480px] h-[360px] object-cover bg-black" style={{ transform: 'scaleX(-1)' }} />
            {!videoReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <p className="text-white">{t('upload.loadingCamera')}</p>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={capturePhoto} disabled={!videoReady}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {t('upload.capturePhoto')}
            </button>
            <button onClick={stopWebcam}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
          className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 transition-all duration-200 cursor-pointer ${isDragOver ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'}`}
          onClick={() => fileInputRef.current?.click()}>
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-gray-700">{t('upload.dragDrop')}</p>
            <p className="text-sm text-gray-400 mt-1">{t('upload.or')} {t('upload.clickToBrowse')}</p>
          </div>
          <div className="text-xs text-gray-400 mt-2">
            {t('upload.supportedFormats')} • {t('upload.maxSize')}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileInput} className="hidden" />
        </div>
      )}

      {!showWebcam && (
        <button onClick={startWebcam}
          className="mt-6 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {t('upload.webcam')}
        </button>
      )}
    </div>
  );
}
