import { useMemo, useState, useCallback, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { useApp } from '../../store/AppContext';
import { useI18n } from '../../hooks/useI18n';
import { getBackgroundColorValue } from '../../utils/image';
import sizes from '../../specs/sizes.json';

type PaperSize = '4x6' | '5x7' | '8x10' | 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal';
type ExportTab = 'sheet' | 'single';

interface PaperDimensions {
  width_mm: number;
  height_mm: number;
  label: string;
}

const PAPER_SIZES: Record<PaperSize, PaperDimensions> = {
  '4x6': { width_mm: 102, height_mm: 152, label: '4×6 in' },
  '5x7': { width_mm: 127, height_mm: 178, label: '5×7 in' },
  '8x10': { width_mm: 203, height_mm: 254, label: '8×10 in' },
  A3: { width_mm: 297, height_mm: 420, label: 'A3' },
  A4: { width_mm: 210, height_mm: 297, label: 'A4' },
  A5: { width_mm: 148, height_mm: 210, label: 'A5' },
  Letter: { width_mm: 216, height_mm: 279, label: 'Letter' },
  Legal: { width_mm: 216, height_mm: 356, label: 'Legal' },
};

export function PrintSheet() {
  const { state, dispatch } = useApp();
  const { t } = useI18n();
  const [paperSize, setPaperSize] = useState<PaperSize>(() => (typeof window !== 'undefined' ? localStorage.getItem('print_paperSize') as PaperSize : null) || 'A4');
  const [showCutLines, setShowCutLines] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('print_showCutLines') !== 'false' : true);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => (typeof window !== 'undefined' ? localStorage.getItem('print_orientation') as 'portrait' | 'landscape' : null) || 'portrait');
  const [exportTab, setExportTab] = useState<ExportTab>('sheet');
  const [singleFormat, setSingleFormat] = useState<'png' | 'jpeg'>('jpeg');
  const [quality, setQuality] = useState(92);
  const [paperColor, setPaperColor] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem('print_paperColor') : null) || '#ffffff');
  const [gap, setGap] = useState(() => typeof window !== 'undefined' && localStorage.getItem('print_gap') ? Number(localStorage.getItem('print_gap')) : 5);
  const [outerMargin, setOuterMargin] = useState(() => typeof window !== 'undefined' && localStorage.getItem('print_outerMargin') ? Number(localStorage.getItem('print_outerMargin')) : 5);
  const [alignX, setAlignX] = useState<'left' | 'center' | 'right'>(() => (typeof window !== 'undefined' ? localStorage.getItem('print_alignX') as any : null) || 'center');
  const [alignY, setAlignY] = useState<'top' | 'center' | 'bottom'>(() => (typeof window !== 'undefined' ? localStorage.getItem('print_alignY') as any : null) || 'center');
  const [maxPhotos, setMaxPhotos] = useState(() => typeof window !== 'undefined' && localStorage.getItem('print_maxPhotos') ? Number(localStorage.getItem('print_maxPhotos')) : 0);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('print_paperSize', paperSize);
    localStorage.setItem('print_showCutLines', showCutLines.toString());
    localStorage.setItem('print_orientation', orientation);
    localStorage.setItem('print_paperColor', paperColor);
    localStorage.setItem('print_gap', gap.toString());
    localStorage.setItem('print_outerMargin', outerMargin.toString());
    localStorage.setItem('print_alignX', alignX);
    localStorage.setItem('print_alignY', alignY);
    localStorage.setItem('print_maxPhotos', maxPhotos.toString());
  }, [paperSize, showCutLines, orientation, paperColor, gap, outerMargin, alignX, alignY, maxPhotos]);

  const currentBg = getBackgroundColorValue(state);
  const currentPreset = useMemo(() => sizes[state.selectedPreset as keyof typeof sizes], [state.selectedPreset]);

  const layout = useMemo(() => {
    if (!currentPreset) return null;
    const paper = PAPER_SIZES[paperSize];
    const photoWidth = currentPreset.width_mm;
    const photoHeight = currentPreset.height_mm;
    const isLandscape = orientation === 'landscape';
    const paperW = isLandscape ? paper.height_mm : paper.width_mm;
    const paperH = isLandscape ? paper.width_mm : paper.height_mm;
    
    const marginX = outerMargin;
    const marginY = outerMargin;
    let cols = Math.max(0, Math.floor((paperW - marginX * 2 + gap) / (photoWidth + gap)));
    let rows = Math.max(0, Math.floor((paperH - marginY * 2 + gap) / (photoHeight + gap)));
    
    // Prevent rendering if even 1 photo doesn't fit
    if (cols > 0 && cols * photoWidth > paperW - marginX * 2) cols = 0;
    if (rows > 0 && rows * photoHeight > paperH - marginY * 2) rows = 0;
    
    let totalCapacity = cols * rows;
    let actualTotal = totalCapacity;
    if (maxPhotos > 0 && maxPhotos < totalCapacity) {
      actualTotal = maxPhotos;
      rows = Math.ceil(actualTotal / cols);
      if (rows === 1) cols = actualTotal;
    }
    
    const contentWidth = cols > 0 ? cols * photoWidth + (cols - 1) * gap : 0;
    const contentHeight = rows > 0 ? rows * photoHeight + (rows - 1) * gap : 0;
    
    let startX = marginX;
    if (alignX === 'center') startX = marginX + (paperW - marginX * 2 - contentWidth) / 2;
    if (alignX === 'right') startX = paperW - marginX - contentWidth;

    let startY = marginY;
    if (alignY === 'center') startY = marginY + (paperH - marginY * 2 - contentHeight) / 2;
    if (alignY === 'bottom') startY = paperH - marginY - contentHeight;

    return { cols, rows, total: actualTotal, photoWidth, photoHeight, paperWidth: paperW, paperHeight: paperH, gap, startX, startY };
  }, [currentPreset, paperSize, orientation, gap, outerMargin, alignX, alignY, maxPhotos]);

  const generatePreview = useCallback(() => {
    if (!layout || !currentPreset) return null;
    const scaleX = 380 / layout.paperWidth;
    const scaleY = 540 / layout.paperHeight;
    const scale = Math.min(scaleX, scaleY);
    const previewWidth = layout.paperWidth * scale;
    const previewHeight = layout.paperHeight * scale;
    const photos: { x: number; y: number }[] = [];
    let count = 0;
    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        if (count >= layout.total) break;
        photos.push({ 
          x: (layout.startX + col * (layout.photoWidth + layout.gap)) * scale, 
          y: (layout.startY + row * (layout.photoHeight + layout.gap)) * scale 
        });
        count++;
      }
    }
    return { previewWidth, previewHeight, photos, scale };
  }, [layout, currentPreset]);

  const preview = generatePreview();

  const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

  const handleDownloadPDF = useCallback(async () => {
    if (!layout || !currentPreset || !state.croppedImage) return;
    const doc = new jsPDF({
      orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: paperSize === '4x6' ? [102, 152] : 
              paperSize === '5x7' ? [127, 178] :
              paperSize === '8x10' ? [203, 254] :
              paperSize.toLowerCase(),
    });
    
    if (paperColor !== '#ffffff' && paperColor !== 'transparent' && paperColor !== 'white') {
      doc.setFillColor(paperColor);
      doc.rect(0, 0, layout.paperWidth, layout.paperHeight, 'F');
    }

    let count = 0;
    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        if (count >= layout.total) break;
        const x = layout.startX + col * (layout.photoWidth + layout.gap);
        const y = layout.startY + row * (layout.photoHeight + layout.gap);
        // Photo background color is already baked into state.croppedImage
        doc.addImage(state.croppedImage, 'PNG', x, y, layout.photoWidth, layout.photoHeight);
        if (showCutLines) { doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1); doc.rect(x, y, layout.photoWidth, layout.photoHeight); }
        count++;
      }
    }
    doc.save(`passport-photos-${Date.now()}.pdf`);
  }, [layout, currentPreset, state.croppedImage, paperSize, orientation, showCutLines, paperColor]);

  const handlePrint = useCallback(async () => {
    if (!layout || !currentPreset || !state.croppedImage) return;
    const doc = new jsPDF({
      orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: paperSize === '4x6' ? [102, 152] : 
              paperSize === '5x7' ? [127, 178] :
              paperSize === '8x10' ? [203, 254] :
              paperSize.toLowerCase(),
    });
    
    if (paperColor !== '#ffffff' && paperColor !== 'transparent' && paperColor !== 'white') {
      doc.setFillColor(paperColor);
      doc.rect(0, 0, layout.paperWidth, layout.paperHeight, 'F');
    }

    let count = 0;
    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        if (count >= layout.total) break;
        const x = layout.startX + col * (layout.photoWidth + layout.gap);
        const y = layout.startY + row * (layout.photoHeight + layout.gap);
        doc.addImage(state.croppedImage, 'PNG', x, y, layout.photoWidth, layout.photoHeight);
        if (showCutLines) { doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1); doc.rect(x, y, layout.photoWidth, layout.photoHeight); }
        count++;
      }
    }
    doc.autoPrint();
    const pdfUrl = doc.output('bloburl');
    window.open(pdfUrl, '_blank');
  }, [layout, currentPreset, state.croppedImage, paperSize, orientation, showCutLines, paperColor]);

  const handleDownloadPNG = useCallback(async () => {
    if (!preview || !state.croppedImage) return;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(preview.previewWidth * 3);
    canvas.height = Math.round(preview.previewHeight * 3);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(3, 3);
    if (paperColor !== 'transparent') {
      ctx.fillStyle = paperColor;
      ctx.fillRect(0, 0, preview.previewWidth, preview.previewHeight);
    }
    const img = await loadImg(state.croppedImage);
    const photoW = layout!.photoWidth * preview.scale;
    const photoH = layout!.photoHeight * preview.scale;
    preview.photos.forEach((photo) => {
      ctx.drawImage(img, photo.x, photo.y, photoW, photoH);
      if (showCutLines) { ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 0.5; ctx.strokeRect(photo.x, photo.y, photoW, photoH); }
    });
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `passport-photos-${Date.now()}.png`; a.click();
        URL.revokeObjectURL(url);
      }
    }, 'image/png');
  }, [preview, state.croppedImage, layout, showCutLines, paperColor]);

  const handleDownloadSingle = useCallback(async () => {
    const src = state.croppedImage;
    if (!src) return;
    const source = state.backgroundColor === 'white' ? src
      : await (async () => {
          const c = document.createElement('canvas');
          const img = await loadImg(src);
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          c.width = w; c.height = h;
          const ctx = c.getContext('2d')!;
          ctx.fillStyle = currentBg; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0);
          return c.toDataURL('image/jpeg', quality / 100);
        })();
    if (singleFormat === 'jpeg') {
      const a = document.createElement('a');
      a.href = source; a.download = `passport-photo-${Date.now()}.jpg`; a.click();
    } else {
      const c = document.createElement('canvas');
      const img = await loadImg(source);
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      c.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `passport-photo-${Date.now()}.png`; a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    }
  }, [state.croppedImage, state.backgroundColor, currentBg, singleFormat, quality]);

  const handleBack = useCallback(() => { dispatch({ type: 'SET_CURRENT_STEP', payload: 'edit' }); }, [dispatch]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 max-w-7xl mx-auto">
      <div className="flex-1 flex flex-col items-center">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">{t('print.title')}</h2>
        {preview ? (
          <div className="relative border border-slate-200 shadow-xl rounded-sm overflow-hidden"
            style={{ width: preview.previewWidth, height: preview.previewHeight, backgroundColor: paperColor }}>
            {preview.photos.map((photo, index) => (
              <div key={index} className="absolute bg-cover bg-center"
                style={{
                  left: photo.x, top: photo.y,
                  width: layout!.photoWidth * preview.scale, height: layout!.photoHeight * preview.scale,
                  backgroundImage: `url(${state.croppedImage})`,
                  border: showCutLines ? '1px dashed #cbd5e1' : 'none',
                }} />
            ))}
          </div>
        ) : (
          <div className="w-[400px] h-[560px] bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
            {t('upload.title')}
          </div>
        )}
        <p className="mt-4 text-sm text-slate-500">{layout ? `${layout.total} ${t('print.photosPerSheet')}` : ''}</p>
      </div>

      <div className="w-full lg:w-100 flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-400" /> {t('export.paperSettings')}
          </h3>
          <div className="space-y-3">
            <div className='flex gap-2 w-full'>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('export.paperSize')}</label>
                <select value={paperSize} onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.entries(PAPER_SIZES).map(([key, value]) => (
                    <option key={key} value={key}>{value.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('export.orientation')}</label>
                <select value={orientation} onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="portrait">{t('export.portrait')}</option>
                  <option value="landscape">{t('export.landscape')}</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-4">
                <input type="checkbox" id="cutLines" checked={showCutLines} onChange={(e) => setShowCutLines(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                <label htmlFor="cutLines" className="text-sm text-slate-700">{t('export.showCutLines')}</label>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('export.paperBackgroundColor')}</label>
              <div className="flex gap-2">
                <input type="color" value={paperColor === 'transparent' ? '#ffffff' : paperColor} onChange={(e) => setPaperColor(e.target.value)}
                  className="h-10 w-full p-1 border border-slate-200 rounded-xl cursor-pointer bg-slate-50" />
                <button onClick={() => setPaperColor('transparent')} className={`px-4 py-2 rounded-xl text-sm font-medium border ${paperColor === 'transparent' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                  {t('export.transparent')}
                </button>
              </div>
            </div>
            <div>
              <label className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{t('export.gapBetweenPhotos')}</span><span>{gap} mm</span>
              </label>
              <input type="range" min="0" max="20" value={gap} onChange={(e) => setGap(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button 
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="w-full flex items-center justify-between text-sm text-slate-600 font-medium hover:text-blue-600 transition-colors"
              >
                <span>⚙️ {t('export.advancedOptions')}</span>
                <span className="text-xs">{isAdvancedOpen ? '▲' : '▼'}</span>
              </button>
              
              {isAdvancedOpen && (
                <div className="mt-3 space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <label className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                      {t('export.maxPhotos')} <span className="text-[10px] text-slate-400 font-normal">{t('export.maxPhotosHint')}</span>
                    </label>
                    <input type="number" min="0" value={maxPhotos} onChange={(e) => setMaxPhotos(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>{t('export.outerMargin')}</span><span>{outerMargin} mm</span>
                    </label>
                    <input type="range" min="0" max="50" value={outerMargin} onChange={(e) => setOuterMargin(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">{t('export.alignHorizontal')}</label>
                      <select value={alignX} onChange={(e) => setAlignX(e.target.value as any)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="left">{t('export.left')}</option>
                        <option value="center">{t('export.center')}</option>
                        <option value="right">{t('export.right')}</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">{t('export.alignVertical')}</label>
                      <select value={alignY} onChange={(e) => setAlignY(e.target.value as any)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="top">{t('export.top')}</option>
                        <option value="center">{t('export.center')}</option>
                        <option value="bottom">{t('export.bottom')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
            <button onClick={() => setExportTab('sheet')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${exportTab === 'sheet' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>
              {t('export.printSheet')}
            </button>
            <button onClick={() => setExportTab('single')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${exportTab === 'single' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>
              {t('export.singlePhoto')}
            </button>
          </div>
          {exportTab === 'sheet' ? (
            <div className="space-y-2">
              <button onClick={handlePrint} disabled={!state.croppedImage}
                className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                🖨️ {t('export.print')}
              </button>
              <button onClick={handleDownloadPDF} disabled={!state.croppedImage}
                className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {t('export.downloadPdf')}
              </button>
              <button onClick={handleDownloadPNG} disabled={!state.croppedImage}
                className="w-full py-2.5 px-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {t('export.downloadPng')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('export.format')}</label>
                <div className="flex gap-2">
                  {(['png', 'jpeg'] as const).map((f) => (
                    <button key={f} onClick={() => setSingleFormat(f)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${singleFormat === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{t('export.quality')}</span><span>{quality}%</span>
                </label>
                <input type="range" min="50" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
              </div>
              <button onClick={handleDownloadSingle} disabled={!state.croppedImage}
                className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {t('export.download')} {singleFormat.toUpperCase()}
              </button>
            </div>
          )}
        </div>

        <button onClick={handleBack} className="w-full py-2 px-4 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300 transition-colors">
          {t('export.backToEditor')}
        </button>
      </div>
    </div>
  );
}
