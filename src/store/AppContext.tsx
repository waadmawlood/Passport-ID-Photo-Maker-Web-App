import { createContext, useContext, useReducer, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { HistoryManager } from '../services/history';
import sizes from '../specs/sizes.json';

export type BackgroundColor = 'white' | 'lightGray' | 'lightBlue' | 'red' | 'custom';

export interface AppState {
  // Image state
  originalImage: string | null;
  processedImage: string | null;
  croppedImage: string | null;
  backgroundRemoved: boolean;

  // Editor state
  brightness: number;
  contrast: number;
  sharpness: number;
  rotation: number;
  imageTransform: { left: number; top: number; scaleX: number; scaleY: number; angle: number } | null;

  // Size preset
  selectedPreset: string;
  customWidth: number;
  customHeight: number;

  // Background color
  backgroundColor: BackgroundColor;
  customColor: string;

  // UI state
  currentStep: 'upload' | 'edit' | 'export';
  isProcessing: boolean;
  processingProgress: number;
  locale: 'en' | 'ar';
  theme: 'light' | 'dark';
}

const savedLocale = typeof window !== 'undefined' ? localStorage.getItem('app_locale') as 'en' | 'ar' : null;
const savedTheme = typeof window !== 'undefined' ? localStorage.getItem('app_theme') as 'light' | 'dark' : null;
const savedPreset = typeof window !== 'undefined' ? localStorage.getItem('app_selectedPreset') : null;
const defaultPresetId = savedPreset || 'iraq_passport';
const defaultPreset = sizes[defaultPresetId as keyof typeof sizes] || sizes['iraq_passport'];

const initialState: AppState = {
  originalImage: null,
  processedImage: null,
  croppedImage: null,
  backgroundRemoved: false,
  brightness: 100,
  contrast: 100,
  sharpness: 0,
  rotation: 0,
  imageTransform: null,
  selectedPreset: defaultPresetId,
  customWidth: defaultPreset.width_mm,
  customHeight: defaultPreset.height_mm,
  backgroundColor: 'white',
  customColor: '#ffffff',
  currentStep: 'upload',
  isProcessing: false,
  processingProgress: 0,
  locale: savedLocale || 'en',
  theme: savedTheme || (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
};

type AppAction =
  | { type: 'SET_ORIGINAL_IMAGE'; payload: string | null }
  | { type: 'SET_PROCESSED_IMAGE'; payload: string | null }
  | { type: 'SET_CROPPED_IMAGE'; payload: string | null }
  | { type: 'SET_BACKGROUND_REMOVED'; payload: boolean }
  | { type: 'SET_BRIGHTNESS'; payload: number }
  | { type: 'SET_CONTRAST'; payload: number }
  | { type: 'SET_SHARPNESS'; payload: number }
  | { type: 'SET_ROTATION'; payload: number }
  | { type: 'SET_IMAGE_TRANSFORM'; payload: { left: number; top: number; scaleX: number; scaleY: number; angle: number } | null }
  | { type: 'SET_SELECTED_PRESET'; payload: string }
  | { type: 'SET_CUSTOM_SIZE'; payload: { width: number; height: number } }
  | { type: 'SET_BACKGROUND_COLOR'; payload: BackgroundColor }
  | { type: 'SET_CUSTOM_COLOR'; payload: string }
  | { type: 'SET_CURRENT_STEP'; payload: 'upload' | 'edit' | 'export' }
  | { type: 'SET_IS_PROCESSING'; payload: boolean }
  | { type: 'SET_PROCESSING_PROGRESS'; payload: number }
  | { type: 'SET_LOCALE'; payload: 'en' | 'ar' }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'RESET_EDITOR' }
  | { type: 'UNDO'; payload: Partial<AppState> }
  | { type: 'REDO'; payload: Partial<AppState> };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_ORIGINAL_IMAGE':
      return { ...state, originalImage: action.payload };
    case 'SET_PROCESSED_IMAGE':
      return { ...state, processedImage: action.payload };
    case 'SET_CROPPED_IMAGE':
      return { ...state, croppedImage: action.payload };
    case 'SET_BACKGROUND_REMOVED':
      return { ...state, backgroundRemoved: action.payload };
    case 'SET_BRIGHTNESS':
      return { ...state, brightness: action.payload };
    case 'SET_CONTRAST':
      return { ...state, contrast: action.payload };
    case 'SET_SHARPNESS':
      return { ...state, sharpness: action.payload };
    case 'SET_ROTATION':
      return { ...state, rotation: action.payload };
    case 'SET_IMAGE_TRANSFORM':
      return { ...state, imageTransform: action.payload };
    case 'SET_SELECTED_PRESET': {
      const presetId = action.payload;
      const preset = sizes[presetId as keyof typeof sizes];
      if (preset && presetId !== 'custom') {
        return {
          ...state,
          selectedPreset: presetId,
          customWidth: preset.width_mm,
          customHeight: preset.height_mm,
        };
      }
      return { ...state, selectedPreset: presetId };
    }
    case 'SET_CUSTOM_SIZE':
      return {
        ...state,
        customWidth: action.payload.width,
        customHeight: action.payload.height,
      };
    case 'SET_BACKGROUND_COLOR':
      return { ...state, backgroundColor: action.payload };
    case 'SET_CUSTOM_COLOR':
      return { ...state, customColor: action.payload };
    case 'SET_CURRENT_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_IS_PROCESSING':
      return { ...state, isProcessing: action.payload };
    case 'SET_PROCESSING_PROGRESS':
      return { ...state, processingProgress: action.payload };
    case 'SET_LOCALE':
      return { ...state, locale: action.payload };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'RESET_EDITOR':
      return {
        ...state,
        processedImage: null,
        croppedImage: null,
        backgroundRemoved: false,
        brightness: 100,
        contrast: 100,
        sharpness: 0,
        rotation: 0,
        imageTransform: null,
      };
    case 'UNDO':
    case 'REDO':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  canUndo: boolean;
  canRedo: boolean;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const historyRef = useRef(new HistoryManager());

  useEffect(() => {
    localStorage.setItem('app_locale', state.locale);
    localStorage.setItem('app_theme', state.theme);
    localStorage.setItem('app_selectedPreset', state.selectedPreset);
  }, [state.locale, state.theme, state.selectedPreset]);

  const pushHistory = useCallback(() => {
    historyRef.current.push({
      originalImage: state.originalImage,
      processedImage: state.processedImage,
      croppedImage: state.croppedImage,
      brightness: state.brightness,
      contrast: state.contrast,
      rotation: state.rotation,
      imageTransform: state.imageTransform,
    });
  }, [state]);

  const undo = useCallback(() => {
    const prevState = historyRef.current.undo();
    if (prevState) {
      dispatch({ type: 'UNDO', payload: prevState });
    }
  }, [dispatch]);

  const redo = useCallback(() => {
    const nextState = historyRef.current.redo();
    if (nextState) {
      dispatch({ type: 'REDO', payload: nextState });
    }
  }, [dispatch]);

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        canUndo: historyRef.current.canUndo(),
        canRedo: historyRef.current.canRedo(),
        pushHistory,
        undo,
        redo,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}