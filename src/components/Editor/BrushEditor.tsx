import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../hooks/useI18n';

interface BrushEditorProps {
  cutout: string;
  original: string;
  onApply: (dataUrl: string) => void;
  onClose: () => void;
}

export function BrushEditor({ cutout, original, onApply, onClose }: BrushEditorProps) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cutoutImgRef = useRef<HTMLImageElement | null>(null);
  const originalImgRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [brushSize, setBrushSize] = useState(28);
  const [mode, setMode] = useState<'erase' | 'restore'>('erase');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const cutoutImg = new Image();
    const originalImg = new Image();
    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded === 2) {
        cutoutImgRef.current = cutoutImg;
        originalImgRef.current = originalImg;
        const maxW = 480;
        const scale = Math.min(maxW / cutoutImg.width, maxW / cutoutImg.width);
        const w = Math.round(cutoutImg.width * scale);
        const h = Math.round(cutoutImg.height * scale);
        const canvas = canvasRef.current!;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(cutoutImg, 0, 0, w, h);
        setReady(true);
      }
    };
    cutoutImg.onload = onLoad;
    originalImg.onload = onLoad;
    cutoutImg.src = cutout;
    originalImg.src = original;
  }, [cutout, original]);

  const getPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const drawStroke = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    if (mode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      const img = originalImgRef.current!;
      ctx.save();
      ctx.beginPath();
      ctx.arc(to.x, to.y, brushSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }, [brushSize, mode]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!ready) return;
    drawingRef.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    const pos = getPos(e);
    lastRef.current = pos;
    drawStroke(pos, pos);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current || !lastRef.current) return;
    const pos = getPos(e);
    drawStroke(lastRef.current, pos);
    lastRef.current = pos;
  };

  const handlePointerUp = () => { drawingRef.current = false; lastRef.current = null; };

  const handleApply = () => {
    const canvas = canvasRef.current!;
    onApply(canvas.toDataURL('image/png'));
  };

  const handleReset = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cutoutImgRef.current!, 0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-800 mb-1">{t('brush.title')}</h3>
        <p className="text-sm text-slate-500 mb-4">{t('brush.desc')}</p>
        <div className="flex justify-center bg-slate-100 rounded-xl p-3 mb-4">
          <canvas ref={canvasRef} className="max-w-full cursor-crosshair touch-none rounded"
            style={{ maxHeight: 360 }}
            onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} />
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setMode('erase')}
              className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${mode === 'erase' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              {t('brush.erase')}
            </button>
            <button onClick={() => setMode('restore')}
              className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${mode === 'restore' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              {t('brush.restore')}
            </button>
          </div>
          <div>
            <label className="flex justify-between text-sm text-slate-600 mb-1.5">
              <span>{t('brush.brushSize')}</span><span className="text-slate-400">{brushSize}px</span>
            </label>
            <input type="range" min="6" max="80" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleReset} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors">
              {t('brush.reset')}
            </button>
            <button onClick={onClose} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors">
              {t('brush.cancel')}
            </button>
            <button onClick={handleApply} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
              {t('brush.apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
