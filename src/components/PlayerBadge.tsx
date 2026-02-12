"use client";

import { getCosmeticById, getNameColorStyle, getNameColorClass } from "@/lib/cosmetics";

interface PlayerBadgeProps {
  username: string;
  equippedCosmetics: Record<string, string | null>;
  size?: "sm" | "md" | "lg";
  showTitle?: boolean;
  showFrame?: boolean;
}

const sizeMap = {
  sm: { px: 24, text: "text-xs" },
  md: { px: 32, text: "text-sm" },
  lg: { px: 40, text: "text-base" },
} as const;

export default function PlayerBadge({
  username,
  equippedCosmetics,
  size = "md",
  showTitle = false,
  showFrame = false,
}: PlayerBadgeProps) {
  const { px, text } = sizeMap[size];

  const nameColorId = equippedCosmetics.name_color ?? null;
  const badgeId = equippedCosmetics.badge ?? null;
  const frameId = equippedCosmetics.avatar_frame ?? null;
  const titleId = equippedCosmetics.title ?? null;

  // Badge emoji
  const badgeItem = badgeId ? getCosmeticById(badgeId) : undefined;

  // Avatar frame classes
  const frameItem = frameId ? getCosmeticById(frameId) : undefined;

  // Title text
  const titleItem = titleId ? getCosmeticById(titleId) : undefined;

  // Name color
  const nameStyle = getNameColorStyle(nameColorId);
  const nameClass = getNameColorClass(nameColorId);

  return (
    <div className="flex items-center gap-2">
      {/* Avatar circle */}
      {showFrame && (
        <div
          className={`flex items-center justify-center rounded-full bg-[var(--casino-darker)] border border-gray-700 text-white font-bold shrink-0 ${
            frameItem ? frameItem.cssValue : ""
          }`}
          style={{
            width: px,
            height: px,
            fontSize: px * 0.45,
          }}
        >
          {username.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name section */}
      <div className="flex flex-col leading-tight">
        <div className="flex items-center gap-1">
          {/* Badge emoji */}
          {badgeItem && (
            <span className="leading-none" style={{ fontSize: px * 0.45 }}>
              {badgeItem.cssValue}
            </span>
          )}

          {/* Username */}
          <span
            className={`font-semibold ${text} ${nameClass || "text-gray-400"}`}
            style={nameStyle}
          >
            {username}
          </span>
        </div>

        {/* Title */}
        {showTitle && titleItem && (
          <span className="text-[10px] text-gray-500">{titleItem.cssValue}</span>
        )}
      </div>
    </div>
  );
}
