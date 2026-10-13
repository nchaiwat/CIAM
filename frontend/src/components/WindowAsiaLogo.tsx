import React from "react";

interface WindowAsiaLogoProps {
  variant?: "dark" | "light"; // dark = for dark backgrounds (white text), light = for light backgrounds (dark text)
  className?: string;
  showSubtitle?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Window Asia Official-style Logo Component
 * Matches the corporate branding with the Alu/uPVC window emblem and typography
 */
export function WindowAsiaLogo({
  variant = "dark",
  className = "",
  showSubtitle = true,
  size = "md",
}: WindowAsiaLogoProps) {
  const isDark = variant === "dark";

  const iconSizes = {
    sm: "w-9 h-9",
    md: "w-12 h-12",
    lg: "w-14 h-14",
  };

  const titleSizes = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl",
  };

  const subtitleSizes = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-xs",
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Window Asia Brand Icon */}
      <div
        className={`${iconSizes[size]} shrink-0 rounded-xl bg-gradient-to-br from-[#0c2a55] via-[#092042] to-[#041226] border border-blue-400/30 shadow-lg shadow-blue-950/40 p-2 flex items-center justify-center relative overflow-hidden group`}
      >
        {/* Subtle glass reflection in badge */}
        <div className="absolute -top-6 -right-6 w-12 h-12 bg-sky-400/20 rounded-full blur-md pointer-events-none" />

        {/* SVG Window Frame with Alu/uPVC Design */}
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow"
        >
          {/* Outer Alu frame */}
          <rect
            x="3"
            y="3"
            width="34"
            height="34"
            rx="4"
            stroke="#93c5fd"
            strokeWidth="2"
            fill="none"
            opacity="0.85"
          />

          {/* Left Window Pane (Frosted / Glass with reflection) */}
          <rect
            x="6"
            y="6"
            width="13"
            height="28"
            rx="2"
            fill="url(#glassGradLeft)"
            stroke="#60a5fa"
            strokeWidth="1.5"
          />
          {/* Left pane crossbars */}
          <line x1="6" y1="20" x2="19" y2="20" stroke="#93c5fd" strokeWidth="1" opacity="0.7" />

          {/* Right Window Pane (Vibrant Corporate Blue) */}
          <rect
            x="21"
            y="6"
            width="13"
            height="28"
            rx="2"
            fill="url(#glassGradRight)"
            stroke="#93c5fd"
            strokeWidth="1.5"
          />
          {/* Right pane crossbars */}
          <line x1="21" y1="20" x2="34" y2="20" stroke="#bfdbfe" strokeWidth="1" opacity="0.7" />

          {/* Center overlap joint */}
          <line x1="20" y1="5" x2="20" y2="35" stroke="#e0f2fe" strokeWidth="1.5" />

          {/* Diagonal light reflections */}
          <path
            d="M8 8 L17 26 M23 8 L32 26"
            stroke="white"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.3"
          />

          <defs>
            <linearGradient id="glassGradLeft" x1="6" y1="6" x2="19" y2="34" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38bdf8" stopOpacity="0.45" />
              <stop stopColor="#0284c7" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="glassGradRight" x1="21" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
              <stop stopColor="#60a5fa" stopOpacity="0.8" />
              <stop stopColor="#1d4ed8" stopOpacity="0.95" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Typography */}
      <div className="flex flex-col leading-tight">
        <div
          className={`${titleSizes[size]} font-extrabold tracking-tight ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          Window Asia
        </div>
        {showSubtitle && (
          <div
            className={`${subtitleSizes[size]} font-medium ${
              isDark ? "text-slate-300/80" : "text-slate-500"
            }`}
          >
            ประตูหน้าต่าง Alu/uPVC คุณภาพสูง
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 3D-styled Overlapping Window Emblem
 * Used in the right login card header matching the sample mockup
 */
export function Modern3DWindowIcon({ className = "w-16 h-16" }: { className?: string }) {
  return (
    <div className={`relative ${className} flex items-center justify-center select-none`}>
      <svg
        viewBox="0 0 72 72"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xl"
      >
        <defs>
          <linearGradient id="backPaneGrad" x1="12" y1="10" x2="48" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="frontPaneGrad" x1="24" y1="20" x2="60" y2="62" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38bdf8" />
            <stop stopColor="#1d4ed8" />
          </linearGradient>
          <filter id="shadowFilter" x="0" y="0" width="72" height="72" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Back Casement (Frosted Pearl / White-Silver) */}
        <g filter="url(#shadowFilter)">
          <rect
            x="12"
            y="12"
            width="34"
            height="34"
            rx="7"
            fill="url(#backPaneGrad)"
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />
          {/* Inner back pane cross */}
          <line x1="29" y1="14" x2="29" y2="44" stroke="#94a3b8" strokeWidth="1" strokeDasharray="1 1" />
          <line x1="14" y1="29" x2="44" y2="29" stroke="#94a3b8" strokeWidth="1" strokeDasharray="1 1" />
        </g>

        {/* Front Casement (Vibrant Window Asia Sapphire Blue) */}
        <g filter="url(#shadowFilter)">
          <rect
            x="26"
            y="24"
            width="34"
            height="34"
            rx="7"
            fill="url(#frontPaneGrad)"
            stroke="#93c5fd"
            strokeWidth="1.5"
          />
          {/* Inner glass cross divider */}
          <line x1="43" y1="26" x2="43" y2="56" stroke="#ffffff" strokeWidth="1.5" opacity="0.6" />
          <line x1="28" y1="41" x2="58" y2="41" stroke="#ffffff" strokeWidth="1.5" opacity="0.6" />

          {/* Glass reflection gloss */}
          <path
            d="M30 28 L54 28 L30 52 Z"
            fill="white"
            opacity="0.15"
          />
        </g>
      </svg>
    </div>
  );
}
