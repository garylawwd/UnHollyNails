"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { VENDOR_UID, formatStorageImageUrl } from "@/lib/constants";

interface CompletedPhoto {
  syncId?: string;
  docId?: string;
  uri: string;
  imageType?: string;
  orderDate?: number;
  notes?: string;
  updatedAt?: number;
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export default function CompletedSetCelebrationModal() {
  const [activePhoto, setActivePhoto] = useState<CompletedPhoto | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const allPhotosRef = useRef<CompletedPhoto[]>([]);

  useEffect(() => {
    let unsubImages: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user?.email) {
        setIsOpen(false);
        setActivePhoto(null);
        if (unsubImages) unsubImages();
        return;
      }

      try {
        // Query client profile by email
        const clientQ = query(
          collection(db, "users", VENDOR_UID, "clients"),
          where("email", "==", user.email)
        );

        const unsubClient = onSnapshot(clientQ, (clientSnap) => {
          if (clientSnap.empty) return;
          const clientData = clientSnap.docs[0].data();
          const syncId = clientData.syncId || clientSnap.docs[0].id;

          if (unsubImages) unsubImages();

          const imgQ = query(
            collection(db, "users", VENDOR_UID, "client_images"),
            where("clientSyncId", "==", syncId)
          );

          unsubImages = onSnapshot(imgQ, (imgSnap) => {
            const completedPhotos: CompletedPhoto[] = [];
            imgSnap.forEach((docSnap) => {
              const data = docSnap.data();
              const isCompleted =
                data.imageType === "completed" ||
                (typeof data.uri === "string" && data.uri.includes("completed"));
              if (isCompleted && data.uri) {
                completedPhotos.push({
                  syncId: data.syncId || docSnap.id,
                  docId: docSnap.id,
                  uri: data.uri,
                  imageType: data.imageType,
                  orderDate: data.orderDate,
                  notes: data.notes,
                  updatedAt: data.updatedAt || 0,
                });
              }
            });

            if (completedPhotos.length === 0) return;

            // Sort newest first
            completedPhotos.sort(
              (a, b) =>
                (b.updatedAt || b.orderDate || 0) -
                (a.updatedAt || a.orderDate || 0)
            );

            allPhotosRef.current = completedPhotos;

            const newest = completedPhotos[0];
            const storageKey = `unholly_celebration_seen_${newest.syncId || newest.docId}`;
            const photoTimestamp = newest.updatedAt || newest.orderDate || 0;
            const isRecent = photoTimestamp > 0 && Date.now() - photoTimestamp < FOURTEEN_DAYS_MS;

            // Check if client has already seen this specific completed set photo
            if (typeof window !== "undefined") {
              // If the newest photo was completed more than 14 days ago, silently auto-mark
              // all historical photos as acknowledged so older orders never pop up.
              if (!isRecent) {
                completedPhotos.forEach((photo) => {
                  localStorage.setItem(`unholly_celebration_seen_${photo.syncId || photo.docId}`, "true");
                });
                return;
              }

              const alreadySeen = localStorage.getItem(storageKey);
              if (!alreadySeen) {
                setActivePhoto(newest);
                setIsOpen(true);
              }
            }
          });
        });

        return () => {
          unsubClient();
          if (unsubImages) unsubImages();
        };
      } catch (err) {
        console.error("Error setting up completed celebration listener:", err);
      }
    });

    return () => {
      unsubAuth();
      if (unsubImages) unsubImages();
    };
  }, []);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      // Mark ALL currently loaded completed photos as seen so user is never prompted for older orders
      allPhotosRef.current.forEach((photo) => {
        const key = `unholly_celebration_seen_${photo.syncId || photo.docId}`;
        localStorage.setItem(key, "true");
      });
    }
    setIsOpen(false);
  };

  if (!isOpen || !activePhoto) return null;

  const displayUrl = formatStorageImageUrl(activePhoto.uri, VENDOR_UID);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 text-black animate-fade-in">
      {/* Dimmed backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={handleDismiss}
      />

      {/* Modal Dialog Card */}
      <div className="relative bg-gradient-to-b from-pink-50/70 via-white to-white rounded-3xl w-full max-w-md shadow-2xl border border-pink-200 overflow-hidden z-10 flex flex-col text-center">
        {/* Close "X" button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-neutral-100 border border-neutral-200 text-neutral-500 hover:text-black flex items-center justify-center font-bold text-sm shadow-sm transition z-20 cursor-pointer"
          title="Close"
        >
          ✕
        </button>

        {/* Top Celebration Badge */}
        <div className="pt-6 px-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-100 text-pink-700 font-bold text-[11px] uppercase tracking-wider mb-2 border border-pink-200">
            <span>✨</span>
            <span>Completed Design Ready</span>
            <span>💅</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
            Your Custom Nails Are Ready!
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1.5 leading-relaxed">
            Holly has finished crafting your custom set! Here is a sneak peek fresh from the studio. We hope you absolutely love how they turned out! 💕
          </p>
        </div>

        {/* Completed Image Showcase */}
        <div className="p-4 sm:p-6 pb-2">
          <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-pink-50 border-2 border-pink-300/80 shadow-lg group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayUrl}
              alt="Completed Custom Nail Set"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow">
              ✓ Handcrafted by Holly
            </div>
          </div>
          {activePhoto.notes && (
            <p className="text-[11px] text-neutral-500 italic mt-2 text-center">
              &ldquo;{activePhoto.notes}&rdquo;
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 sm:p-6 pt-2 space-y-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-sm shadow-lg shadow-pink-500/25 transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>I Love It! ✨</span>
          </button>

          <Link
            href="/profile?tab=orders"
            onClick={handleDismiss}
            className="w-full py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs transition flex items-center justify-center gap-1.5"
          >
            <span>View in My Orders & Gallery →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
