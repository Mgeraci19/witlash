"use client";

import { Tool } from "@/hooks/useFabricCanvas";

interface ShapeToolsProps {
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
  currentColor: string;
}

export function ShapeTools({ currentTool, onToolChange, currentColor }: ShapeToolsProps) {
  const tools: { id: Tool; label: string; icon: React.ReactNode }[] = [
    {
      id: "brush",
      label: "Brush",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
          <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z" />
        </svg>
      ),
    },
    {
      id: "eraser",
      label: "Eraser",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
          <path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0zM4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-4.95-4.95-4.95 4.95z" />
        </svg>
      ),
    },
    {
      id: "select",
      label: "Move/Select",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
          <path d="M13 5.41V17h2.09L12 20.09 8.91 17H11V5.41L8.91 3.33 8.5 3.75 10.75 6H7.91L11 9.09 14.09 6H11.25L13.5 3.75l-.41-.42L11 5.41V3h2v2.41z" />
          <path d="M3 3h7v2H5v5H3V3zm18 0h-7v2h5v5h2V3zM3 21h7v-2H5v-5H3v7zm18 0h-7v-2h5v-5h2v7z" />
        </svg>
      ),
    },
    {
      id: "circle",
      label: "Circle",
      icon: (
        <div
          className="w-5 h-5 rounded-full border-2"
          style={{
            borderColor: currentColor === "#FFFFFF" ? "#000" : currentColor,
            backgroundColor: currentColor,
          }}
        />
      ),
    },
    {
      id: "rectangle",
      label: "Rectangle",
      icon: (
        <div
          className="w-5 h-5 border-2"
          style={{
            borderColor: currentColor === "#FFFFFF" ? "#000" : currentColor,
            backgroundColor: currentColor,
          }}
        />
      ),
    },
    {
      id: "triangle",
      label: "Triangle",
      icon: (
        <div
          className="w-0 h-0"
          style={{
            borderLeft: "10px solid transparent",
            borderRight: "10px solid transparent",
            borderBottom: `18px solid ${currentColor === "#FFFFFF" ? "#000" : currentColor}`,
          }}
        />
      ),
    },
  ];

  return (
    <div className="flex gap-2 justify-center">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onToolChange(tool.id)}
          className={`flex items-center justify-center w-11 h-11 rounded-lg transition-all active:scale-95 ${
            currentTool === tool.id
              ? "bg-blue-500 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
          aria-label={tool.label}
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}
