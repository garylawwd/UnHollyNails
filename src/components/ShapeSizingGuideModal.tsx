'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ShapeSizingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'shapes' | 'sizing';
}

const NAIL_SHAPES = [
  {
    name: "Almond",
    desc: "Tapered sides that curve gently to a soft rounded point. Elegant, elongating, and our signature look.",
    icon: (
      <svg viewBox="0 0 40 70" className="w-8 h-14 mx-auto text-pink-500 fill-pink-100 stroke-current stroke-2">
        <path d="M 10 65 L 10 35 C 10 15 20 5 20 5 C 20 5 30 15 30 35 L 30 65 Z" />
      </svg>
    )
  },
  {
    name: "Coffin / Ballerina",
    desc: "Tapered sides with a sharp, straight square tip. High-glam, dramatic, and a client favorite for medium & long sets.",
    icon: (
      <svg viewBox="0 0 40 70" className="w-8 h-14 mx-auto text-pink-500 fill-pink-100 stroke-current stroke-2">
        <path d="M 9 65 L 13 25 L 15 8 L 25 8 L 27 25 L 31 65 Z" />
      </svg>
    )
  },
  {
    name: "Square",
    desc: "Parallel straight sidewalls with a sharp 90-degree flat top. Classic, sturdy, and clean.",
    icon: (
      <svg viewBox="0 0 40 70" className="w-8 h-14 mx-auto text-pink-500 fill-pink-100 stroke-current stroke-2">
        <path d="M 10 65 L 10 8 L 30 8 L 30 65 Z" />
      </svg>
    )
  },
  {
    name: "Oval",
    desc: "Curved edges that mimic natural egg-shaped contours. Highly durable, soft, and universally flattering.",
    icon: (
      <svg viewBox="0 0 40 70" className="w-8 h-14 mx-auto text-pink-500 fill-pink-100 stroke-current stroke-2">
        <path d="M 10 65 L 10 30 C 10 10 30 10 30 30 L 30 65 Z" />
      </svg>
    )
  },
  {
    name: "Stiletto",
    desc: "Dramatic tapering narrowing down to an ultra-sharp point. Bold, fierce, and glamorous statement nails.",
    icon: (
      <svg viewBox="0 0 40 70" className="w-8 h-14 mx-auto text-pink-500 fill-pink-100 stroke-current stroke-2">
        <path d="M 9 65 L 13 35 L 20 5 L 27 35 L 31 65 Z" />
      </svg>
    )
  },
  {
    name: "Round",
    desc: "Straight sides following the natural fingertip with a gently curved arc. Practical, low-maintenance, and chic.",
    icon: (
      <svg viewBox="0 0 40 70" className="w-8 h-14 mx-auto text-pink-500 fill-pink-100 stroke-current stroke-2">
        <path d="M 11 65 L 11 25 C 11 12 29 12 29 25 L 29 65 Z" />
      </svg>
    )
  }
];

const PRE_SIZED_SETS = [
  { label: "XS", mm: "14mm, 11mm, 12mm, 10mm, 8mm" },
  { label: "S", mm: "15mm, 12mm, 13mm, 11mm, 9mm" },
  { label: "M", mm: "16mm, 13mm, 14mm, 12mm, 10mm" },
  { label: "L", mm: "18mm, 14mm, 15mm, 13mm, 11mm" },
  { label: "XL", mm: "19mm, 15mm, 16mm, 14mm, 12mm" },
];

export default function ShapeSizingGuideModal({
  isOpen,
  onClose,
  defaultTab = 'shapes'
}: ShapeSizingGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'shapes' | 'sizing'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Dialog */}
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-black animate-slide-up z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-pink-100 bg-[#FFF5F8]">
          <div className="flex items-center gap-3">
            <span className="text-xl">📏</span>
            <h3 className="font-brand font-bold text-lg tracking-tight text-neutral-900">
              UnHollyNails Sizing & Shape Guide
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black font-bold text-xl transition-all shadow-sm"
          >
            &times;
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-neutral-100 bg-white px-6 pt-3 gap-6">
          <button
            onClick={() => setActiveTab('shapes')}
            className={`pb-3 font-brand font-bold text-xs sm:text-sm tracking-wider uppercase transition-colors relative ${
              activeTab === 'shapes' ? 'text-[#FF5C9D]' : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            Nail Shapes
            {activeTab === 'shapes' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF5C9D] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('sizing')}
            className={`pb-3 font-brand font-bold text-xs sm:text-sm tracking-wider uppercase transition-colors relative ${
              activeTab === 'sizing' ? 'text-[#FF5C9D]' : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            How To Find Your Size
            {activeTab === 'sizing' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF5C9D] rounded-full" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 hide-scrollbar">
          {activeTab === 'shapes' ? (
            <div className="space-y-4">
              <p className="font-brand text-xs text-neutral-500">
                Choose the shape that best compliments your natural nail bed and aesthetic:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {NAIL_SHAPES.map((shape) => (
                  <div 
                    key={shape.name} 
                    className="p-4 rounded-2xl border border-pink-100 bg-[#FFF5F8]/40 flex flex-col items-center text-center hover:border-pink-300 transition-all"
                  >
                    <div className="mb-2">
                      {shape.icon}
                    </div>
                    <h4 className="font-brand font-bold text-xs sm:text-sm text-neutral-900 mb-1">{shape.name}</h4>
                    <p className="font-brand text-[11px] text-neutral-500 leading-snug">{shape.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Holly's 3 Sizing Methods */}
              <div>
                <span className="font-brand font-bold text-[10px] uppercase tracking-widest text-[#FF5C9D] block mb-1">3 Sizing Methods</span>
                <h4 className="font-brand font-bold text-sm uppercase tracking-wide text-neutral-900 mb-3">
                  How To Find Your Perfect Sizes
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Method 1 */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-b from-pink-50 to-white border-2 border-pink-200 flex flex-col justify-between">
                    <div>
                      <span className="bg-[#FF5C9D] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block mb-2">1. Sizing Kit</span>
                      <h5 className="font-brand font-bold text-xs text-neutral-900 mb-1">Numbered Tips</h5>
                      <p className="font-brand text-[11px] text-neutral-600 leading-relaxed mb-2">Try on blank numbered tips for 100% precision.</p>
                    </div>
                    <span className="font-brand font-bold text-[10px] text-pink-700 bg-pink-100/70 p-1.5 rounded-lg text-center">
                      🎁 €5 back on 1st custom order!
                    </span>
                  </div>

                  {/* Method 2 */}
                  <div className="p-3.5 rounded-2xl bg-white border border-pink-100 flex flex-col justify-between">
                    <div>
                      <span className="bg-neutral-100 text-neutral-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block mb-2">2. Tape Method</span>
                      <h5 className="font-brand font-bold text-xs text-neutral-900 mb-1">Masking Tape</h5>
                      <p className="font-brand text-[11px] text-neutral-600 leading-relaxed">Place tape across widest part, mark edges with pen, count millimeters (mm) against a ruler.</p>
                    </div>
                  </div>

                  {/* Method 3 */}
                  <div className="p-3.5 rounded-2xl bg-white border border-pink-100 flex flex-col justify-between">
                    <div>
                      <span className="bg-neutral-100 text-neutral-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block mb-2">3. Coin Photo</span>
                      <h5 className="font-brand font-bold text-xs text-neutral-900 mb-1">Photo In DMs</h5>
                      <p className="font-brand text-[11px] text-neutral-600 leading-relaxed">Hand flat next to any Euro coin (aerial photo). Send 4 photos to @unhollynails DMs to map digitally!</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pre-Sized Sets Chart (XS, S, M, L, XL) */}
              <div>
                <h4 className="font-brand font-bold text-xs uppercase tracking-wider text-neutral-900 mb-2">
                  Pre Sized Sets (Thumb to Pinky)
                </h4>
                <div className="divide-y divide-pink-100 border border-pink-100 rounded-2xl overflow-hidden bg-white">
                  {PRE_SIZED_SETS.map((size) => (
                    <div key={size.label} className="p-2.5 sm:p-3 flex items-center justify-between hover:bg-pink-50/30 transition">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-pink-100 text-pink-700 font-brand font-bold text-xs flex items-center justify-center">
                          {size.label}
                        </span>
                        <p className="font-brand font-bold text-xs text-neutral-800">{size.mm}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-neutral-400 italic mt-1.5 text-center font-brand">
                  *If you measure between sizes, size up! Measurements are the client&apos;s responsibility.
                </p>
              </div>

              {/* Tip Callout */}
              <div className="p-3.5 rounded-2xl bg-pink-50 border border-pink-200 flex items-start gap-3">
                <span className="text-xl">✨</span>
                <div>
                  <h5 className="font-brand font-bold text-xs text-pink-900 mb-0.5">Save Custom Measurements in Profile</h5>
                  <p className="font-brand text-[11px] text-pink-700 leading-relaxed">
                    Don’t match standard sizes? Save your exact mm sizes in your <Link href="/profile" className="font-bold underline" onClick={onClose}>Client Profile</Link> and click &ldquo;✨ Use My Saved Sizes ✨&rdquo; on any design!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex justify-between items-center">
          <Link href="/guides" onClick={onClose} className="font-brand text-xs text-pink-600 font-bold hover:underline">
            View Full Guide & Prep Instructions →
          </Link>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-neutral-900 text-white font-brand font-bold text-xs uppercase tracking-wider hover:bg-[#FF5C9D] transition shadow"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
