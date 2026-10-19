"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { User, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Product } from "@/lib/types";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { VENDOR_UID, isAdminUid } from "@/lib/constants";
import { useNailOptions } from "@/hooks/useNailOptions";
import InteractiveHandSizer, {
  FINGER_MAP,
  HandSizesMap,
  hasAnyFingerSize,
  formatHandSizesSummary,
} from "@/components/InteractiveHandSizer";

interface ProductDetailDrawerProps {
  product: Product | null;
  onClose: () => void;
  currentUser: User | null;
  clientProfile: any | null;
  onOpenLightbox: (index: number) => void;
  onOpenShapeGuide: () => void;
}

const normalizeLengthCode = (len?: string): string => {
  if (!len) return "M";
  const map: Record<string, string> = {
    "Extra Short": "XS",
    Short: "S",
    Medium: "M",
    Long: "L",
    "Extra Long": "XL",
  };
  return map[len] || len;
};

export default function ProductDetailDrawer({
  product,
  onClose,
  currentUser,
  clientProfile,
  onOpenLightbox,
  onOpenShapeGuide,
}: ProductDetailDrawerProps) {
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { shapes, lengths, sizes: presetSizes, addShape, addLength } = useNailOptions();

  const isAdmin = isAdminUid(currentUser?.uid);

  const [selectedShape, setSelectedShape] = useState<string>("Almond");
  const [selectedSize, setSelectedSize] = useState<string>("M");
  const [selectedLength, setSelectedLength] = useState<string>("M");
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);

  // Custom "Other" text inputs for Shape & Length
  const [customShapeText, setCustomShapeText] = useState<string>("");
  const [customLengthText, setCustomLengthText] = useState<string>("");

  // Interactive 10-finger hand sizer state
  const [profileSizes, setProfileSizes] = useState<HandSizesMap>({});
  const [customSizes, setCustomSizes] = useState<HandSizesMap>({});
  const [expandSavedSizes, setExpandSavedSizes] = useState<boolean>(false);
  const [savingProfileSizes, setSavingProfileSizes] = useState<boolean>(false);
  const [savedProfileBadge, setSavedProfileBadge] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>("");
  const [savingOptionBadge, setSavingOptionBadge] = useState<string>("");

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const hiddenShapesSet = new Set(product?.hiddenShapes || []);
  const hiddenLengthsSet = new Set(product?.hiddenLengths || []);

  const availableShapes = shapes.filter((s) => !hiddenShapesSet.has(s));
  const availableLengths = lengths.filter((l) => !hiddenLengthsSet.has(l));

  const shapeOptions = [...(availableShapes.length > 0 ? availableShapes : shapes), "Other"];
  const lengthOptions = [...(availableLengths.length > 0 ? availableLengths : lengths), "Other"];
  const sizeOptions = presetSizes;

  // Initialize selections whenever product opens
  useEffect(() => {
    if (!product) return;
    const currentHiddenShapes = product.hiddenShapes || [];
    const currentHiddenLengths = product.hiddenLengths || [];

    const validShapes = shapes.filter((s) => !currentHiddenShapes.includes(s));
    const validLengths = lengths.filter((l) => !currentHiddenLengths.includes(l));

    const preferredShape =
      clientProfile?.defaultShape && !currentHiddenShapes.includes(clientProfile.defaultShape)
        ? clientProfile.defaultShape
        : null;
    const prodDefaultShape =
      product.defaultShape && !currentHiddenShapes.includes(product.defaultShape)
        ? product.defaultShape
        : null;
    const initShape = preferredShape || prodDefaultShape || validShapes[0] || "Almond";

    const preferredLength =
      clientProfile?.defaultLength && !currentHiddenLengths.includes(clientProfile.defaultLength)
        ? clientProfile.defaultLength
        : null;
    const prodDefaultLength =
      product.defaultLength && !currentHiddenLengths.includes(product.defaultLength)
        ? product.defaultLength
        : null;
    const initLength = normalizeLengthCode(preferredLength || prodDefaultLength || validLengths[0] || "M");

    setSelectedShape(initShape);
    setSelectedSize(currentUser ? "Profile Sizes" : "M");
    setSelectedLength(initLength);
    setSelectedQuantity(1);
    setCustomShapeText("");
    setCustomLengthText("");
    setCustomSizes({});
    setExpandSavedSizes(false);
    setValidationError("");
    setSavedProfileBadge(false);
  }, [product, clientProfile, currentUser, shapes, lengths]);

  // Load saved finger sizes when logged in and clientProfile is available
  useEffect(() => {
    if (!product || !clientProfile?.syncId) return;

    let active = true;
    const fetchClientSizes = async () => {
      try {
        const sizeQ = query(
          collection(db, "users", VENDOR_UID, "nail_sizes"),
          where("clientSyncId", "==", clientProfile.syncId)
        );
        const sizeSnap = await getDocs(sizeQ);
        const loaded: HandSizesMap = {};
        sizeSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (typeof data.fingerIndex !== "number") return;
          const key = Object.keys(FINGER_MAP).find(
            (k) => FINGER_MAP[k] === data.fingerIndex
          );
          if (key) {
            loaded[key] = { syncId: data.syncId || docSnap.id, sizeMm: data.sizeMm };
          }
        });
        if (active) {
          setProfileSizes(loaded);
        }
      } catch (err) {
        console.error("Failed to fetch saved nail sizes in drawer:", err);
      }
    };

    fetchClientSizes();
    return () => {
      active = false;
    };
  }, [product, clientProfile?.syncId]);

  if (!product) return null;

  const scrollGallery = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const { clientWidth } = scrollContainerRef.current;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -clientWidth : clientWidth,
        behavior: "smooth",
      });
    }
  };

  const lowerName = product.name.toLowerCase();
  const isSizingKit = lowerName.includes("sizing");
  const isMiniSet =
    lowerName.includes("mini") ||
    lowerName.includes("kids") ||
    product.type?.toLowerCase() === "minis" ||
    (product.tags || []).some((t) => t.toLowerCase() === "minis");

  const handleProfileFingerSizeChange = (
    hand: "Left" | "Right",
    finger: string,
    value: string
  ) => {
    const key = `${hand}-${finger}`;
    setSavedProfileBadge(false);
    setProfileSizes((prev) => ({
      ...prev,
      [key]: { ...prev[key], sizeMm: value },
    }));
  };

  const handleCustomFingerSizeChange = (
    hand: "Left" | "Right",
    finger: string,
    value: string
  ) => {
    const key = `${hand}-${finger}`;
    setSavedProfileBadge(false);
    setCustomSizes((prev) => ({
      ...prev,
      [key]: { ...prev[key], sizeMm: value },
    }));
  };

  const persistSingleFingerToProfile = async (
    clientSyncId: string,
    hand: "Left" | "Right",
    finger: string
  ) => {
    const key = `${hand}-${finger}`;
    const entry = profileSizes[key];
    if (!entry || entry.sizeMm === "" || entry.sizeMm === undefined) return;
    const numeric = parseFloat(String(entry.sizeMm));
    if (isNaN(numeric)) return;

    const sizeSyncId = entry.syncId || crypto.randomUUID();
    setProfileSizes((prev) => ({
      ...prev,
      [key]: { syncId: sizeSyncId, sizeMm: numeric },
    }));

    await setDoc(doc(db, "users", VENDOR_UID, "nail_sizes", sizeSyncId), {
      syncId: sizeSyncId,
      clientId: 0,
      clientSyncId,
      fingerIndex: FINGER_MAP[key],
      sizeMm: numeric,
      updatedAt: Date.now(),
    });
  };

  const handleSaveAllSizesToProfile = async (
    sourceMap: HandSizesMap,
    targetClientSyncId?: string
  ) => {
    const syncId = targetClientSyncId || clientProfile?.syncId;
    if (!syncId) return;
    setSavingProfileSizes(true);
    try {
      const promises: Promise<void>[] = [];
      const updatedMap: HandSizesMap = { ...profileSizes };
      for (const [key, entry] of Object.entries(sourceMap)) {
        if (!entry || entry.sizeMm === "" || entry.sizeMm === undefined) continue;
        const numeric = parseFloat(String(entry.sizeMm));
        if (isNaN(numeric)) continue;
        const fingerIdx = FINGER_MAP[key];
        if (typeof fingerIdx !== "number") continue;

        const sizeSyncId =
          entry.syncId || profileSizes[key]?.syncId || crypto.randomUUID();
        updatedMap[key] = { syncId: sizeSyncId, sizeMm: numeric };
        promises.push(
          setDoc(doc(db, "users", VENDOR_UID, "nail_sizes", sizeSyncId), {
            syncId: sizeSyncId,
            clientId: 0,
            clientSyncId: syncId,
            fingerIndex: fingerIdx,
            sizeMm: numeric,
            updatedAt: Date.now(),
          })
        );
      }
      await Promise.all(promises);
      setProfileSizes(updatedMap);
      setSavedProfileBadge(true);
    } catch (err) {
      console.error("Failed to save sizes to profile:", err);
    } finally {
      setSavingProfileSizes(false);
    }
  };

  const handleGuestSignInAndSaveSizes = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      if (!u.email) return;

      const q = query(
        collection(db, "users", VENDOR_UID, "clients"),
        where("email", "==", u.email)
      );
      const snap = await getDocs(q);
      let clientSyncId: string;

      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data();
        clientSyncId = data.syncId || docSnap.id;
      } else {
        clientSyncId = crypto.randomUUID();
        await setDoc(doc(db, "users", VENDOR_UID, "clients", clientSyncId), {
          syncId: clientSyncId,
          id: 0,
          name: u.displayName || "",
          email: u.email,
          instagram: "",
          phone: "",
          address: "",
          birthday: null,
          defaultShape: selectedShape !== "Other" ? selectedShape : "Almond",
          defaultLength: selectedLength !== "Other" ? selectedLength : "M",
          additionalComments: "",
          designNotes: "",
          adminUid: VENDOR_UID,
          loyaltyStamps: 0,
          loyaltyRewardsAvailable: 0,
          updatedAt: Date.now(),
        });
      }

      await handleSaveAllSizesToProfile(customSizes, clientSyncId);
      setSelectedSize("Profile Sizes");
      setExpandSavedSizes(true);
    } catch (err) {
      console.error("Guest sign-in to save sizes failed:", err);
    }
  };

  const handleAdminQuickAddShape = async () => {
    const trimmed = customShapeText.trim();
    if (!trimmed) return;
    await addShape(trimmed);
    setSelectedShape(trimmed);
    setCustomShapeText("");
    setSavingOptionBadge(`Added "${trimmed}" to standard shapes!`);
    setTimeout(() => setSavingOptionBadge(""), 3000);
  };

  const handleAdminQuickAddLength = async () => {
    const trimmed = customLengthText.trim();
    if (!trimmed) return;
    await addLength(trimmed);
    setSelectedLength(trimmed);
    setCustomLengthText("");
    setSavingOptionBadge(`Added "${trimmed}" to standard lengths!`);
    setTimeout(() => setSavingOptionBadge(""), 3000);
  };

  const handleAddToBag = () => {
    setValidationError("");

    let finalShape = selectedShape;
    if (!isMiniSet && selectedShape === "Other") {
      if (!customShapeText.trim()) {
        setValidationError("Please type your custom nail shape in the box above.");
        return;
      }
      finalShape = `Other (${customShapeText.trim()})`;
    } else if (isMiniSet) {
      finalShape = "N/A";
    }

    let finalLength = selectedLength;
    if (!isMiniSet && selectedLength === "Other") {
      if (!customLengthText.trim()) {
        setValidationError("Please type your custom nail length in the box above.");
        return;
      }
      finalLength = `Other (${customLengthText.trim()})`;
    } else if (isMiniSet) {
      finalLength = "N/A";
    }

    let finalSize = selectedSize;
    let activeHandSizes: HandSizesMap | undefined = undefined;

    if (isSizingKit) {
      finalSize = "N/A";
    } else if (selectedSize === "Profile Sizes") {
      finalSize = "Profile Sizes";
      if (hasAnyFingerSize(profileSizes)) {
        activeHandSizes = profileSizes;
      }
    } else if (selectedSize === "Custom Sizes") {
      if (!hasAnyFingerSize(customSizes)) {
        setValidationError(
          "Please enter your finger measurements (mm) on the hand diagrams above, or choose a preset size."
        );
        return;
      }
      finalSize = "Custom Sizes (mm)";
      activeHandSizes = customSizes;
    }

    addToCart(
      product,
      finalShape,
      finalSize,
      finalLength,
      selectedQuantity,
      activeHandSizes
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center text-black">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full sm:w-[500px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] transform transition-transform animate-slide-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur p-2 rounded-full text-black hover:bg-neutral-100 transition shadow-sm cursor-pointer"
          aria-label="Close drawer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="overflow-y-auto w-full hide-scrollbar">
          {/* Image Gallery Carousel */}
          <div className="relative group">
            <div
              ref={scrollContainerRef}
              className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar"
            >
              <div
                className="relative aspect-[4/3] w-full shrink-0 snap-center bg-pink-50 cursor-zoom-in group/zoom"
                onClick={() => onOpenLightbox(0)}
              >
                <Image
                  src={product.imagePath}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 500px"
                />
                <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 opacity-90 group-hover/zoom:opacity-100 transition shadow pointer-events-none">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-3.5 h-3.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
                    />
                  </svg>
                  <span className="font-semibold text-[11px]">
                    Tap to view full
                  </span>
                </div>
              </div>
              {product.additionalImages?.map((url: string, idx: number) => (
                <div
                  key={idx}
                  className="relative aspect-[4/3] w-full shrink-0 snap-center bg-pink-50 border-l border-white cursor-zoom-in group/zoom"
                  onClick={() => onOpenLightbox(idx + 1)}
                >
                  <Image
                    src={url}
                    alt={`${product.name} ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 500px"
                  />
                  <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 opacity-90 group-hover/zoom:opacity-100 transition shadow pointer-events-none">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-3.5 h-3.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
                      />
                    </svg>
                    <span className="font-semibold text-[11px]">
                      Tap to view full
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {(product.additionalImages?.length || 0) > 0 && (
              <>
                <button
                  onClick={() => scrollGallery("left")}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow-md text-black opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 19.5L8.25 12l7.5-7.5"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => scrollGallery("right")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow-md text-black opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </button>
              </>
            )}
          </div>

          {(product.additionalImages?.length || 0) > 0 && (
            <div className="flex justify-center gap-1.5 mt-3 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-black/60"></div>
              {product.additionalImages?.map((_, idx) => (
                <div
                  key={idx}
                  className="w-1.5 h-1.5 rounded-full bg-black/20"
                ></div>
              ))}
            </div>
          )}

          <div className="p-5 sm:p-6 pb-6">
            <div className="flex flex-wrap gap-1 mb-2">
              {product.tags?.map((t) => (
                <span
                  key={t}
                  className="bg-pink-50 text-pink-700 text-[10px] px-2 py-0.5 rounded-md border border-pink-200"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between mb-1 gap-2">
              <h2 className="text-2xl font-bold text-[#1A1A1A]">
                {product.name}
              </h2>
              <button
                type="button"
                onClick={() => toggleWishlist(product)}
                className={`px-3 py-1.5 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  isWishlisted(product.id)
                    ? "border-pink-300 bg-pink-50 text-pink-600 shadow-sm"
                    : "border-neutral-200 text-neutral-600 hover:text-black hover:border-black"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill={isWishlisted(product.id) ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth={isWishlisted(product.id) ? 0 : 2}
                  className="w-3.5 h-3.5 text-pink-500"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                  />
                </svg>
                <span>{isWishlisted(product.id) ? "Saved" : "Save"}</span>
              </button>
            </div>

            <p
              className={`text-lg font-medium mb-4 ${
                product.priceOnAsk
                  ? "text-pink-600 font-bold"
                  : "text-neutral-600"
              }`}
            >
              {product.priceOnAsk
                ? "Price on Ask"
                : `€${product.basePrice.toFixed(2)}`}
            </p>

            {product.description && (
              <p className="text-neutral-500 text-sm leading-relaxed mb-5 whitespace-pre-wrap">
                {product.description}
              </p>
            )}

            {savingOptionBadge && (
              <div className="mb-4 p-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-bold text-center">
                ✓ {savingOptionBadge}
              </div>
            )}

            {/* SHAPE SELECTION */}
            {!isMiniSet && (
              <div className="mb-4">
                <div className="flex justify-between items-end mb-2">
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                    Shape
                  </h3>
                  <button
                    type="button"
                    onClick={onOpenShapeGuide}
                    className="text-xs text-pink-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    ✨ Shape & Sizing Guide
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {shapeOptions.map((shape) => (
                    <label
                      key={shape}
                      className={`cursor-pointer text-center px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        selectedShape === shape
                          ? "bg-black text-white border-black"
                          : "bg-white text-neutral-700 border-neutral-200 hover:border-black"
                      }`}
                    >
                      <input
                        type="radio"
                        className="hidden"
                        name="shape"
                        value={shape}
                        checked={selectedShape === shape}
                        onChange={(e) => setSelectedShape(e.target.value)}
                      />
                      {shape}
                    </label>
                  ))}
                </div>

                {selectedShape === "Other" && (
                  <div className="mt-2.5 p-3 rounded-2xl bg-pink-50/60 border border-pink-200 space-y-2 animate-fade-in">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-pink-700">
                      Custom Shape Request
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customShapeText}
                        onChange={(e) => setCustomShapeText(e.target.value)}
                        placeholder="Type shape (e.g. Duck, Lipstick, Pointy)..."
                        className="flex-1 bg-white border border-pink-200 rounded-xl px-3.5 py-2 text-sm text-neutral-900 focus:outline-none focus:border-pink-500"
                      />
                      {isAdmin && customShapeText.trim() && (
                        <button
                          type="button"
                          onClick={handleAdminQuickAddShape}
                          className="px-3 py-2 rounded-xl bg-black hover:bg-pink-600 text-white text-xs font-bold whitespace-nowrap transition cursor-pointer"
                          title="Add this shape to the standard store options"
                        >
                          + Save to Store
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SIZE SELECTION */}
            {!isSizingKit && (
              <div className="mb-4">
                <div className="flex justify-between items-end mb-2">
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                    Size
                  </h3>
                  {isMiniSet && (
                    <button
                      type="button"
                      onClick={onOpenShapeGuide}
                      className="text-xs text-pink-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      ✨ Sizing Guide
                    </button>
                  )}
                </div>

                {/* Top Full-Width Custom/Profile Size Buttons */}
                <div className="flex flex-col gap-1.5 mb-1.5">
                  {currentUser && (
                    <label
                      className={`cursor-pointer w-full py-2.5 px-3 flex items-center justify-center rounded-xl text-sm font-semibold border transition-all ${
                        selectedSize === "Profile Sizes"
                          ? "bg-black text-white border-black shadow-sm"
                          : "bg-pink-50 text-pink-700 border-pink-200 hover:border-pink-300"
                      }`}
                    >
                      <input
                        type="radio"
                        className="hidden"
                        name="size"
                        value="Profile Sizes"
                        checked={selectedSize === "Profile Sizes"}
                        onChange={(e) => setSelectedSize(e.target.value)}
                      />
                      ✨ Use My Saved Sizes ✨
                    </label>
                  )}

                  <label
                    className={`cursor-pointer w-full py-2.5 px-3 flex items-center justify-center rounded-xl text-sm font-semibold border transition-all ${
                      selectedSize === "Custom Sizes"
                        ? "bg-black text-white border-black shadow-sm"
                        : "bg-pink-50 text-pink-700 border-pink-200 hover:border-pink-300"
                    }`}
                  >
                    <input
                      type="radio"
                      className="hidden"
                      name="size"
                      value="Custom Sizes"
                      checked={selectedSize === "Custom Sizes"}
                      onChange={(e) => setSelectedSize(e.target.value)}
                    />
                    📏 Enter Custom Sizes (mm)
                  </label>
                </div>

                {/* Preset Sizes Underneath (XS, S, M, L) */}
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {sizeOptions.map((size) => (
                    <label
                      key={size}
                      className={`cursor-pointer flex-1 min-w-[3rem] py-2.5 flex items-center justify-center rounded-xl text-sm font-semibold border transition-all ${
                        selectedSize === size
                          ? "bg-black text-white border-black"
                          : "bg-white text-neutral-700 border-neutral-200 hover:border-black"
                      }`}
                    >
                      <input
                        type="radio"
                        className="hidden"
                        name="size"
                        value={size}
                        checked={selectedSize === size}
                        onChange={(e) => setSelectedSize(e.target.value)}
                      />
                      {size}
                    </label>
                  ))}
                </div>

                {/* Logged-in User Expandable Saved Sizes Dropdown */}
                {currentUser && selectedSize === "Profile Sizes" && (
                  <div className="mt-2 rounded-2xl border border-pink-200 bg-[#FFF5F8]/70 overflow-hidden transition-all">
                    <button
                      type="button"
                      onClick={() => setExpandSavedSizes((prev) => !prev)}
                      className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-pink-700 hover:bg-pink-100/60 transition cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <span>👋</span>
                        <span>
                          {expandSavedSizes
                            ? "Hide your hand sizes"
                            : "Expand to see & edit your sizes"}
                        </span>
                      </span>
                      <span className="text-[11px] bg-white px-2 py-0.5 rounded-full border border-pink-200 text-pink-600">
                        {expandSavedSizes ? "▴ Collapse" : "▾ Expand"}
                      </span>
                    </button>

                    {!expandSavedSizes && hasAnyFingerSize(profileSizes) && (
                      <div className="px-3.5 pb-2.5 text-[11px] text-neutral-500 font-medium">
                        {formatHandSizesSummary(profileSizes)}
                      </div>
                    )}

                    {expandSavedSizes && (
                      <div className="p-3 pt-1 border-t border-pink-100 bg-white">
                        <p className="text-[11px] text-neutral-500 text-center mb-1">
                          Tap any finger circle to adjust your size (mm) for this order or update your profile:
                        </p>
                        <InteractiveHandSizer
                          sizes={profileSizes}
                          onChange={handleProfileFingerSizeChange}
                          onBlurFinger={
                            clientProfile?.syncId
                              ? (hand, finger) =>
                                  persistSingleFingerToProfile(
                                    clientProfile.syncId,
                                    hand,
                                    finger
                                  )
                              : undefined
                          }
                          compact={true}
                        />
                        {clientProfile?.syncId && (
                          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-pink-50">
                            <span className="text-[11px] text-neutral-400">
                              {savedProfileBadge
                                ? "✓ Saved to your profile!"
                                : "Changes apply to this order & your profile."}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSaveAllSizesToProfile(profileSizes)}
                              disabled={savingProfileSizes}
                              className="px-3 py-1.5 rounded-full bg-pink-500 hover:bg-pink-600 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                            >
                              {savingProfileSizes
                                ? "Saving..."
                                : "💾 Save to Profile"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Enter Custom Sizes (mm) Hand Sizer (for BOTH signed-in and guest users) */}
                {selectedSize === "Custom Sizes" && (
                  <div className="mt-2 p-3 rounded-2xl border border-pink-200 bg-white space-y-2">
                    <p className="text-[11px] text-neutral-600 text-center font-medium">
                      Tap each finger circle below to enter custom measurements in{" "}
                      <span className="font-bold text-pink-600">mm</span>:
                    </p>
                    <InteractiveHandSizer
                      sizes={customSizes}
                      onChange={handleCustomFingerSizeChange}
                      compact={true}
                    />
                    {currentUser && clientProfile?.syncId ? (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-pink-50">
                        <span className="text-[11px] text-neutral-400">
                          {savedProfileBadge
                            ? "✓ Saved to your profile!"
                            : "Entered for this order only (or save to profile):"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSaveAllSizesToProfile(customSizes)}
                          disabled={savingProfileSizes}
                          className="px-3 py-1.5 rounded-full bg-pink-500 hover:bg-pink-600 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          {savingProfileSizes
                            ? "Saving..."
                            : "💾 Save as Profile Sizes"}
                        </button>
                      </div>
                    ) : !currentUser ? (
                      <div className="p-3 rounded-xl bg-pink-50/80 border border-pink-200 flex flex-col sm:flex-row items-center justify-between gap-2">
                        <p className="text-[11px] text-pink-900 font-medium text-center sm:text-left">
                          💡 Want to save these sizes for future orders? Set up your profile in one tap!
                        </p>
                        <button
                          type="button"
                          onClick={handleGuestSignInAndSaveSizes}
                          className="px-3.5 py-2 rounded-full bg-black hover:bg-pink-600 text-white text-[11px] font-bold whitespace-nowrap transition cursor-pointer shadow-sm"
                        >
                          Save & Create Profile
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}

                {!currentUser && selectedSize !== "Custom Sizes" && (
                  <p className="text-[10px] text-neutral-500 text-center italic mt-1.5">
                    💡 Tip: Select &ldquo;Enter Custom Sizes (mm)&rdquo; above to input your exact finger sizes, or sign in to use your saved profile!
                  </p>
                )}
              </div>
            )}

            {/* LENGTH SELECTION */}
            {!isMiniSet && (
              <div className="mb-4">
                <div className="flex justify-between items-end mb-2">
                  <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                    Length
                  </h3>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {lengthOptions.map((length) => (
                    <label
                      key={length}
                      className={`cursor-pointer text-center px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        selectedLength === length
                          ? "bg-black text-white border-black"
                          : "bg-white text-neutral-700 border-neutral-200 hover:border-black"
                      }`}
                    >
                      <input
                        type="radio"
                        className="hidden"
                        name="length"
                        value={length}
                        checked={selectedLength === length}
                        onChange={(e) => setSelectedLength(e.target.value)}
                      />
                      {length}
                    </label>
                  ))}
                </div>

                {selectedLength === "Other" && (
                  <div className="mt-2.5 p-3 rounded-2xl bg-pink-50/60 border border-pink-200 space-y-2 animate-fade-in">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-pink-700">
                      Custom Length Request
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customLengthText}
                        onChange={(e) => setCustomLengthText(e.target.value)}
                        placeholder="Type length (e.g. XXL, XXXL, Short-Medium)..."
                        className="flex-1 bg-white border border-pink-200 rounded-xl px-3.5 py-2 text-sm text-neutral-900 focus:outline-none focus:border-pink-500"
                      />
                      {isAdmin && customLengthText.trim() && (
                        <button
                          type="button"
                          onClick={handleAdminQuickAddLength}
                          className="px-3 py-2 rounded-xl bg-black hover:bg-pink-600 text-white text-xs font-bold whitespace-nowrap transition cursor-pointer"
                          title="Add this length to the standard store options"
                        >
                          + Save to Store
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {validationError && (
              <div className="mt-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold text-center">
                {validationError}
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-4 bg-white border-t border-neutral-100 flex-shrink-0 flex items-center gap-4">
          <div className="flex items-center border border-neutral-200 rounded-xl px-2 h-[56px]">
            <button
              type="button"
              onClick={() =>
                setSelectedQuantity(Math.max(1, selectedQuantity - 1))
              }
              className="p-2 text-neutral-500 hover:text-black w-8 h-full flex items-center justify-center font-bold text-lg cursor-pointer"
            >
              -
            </button>
            <span className="px-2 font-bold text-sm min-w-[2rem] text-center">
              {selectedQuantity}
            </span>
            <button
              type="button"
              onClick={() => setSelectedQuantity(selectedQuantity + 1)}
              className="p-2 text-neutral-500 hover:text-black w-8 h-full flex items-center justify-center font-bold text-lg cursor-pointer"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={handleAddToBag}
            className="flex-grow bg-black text-white font-bold text-base py-4 rounded-xl hover:bg-neutral-800 transition-colors shadow-lg shadow-black/10 active:scale-[0.98] h-[56px] cursor-pointer"
          >
            {product.priceOnAsk
              ? "Add to Request — POA"
              : `Add to Bag — €${(product.basePrice * selectedQuantity).toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
