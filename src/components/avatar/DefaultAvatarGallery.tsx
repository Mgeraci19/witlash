/* eslint-disable @next/next/no-img-element */
"use client";

interface DefaultAvatarGalleryProps {
  avatars: Array<{ _id: string; name: string; imageData: string }>;
  onSelect: (imageData: string) => void;
}

export function DefaultAvatarGallery({
  avatars,
  onSelect,
}: DefaultAvatarGalleryProps) {
  console.log("[DefaultAvatarGallery] Rendering with", avatars.length, "avatars");

  if (avatars.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        No templates available yet
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      {avatars.map((avatar) => (
        <button
          key={avatar._id}
          onClick={() => {
            console.log("[DefaultAvatarGallery] Avatar clicked:", avatar.name);
            console.log("[DefaultAvatarGallery] imageData prefix:", avatar.imageData?.substring(0, 50));
            onSelect(avatar.imageData);
          }}
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 transition-colors active:scale-95"
        >
          <div className="w-16 h-16 rounded-lg border-2 border-gray-300 overflow-hidden bg-white">
            <img
              src={avatar.imageData}
              alt={avatar.name}
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-xs text-gray-600 truncate max-w-full">
            {avatar.name}
          </span>
        </button>
      ))}
    </div>
  );
}
