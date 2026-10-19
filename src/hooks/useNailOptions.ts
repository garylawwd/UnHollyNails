"use client";

import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  VENDOR_UID,
  DEFAULT_SHAPES,
  DEFAULT_LENGTHS,
  DEFAULT_SIZES,
} from "@/lib/constants";

export interface NailOptionsDoc {
  shapes: string[];
  lengths: string[];
  sizes: string[];
  updatedAt?: number;
}

export function useNailOptions() {
  const [shapes, setShapes] = useState<string[]>(DEFAULT_SHAPES);
  const [lengths, setLengths] = useState<string[]>(DEFAULT_LENGTHS);
  const [sizes, setSizes] = useState<string[]>(DEFAULT_SIZES);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const docRef = doc(db, "users", VENDOR_UID, "store_settings", "nail_options");
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<NailOptionsDoc>;
          if (Array.isArray(data.shapes) && data.shapes.length > 0) {
            setShapes(data.shapes.filter((s) => s && s.toLowerCase() !== "other"));
          } else {
            setShapes(DEFAULT_SHAPES);
          }
          if (Array.isArray(data.lengths) && data.lengths.length > 0) {
            setLengths(data.lengths.filter((l) => l && l.toLowerCase() !== "other"));
          } else {
            setLengths(DEFAULT_LENGTHS);
          }
          if (Array.isArray(data.sizes) && data.sizes.length > 0) {
            setSizes(data.sizes.filter((s) => s && s.toLowerCase() !== "other"));
          } else {
            setSizes(DEFAULT_SIZES);
          }
        }
        setLoading(false);
      },
      (err) => {
        console.warn("Could not subscribe to nail_options, using defaults:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const saveOptions = useCallback(
    async (nextShapes: string[], nextLengths: string[], nextSizes: string[] = sizes) => {
      const cleanShapes = nextShapes.filter((s) => s.trim() && s.trim().toLowerCase() !== "other");
      const cleanLengths = nextLengths.filter((l) => l.trim() && l.trim().toLowerCase() !== "other");
      const cleanSizes = nextSizes.filter((s) => s.trim() && s.trim().toLowerCase() !== "other");

      setShapes(cleanShapes);
      setLengths(cleanLengths);
      setSizes(cleanSizes);

      await setDoc(
        doc(db, "users", VENDOR_UID, "store_settings", "nail_options"),
        {
          shapes: cleanShapes,
          lengths: cleanLengths,
          sizes: cleanSizes,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    },
    [sizes]
  );

  const addShape = useCallback(
    async (newShape: string) => {
      const trimmed = newShape.trim();
      if (!trimmed || trimmed.toLowerCase() === "other") return;
      if (shapes.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;
      const updated = [...shapes, trimmed];
      await saveOptions(updated, lengths, sizes);
    },
    [shapes, lengths, sizes, saveOptions]
  );

  const removeShape = useCallback(
    async (shapeToRemove: string) => {
      const updated = shapes.filter((s) => s !== shapeToRemove);
      await saveOptions(updated, lengths, sizes);
    },
    [shapes, lengths, sizes, saveOptions]
  );

  const renameShape = useCallback(
    async (oldShape: string, newShape: string) => {
      const trimmed = newShape.trim();
      if (!trimmed || trimmed.toLowerCase() === "other") return;
      const updated = shapes.map((s) => (s === oldShape ? trimmed : s));
      await saveOptions(updated, lengths, sizes);
    },
    [shapes, lengths, sizes, saveOptions]
  );

  const addLength = useCallback(
    async (newLength: string) => {
      const trimmed = newLength.trim();
      if (!trimmed || trimmed.toLowerCase() === "other") return;
      if (lengths.some((l) => l.toLowerCase() === trimmed.toLowerCase())) return;
      const updated = [...lengths, trimmed];
      await saveOptions(shapes, updated, sizes);
    },
    [shapes, lengths, sizes, saveOptions]
  );

  const removeLength = useCallback(
    async (lengthToRemove: string) => {
      const updated = lengths.filter((l) => l !== lengthToRemove);
      await saveOptions(shapes, updated, sizes);
    },
    [shapes, lengths, sizes, saveOptions]
  );

  const renameLength = useCallback(
    async (oldLength: string, newLength: string) => {
      const trimmed = newLength.trim();
      if (!trimmed || trimmed.toLowerCase() === "other") return;
      const updated = lengths.map((l) => (l === oldLength ? trimmed : l));
      await saveOptions(shapes, updated, sizes);
    },
    [shapes, lengths, sizes, saveOptions]
  );

  return {
    shapes,
    lengths,
    sizes,
    loading,
    addShape,
    removeShape,
    renameShape,
    addLength,
    removeLength,
    renameLength,
  };
}
