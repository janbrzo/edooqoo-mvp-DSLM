/**
 * DrawingOverlay - Nakładka canvas z Fabric.js (REDESIGNED v6.0 - Windows Snipping Tool style)
 * 
 * Główny komponent do rysowania po worksheet.
 * Narzędzia: marker, highlighter, arrow, eraser, select-worksheet
 * 
 * NAPRAWIONE v6.0:
 * - GUMKA: Całkowicie przepisana - używa getBoundingRect i sprawdza odległość od kursora
 * - GUMKA: Działa przy przeciąganiu myszką (nie tylko kliknięciu)
 * - GUMKA: Usuwa całe strzałki (linia + grot) jako jeden obiekt przez metadata
 * - UNDO/REDO: Przepisane z useState dla historii - nie używa refs dla stanów
 * - UNDO/REDO: Poprawnie limitowane do 50 kroków
 */

devLog('🎨 DrawingOverlay v6.0 loaded - FULL REWRITE of Eraser/Undo/Redo');

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, useReducer } from 'react';
import { Canvas as FabricCanvas, PencilBrush, Line, FabricObject, Triangle, Path, Point } from 'fabric';
import { 
import { devLog } from '@/utils/logger';
  DrawingOverlayProps, 
  DrawingState, 
  DrawingTool,
  DrawingColor,
  StrokeWidth,
  DrawingData,
  DEFAULT_DRAWING_STATE,
  DEFAULT_DRAWING_COLOR,
  DEFAULT_STROKE_WIDTH,
  DRAWING_LIMITS,
  DRAWING_AUTOSAVE_CONFIG,
} from '@/types/drawing';
import { DrawingToolbar } from './DrawingToolbar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useDemoContext } from '@/contexts/DemoContext';

/** Rozszerzone props z opcjonalnym zewnętrznym sterowaniem */
export interface DrawingOverlayExternalProps extends DrawingOverlayProps {
  externalTool?: DrawingTool;
  externalColor?: DrawingColor;
  externalStrokeWidth?: StrokeWidth;
  hideToolbar?: boolean;
  /** NOWE: Kontrola widoczności CSS (niezależna od isEnabled) */
  isVisible?: boolean;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onSaveStatusChange?: (isSaving: boolean, lastSavedAt: Date | null) => void;
  /** Callback gdy Select on Worksheet jest aktywne (do wyłączenia pointer-events) */
  onSelectWorksheetMode?: (isActive: boolean) => void;
}

/** Metody eksponowane przez ref */
export interface DrawingOverlayRef {
  undo: () => void;
  redo: () => void;
  clearAll: () => void;
  getCanUndo: () => boolean;
  getCanRedo: () => boolean;
}

export const DrawingOverlay = forwardRef<DrawingOverlayRef, DrawingOverlayExternalProps>(({
  worksheetId,
  teacherId,
  isTeacher,
  isEnabled,
  isVisible = true,
  onDrawingChange,
  externalTool,
  externalColor,
  externalStrokeWidth,
  hideToolbar = false,
  onHistoryChange,
  onSaveStatusChange,
  onSelectWorksheetMode
}, ref) => {
  const { isDemoMode } = useDemoContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDrawingArrowRef = useRef(false);
  const arrowStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentArrowGroupRef = useRef<{ line: Line; triangle: Triangle } | null>(null);
  const isInitializedRef = useRef(false);
  
  // NAPRAWKA v7: Historia z useReducer - gwarantuje poprawne aktualizacje stanu
  type HistoryState = { stack: string[]; index: number };
  type HistoryAction = 
    | { type: 'PUSH'; state: string }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'INIT'; state: string }
    | { type: 'CLEAR' };

  const historyReducer = (state: HistoryState, action: HistoryAction): HistoryState => {
    switch (action.type) {
      case 'PUSH': {
        // Usuń wszystkie stany po obecnym indeksie (nowa gałąź historii)
        const newStack = [...state.stack.slice(0, state.index + 1), action.state];
        // Ogranicz do 50 kroków
        const trimmedStack = newStack.length > 50 ? newStack.slice(-50) : newStack;
        const newIndex = trimmedStack.length - 1;
        devLog('🎨 [History v7] PUSH - new index:', newIndex, 'stack length:', trimmedStack.length);
        return { stack: trimmedStack, index: newIndex };
      }
      case 'UNDO': {
        const newIndex = Math.max(0, state.index - 1);
        devLog('🎨 [History v7] UNDO - new index:', newIndex);
        return { ...state, index: newIndex };
      }
      case 'REDO': {
        const newIndex = Math.min(state.stack.length - 1, state.index + 1);
        devLog('🎨 [History v7] REDO - new index:', newIndex);
        return { ...state, index: newIndex };
      }
      case 'INIT': {
        devLog('🎨 [History v7] INIT - setting initial state');
        return { stack: [action.state], index: 0 };
      }
      case 'CLEAR': {
        devLog('🎨 [History v7] CLEAR - resetting history');
        return { stack: [], index: -1 };
      }
      default:
        return state;
    }
  };

  const [historyState, dispatchHistory] = useReducer(historyReducer, { stack: [], index: -1 });
  
  // Oblicz canUndo i canRedo
  const canUndo = historyState.index > 0;
  const canRedo = historyState.index < historyState.stack.length - 1;
  
  // Synchronizuj props z callback'ami
  const updateHistoryState = useCallback(() => {
    devLog('🎨 [History v7] Update state:', { 
      stackLength: historyState.stack.length, 
      historyIndex: historyState.index, 
      canUndo, 
      canRedo 
    });
    
    onHistoryChange?.(canUndo, canRedo);
  }, [historyState.stack.length, historyState.index, canUndo, canRedo, onHistoryChange]);

  // Powiadom o zmianach historii
  useEffect(() => {
    updateHistoryState();
  }, [historyState.index, historyState.stack.length, updateHistoryState]);

  // Stan rysowania
  const [drawingState, setDrawingState] = useState<DrawingState>({
    ...DEFAULT_DRAWING_STATE,
    activeTool: 'marker',
  });

  // Synchronizuj z zewnętrznymi props
  useEffect(() => {
    if (externalTool !== undefined) {
      setDrawingState(prev => ({ ...prev, activeTool: externalTool }));
    }
  }, [externalTool]);

  useEffect(() => {
    if (externalColor !== undefined) {
      setDrawingState(prev => ({ ...prev, activeColor: externalColor }));
    }
  }, [externalColor]);

  useEffect(() => {
    if (externalStrokeWidth !== undefined) {
      setDrawingState(prev => ({ ...prev, strokeWidth: externalStrokeWidth }));
    }
  }, [externalStrokeWidth]);

  // Powiadom o trybie Select on Worksheet
  useEffect(() => {
    onSelectWorksheetMode?.(drawingState.activeTool === 'select-worksheet');
  }, [drawingState.activeTool, onSelectWorksheetMode]);

  // NAPRAWKA v7: Zapisz do historii - używa dispatch
  const saveToHistory = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const json = JSON.stringify(canvas.toJSON());
    dispatchHistory({ type: 'PUSH', state: json });
  }, []);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      saveDrawings();
    }, DRAWING_AUTOSAVE_CONFIG.debounceMs);
  }, []);

  // NAPRAWKA v5: loadDrawingsFromData zwraca Promise - resolve W CALLBACKU
  // CRITICAL: Zwraca flagę czy załadowano obiekty (do ustawienia initial state)
  const loadDrawingsFromData = useCallback((drawingData: DrawingData, shouldSaveInitialState: boolean = false): Promise<boolean> => {
    return new Promise((resolve) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !drawingData.objects || drawingData.objects.length === 0) {
        devLog('🎨 [Load] No objects to load or no canvas');
        resolve(false);
        return;
      }

      devLog('🎨 [Load] Loading', drawingData.objects.length, 'objects from data');

      canvas.loadFromJSON({ objects: drawingData.objects }, () => {
        canvas.renderAll();
        
        // Zablokuj wszystkie obiekty
        canvas.forEachObject((obj) => {
          obj.selectable = false;
          obj.evented = false;
        });
        
        devLog('🎨 [Load] Objects loaded and locked, count:', canvas.getObjects().length);
        
        // NAPRAWKA v7: Zapisz initial state używając dispatch
        if (shouldSaveInitialState) {
          const initialState = JSON.stringify(canvas.toJSON());
          dispatchHistory({ type: 'INIT', state: initialState });
          devLog('🎨 [Load v7] Initial state saved AFTER loading, objects:', canvas.getObjects().length);
        }
        
        resolve(true);
      });
    });
  }, [updateHistoryState]);

  // NAPRAWKA v5: loadDrawings czeka na loadDrawingsFromData i przekazuje flagę initial state
  const loadDrawings = useCallback(async (shouldSaveInitialState: boolean = false): Promise<boolean> => {
    if (isDemoMode) return false;
    try {
      devLog('🎨 [Load] Loading drawings for worksheet:', worksheetId, 'shouldSaveInitialState:', shouldSaveInitialState);
      
      const { data, error } = await supabase
        .from('worksheet_drawings')
        .select('drawing_data')
        .eq('worksheet_id', worksheetId)
        .maybeSingle();

      if (error) {
        console.error('🎨 [Load] Error loading drawings:', error);
        return false;
      }

      if (data?.drawing_data) {
        const drawingData = data.drawing_data as unknown as DrawingData;
        if (drawingData && drawingData.objects && drawingData.objects.length > 0) {
          await loadDrawingsFromData(drawingData, shouldSaveInitialState);
          devLog('🎨 [Load] Drawings loaded successfully');
          return true;
        }
      }
      
      devLog('🎨 [Load] No drawings found');
      return false;
    } catch (err) {
      console.error('🎨 [Load] Error loading drawings:', err);
      return false;
    }
  }, [worksheetId, loadDrawingsFromData]);

  const saveDrawings = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isTeacher || isDemoMode) return;

    setDrawingState(prev => ({ ...prev, isSaving: true }));
    onSaveStatusChange?.(true, drawingState.lastSavedAt);

    try {
      const objects = canvas.toJSON().objects || [];
      
      if (objects.length > DRAWING_LIMITS.maxObjects) {
        toast.error(`Too many objects (max ${DRAWING_LIMITS.maxObjects})`);
        setDrawingState(prev => ({ ...prev, isSaving: false }));
        onSaveStatusChange?.(false, drawingState.lastSavedAt);
        return;
      }

      const drawingData: DrawingData = {
        objects,
        version: '1.0',
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      };

      const { data: existing } = await supabase
        .from('worksheet_drawings')
        .select('id')
        .eq('worksheet_id', worksheetId)
        .maybeSingle();

      let error;
      
      if (existing) {
        const result = await supabase
          .from('worksheet_drawings')
          .update({
            drawing_data: JSON.parse(JSON.stringify(drawingData)),
            updated_at: new Date().toISOString(),
          })
          .eq('worksheet_id', worksheetId);
        error = result.error;
      } else {
        const result = await supabase
          .from('worksheet_drawings')
          .insert([{
            worksheet_id: worksheetId,
            teacher_id: teacherId,
            drawing_data: JSON.parse(JSON.stringify(drawingData)),
          }]);
        error = result.error;
      }

      if (error) throw error;

      const now = new Date();
      setDrawingState(prev => ({ 
        ...prev, 
        isSaving: false,
        lastSavedAt: now,
      }));
      onSaveStatusChange?.(false, now);

      onDrawingChange?.(drawingData);
    } catch (err) {
      console.error('Error saving drawings:', err);
      toast.error('Failed to save drawing');
      setDrawingState(prev => ({ ...prev, isSaving: false }));
      onSaveStatusChange?.(false, drawingState.lastSavedAt);
    }
  };

  // NAPRAWIONE v7: Undo cofa pojedynczy krok - używa reducer
  const handleUndo = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      devLog('🎨 [Undo v7] No canvas');
      return;
    }
    
    if (!canUndo) {
      devLog('🎨 [Undo v7] Nothing to undo, index:', historyState.index);
      return;
    }

    const newIndex = historyState.index - 1;
    const previousState = historyState.stack[newIndex];
    
    devLog('🎨 [Undo v7] Undoing to index:', newIndex, 'objects:', JSON.parse(previousState).objects?.length || 0);
    
    canvas.loadFromJSON(JSON.parse(previousState), () => {
      canvas.renderAll();
      canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
      
      dispatchHistory({ type: 'UNDO' });
      devLog('🎨 [Undo v7] State restored');
      scheduleAutoSave();
    });
  }, [canUndo, historyState.index, historyState.stack, scheduleAutoSave]);

  // NAPRAWIONE v7: Redo działa natychmiast - używa reducer
  const handleRedo = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      devLog('🎨 [Redo v7] No canvas');
      return;
    }
    
    if (!canRedo) {
      devLog('🎨 [Redo v7] Nothing to redo, index:', historyState.index, 'stack length:', historyState.stack.length);
      return;
    }

    const newIndex = historyState.index + 1;
    const nextState = historyState.stack[newIndex];
    
    devLog('🎨 [Redo v7] Redoing to index:', newIndex, 'objects:', JSON.parse(nextState).objects?.length || 0);

    canvas.loadFromJSON(JSON.parse(nextState), () => {
      canvas.renderAll();
      canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
      
      dispatchHistory({ type: 'REDO' });
      devLog('🎨 [Redo v7] State restored');
      scheduleAutoSave();
    });
  }, [canRedo, historyState.index, historyState.stack, scheduleAutoSave]);

  const handleClearAll = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    saveToHistory();
    canvas.clear();
    canvas.backgroundColor = 'transparent';
    canvas.renderAll();
    scheduleAutoSave();
  }, [saveToHistory, scheduleAutoSave]);

  // Eksponuj metody przez ref
  useImperativeHandle(ref, () => ({
    undo: handleUndo,
    redo: handleRedo,
    clearAll: handleClearAll,
    getCanUndo: () => canUndo,
    getCanRedo: () => canRedo,
  }), [handleUndo, handleRedo, handleClearAll, canUndo, canRedo]);

  // NAPRAWKA v4: Inicjalizacja Fabric.js canvas z poprawnym ładowaniem
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    
    // Jeśli canvas już istnieje, nie twórz nowego
    if (isInitializedRef.current && fabricCanvasRef.current) {
      devLog('🎨 [Init] Canvas already initialized, skipping');
      return;
    }

    devLog('🎨 [Init] Initializing Fabric.js canvas for worksheet:', worksheetId);

    const container = containerRef.current;
    const canvas = new FabricCanvas(canvasRef.current, {
      width: container.offsetWidth,
      height: container.offsetHeight,
      backgroundColor: 'transparent',
      selection: false,
      isDrawingMode: false,
    });

    // Konfiguracja pędzla
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = DEFAULT_DRAWING_COLOR.hex;
    canvas.freeDrawingBrush.width = DEFAULT_STROKE_WIDTH.value;

    fabricCanvasRef.current = canvas;
    isInitializedRef.current = true;

    // NAPRAWKA v7: Załaduj rysunki z flagą do zapisania initial state
    loadDrawings(true).then((hasDrawings) => {
      // Jeśli nie było rysunków, zapisz pusty initial state
      if (!hasDrawings && fabricCanvasRef.current) {
        const initialState = JSON.stringify(fabricCanvasRef.current.toJSON());
        dispatchHistory({ type: 'INIT', state: initialState });
        devLog('🎨 [Init v7] Empty initial state saved (no drawings found)');
      }
    });

    // Obsługa resize
    const handleResize = () => {
      if (!containerRef.current || !fabricCanvasRef.current) return;
      
      const newWidth = containerRef.current.offsetWidth;
      const newHeight = containerRef.current.offsetHeight;
      
      fabricCanvasRef.current.setDimensions({
        width: newWidth,
        height: newHeight
      });
      fabricCanvasRef.current.renderAll();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      devLog('🎨 [Init] Cleanup - disposing canvas');
      window.removeEventListener('resize', handleResize);
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      canvas.dispose();
      fabricCanvasRef.current = null;
      isInitializedRef.current = false;
    };
  }, [worksheetId]); // Dodane worksheetId jako dependency

  // Aktualizuj interaktywność canvas gdy isEnabled się zmienia
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.selection = false;
    canvas.forEachObject((obj) => {
      obj.selectable = false;
      obj.evented = false;
    });
    
    canvas.renderAll();
  }, [isTeacher, isEnabled]);

  // Obsługa zmiany narzędzia (marker, highlighter)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isTeacher) return;

    const { activeTool, activeColor, strokeWidth } = drawingState;

    const drawingTools: DrawingTool[] = ['marker', 'highlighter'];
    
    if (drawingTools.includes(activeTool) && isEnabled) {
      canvas.isDrawingMode = true;
      
      canvas.freeDrawingBrush = new PencilBrush(canvas);
      
      if (activeTool === 'marker') {
        canvas.freeDrawingBrush.color = activeColor.hex;
        canvas.freeDrawingBrush.width = strokeWidth.value * 2;
      } else if (activeTool === 'highlighter') {
        canvas.freeDrawingBrush.color = activeColor.hex;
        canvas.freeDrawingBrush.width = strokeWidth.value * 4;
      }
    } else {
      canvas.isDrawingMode = false;
    }
  }, [drawingState.activeTool, drawingState.activeColor, drawingState.strokeWidth, isTeacher, isEnabled]);

  // Obsługa path:created - zapisz do historii po narysowaniu
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handlePathCreated = (e: any) => {
      const path = e.path;
      if (path) {
        // Zablokuj edycję path
        path.selectable = false;
        path.evented = false;
        
        devLog('🎨 [Path] Created, saving to history');
        saveToHistory();
        scheduleAutoSave();
      }
    };

    canvas.on('path:created', handlePathCreated);
    
    return () => {
      canvas.off('path:created', handlePathCreated);
    };
  }, [saveToHistory, scheduleAutoSave]);

  // Obsługa strzałki (arrow tool)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isTeacher || !isEnabled) return;
    if (drawingState.activeTool !== 'arrow') return;

    const { activeColor, strokeWidth } = drawingState;

    const handleMouseDown = (e: any) => {
      if (!e.pointer) return;
      
      isDrawingArrowRef.current = true;
      arrowStartPointRef.current = { x: e.pointer.x, y: e.pointer.y };
      
      // Utwórz linię
      const line = new Line(
        [e.pointer.x, e.pointer.y, e.pointer.x, e.pointer.y],
        {
          stroke: activeColor.hex,
          strokeWidth: strokeWidth.value * 2,
          selectable: false,
          evented: false,
        }
      );
      
      // Utwórz grot strzałki
      const triangle = new Triangle({
        left: e.pointer.x,
        top: e.pointer.y,
        width: strokeWidth.value * 6,
        height: strokeWidth.value * 8,
        fill: activeColor.hex,
        selectable: false,
        evented: false,
        originX: 'center',
        originY: 'center',
      });
      
      currentArrowGroupRef.current = { line, triangle };
      canvas.add(line);
      canvas.add(triangle);
    };

    const handleMouseMove = (e: any) => {
      if (!isDrawingArrowRef.current || !arrowStartPointRef.current || !currentArrowGroupRef.current || !e.pointer) return;
      
      const { line, triangle } = currentArrowGroupRef.current;
      const start = arrowStartPointRef.current;
      const end = e.pointer;
      
      // Aktualizuj linię
      line.set({ x2: end.x, y2: end.y });
      
      // Oblicz kąt strzałki
      const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI + 90;
      
      // Aktualizuj grot
      triangle.set({
        left: end.x,
        top: end.y,
        angle: angle,
      });
      
      canvas.renderAll();
    };

    const handleMouseUp = () => {
      if (isDrawingArrowRef.current && currentArrowGroupRef.current) {
        const { line, triangle } = currentArrowGroupRef.current;
        line.selectable = false;
        line.evented = false;
        triangle.selectable = false;
        triangle.evented = false;
        
        devLog('🎨 [Arrow] Created, saving to history');
        saveToHistory();
        scheduleAutoSave();
      }
      
      isDrawingArrowRef.current = false;
      arrowStartPointRef.current = null;
      currentArrowGroupRef.current = null;
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [drawingState.activeTool, drawingState.activeColor, drawingState.strokeWidth, isTeacher, isEnabled, saveToHistory, scheduleAutoSave]);

  // NAPRAWKA v5: Gumka - sprawdza odległość od SEGMENTÓW ścieżki
  // Dodano logi diagnostyczne do debugowania
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    
    // DIAGNOSTYKA: Loguj warunki wejściowe
    devLog('🎨 [Eraser] useEffect check:', { 
      hasCanvas: !!canvas, 
      isTeacher, 
      isEnabled, 
      activeTool: drawingState.activeTool,
      objectsCount: canvas?.getObjects().length || 0
    });
    
    if (!canvas || !isTeacher || !isEnabled) {
      devLog('🎨 [Eraser] Skipping - missing requirements');
      return;
    }
    if (drawingState.activeTool !== 'eraser') {
      devLog('🎨 [Eraser] Skipping - not eraser tool');
      return;
    }

    devLog('🎨 [Eraser] ACTIVE - setting up handlers');
    canvas.isDrawingMode = false;
    let isErasing = false;
    let hasErased = false;

    // Oblicz odległość punktu od odcinka
    const pointToSegmentDistance = (
      px: number, py: number,
      x1: number, y1: number,
      x2: number, y2: number
    ): number => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lengthSquared = dx * dx + dy * dy;
      
      if (lengthSquared === 0) {
        return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
      }
      
      let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
      t = Math.max(0, Math.min(1, t));
      
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      
      return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    };

    // NAPRAWKA v4: Sprawdź czy punkt jest na obiekcie (sprawdzaj SEGMENTY, nie tylko punkty)
    const isPointOnObject = (obj: FabricObject, pointer: { x: number; y: number }): boolean => {
      const tolerance = 15;
      
      // Dla Line (część strzałki) - oblicz odległość od linii
      if (obj.type === 'line') {
        const line = obj as Line;
        const matrix = line.calcTransformMatrix();
        
        // Transformuj punkty linii
        const x1 = line.x1 || 0;
        const y1 = line.y1 || 0;
        const x2 = line.x2 || 0;
        const y2 = line.y2 || 0;
        
        // Zastosuj transformację
        const startX = matrix[0] * x1 + matrix[2] * y1 + matrix[4];
        const startY = matrix[1] * x1 + matrix[3] * y1 + matrix[5];
        const endX = matrix[0] * x2 + matrix[2] * y2 + matrix[4];
        const endY = matrix[1] * x2 + matrix[3] * y2 + matrix[5];
        
        const distance = pointToSegmentDistance(pointer.x, pointer.y, startX, startY, endX, endY);
        return distance < tolerance + (line.strokeWidth || 2);
      }
      
      // Dla Triangle (grot strzałki) - sprawdź bounding box (jest mały)
      if (obj.type === 'triangle') {
        const bounds = obj.getBoundingRect();
        const padding = tolerance;
        return (
          pointer.x >= bounds.left - padding &&
          pointer.x <= bounds.left + bounds.width + padding &&
          pointer.y >= bounds.top - padding &&
          pointer.y <= bounds.top + bounds.height + padding
        );
      }
      
      // NAPRAWKA v4: Dla Path (marker/highlighter) - sprawdź SEGMENTY ścieżki
      if (obj.type === 'path' && (obj as Path).path) {
        const path = obj as Path;
        const pathData = path.path;
        if (!pathData || pathData.length === 0) return false;
        
        const matrix = path.calcTransformMatrix();
        const strokeTolerance = tolerance + (path.strokeWidth || 2);
        
        // Przechowuj poprzedni punkt do tworzenia segmentów
        let prevX = 0;
        let prevY = 0;
        let isFirstPoint = true;
        
        // Sprawdź każdy segment ścieżki
        for (let i = 0; i < pathData.length; i++) {
          const segment = pathData[i];
          if (!Array.isArray(segment) || segment.length < 3) continue;
          
          const cmd = segment[0];
          
          if (cmd === 'M') {
            // Move to - początek nowej ścieżki
            prevX = segment[1] as number;
            prevY = segment[2] as number;
            isFirstPoint = false;
          } else if (cmd === 'L' || cmd === 'Q' || cmd === 'C') {
            // Line to, Quadratic, Cubic - mamy segment
            const x = segment[segment.length - 2] as number;
            const y = segment[segment.length - 1] as number;
            
            if (!isFirstPoint) {
              // Transformuj oba punkty segmentu
              const startX = matrix[0] * prevX + matrix[2] * prevY + matrix[4];
              const startY = matrix[1] * prevX + matrix[3] * prevY + matrix[5];
              const endX = matrix[0] * x + matrix[2] * y + matrix[4];
              const endY = matrix[1] * x + matrix[3] * y + matrix[5];
              
              // Sprawdź odległość od segmentu
              const distance = pointToSegmentDistance(pointer.x, pointer.y, startX, startY, endX, endY);
              
              if (distance < strokeTolerance) {
                devLog('🎨 [Eraser] Hit path segment, distance:', distance.toFixed(2));
                return true;
              }
            }
            
            prevX = x;
            prevY = y;
            isFirstPoint = false;
          }
        }
        return false;
      }
      
      // Dla innych obiektów - użyj containsPoint z tolerancją
      return obj.containsPoint(new Point(pointer.x, pointer.y));
    };

    const handleMouseDown = (e: any) => {
      if (!e.pointer) return;
      isErasing = true;
      hasErased = false;
      eraseAtPoint(e.pointer);
    };

    const handleMouseMove = (e: any) => {
      if (!isErasing || !e.pointer) return;
      eraseAtPoint(e.pointer);
    };

    const eraseAtPoint = (pointer: { x: number; y: number }) => {
      const objectsToRemove: FabricObject[] = [];
      const totalObjects = canvas.getObjects().length;
      
      devLog('🎨 [Eraser] Checking at point:', pointer, 'Total objects:', totalObjects);
      
      canvas.forEachObject((obj) => {
        const hit = isPointOnObject(obj, pointer);
        if (hit) {
          devLog('🎨 [Eraser] HIT object type:', obj.type);
          objectsToRemove.push(obj);
        }
      });
      
      if (objectsToRemove.length > 0) {
        devLog('🎨 [Eraser] Removing', objectsToRemove.length, 'objects');
        objectsToRemove.forEach(obj => canvas.remove(obj));
        canvas.renderAll();
        hasErased = true;
      } else if (totalObjects > 0) {
        devLog('🎨 [Eraser] No hits at this point');
      }
    };

    const handleMouseUp = () => {
      if (isErasing && hasErased) {
        devLog('🎨 [Eraser] Erased objects, saving to history');
        saveToHistory();
        scheduleAutoSave();
      }
      isErasing = false;
      hasErased = false;
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [drawingState.activeTool, isTeacher, isEnabled, saveToHistory, scheduleAutoSave]);

  // Realtime subscription dla ucznia
  useEffect(() => {
    if (isTeacher || isDemoMode) return;

    const channel = supabase
      .channel(`drawing:${worksheetId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'worksheet_drawings',
          filter: `worksheet_id=eq.${worksheetId}`,
        },
        (payload) => {
          if (payload.new && 'drawing_data' in payload.new) {
            const drawingData = payload.new.drawing_data as unknown as DrawingData;
            if (drawingData && drawingData.objects) {
              loadDrawingsFromData(drawingData);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [worksheetId, isTeacher, loadDrawingsFromData]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isTeacher || !isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        const toolShortcuts: Record<string, DrawingTool> = {
          'v': 'select-worksheet',
          'm': 'marker',
          'h': 'highlighter',
          'a': 'arrow',
          'e': 'eraser',
        };
        
        const tool = toolShortcuts[e.key.toLowerCase()];
        if (tool) {
          setDrawingState(prev => ({ ...prev, activeTool: tool }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTeacher, isEnabled, handleUndo, handleRedo]);

  const handleToolChange = (tool: DrawingTool) => {
    setDrawingState(prev => ({ ...prev, activeTool: tool }));
  };

  const handleColorChange = (color: DrawingColor) => {
    setDrawingState(prev => ({ ...prev, activeColor: color }));
  };

  const handleStrokeWidthChange = (width: StrokeWidth) => {
    setDrawingState(prev => ({ ...prev, strokeWidth: width }));
  };

  const isSelectMode = drawingState.activeTool === 'select-worksheet';

  // NAPRAWKA v4: Kontrola widoczności przez prop isVisible
  // Dla studentów - tylko pokaż rysunki (nie pozwól rysować)
  if (!isTeacher && !isEnabled) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "absolute inset-0 z-[30] pointer-events-none",
          !isVisible && "hidden"
        )}
      >
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    );
  }

  return (
    <>
      {/* Toolbar - tylko dla nauczyciela gdy włączone i nie ukryty */}
      {isTeacher && isEnabled && !hideToolbar && (
        <DrawingToolbar
          state={drawingState}
          onToolChange={handleToolChange}
          onColorChange={handleColorChange}
          onStrokeWidthChange={handleStrokeWidthChange}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClearAll={handleClearAll}
        />
      )}

      {/* Canvas overlay - NAPRAWKA v4: kontrola widoczności przez CSS */}
      <div
        ref={containerRef}
        className={cn(
          "absolute inset-0 z-[30]",
          isSelectMode ? "pointer-events-none" : (isEnabled ? "pointer-events-auto" : "pointer-events-none"),
          !isTeacher && "pointer-events-none",
          !isVisible && "hidden"
        )}
        style={{
          touchAction: isEnabled && isTeacher && !isSelectMode ? 'none' : 'auto',
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
        />
      </div>
    </>
  );
});

DrawingOverlay.displayName = 'DrawingOverlay';

export default DrawingOverlay;
