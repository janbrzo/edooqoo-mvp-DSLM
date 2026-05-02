/**
 * Drawing Overlay Types for Live Session
 * 
 * REDESIGNED based on Windows Snipping Tool (version 11.2510.31.0)
 * Simplified tools: marker, highlighter, arrow, eraser, select-worksheet
 */

// ============================================
// NARZĘDZIA RYSOWANIA
// ============================================

/**
 * Dostępne narzędzia rysowania (zredukowane jak w Snipping Tool)
 */
export type DrawingTool = 
  | 'select-worksheet' // Zaznaczanie treści worksheet (nie elementów rysunku)
  | 'marker'           // Pisak - do rysowania
  | 'highlighter'      // Zakreślacz - półprzezroczysty
  | 'arrow'            // Strzałka z grotem
  | 'eraser';          // Gumka - usuwanie obiektów

/**
 * Informacje o każdym narzędziu
 */
export interface DrawingToolInfo {
  id: DrawingTool;
  label: string;
  icon: string; // Lucide icon name
  shortcut?: string;
  hasColorPicker?: boolean; // Czy pokazać color picker
  hasStrokeWidth?: boolean; // Czy pokazać stroke width slider
}

/**
 * Lista wszystkich narzędzi z metadanymi
 * UWAGA: Eraser, Undo, Redo tymczasowo ukryte - do poprawy później
 */
export const DRAWING_TOOLS: DrawingToolInfo[] = [
  { id: 'select-worksheet', label: 'Select on Worksheet', icon: 'MousePointer2', shortcut: 'V', hasColorPicker: false, hasStrokeWidth: false },
  { id: 'marker', label: 'Marker', icon: 'Pen', shortcut: 'M', hasColorPicker: true, hasStrokeWidth: true },
  { id: 'highlighter', label: 'Highlighter', icon: 'Highlighter', shortcut: 'H', hasColorPicker: true, hasStrokeWidth: true },
  { id: 'arrow', label: 'Arrow', icon: 'MoveUpRight', shortcut: 'A', hasColorPicker: true, hasStrokeWidth: true },
  // { id: 'eraser', label: 'Eraser', icon: 'Eraser', shortcut: 'E', hasColorPicker: false, hasStrokeWidth: false }, // TYMCZASOWO UKRYTE
];

// ============================================
// KOLORY
// ============================================

/**
 * Predefiniowane kolory do rysowania
 */
export interface DrawingColor {
  name: string;
  value: string; // HSL format
  hex: string;   // For Fabric.js
}

/**
 * Kolory dla Marker i Arrow (15 kolorów - jak w Snipping Tool)
 */
export const MARKER_COLORS: DrawingColor[] = [
  { name: 'Black', value: 'hsl(0, 0%, 0%)', hex: '#000000' },
  { name: 'White', value: 'hsl(0, 0%, 100%)', hex: '#ffffff' },
  { name: 'Gray', value: 'hsl(0, 0%, 50%)', hex: '#808080' },
  { name: 'Red', value: 'hsl(0, 84%, 60%)', hex: '#ef4444' },
  { name: 'Maroon', value: 'hsl(0, 100%, 25%)', hex: '#800000' },
  { name: 'Orange', value: 'hsl(25, 95%, 53%)', hex: '#f97316' },
  { name: 'Yellow', value: 'hsl(48, 96%, 53%)', hex: '#eab308' },
  { name: 'Lime', value: 'hsl(84, 81%, 44%)', hex: '#84cc16' },
  { name: 'Green', value: 'hsl(142, 71%, 45%)', hex: '#22c55e' },
  { name: 'Teal', value: 'hsl(174, 72%, 40%)', hex: '#14b8a6' },
  { name: 'Blue', value: 'hsl(217, 91%, 60%)', hex: '#3b82f6' },
  { name: 'Navy', value: 'hsl(224, 64%, 33%)', hex: '#1e3a5f' },
  { name: 'Purple', value: 'hsl(271, 91%, 65%)', hex: '#a855f7' },
  { name: 'Pink', value: 'hsl(330, 81%, 60%)', hex: '#ec4899' },
  { name: 'Brown', value: 'hsl(20, 50%, 40%)', hex: '#8B4513' },
];

/**
 * Kolory dla Highlighter (5 kolorów podświetlających - semi-transparent)
 */
export const HIGHLIGHTER_COLORS: DrawingColor[] = [
  { name: 'Yellow', value: 'hsla(60, 100%, 50%, 0.4)', hex: 'rgba(255, 255, 0, 0.4)' },
  { name: 'Green', value: 'hsla(120, 100%, 50%, 0.4)', hex: 'rgba(0, 255, 0, 0.4)' },
  { name: 'Blue', value: 'hsla(200, 100%, 50%, 0.4)', hex: 'rgba(0, 180, 255, 0.4)' },
  { name: 'Pink', value: 'hsla(330, 100%, 70%, 0.4)', hex: 'rgba(255, 105, 180, 0.4)' },
  { name: 'Orange', value: 'hsla(30, 100%, 50%, 0.4)', hex: 'rgba(255, 165, 0, 0.4)' },
];

/**
 * Wszystkie kolory (dla kompatybilności)
 */
export const DRAWING_COLORS: DrawingColor[] = MARKER_COLORS;

/**
 * Domyślny kolor
 */
export const DEFAULT_DRAWING_COLOR = MARKER_COLORS[0]; // Black
export const DEFAULT_HIGHLIGHTER_COLOR = HIGHLIGHTER_COLORS[0]; // Yellow

// ============================================
// GRUBOŚĆ LINII
// ============================================

/**
 * Grubość linii
 */
export interface StrokeWidth {
  name: string;
  value: number;
}

/**
 * Grubości - zakres 1-16 (generowane dynamicznie)
 */
export const STROKE_WIDTHS: StrokeWidth[] = Array.from({ length: 16 }, (_, i) => ({
  name: `${i + 1}`,
  value: i + 1,
}));

/**
 * Domyślna grubość
 */
export const DEFAULT_STROKE_WIDTH: StrokeWidth = { name: '4', value: 4 }; // Medium

// ============================================
// STAN RYSOWANIA
// ============================================

/**
 * Stan narzędzia rysowania
 */
export interface DrawingState {
  isEnabled: boolean;          // Czy rysowanie jest włączone
  activeTool: DrawingTool;     // Aktualnie wybrane narzędzie
  activeColor: DrawingColor;   // Aktualnie wybrany kolor
  strokeWidth: StrokeWidth;    // Aktualnie wybrana grubość
  canUndo: boolean;            // Czy można cofnąć
  canRedo: boolean;            // Czy można powtórzyć
  isSaving: boolean;           // Czy trwa zapisywanie
  lastSavedAt: Date | null;    // Ostatni zapis
}

/**
 * Domyślny stan
 */
export const DEFAULT_DRAWING_STATE: DrawingState = {
  isEnabled: false,
  activeTool: 'marker',
  activeColor: DEFAULT_DRAWING_COLOR,
  strokeWidth: DEFAULT_STROKE_WIDTH,
  canUndo: false,
  canRedo: false,
  isSaving: false,
  lastSavedAt: null,
};

// ============================================
// DANE RYSUNKU (do zapisu w bazie)
// ============================================

/**
 * Struktura danych rysunku zapisywana w bazie
 */
export interface DrawingData {
  objects: FabricObjectData[];  // Obiekty Fabric.js
  version: string;              // Wersja formatu (dla kompatybilności)
  canvasWidth?: number;         // Szerokość canvas przy zapisie
  canvasHeight?: number;        // Wysokość canvas przy zapisie
}

/**
 * Pojedynczy obiekt Fabric.js (uproszczony typ)
 */
export interface FabricObjectData {
  type: string;
  left: number;
  top: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  path?: any[];           // Dla ścieżek (marker)
  text?: string;          // Dla tekstu
  points?: any[];         // Dla linii, strzałek
  [key: string]: any;     // Inne właściwości Fabric.js
}

/**
 * Domyślne dane pustego rysunku
 */
export const EMPTY_DRAWING_DATA: DrawingData = {
  objects: [],
  version: '1.0',
};

// ============================================
// REKORD BAZY DANYCH
// ============================================

/**
 * Rekord z tabeli worksheet_drawings
 */
export interface WorksheetDrawing {
  id: string;
  worksheet_id: string;
  teacher_id: string;
  drawing_data: DrawingData;
  created_at: string;
  updated_at: string;
}

// ============================================
// PROPS KOMPONENTÓW
// ============================================

/**
 * Props dla DrawingOverlay
 */
export interface DrawingOverlayProps {
  worksheetId: string;
  teacherId: string;
  isTeacher: boolean;           // Czy użytkownik jest nauczycielem
  isEnabled: boolean;           // Czy tryb rysowania jest włączony
  onDrawingChange?: (data: DrawingData) => void;
}

/**
 * Ustawienia per narzędzie (kolor + grubość)
 */
export interface ToolSettings {
  color: DrawingColor;
  strokeWidth: StrokeWidth;
}

/**
 * Mapa ustawień dla wszystkich narzędzi rysujących
 */
export interface ToolSettingsMap {
  marker: ToolSettings;
  highlighter: ToolSettings;
  arrow: ToolSettings;
}

/**
 * Props dla DrawingToolbar
 */
export interface DrawingToolbarProps {
  state: DrawingState;
  /** NAPRAWKA v5: Osobne ustawienia dla każdego narzędzia */
  toolSettings?: ToolSettingsMap;
  onToolChange: (tool: DrawingTool) => void;
  onColorChange: (color: DrawingColor) => void;
  onStrokeWidthChange: (width: StrokeWidth) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
}

/**
 * Props dla DrawingToggleButton
 */
export interface DrawingToggleButtonProps {
  isEnabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * Props dla DrawingColorPicker
 */
export interface DrawingColorPickerProps {
  selectedColor: DrawingColor;
  onColorSelect: (color: DrawingColor) => void;
}

/**
 * Props dla DrawingStrokeWidth
 */
export interface DrawingStrokeWidthProps {
  selectedWidth: StrokeWidth;
  onWidthSelect: (width: StrokeWidth) => void;
}

// ============================================
// REALTIME EVENTS
// ============================================

/**
 * Typy eventów Realtime dla synchronizacji
 */
export type DrawingRealtimeEventType = 
  | 'drawing:update'    // Aktualizacja rysunku
  | 'drawing:clear'     // Wyczyszczenie wszystkiego
  | 'drawing:object:add'    // Dodanie obiektu
  | 'drawing:object:modify' // Modyfikacja obiektu
  | 'drawing:object:remove'; // Usunięcie obiektu

/**
 * Payload eventu Realtime
 */
export interface DrawingRealtimePayload {
  type: DrawingRealtimeEventType;
  worksheetId: string;
  teacherId: string;
  data: Partial<DrawingData> | FabricObjectData | null;
  timestamp: number;
}

// ============================================
// HISTORIA (Undo/Redo)
// ============================================

/**
 * Konfiguracja historii
 */
export const DRAWING_HISTORY_CONFIG = {
  maxSteps: 50,           // Maksymalna liczba kroków w historii
  debounceMs: 300,        // Debounce przed zapisem do historii
};

/**
 * Stan historii
 */
export interface DrawingHistoryState {
  undoStack: DrawingData[];
  redoStack: DrawingData[];
}

// ============================================
// AUTO-SAVE
// ============================================

/**
 * Konfiguracja auto-save
 */
export const DRAWING_AUTOSAVE_CONFIG = {
  debounceMs: 2000,       // Debounce przed zapisem do bazy (2s)
  maxRetries: 3,          // Maksymalna liczba prób zapisu
  retryDelayMs: 1000,     // Opóźnienie między próbami
};

// ============================================
// LIMITY
// ============================================

/**
 * Limity bezpieczeństwa
 */
export const DRAWING_LIMITS = {
  maxObjects: 500,        // Maksymalna liczba obiektów na canvas
  maxDataSizeKB: 1024,    // Maksymalny rozmiar danych (1MB)
};
