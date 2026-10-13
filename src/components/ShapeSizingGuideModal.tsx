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
    desc: "Tapered sides that curve gently to a soft rounded point. Elegant, elongating, and our most popular look.",
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
    desc: "Dramatic tapering narrowing down to an ultra-sharp point. Bold, fierce, and glamorous.",
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

const STANDARD_SIZES = [
  { label: "XS", mm: "14mm | 11mm | 12mm | 10mm | 8mm", numbers: "3, 6, 5, 7, 9" },
  { label: "S", mm: "15mm | 12mm | 13mm | 11mm | 8mm", numbers: "2, 5, 4, 6, 9" },
  { label: "M", mm: "16mm | 13mm | 14mm | 12mm | 9mm", numbers: "1, 4, 3, 5, 8" },
  { label: "L", mm: "18mm | 14mm | 15mm | 13mm | 10mm", numbers: "0, 3, 2, 4, 7" },
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
            <h3 className="text-lg font-black tracking-tight text-neutral-900">
              Shape & Sizing Guide
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
            className={`pb-3 font-bold text-sm tracking-wider uppercase transition-colors relative ${
              activeTab === 'shapes' ? 'text-pink-600' : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            Nail Shapes
            {activeTab === 'shapes' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('sizing')}
            className={`pb-3 font-bold text-sm tracking-wider uppercase transition-colors relative ${
              activeTab === 'sizing' ? 'text-pink-600' : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            How To Measure & Sizes
            {activeTab === 'sizing' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 hide-scrollbar">
          {activeTab === 'shapes' ? (
            <div className="space-y-4">
              <p className="text-xs text-neutral-500">
                Choose the shape that best compliments your natural nail bed and lifestyle:
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
                    <h4 className="font-bold text-sm text-neutral-900 mb-1">{shape.name}</h4>
                    <p className="text-[11px] text-neutral-500 leading-snug">{shape.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 3-Step Measurement Guide */}
              <div>
                <h4 className="font-black text-sm uppercase tracking-wider text-pink-600 mb-3">
                  How To Measure Your Natural Nails
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-2xl bg-pink-50/70 border border-pink-100 flex flex-col">
                    <span className="w-6 h-6 rounded-full bg-pink-500 text-white font-bold text-xs flex items-center justify-center mb-2">1</span>
                    <h5 className="font-bold text-xs mb-1">Apply Tape</h5>
                    <p className="text-[11px] text-neutral-600">Place transparent tape horizontally across the widest part of your natural nail.</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-pink-50/70 border border-pink-100 flex flex-col">
                    <span className="w-6 h-6 rounded-full bg-pink-500 text-white font-bold text-xs flex items-center justify-center mb-2">2</span>
                    <h5 className="font-bold text-xs mb-1">Mark Sidewalls</h5>
                    <p className="text-[11px] text-neutral-600">Use a pen to mark the exact edge on both sides where your nail meets the skin.</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-pink-50/70 border border-pink-100 flex flex-col">
                    <span className="w-6 h-6 rounded-full bg-pink-500 text-white font-bold text-xs flex items-center justify-center mb-2">3</span>
                    <h5 className="font-bold text-xs mb-1">Measure Millimeters</h5>
                    <p className="text-[11px] text-neutral-600">Peel the tape off and place it against a metric ruler. Measure the distance in millimeters (mm).</p>
                  </div>
                </div>
              </div>

              {/* Standard Sizes Table */}
              <div>
                <h4 className="font-black text-sm uppercase tracking-wider text-neutral-900 mb-2">
                  Standard Sizing Chart (Thumb to Pinky)
                </h4>
                <div className="divide-y divide-pink-100 border border-pink-100 rounded-2xl overflow-hidden bg-white">
                  {STANDARD_SIZES.map((size) => (
                    <div key={size.label} className="p-3 flex items-center justify-between hover:bg-pink-50/30 transition">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-pink-100 text-pink-700 font-black text-xs flex items-center justify-center">
                          {size.label}
                        </span>
                        <div>
                          <p className="font-bold text-xs text-neutral-800">{size.mm}</p>
                          <p className="text-[10px] text-neutral-400">Tip Sizes: {size.numbers}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tip Callout */}
              <div className="p-4 rounded-2xl bg-pink-50 border border-pink-200 flex items-start gap-3">
                <span className="text-xl">✨</span>
                <div>
                  <h5 className="font-bold text-xs text-pink-900 mb-0.5">Custom Sizing in Profile</h5>
                  <p className="text-[11px] text-pink-700 leading-relaxed">
                    Don’t match standard sizes? You can enter your exact mm measurements for each finger in your <Link href="/profile" className="font-black underline" onClick={onClose}>Client Profile</Link> and select &ldquo;✨ Use My Saved Sizes ✨&rdquo; on any order!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-full bg-black text-white font-bold text-xs uppercase tracking-wider hover:bg-neutral-800 transition shadow"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
