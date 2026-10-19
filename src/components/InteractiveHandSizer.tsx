"use client";

import Image from "next/image";

export const FINGER_MAP: Record<string, number> = {
  "Left-Pinky": 0,
  "Left-Ring": 1,
  "Left-Middle": 2,
  "Left-Index": 3,
  "Left-Thumb": 4,
  "Right-Thumb": 5,
  "Right-Index": 6,
  "Right-Middle": 7,
  "Right-Ring": 8,
  "Right-Pinky": 9,
};

export const FINGER_KEYS_ORDERED = [
  "Left-Thumb",
  "Left-Index",
  "Left-Middle",
  "Left-Ring",
  "Left-Pinky",
  "Right-Thumb",
  "Right-Index",
  "Right-Middle",
  "Right-Ring",
  "Right-Pinky",
] as const;

export interface FingerSizeEntry {
  syncId?: string;
  sizeMm?: number | string;
}

export type HandSizesMap = Record<string, FingerSizeEntry>;

interface InteractiveHandSizerProps {
  sizes: HandSizesMap;
  onChange: (hand: "Left" | "Right", finger: string, value: string) => void;
  onBlurFinger?: (hand: "Left" | "Right", finger: string) => void;
  compact?: boolean;
}

export function formatHandSizesSummary(sizes?: HandSizesMap | null): string {
  if (!sizes) return "";
  const left = ["Thumb", "Index", "Middle", "Ring", "Pinky"]
    .map((f) => sizes[`Left-${f}`]?.sizeMm ?? "?")
    .join(", ");
  const right = ["Thumb", "Index", "Middle", "Ring", "Pinky"]
    .map((f) => sizes[`Right-${f}`]?.sizeMm ?? "?")
    .join(", ");
  return `L: [${left}] • R: [${right}]`;
}

export function hasAnyFingerSize(sizes?: HandSizesMap | null): boolean {
  if (!sizes) return false;
  return Object.values(sizes).some(
    (entry) =>
      entry &&
      entry.sizeMm !== undefined &&
      entry.sizeMm !== null &&
      String(entry.sizeMm).trim() !== ""
  );
}

export default function InteractiveHandSizer({
  sizes,
  onChange,
  onBlurFinger,
  compact = false,
}: InteractiveHandSizerProps) {
  const circleBaseClass = compact
    ? "w-8 h-8 sm:w-9 sm:h-9 text-[11px] sm:text-xs"
    : "w-10 h-10 sm:w-12 sm:h-12 text-xs sm:text-sm";

  const sharedInputClass = `absolute ${circleBaseClass} rounded-full border-2 border-pink-400 bg-pink-100/75 flex items-center justify-center text-center text-pink-600 font-bold hover:bg-pink-100 transition shadow-sm z-10 backdrop-blur-[2px] focus:outline-none focus:ring-2 focus:ring-pink-500 focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;

  const renderFingerInput = (
    hand: "Left" | "Right",
    finger: "Pinky" | "Ring" | "Middle" | "Index" | "Thumb",
    posClass: string
  ) => {
    const key = `${hand}-${finger}`;
    return (
      <input
        key={key}
        type="number"
        step="0.1"
        placeholder="?"
        aria-label={`${hand} ${finger} size in mm`}
        title={`${hand} ${finger} (mm)`}
        className={`${sharedInputClass} ${posClass}`}
        value={sizes[key]?.sizeMm ?? ""}
        onChange={(e) => onChange(hand, finger, e.target.value)}
        onBlur={() => onBlurFinger?.(hand, finger)}
      />
    );
  };

  return (
    <div
      className={`relative w-full ${
        compact ? "max-w-md my-2" : "max-w-lg mb-8"
      } mx-auto flex justify-center items-end gap-2 px-1 sm:px-2`}
    >
      {/* Left Hand Container */}
      <div className="relative w-1/2 aspect-[3/4]">
        <Image
          src="/hand_left.jpg"
          alt="Left Hand"
          fill
          className="object-contain"
          sizes="(max-width: 640px) 45vw, 240px"
        />
        {renderFingerInput("Left", "Pinky", "top-[29%] left-[8%]")}
        {renderFingerInput("Left", "Ring", "top-[14%] left-[34%]")}
        {renderFingerInput("Left", "Middle", "top-[10%] left-[52%]")}
        {renderFingerInput("Left", "Index", "top-[18%] left-[73%]")}
        {renderFingerInput("Left", "Thumb", "top-[68%] left-[78%]")}
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-widest text-neutral-400 pointer-events-none">
          Left Hand (mm)
        </span>
      </div>

      {/* Right Hand Container */}
      <div className="relative w-1/2 aspect-[3/4]">
        <Image
          src="/hand_right.jpg"
          alt="Right Hand"
          fill
          className="object-contain"
          sizes="(max-width: 640px) 45vw, 240px"
        />
        {renderFingerInput("Right", "Thumb", "top-[68%] right-[78%]")}
        {renderFingerInput("Right", "Index", "top-[18%] right-[73%]")}
        {renderFingerInput("Right", "Middle", "top-[10%] right-[52%]")}
        {renderFingerInput("Right", "Ring", "top-[14%] right-[34%]")}
        {renderFingerInput("Right", "Pinky", "top-[29%] right-[8%]")}
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-widest text-neutral-400 pointer-events-none">
          Right Hand (mm)
        </span>
      </div>
    </div>
  );
}
