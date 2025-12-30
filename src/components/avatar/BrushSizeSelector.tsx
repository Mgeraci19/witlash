"use client";

interface BrushSizeSelectorProps {
  currentSize: number;
  onSizeChange: (size: number) => void;
  currentColor: string;
}

const BRUSH_SIZES = [4, 8, 16, 32];

export function BrushSizeSelector({
  currentSize,
  onSizeChange,
  currentColor,
}: BrushSizeSelectorProps) {
  return (
    <div className="flex gap-3 justify-center items-center">
      {BRUSH_SIZES.map((size) => (
        <button
          key={size}
          onClick={() => onSizeChange(size)}
          className={`flex items-center justify-center w-11 h-11 rounded-lg transition-all active:scale-95 ${
            currentSize === size
              ? "bg-blue-100 border-2 border-blue-500"
              : "bg-gray-100 border-2 border-gray-300"
          }`}
          aria-label={`Brush size ${size}px`}
        >
          <div
            className="rounded-full"
            style={{
              width: Math.min(size, 28),
              height: Math.min(size, 28),
              backgroundColor: currentColor === "#FFFFFF" ? "#000000" : currentColor,
            }}
          />
        </button>
      ))}
    </div>
  );
}
