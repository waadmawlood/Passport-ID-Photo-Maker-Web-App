import React, { useEffect, useCallback } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import { useI18n } from './hooks/useI18n';
import { Upload } from './components/Upload/Upload';
import { Editor } from './components/Editor/Editor';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PrintSheet } from './components/PrintSheet/PrintSheet';

const STEPS = ['upload', 'edit', 'export'] as const;

function StepIndicator({ current }: { current: (typeof STEPS)[number] }) {
  const { state, dispatch } = useApp();
  const { t } = useI18n();
  const currentIndex = STEPS.indexOf(current);
  const labels = [t('upload.title'), t('editor.title'), t('export.printSheet')];
  
  const handleStepClick = (step: (typeof STEPS)[number]) => {
    if (!state.originalImage && step !== 'upload') return;
    dispatch({ type: 'SET_CURRENT_STEP', payload: step });
  };

  return (
    <div className="hidden md:flex items-center gap-1">
      {STEPS.map((step, index) => {
        const isActive = step === current;
        const isDone = index < currentIndex;
        const canClick = state.originalImage !== null || step === 'upload';
        
        return (
          <React.Fragment key={step}>
            <button
              onClick={() => handleStepClick(step)}
              disabled={!canClick}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isActive ? 'bg-blue-50 dark:bg-blue-900/30' : canClick ? 'bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer' : 'bg-transparent opacity-50 cursor-not-allowed'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${isActive ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/50' : isDone ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
                {isDone ? '✓' : index + 1}
              </div>
              <span className={`text-sm font-medium ${isActive ? 'text-blue-700 dark:text-blue-400' : isDone ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-slate-400'}`}>
                {labels[index]}
              </span>
            </button>
            {index < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 rounded ${isDone ? 'bg-green-400' : 'bg-gray-200 dark:bg-slate-700'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function AppContent() {
  const { state, dispatch, canUndo, canRedo, undo, redo } = useApp();
  const { t, locale } = useI18n();

  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  const toggleLocale = useCallback(() => {
    dispatch({ type: 'SET_LOCALE', payload: locale === 'en' ? 'ar' : 'en' });
  }, [locale, dispatch]);

  const toggleTheme = useCallback(() => {
    dispatch({ type: 'SET_THEME', payload: state.theme === 'dark' ? 'light' : 'dark' });
  }, [state.theme, dispatch]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      }
      if ((e.ctrlKey || e.metaKey) && ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        if (canRedo) redo();
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'SET_CURRENT_STEP', payload: 'upload' });
      }
    },
    [canUndo, canRedo, undo, redo, dispatch]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  useEffect(() => {
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.theme]);

  const renderStep = () => {
    switch (state.currentStep) {
      case 'upload':
        return <Upload />;
      case 'edit':
        return (
          <div className="flex flex-col lg:flex-row gap-6 p-4 max-w-7xl mx-auto items-start">
            <div className="flex-1 min-w-0">
              <Editor />
            </div>
            <Sidebar />
          </div>
        );
      case 'export':
        return <PrintSheet />;
      default:
        return <Upload />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950 transition-colors duration-200">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{t('app.title')}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">🔒 {t('app.privacy')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 relative">
            <StepIndicator current={state.currentStep} />
            <button onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              ⚙️ {t('settings.title')}
            </button>
            {isSettingsOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                <div className="p-2 space-y-1">
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('settings.theme')}
                  </div>
                  <button onClick={() => { toggleTheme(); setIsSettingsOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center justify-between transition-colors">
                    <span>{state.theme === 'light' ? '🌙 ' + t('settings.dark') : '☀️ ' + t('settings.light')}</span>
                  </button>
                  <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('settings.language')}
                  </div>
                  <button onClick={() => { toggleLocale(); setIsSettingsOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center justify-between transition-colors">
                    <span>{locale === 'en' ? '🇸🇦 ' + t('settings.arabic') : '🇺🇸 ' + t('settings.english')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 py-6">{renderStep()}</main>

      <footer className="bg-white/60 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 py-4 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>🔒 {t('app.privacyFull')}</p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
