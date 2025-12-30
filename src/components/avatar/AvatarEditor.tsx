"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFabricCanvas } from "@/hooks/useFabricCanvas";
import { ColorPalette } from "./ColorPalette";
import { BrushSizeSelector } from "./BrushSizeSelector";
import { ShapeTools } from "./ShapeTools";
import { DefaultAvatarGallery } from "./DefaultAvatarGallery";

interface AvatarEditorProps {
  initialAvatar?: string;
  onSave: (avatarData: string) => void;
  onSkip: () => void;
  defaultAvatars: Array<{ _id: string; name: string; imageData: string }>;
}

export function AvatarEditor({

  onSave,
  onSkip,
  defaultAvatars,
}: AvatarEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
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
  } = useFabricCanvas(canvasRef);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const imageData = exportImage();
      if (imageData) {
        await onSave(imageData);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    if (confirm("Clear the canvas? This cannot be undone.")) {
      clear();
    }
  };

  const handleSelectTemplate = async (imageData: string) => {
    await loadImage(imageData);
    setShowTemplates(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 lg:flex-row">
      {/* Top bar - mobile only */}
      <div className="flex justify-between items-center p-4 bg-white border-b lg:hidden">
        <Button variant="ghost" onClick={onSkip} disabled={isSaving}>
          Skip
        </Button>
        <h1 className="text-lg font-bold">Draw Your Avatar</h1>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Desktop/Tablet: Side toolbar on left */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:bg-white lg:border-r lg:p-4 lg:space-y-4 lg:overflow-y-auto">
        <h1 className="text-xl font-bold text-center">Draw Your Avatar</h1>

        {/* Actions */}
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo}>
            Undo
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            Clear
          </Button>
        </div>

        {/* Tools */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Tools</div>
          <ShapeTools currentTool={currentTool} onToolChange={setTool} currentColor={currentColor} />
        </div>

        {/* Brush sizes */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Brush Size</div>
          <BrushSizeSelector currentSize={brushSize} onSizeChange={setBrushSize} currentColor={currentColor} />
        </div>

        {/* Color palette */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Colors</div>
          <ColorPalette currentColor={currentColor} onColorChange={setColor} />
        </div>

        {/* Template selector */}
        <div>
          <Button variant="outline" className="w-full" onClick={() => setShowTemplates(!showTemplates)}>
            {showTemplates ? "Hide Templates" : "Start from Template"}
          </Button>
          {showTemplates && (
            <div className="mt-4">
              <DefaultAvatarGallery avatars={defaultAvatars} onSelect={handleSelectTemplate} />
            </div>
          )}
        </div>

        {/* Save/Skip - desktop */}
        <div className="mt-auto pt-4 space-y-2">
          <Button className="w-full" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Avatar"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onSkip} disabled={isSaving}>
            Skip
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div
          className="bg-white rounded-lg shadow-lg border-4 border-gray-300"
          style={{ touchAction: "none" }}
        >
          <canvas
            ref={canvasRef}
            width={300}
            height={300}
            className="rounded-md"
          />
        </div>
      </div>

      {/* Toolbar - bottom anchored (mobile only) */}
      <div className="bg-white border-t p-4 space-y-4 pb-safe lg:hidden">
        {/* Actions row */}
        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={!canUndo}
          >
            Undo
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            Clear
          </Button>
        </div>

        {/* Tools row */}
        <ShapeTools
          currentTool={currentTool}
          onToolChange={setTool}
          currentColor={currentColor}
        />

        {/* Brush sizes */}
        <BrushSizeSelector
          currentSize={brushSize}
          onSizeChange={setBrushSize}
          currentColor={currentColor}
        />

        {/* Color palette */}
        <ColorPalette currentColor={currentColor} onColorChange={setColor} />

        {/* Template selector */}
        <div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowTemplates(!showTemplates)}
          >
            {showTemplates ? "Hide Templates" : "Start from Template"}
          </Button>

          {showTemplates && (
            <div className="mt-4">
              <DefaultAvatarGallery
                avatars={defaultAvatars}
                onSelect={handleSelectTemplate}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
