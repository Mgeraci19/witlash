"use client";

interface ColorPaletteProps {
  currentColor: string;
  onColorChange: (color: string) => void;
}

// 12 curated colors in a 3x4 grid
const COLORS = [
  "#000000", // Black
  "#FFFFFF", // White
  "#FF0000", // Red
  "#FF8000", // Orange
  "#FFFF00", // Yellow
  "#00FF00", // Green
  "#00FFFF", // Cyan
  "#0000FF", // Blue
  "#8000FF", // Purple
  "#FF00FF", // Pink
  "#8B4513", // Brown
  "#808080", // Gray
];

export function ColorPalette({ currentColor, onColorChange }: ColorPaletteProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {COLORS.map((color) => (
        <button
          key={color}
          onClick={() => onColorChange(color)}
          className={`w-11 h-11 rounded-lg border-2 transition-transform active:scale-95 ${
            currentColor === color
              ? "border-blue-500 ring-2 ring-blue-300 scale-110"
              : "border-gray-300"
          }`}
          style={{ backgroundColor: color }}
          aria-label={`Select color ${color}`}
        />
      ))}
    </div>
  );
}
