import { useEffect, useRef, useCallback, useState } from 'react';
import * as fabric from 'fabric';
import { useApp } from '../../store/AppContext';
import { useI18n } from '../../hooks/useI18n';
import { useBackgroundRemoval } from '../../hooks/useBackgroundRemoval';
import { useFaceDetection } from '../../hooks/useFaceDetection';
import { getBackgroundColorValue } from '../../utils/image';
import sizes from '../../specs/sizes.json';
import { BrushEditor } from './BrushEditor';

export function Editor() {
  const { state, dispatch, canUndo, canRedo, undo, redo, pushHistory } = useApp();
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [showBrush, setShowBrush] = useState(false);
  const { removeBackground, isProcessing, progress } = useBackgroundRemoval();
  const { getFaceLandmarks } = useFaceDetection();

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 600,
      height: 450,
      backgroundColor: '#e2e8f0',
      selection: false,
      preserveObjectStacking: true,
    });
    fabricRef.current = canvas;
    setCanvasReady(true);
    return () => { canvas.dispose(); fabricRef.current = null; };
  }, []);

  const getFrameRect = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return null;
    const cw = canvas.getWidth();
    const ch = canvas.getHeight();
    const ratio = state.customWidth / state.customHeight;
    let gw = cw * 0.66;
    let gh = gw / ratio;
    if (gh > ch * 0.82) { gh = ch * 0.82; gw = gh * ratio; }
    const gx = (cw - gw) / 2;
    const gy = (ch - gh) / 2;
    return { gx, gy, gw, gh };
  }, [state.customWidth, state.customHeight]);

  const applyGuide = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.getObjects().forEach((obj) => {
      if ((obj as any).data?.isGuide) canvas.remove(obj);
    });

    const rect = getFrameRect();
    if (!rect) return;
    const { gx, gy, gw, gh } = rect;

    const addGuide = (obj: fabric.Object) => {
      (obj as any).data = { isGuide: true };
      obj.set({ selectable: false, evented: false, hoverCursor: 'default' });
      canvas.add(obj);
    };

    // Draw blue outline representing crop / selected photo size (cut lines border)
    const cropOutline = new fabric.Rect({
      width: gw, height: gh,
      fill: 'transparent', stroke: '#3b82f6', strokeWidth: 2,
    });
    // Explicitly set position and origin to fix top-left corner rendering bug
    cropOutline.set({ 
      left: gx, 
      top: gy,
      originX: 'left',
      originY: 'top'
    });
    
    addGuide(cropOutline);

    // Ensure user image is at the back of the stack
    const imgObj = canvas.getObjects().find((o) => (o as any).data?.isUserImage);
    if (imgObj) {
      canvas.sendObjectToBack(imgObj);
    }

    canvas.renderAll();
  }, [getFrameRect, state.selectedPreset]);

  const hideGuides = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.getObjects().forEach((obj) => {
      if ((obj as any).data?.isGuide) {
        obj.set({ visible: false });
      }
    });
  }, []);

  // Track manual transform modifications
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const handleModified = (e: any) => {
      const target = e.target;
      if (target && target.data?.isUserImage) {
        dispatch({
          type: 'SET_IMAGE_TRANSFORM',
          payload: {
            left: target.left,
            top: target.top,
            scaleX: target.scaleX,
            scaleY: target.scaleY,
            angle: target.angle,
          },
        });
        pushHistory();
      }
    };

    canvas.on('object:modified', handleModified);
    return () => {
      canvas.off('object:modified', handleModified);
    };
  }, [canvasReady, dispatch, pushHistory]);

  // Synchronize imageTransform to the canvas image object when state changes (e.g. from undo/redo)
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !state.imageTransform) return;
    const imgObj = canvas.getObjects().find((o) => (o as any).data?.isUserImage) as fabric.FabricImage;
    if (!imgObj) return;

    const t = state.imageTransform;
    let changed = false;
    if (imgObj.left !== t.left) { imgObj.left = t.left; changed = true; }
    if (imgObj.top !== t.top) { imgObj.top = t.top; changed = true; }
    if (imgObj.scaleX !== t.scaleX) { imgObj.scaleX = t.scaleX; changed = true; }
    if (imgObj.scaleY !== t.scaleY) { imgObj.scaleY = t.scaleY; changed = true; }
    if (imgObj.angle !== t.angle) { imgObj.angle = t.angle; changed = true; }

    if (changed) {
      canvas.renderAll();
    }
  }, [state.imageTransform]);

  // Load image onto canvas (only when source image URL changes)
  const lastLoadedUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!canvasReady || !fabricRef.current) return;
    const imageUrl = state.processedImage || state.originalImage;
    if (!imageUrl) return;
    
    if (lastLoadedUrlRef.current === imageUrl) return;
    lastLoadedUrlRef.current = imageUrl;

    const canvas = fabricRef.current;
    canvas.getObjects().forEach((o) => canvas.remove(o));

    fabric.FabricImage.fromURL(imageUrl).then((img) => {
      if (!img) return;
      (img as any).data = { isUserImage: true };

      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();
      
      if (state.imageTransform) {
        const t = state.imageTransform;
        img.set({
          left: t.left, top: t.top,
          scaleX: t.scaleX, scaleY: t.scaleY,
          angle: t.angle,
          originX: 'center', originY: 'center',
          selectable: true, hasControls: true, hasBorders: true,
          backgroundColor: getBackgroundColorValue(state)
        });
      } else {
        const rect = getFrameRect();
        let defaultTransform;
        if (rect) {
          const { gx, gy, gw, gh } = rect;
          const scale = Math.max(gw / (img.width || 1), gh / (img.height || 1));
          defaultTransform = {
            left: gx + gw / 2,
            top: gy + gh / 2,
            scaleX: scale,
            scaleY: scale,
            angle: 0,
          };
        } else {
          const scale = Math.min(canvasWidth / (img.width || 1), canvasHeight / (img.height || 1)) * 0.92;
          defaultTransform = {
            left: canvasWidth / 2,
            top: canvasHeight / 2,
            scaleX: scale,
            scaleY: scale,
            angle: 0,
          };
        }
        img.set({
          ...defaultTransform,
          originX: 'center', originY: 'center',
          selectable: true, hasControls: true, hasBorders: true,
          backgroundColor: getBackgroundColorValue(state)
        });
        dispatch({ type: 'SET_IMAGE_TRANSFORM', payload: defaultTransform });
      }

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      applyGuide();
    });
  }, [canvasReady, state.originalImage, state.processedImage, applyGuide]);

  // Apply background color to image object
  useEffect(() => {
    if (!fabricRef.current) return;
    const imgObj = fabricRef.current.getObjects().find((o) => (o as any).data?.isUserImage) as fabric.FabricImage;
    if (imgObj) {
      imgObj.set({ backgroundColor: getBackgroundColorValue(state) });
      fabricRef.current.renderAll();
    }
  }, [state.backgroundColor, state.customColor]);

  // Apply filters
  useEffect(() => {
    if (!fabricRef.current) return;
    const imgObj = fabricRef.current.getObjects().find((o) => (o as any).data?.isUserImage) as fabric.FabricImage;
    if (imgObj) {
      imgObj.filters = [];
      if (state.brightness !== 100) imgObj.filters.push(new fabric.filters.Brightness({ brightness: (state.brightness - 100) / 100 }));
      if (state.contrast !== 100) imgObj.filters.push(new fabric.filters.Contrast({ contrast: (state.contrast - 100) / 100 }));
      if (state.sharpness > 0) {
        const s = state.sharpness / 100;
        imgObj.filters.push(new fabric.filters.Convolute({ matrix: [0, -s, 0, -s, 1 + 4 * s, -s, 0, -s, 0] }));
      }
      imgObj.applyFilters();
      fabricRef.current.renderAll();
    }
  }, [state.brightness, state.contrast, state.sharpness]);

  // Redraw guide when selectedPreset changes
  useEffect(() => { applyGuide(); }, [applyGuide]);

  // Reusable Face Auto-Alignment function
  const alignFace = useCallback((landmarksResult: any) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const imgObj = canvas.getObjects().find((o) => (o as any).data?.isUserImage) as fabric.FabricImage;
    if (!imgObj) return;

    const rect = getFrameRect();
    if (!rect) return;
    const { gx, gy, gw, gh } = rect;

    const leftEyePoints = landmarksResult.leftEye;
    const rightEyePoints = landmarksResult.rightEye;
    
    const calcCenter = (points: { x: number; y: number }[]) => {
      const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
      return { x: sum.x / points.length, y: sum.y / points.length };
    };

    const leftEyeCenter = calcCenter(leftEyePoints);
    const rightEyeCenter = calcCenter(rightEyePoints);
    const positions = landmarksResult.landmarks.positions;
    const chinPoint = positions[8]; 

    const eyeMidpoint = {
      x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
      y: (leftEyeCenter.y + rightEyeCenter.y) / 2,
    };

    const dx = chinPoint.x - eyeMidpoint.x;
    const dy = chinPoint.y - eyeMidpoint.y;
    const distEyesToChin = Math.sqrt(dx * dx + dy * dy);
    const estHeadHeightImg = distEyesToChin * 1.667;

    const eyeDx = rightEyeCenter.x - leftEyeCenter.x;
    const eyeDy = rightEyeCenter.y - leftEyeCenter.y;
    const tiltAngleRad = Math.atan2(eyeDy, eyeDx);
    const tiltAngleDeg = (tiltAngleRad * 180) / Math.PI;

    const preset = sizes[state.selectedPreset as keyof typeof sizes] as { head_min_pct?: number; head_max_pct?: number } | undefined;
    const minPct = preset?.head_min_pct ?? 50;
    const maxPct = preset?.head_max_pct ?? 70;
    const targetHeadPct = (minPct + maxPct) / 2;
    const targetHeadHeightCanvas = gh * (targetHeadPct / 100);

    const targetScale = targetHeadHeightCanvas / estHeadHeightImg;
    const targetAngle = -tiltAngleDeg;

    const targetEyeCanvas = {
      x: gx + gw / 2,
      y: gy + gh * 0.42,
    };

    const imgWidth = imgObj.width || 1;
    const imgHeight = imgObj.height || 1;
    const imgCenter = { x: imgWidth / 2, y: imgHeight / 2 };
    
    const vecToEye = {
      x: eyeMidpoint.x - imgCenter.x,
      y: eyeMidpoint.y - imgCenter.y,
    };

    const cos = Math.cos(-tiltAngleRad);
    const sin = Math.sin(-tiltAngleRad);
    const rotatedVecToEye = {
      x: (vecToEye.x * cos - vecToEye.y * sin) * targetScale,
      y: (vecToEye.x * sin + vecToEye.y * cos) * targetScale,
    };

    const targetImgCenter = {
      x: targetEyeCanvas.x - rotatedVecToEye.x,
      y: targetEyeCanvas.y - rotatedVecToEye.y,
    };

    pushHistory();

    imgObj.set({
      scaleX: targetScale,
      scaleY: targetScale,
      angle: targetAngle,
      left: targetImgCenter.x,
      top: targetImgCenter.y,
    });

    dispatch({
      type: 'SET_IMAGE_TRANSFORM',
      payload: {
        left: targetImgCenter.x,
        top: targetImgCenter.y,
        scaleX: targetScale,
        scaleY: targetScale,
        angle: targetAngle,
      },
    });

    canvas.renderAll();
  }, [getFrameRect, state.selectedPreset, pushHistory, dispatch]);

  // Reusable Frame Fit Zoom function
  const handleFit = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const imgObj = canvas.getObjects().find((o) => (o as any).data?.isUserImage) as fabric.FabricImage;
    if (!imgObj) return;

    const rect = getFrameRect();
    if (!rect) return;
    const { gx, gy, gw, gh } = rect;

    pushHistory();

    imgObj.set({ angle: 0 });

    const imgW = imgObj.width || 1;
    const imgH = imgObj.height || 1;
    const scale = Math.max(gw / imgW, gh / imgH);

    const defaultTransform = {
      left: gx + gw / 2,
      top: gy + gh / 2,
      scaleX: scale,
      scaleY: scale,
      angle: 0,
    };

    imgObj.set(defaultTransform);
    dispatch({ type: 'SET_IMAGE_TRANSFORM', payload: defaultTransform });
    canvas.renderAll();
  }, [getFrameRect, pushHistory, dispatch]);

  // Zoom In and Zoom Out functions
  const handleZoomIn = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const imgObj = canvas.getObjects().find((o) => (o as any).data?.isUserImage);
    if (imgObj) {
      pushHistory();
      const newScaleX = (imgObj.scaleX || 1) * 1.1;
      const newScaleY = (imgObj.scaleY || 1) * 1.1;
      imgObj.set({ scaleX: newScaleX, scaleY: newScaleY });
      canvas.renderAll();
      dispatch({
        type: 'SET_IMAGE_TRANSFORM',
        payload: {
          left: imgObj.left || 0,
          top: imgObj.top || 0,
          scaleX: newScaleX,
          scaleY: newScaleY,
          angle: imgObj.angle || 0,
        },
      });
    }
  }, [dispatch, pushHistory]);

  const handleZoomOut = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const imgObj = canvas.getObjects().find((o) => (o as any).data?.isUserImage);
    if (imgObj) {
      pushHistory();
      const newScaleX = (imgObj.scaleX || 1) * 0.9;
      const newScaleY = (imgObj.scaleY || 1) * 0.9;
      imgObj.set({ scaleX: newScaleX, scaleY: newScaleY });
      canvas.renderAll();
      dispatch({
        type: 'SET_IMAGE_TRANSFORM',
        payload: {
          left: imgObj.left || 0,
          top: imgObj.top || 0,
          scaleX: newScaleX,
          scaleY: newScaleY,
          angle: imgObj.angle || 0,
        },
      });
    }
  }, [dispatch, pushHistory]);

  // Auto-align or fit when size preset changes
  const prevPresetRef = useRef(state.selectedPreset);
  useEffect(() => {
    const prev = prevPresetRef.current;
    prevPresetRef.current = state.selectedPreset;
    if (!canvasReady) return;
    if (prev === state.selectedPreset) return;

    const imageUrl = state.processedImage || state.originalImage;
    if (!imageUrl) return;

    // Silent background face detection and alignment
    getFaceLandmarks(imageUrl).then((landmarksResult: any) => {
      if (landmarksResult) {
        alignFace(landmarksResult);
      } else {
        handleFit();
      }
    });
  }, [state.selectedPreset, canvasReady, getFaceLandmarks, alignFace, handleFit]);

  // Face auto-alignment event handler
  useEffect(() => {
    const handleTriggerAutoAlign = (e: Event) => {
      const customEvent = e as CustomEvent;
      const landmarksResult = customEvent.detail;
      if (landmarksResult) {
        alignFace(landmarksResult);
      }
    };

    document.addEventListener('trigger-auto-align', handleTriggerAutoAlign);
    return () => {
      document.removeEventListener('trigger-auto-align', handleTriggerAutoAlign);
    };
  }, [canvasReady, alignFace]);

  const handleRemoveBackground = useCallback(async () => {
    if (!state.originalImage) return;
    dispatch({ type: 'SET_IS_PROCESSING', payload: true });
    try {
      pushHistory();
      const result = await removeBackground(state.originalImage);
      dispatch({ type: 'SET_PROCESSED_IMAGE', payload: result });
      dispatch({ type: 'SET_BACKGROUND_REMOVED', payload: true });
    } catch (error) {
      console.error('Background removal failed:', error);
    } finally {
      dispatch({ type: 'SET_IS_PROCESSING', payload: false });
      dispatch({ type: 'SET_PROCESSING_PROGRESS', payload: 0 });
    }
  }, [state.originalImage, removeBackground, dispatch, pushHistory]);

  const handleBrightnessChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { pushHistory(); dispatch({ type: 'SET_BRIGHTNESS', payload: Number(e.target.value) }); }, [dispatch, pushHistory]);
  const handleContrastChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { pushHistory(); dispatch({ type: 'SET_CONTRAST', payload: Number(e.target.value) }); }, [dispatch, pushHistory]);
  const handleSharpnessChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { pushHistory(); dispatch({ type: 'SET_SHARPNESS', payload: Number(e.target.value) }); }, [dispatch, pushHistory]);

  const handleRotate = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const imgObj = canvas.getObjects().find((o) => (o as any).data?.isUserImage);
    if (imgObj) {
      pushHistory();
      const newAngle = ((imgObj.angle || 0) + 90) % 360;
      imgObj.set({ angle: newAngle });
      canvas.renderAll();
      dispatch({
        type: 'SET_IMAGE_TRANSFORM',
        payload: {
          left: imgObj.left || 0,
          top: imgObj.top || 0,
          scaleX: imgObj.scaleX || 1,
          scaleY: imgObj.scaleY || 1,
          angle: newAngle,
        },
      });
    }
  }, [dispatch, pushHistory]);

  const handleReset = useCallback(() => {
    pushHistory();
    dispatch({ type: 'RESET_EDITOR' });
    const canvas = fabricRef.current;
    if (canvas) {
      const imgObj = canvas.getObjects().find((o) => (o as any).data?.isUserImage);
      if (imgObj) {
        const rect = getFrameRect();
        if (rect) {
          const { gx, gy, gw, gh } = rect;
          const scale = Math.max(gw / (imgObj.width || 1), gh / (imgObj.height || 1));
          const defaultTransform = {
            left: gx + gw / 2,
            top: gy + gh / 2,
            scaleX: scale,
            scaleY: scale,
            angle: 0,
          };
          imgObj.set(defaultTransform);
          canvas.renderAll();
          dispatch({ type: 'SET_IMAGE_TRANSFORM', payload: defaultTransform });
        }
      }
    }
  }, [dispatch, pushHistory, getFrameRect]);

  const handleBack = useCallback(() => { dispatch({ type: 'SET_CURRENT_STEP', payload: 'upload' }); }, [dispatch]);

  const handleNext = useCallback(() => {
    const canvas = fabricRef.current;
    const rect = getFrameRect();
    if (!canvas || !rect) {
      dispatch({ type: 'SET_CURRENT_STEP', payload: 'export' });
      return;
    }
    const { gx, gy, gw, gh } = rect;

    hideGuides();
    canvas.renderAll();

    const targetWidthMm = state.customWidth;
    const targetWidthInches = targetWidthMm / 25.4;
    const targetWidthPx = targetWidthInches * 300; 
    const multiplier = targetWidthPx / gw;

    const dataUrl = canvas.toDataURL({
      format: 'png',
      left: gx,
      top: gy,
      width: gw,
      height: gh,
      multiplier: Math.max(1, multiplier),
    });

    applyGuide();

    dispatch({ type: 'SET_CROPPED_IMAGE', payload: dataUrl });
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'export' });
  }, [getFrameRect, hideGuides, applyGuide, state.customWidth, dispatch]);

  const handleBrushApply = useCallback((dataUrl: string) => {
    pushHistory();
    dispatch({ type: 'SET_PROCESSED_IMAGE', payload: dataUrl });
    dispatch({ type: 'SET_BACKGROUND_REMOVED', payload: true });
    setShowBrush(false);
  }, [dispatch, pushHistory]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full">
      <div className="flex-1 flex flex-col items-center">
        <div ref={containerRef} className="relative bg-slate-200 rounded-2xl overflow-hidden shadow-xl ring-1 ring-slate-200">
          <canvas ref={canvasRef} />
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
              <div className="w-56 bg-slate-300 rounded-full h-3 overflow-hidden">
                <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-white font-medium">{t('editor.removingBackground')}</p>
            </div>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-2 font-mono">
          Canvas: {fabricRef.current ? `${fabricRef.current.getWidth()}x${fabricRef.current.getHeight()}` : 'none'} | 
          Rect: {getFrameRect() ? `gx=${getFrameRect()?.gx.toFixed(1)} gy=${getFrameRect()?.gy.toFixed(1)} gw=${getFrameRect()?.gw.toFixed(1)} gh=${getFrameRect()?.gh.toFixed(1)}` : 'none'}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          <button onClick={handleBack} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors">
            {t('editor.back')}
          </button>
          <button onClick={undo} disabled={!canUndo} className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors disabled:opacity-40" title="Undo (Ctrl+Z)">
            ↩
          </button>
          <button onClick={redo} disabled={!canRedo} className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors disabled:opacity-40" title="Redo (Ctrl+Shift+Z)">
            ↪
          </button>
          <button onClick={handleZoomIn} className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors" title={t('editor.zoomIn')}>
            🔍+
          </button>
          <button onClick={handleZoomOut} className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors" title={t('editor.zoomOut')}>
            🔍-
          </button>
          <button onClick={handleFit} className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors" title={t('editor.fit')}>
            ⛶ {t('editor.fit')}
          </button>
          <button onClick={handleNext} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            {t('editor.next')}
          </button>
        </div>
      </div>

      <div className="w-full lg:w-72 flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> {t('editor.removeBackground')}
          </h3>
          <div className="flex flex-col gap-2">
            <button onClick={handleRemoveBackground} disabled={isProcessing || state.backgroundRemoved}
              className={`w-full py-2.5 px-4 rounded-xl font-medium transition-all ${state.backgroundRemoved ? 'bg-green-100 text-green-700 cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'}`}>
              {state.backgroundRemoved ? t('editor.backgroundRemoved') : t('editor.removeBackground')}
            </button>
            <button onClick={() => setShowBrush(true)} disabled={!state.backgroundRemoved || !state.processedImage}
              className={`w-full py-2 px-4 rounded-xl font-medium transition-colors ${state.backgroundRemoved && state.processedImage ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer' : 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-50'}`}>
              🖌 {t('editor.touchUp')}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500" /> {t('sidebar.faceAlignment')}
          </h3>
          <div className="space-y-5">
            <div>
              <label className="flex justify-between text-sm text-slate-600 mb-1.5">
                <span>{t('editor.brightness')}</span><span className="text-slate-400">{state.brightness}%</span>
              </label>
              <input type="range" min="0" max="200" value={state.brightness} onChange={handleBrightnessChange}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
            </div>
            <div>
              <label className="flex justify-between text-sm text-slate-600 mb-1.5">
                <span>{t('editor.contrast')}</span><span className="text-slate-400">{state.contrast}%</span>
              </label>
              <input type="range" min="0" max="200" value={state.contrast} onChange={handleContrastChange}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
            </div>
            <div>
              <label className="flex justify-between text-sm text-slate-600 mb-1.5">
                <span>{t('editor.sharpness')}</span><span className="text-slate-400">{state.sharpness}</span>
              </label>
              <input type="range" min="0" max="100" value={state.sharpness} onChange={handleSharpnessChange}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleRotate} className="flex-1 py-2 px-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors text-sm">
                {t('editor.rotate')}
              </button>
              <button onClick={handleReset} className="flex-1 py-2 px-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors text-sm">
                {t('editor.reset')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showBrush && state.processedImage && state.originalImage && (
        <BrushEditor cutout={state.processedImage} original={state.originalImage} onApply={handleBrushApply} onClose={() => setShowBrush(false)} />
      )}
    </div>
  );
}
