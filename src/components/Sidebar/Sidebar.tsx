import { useMemo, useCallback } from 'react';
import { useApp, type BackgroundColor } from '../../store/AppContext';
import { useI18n } from '../../hooks/useI18n';
import { useFaceDetection } from '../../hooks/useFaceDetection';
import { getBackgroundColorValue } from '../../utils/image';
import sizes from '../../specs/sizes.json';

export function Sidebar() {
  const { state, dispatch } = useApp();
  const { t } = useI18n();
  const { getFaceLandmarks, isDetecting } = useFaceDetection();

  const presets = useMemo(() => {
    return Object.values(sizes).map((preset) => ({
      ...preset,
      name: preset.names[state.locale as keyof typeof preset.names] || preset.names.en,
    }));
  }, [state.locale]);

  const selectedPreset = useMemo(() => sizes[state.selectedPreset as keyof typeof sizes], [state.selectedPreset]);

  const backgroundColors: { value: BackgroundColor; color: string; label: string }[] = [
    { value: 'white', color: '#ffffff', label: t('colors.white') },
    { value: 'lightGray', color: '#f3f4f6', label: t('colors.lightGray') },
    { value: 'lightBlue', color: '#dbeafe', label: t('colors.lightBlue') },
    { value: 'red', color: '#fee2e2', label: t('colors.red') },
    { value: 'custom', color: state.customColor, label: t('colors.custom') },
  ];

  const currentBg = getBackgroundColorValue(state);
  const supportsTransparency = state.backgroundRemoved || (state.originalImage && (state.originalImage.startsWith('data:image/png') || state.originalImage.startsWith('data:image/webp')));

  const handlePresetChange = (presetId: string) => {
    dispatch({ type: 'SET_SELECTED_PRESET', payload: presetId });
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_CUSTOM_SIZE', payload: { width: Number(e.target.value), height: state.customHeight } });
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_CUSTOM_SIZE', payload: { width: state.customWidth, height: Number(e.target.value) } });
  };

  const handleBackgroundColorChange = (color: BackgroundColor) => {
    dispatch({ type: 'SET_BACKGROUND_COLOR', payload: color });
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_CUSTOM_COLOR', payload: e.target.value });
  };

  const handleAutoAlign = useCallback(async () => {
    const imageUrl = state.processedImage || state.originalImage;
    if (!imageUrl) return;
    try {
      const landmarksResult = await getFaceLandmarks(imageUrl);
      if (!landmarksResult) {
        alert(state.locale === 'ar' ? 'لم يتم العثور على وجه في الصورة. يرجى ضبطها يدوياً.' : 'No face detected in the photo. Please align manually.');
        return;
      }
      const event = new CustomEvent('trigger-auto-align', { detail: landmarksResult });
      document.dispatchEvent(event);
    } catch (error) {
      console.error('Auto-align error:', error);
    }
  }, [state.processedImage, state.originalImage, getFaceLandmarks, state.locale]);

  return (
    <div className="w-full lg:w-80 flex flex-col gap-4">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-slate-400" /> {t('sidebar.sizePreset')}
        </h3>
        <select value={state.selectedPreset} onChange={(e) => handlePresetChange(e.target.value)}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>{preset.name} --- ({preset.width_mm} × {preset.height_mm} mm)</option>
          ))}
        </select>
        {state.selectedPreset === 'custom' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('sidebar.width')}</label>
              <input type="number" value={state.customWidth} onChange={handleWidthChange} min="10" max="200"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('sidebar.height')}</label>
              <input type="number" value={state.customHeight} onChange={handleHeightChange} min="10" max="200"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        )}
        {selectedPreset && (
          <div className="mt-3 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1">
            <p><span className="font-medium text-slate-700">{t('sidebar.selected')}:</span> {selectedPreset.names[state.locale as keyof typeof selectedPreset.names] || selectedPreset.names.en}</p>
            <p><span className="font-medium text-slate-700">{t('sidebar.size')}:</span> {selectedPreset.width_mm} × {selectedPreset.height_mm} mm</p>
            {selectedPreset.head_min_pct && (
              <p><span className="font-medium text-slate-700">{t('sidebar.headHeight')}:</span> {selectedPreset.head_min_pct}–{selectedPreset.head_max_pct}%</p>
            )}
          </div>
        )}
      </div>

      <div className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-100 ${!supportsTransparency ? 'opacity-70' : ''}`}>
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-500" /> {t('sidebar.backgroundColor')}
        </h3>
        {!supportsTransparency ? (
          <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
            {t('sidebar.removeBgForColors')}
          </div>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              {backgroundColors.map((bg) => (
                <button key={bg.value} onClick={() => handleBackgroundColorChange(bg.value)}
                  className={`w-10 h-10 rounded-xl border-2 transition-all ${state.backgroundColor === bg.value ? 'border-blue-500 scale-110 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}
                  style={{ backgroundColor: bg.color }} title={bg.label} />
              ))}
            </div>
            {state.backgroundColor === 'custom' && (
              <div className="mt-3 flex gap-2 items-center">
                <input type="color" value={state.customColor} onChange={handleCustomColorChange}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent" />
                <input type="text" value={state.customColor} onChange={handleCustomColorChange}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span>{t('sidebar.applied')}:</span>
              <span className="w-5 h-5 rounded border border-slate-200" style={{ backgroundColor: currentBg }} />
              <span className="font-mono">{currentBg}</span>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500" /> {t('sidebar.faceAlignment')}
        </h3>
        <button onClick={handleAutoAlign} disabled={isDetecting || !state.originalImage}
          className="w-full py-2.5 px-4 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {isDetecting ? t('sidebar.detecting') : t('sidebar.autoAlignFace')}
        </button>
        <p className="text-xs text-slate-500 mt-2">{t('sidebar.autoAlignDesc')}</p>
      </div>
    </div>
  );
}
