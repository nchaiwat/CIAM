import React from "react";

interface WindowAsiaLogoProps {
  variant?: "dark" | "light" | "plain"; // dark = for dark backgrounds (with crisp white container), light/plain = direct
  className?: string;
  showSubtitle?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Window Asia Official Brand Logo Component
 * Uses the exact authentic logo asset provided directly by Window Asia
 */
export function WindowAsiaLogo({
  variant = "dark",
  className = "",
  showSubtitle = true,
  size = "md",
}: WindowAsiaLogoProps) {
  const logoHeights = {
    sm: "h-7",
    md: "h-9",
    lg: "h-11",
  };

  if (variant === "dark") {
    return (
      <div className={`inline-flex flex-col items-start gap-1.5 select-none ${className}`}>
        {/* Crisp white container ensures 100% brand fidelity on dark backgrounds */}
        <div className="bg-white px-4 py-2 rounded-2xl shadow-lg shadow-blue-950/40 border border-white/30 flex items-center justify-center">
          <img
            src="/window-asia-logo.png"
            alt="Window Asia วินโดว์ เอเชีย"
            className={`${logoHeights[size]} w-auto object-contain block`}
          />
        </div>
        {showSubtitle && (
          <div className="text-[11px] font-medium text-sky-200/90 pl-1 tracking-wide">
            ประตูหน้าต่าง Alu/uPVC คุณภาพสูง
          </div>
        )}
      </div>
    );
  }

  // Light / plain surface
  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <img
        src="/window-asia-logo.png"
        alt="Window Asia วินโดว์ เอเชีย"
        className={`${logoHeights[size]} w-auto object-contain block`}
      />
      {showSubtitle && (
        <div className="text-[11px] font-medium text-slate-500 mt-1 tracking-wide">
          ประตูหน้าต่าง Alu/uPVC คุณภาพสูง
        </div>
      )}
    </div>
  );
}

/**
 * Official Window Asia Circular Window Emblem
 * Extracted with pixel accuracy from the official corporate logo
 */
export function WindowAsiaEmblem({
  className = "w-16 h-16",
}: {
  className?: string;
}) {
  return (
    <div className={`relative ${className} flex items-center justify-center select-none`}>
      <img
        src="/window-asia-emblem.png"
        alt="Window Asia Emblem"
        className="w-full h-full object-contain drop-shadow-md"
      />
    </div>
  );
}
