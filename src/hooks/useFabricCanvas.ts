"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, PencilBrush, Circle, Rect, Triangle, FabricObject } from "fabric";

export type Tool = "brush" | "eraser" | "select" | "circle" | "rectangle" | "triangle";

export interface FabricCanvasState {
  canvas: Canvas | null;
  currentTool: Tool;
  currentColor: string;
  brushSize: number;
  canUndo: boolean;
}

export interface FabricCanvasActions {
  setTool: (tool: Tool) => void;
  setColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  undo: () => void;
  clear: () => void;
  loadImage: (dataUrl: string) => Promise<void>;
  exportImage: () => string | null;
}

const CANVAS_SIZE = 300;
const STORED_SIZE = 600; // 2x for high DPI

export function useFabricCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>
): FabricCanvasState & FabricCanvasActions {
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [currentTool, setCurrentTool] = useState<Tool>("brush");
  const [currentColor, setCurrentColor] = useState("#000000");
  const [brushSize, setBrushSizeState] = useState(8);
  const [canUndo, setCanUndo] = useState(false);

  // Store history for undo
  const historyRef = useRef<string[]>([]);
  const isLoadingRef = useRef(false);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || canvas) return;

    const fabricCanvas = new Canvas(canvasRef.current, {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      backgroundColor: "#ffffff",
      isDrawingMode: true,
      selection: true,
    });

    // Configure brush
    fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);
    fabricCanvas.freeDrawingBrush.color = currentColor;
    fabricCanvas.freeDrawingBrush.width = brushSize;

    // Save initial state
    historyRef.current = [JSON.stringify(fabricCanvas.toJSON())];

    // Listen for object additions/modifications to save history
    const saveHistory = () => {
      if (isLoadingRef.current) return;
      const json = JSON.stringify(fabricCanvas.toJSON());
      // Only save if different from last state
      if (historyRef.current[historyRef.current.length - 1] !== json) {
        historyRef.current.push(json);
        // Limit history to 20 states
        if (historyRef.current.length > 20) {
          historyRef.current.shift();
        }
        setCanUndo(historyRef.current.length > 1);
      }
    };

    fabricCanvas.on("object:added", saveHistory);
    fabricCanvas.on("object:modified", saveHistory);
    fabricCanvas.on("path:created", saveHistory);

    setCanvas(fabricCanvas);

    return () => {
      fabricCanvas.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef]);

  // Update brush when color or size changes
  useEffect(() => {
    if (!canvas) return;

    if (canvas.freeDrawingBrush) {
      if (currentTool === "eraser") {
        canvas.freeDrawingBrush.color = "#ffffff";
      } else {
        canvas.freeDrawingBrush.color = currentColor;
      }
      canvas.freeDrawingBrush.width = brushSize;
    }
  }, [canvas, currentColor, brushSize, currentTool]);

  // Handle tool changes
  const setTool = useCallback((tool: Tool) => {
    if (!canvas) return;

    setCurrentTool(tool);

    if (tool === "brush" || tool === "eraser") {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      canvas.discardActiveObject();
      canvas.renderAll();

      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = tool === "eraser" ? "#ffffff" : currentColor;
        canvas.freeDrawingBrush.width = brushSize;
      }
    } else if (tool === "select") {
      // Select/move tool
      canvas.isDrawingMode = false;
      canvas.selection = true;
      // Make all objects selectable
      canvas.forEachObject((obj) => {
        obj.selectable = true;
        obj.evented = true;
      });
      canvas.renderAll();
    } else {
      // Shape tools - add shape then switch to select mode
      canvas.isDrawingMode = false;
      canvas.selection = true;

      // Add shape to center
      let shape: FabricObject | null = null;
      const shapeSize = 60;
      const center = CANVAS_SIZE / 2;

      if (tool === "circle") {
        shape = new Circle({
          radius: shapeSize / 2,
          fill: currentColor,
          left: center - shapeSize / 2,
          top: center - shapeSize / 2,
        });
      } else if (tool === "rectangle") {
        shape = new Rect({
          width: shapeSize,
          height: shapeSize,
          fill: currentColor,
          left: center - shapeSize / 2,
          top: center - shapeSize / 2,
        });
      } else if (tool === "triangle") {
        shape = new Triangle({
          width: shapeSize,
          height: shapeSize,
          fill: currentColor,
          left: center - shapeSize / 2,
          top: center - shapeSize / 2,
        });
      }

      if (shape) {
        canvas.add(shape);
        canvas.setActiveObject(shape);
        canvas.renderAll();
      }

      // Switch to select mode so user can move/resize the shape
      setCurrentTool("select");
    }
  }, [canvas, currentColor, brushSize]);

  const setColor = useCallback((color: string) => {
    setCurrentColor(color);
    if (canvas?.freeDrawingBrush && currentTool !== "eraser") {
      canvas.freeDrawingBrush.color = color;
    }
  }, [canvas, currentTool]);

  const setBrushSize = useCallback((size: number) => {
    setBrushSizeState(size);
    if (canvas?.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = size;
    }
  }, [canvas]);

  const undo = useCallback(() => {
    if (!canvas || historyRef.current.length <= 1) return;

    isLoadingRef.current = true;
    historyRef.current.pop(); // Remove current state
    const previousState = historyRef.current[historyRef.current.length - 1];

    canvas.loadFromJSON(JSON.parse(previousState)).then(() => {
      canvas.renderAll();
      isLoadingRef.current = false;
      setCanUndo(historyRef.current.length > 1);
    });
  }, [canvas]);

  const clear = useCallback(() => {
    if (!canvas) return;

    canvas.clear();
    canvas.backgroundColor = "#ffffff";
    canvas.renderAll();

    // Save cleared state
    historyRef.current.push(JSON.stringify(canvas.toJSON()));
    setCanUndo(historyRef.current.length > 1);
  }, [canvas]);

  const loadImage = useCallback(async (dataUrl: string) => {
    console.log("[AvatarEditor] loadImage called, canvas exists:", !!canvas);
    console.log("[AvatarEditor] dataUrl prefix:", dataUrl?.substring(0, 50));

    if (!canvas) {
      console.error("[AvatarEditor] No canvas available for loadImage");
      return;
    }

    isLoadingRef.current = true;

    try {
      // Use Fabric.js Image.fromURL to properly load image as a Fabric object
      const { FabricImage } = await import("fabric");

      const fabricImg = await FabricImage.fromURL(dataUrl, { crossOrigin: "anonymous" });
      console.log("[AvatarEditor] Fabric image created, dimensions:", fabricImg.width, fabricImg.height);

      // Clear canvas first
      canvas.clear();
      canvas.backgroundColor = "#ffffff";

      // Scale image to fit canvas
      const scale = Math.min(CANVAS_SIZE / (fabricImg.width || 1), CANVAS_SIZE / (fabricImg.height || 1));
      fabricImg.scale(scale);
      fabricImg.set({
        left: (CANVAS_SIZE - (fabricImg.width || 0) * scale) / 2,
        top: (CANVAS_SIZE - (fabricImg.height || 0) * scale) / 2,
        selectable: true,
        evented: true,
      });

      canvas.add(fabricImg);
      canvas.renderAll();

      // Save to history
      historyRef.current = [JSON.stringify(canvas.toJSON())];
      setCanUndo(false);
      isLoadingRef.current = false;
      console.log("[AvatarEditor] Image added to canvas successfully");
    } catch (error) {
      console.error("[AvatarEditor] loadImage failed:", error);
      isLoadingRef.current = false;
    }
  }, [canvas]);

  const exportImage = useCallback(() => {
    if (!canvas) return null;

    // Export at higher resolution
    return canvas.toDataURL({
      format: "png",
      multiplier: STORED_SIZE / CANVAS_SIZE,
    });
  }, [canvas]);

  return {
    canvas,
    currentTool,
    currentColor,
    brushSize,
    canUndo,
    setTool,
    setColor,
    setBrushSize,
    undo,
    clear,
    loadImage,
    exportImage,
  };
}
