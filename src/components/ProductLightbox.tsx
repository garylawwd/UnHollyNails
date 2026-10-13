'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface ProductLightboxProps {
  isOpen: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  title?: string;
}

export default function ProductLightbox({
  isOpen,
  images,
  initialIndex = 0,
  onClose,
  title
}: ProductLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Sync initialIndex when lightbox opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    setTouchStartX(null);
  };

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex] || images[0];

  return (
    <div 
      className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-md flex flex-col justify-between items-center select-none text-white animate-fade-in-up"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div 
        className="w-full flex items-center justify-between px-4 sm:px-8 py-4 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          {title && (
            <h3 className="font-bold text-sm sm:text-base text-white/90 truncate max-w-[200px] sm:max-w-md">
              {title}
            </h3>
          )}
          {images.length > 1 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-white/80 border border-white/10">
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all text-xl font-bold leading-none cursor-pointer"
          aria-label="Close fullscreen preview"
        >
          &times;
        </button>
      </div>

      {/* Main Image Stage */}
      <div 
        className="relative flex-1 w-full flex items-center justify-center px-2 sm:px-16 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-2 sm:left-6 z-20 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/50 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/10 hover:scale-105 active:scale-95"
              aria-label="Previous image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-2 sm:right-6 z-20 w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-black/50 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/10 hover:scale-105 active:scale-95"
              aria-label="Next image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </>
        )}

        {/* The uncropped image */}
        <div className="relative w-full h-[75vh] max-h-[85vh] max-w-5xl flex items-center justify-center">
          <Image
            src={currentImage}
            alt={title || `Product photo ${currentIndex + 1}`}
            fill
            sizes="100vw"
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* Bottom Thumbnails / Dots */}
      <div 
        className="w-full py-4 px-4 flex justify-center items-center gap-2 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        {images.length > 1 && images.map((img, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`relative rounded-lg overflow-hidden transition-all ${
              idx === currentIndex
                ? 'w-12 h-12 ring-2 ring-pink-500 scale-105 opacity-100'
                : 'w-10 h-10 opacity-50 hover:opacity-80'
            }`}
            aria-label={`Jump to image ${idx + 1}`}
          >
            <Image
              src={img}
              alt={`Thumbnail ${idx + 1}`}
              fill
              sizes="48px"
              className="object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
