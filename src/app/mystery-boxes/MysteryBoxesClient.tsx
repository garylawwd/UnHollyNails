"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAdmin } from "@/context/AdminContext";

interface MysteryBoxItem {
  id: string;
  title: string;
  target: string;
  price: string;
  tagline: string;
  features: string[];
  howToOrder: string;
}

interface DeetsPoint {
  id: string;
  label: string;
  desc: string;
}

interface MysteryBoxesData {
  eyebrow: string;
  title: string;
  subtitle: string;
  boxes: MysteryBoxItem[];
  deetsEyebrow: string;
  deetsTitle: string;
  deetsSubtitle: string;
  deetsPoints: DeetsPoint[];
}

export const DEFAULT_MYSTERY_DATA: MysteryBoxesData = {
  eyebrow: "Surprise Artistry",
  title: "UnHollyNails Mystery Boxes",
  subtitle: "Can't decide on a design? Let me create something bespoke and stunning just for you.",
  boxes: [
    {
      id: "kids",
      title: "Kids' Mini Mystery Boxes",
      target: "Ages 5–12",
      price: "From €25",
      tagline: "The ultimate surprise gift pack for the little divas (ages 5–12)! Perfect for birthdays, treats or special occasions!",
      features: [
        "A surprise mini press-on set designed specifically for kids",
        "Mini application kit (NO GLUE, ONLY SAFE STICKY TABS)",
        "A gift bag full of fun treats and goodies"
      ],
      howToOrder: "Send me a DM requesting one! They can be shipped to you or directly to your recipient's address with a hand-written gift note (provided by you in our DMs)!"
    },
    {
      id: "adults",
      title: "Adult Mystery Boxes",
      target: "XS, S, M, L, or XL",
      price: "From €35",
      tagline: "Want a gorgeous, high end set of press ons but can't decide on a design? Leave it to me! Or give it as a gift to someone special!",
      features: [
        "A pre-sized (XS, S, M, L, or XL) set of luxury press-ons with a hand-painted surprise design",
        "A full professional application kit",
        "A gift bag packed with goodies",
        "A fun scratcher that reveals a discount for your next order!"
      ],
      howToOrder: "Send me a DM with your selected size! They can be shipped to you or directly to your recipient's address with a hand-written gift note (provided by you in our DMs)!"
    }
  ],
  deetsEyebrow: "Personalise Your Mystery",
  deetsTitle: "The Deets (Preferences)",
  deetsSubtitle: "Feel free to let me know any details when ordering via DM so I can make it perfect for you:",
  deetsPoints: [
    { id: "d1", label: "Your Style / Vibe", desc: "Pastel, goth, cute, floral, sparkly, chrome, grunge, or minimalist — let me know what you love!" },
    { id: "d2", label: "Length & Shape", desc: "Prefer short and practical, or long and dramatic? Let me know your preference." },
    { id: "d3", label: "Absolute No-Nos", desc: "Hate yellow? Detest 3D gems? Can't stand square tips? Tell me and I will ensure it's not included!" }
  ]
};

export default function MysteryBoxesClient() {
  const {
    editMode,
    setPageTitle,
    setIsSaving,
    setLastSaved: setAdminLastSaved,
    setSaveHandler,
    setResetHandler
  } = useAdmin();
  const [data, setData] = useState<MysteryBoxesData>(DEFAULT_MYSTERY_DATA);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const vendorUid = process.env.NEXT_PUBLIC_VENDOR_UID || "CMzpkonBxKeLboaVTUYwDWgiwNG3";

  useEffect(() => {
    const loadContent = async () => {
      try {
        const snap = await getDoc(doc(db, "users", vendorUid, "store_settings", "mystery_boxes_content"));
        if (snap.exists()) {
          const remoteData = snap.data() as Partial<MysteryBoxesData>;
          setData(prev => ({
            ...prev,
            ...remoteData,
            boxes: Array.isArray(remoteData.boxes) && remoteData.boxes.length > 0 ? remoteData.boxes : prev.boxes,
            deetsPoints: Array.isArray(remoteData.deetsPoints) && remoteData.deetsPoints.length > 0 ? remoteData.deetsPoints : prev.deetsPoints,
          }));
        }
      } catch (err) {
        console.warn("Could not load mystery_boxes_content, using defaults", err);
      }
    };
    loadContent();
  }, [vendorUid]);

  const saveToFirestore = useCallback(async (dataToSave: MysteryBoxesData) => {
    setSaving(true);
    try {
      await setDoc(doc(db, "users", vendorUid, "store_settings", "mystery_boxes_content"), dataToSave, { merge: true });
      setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to save mystery_boxes_content:", err);
    } finally {
      setSaving(false);
    }
  }, [vendorUid]);

  // Box edit handlers
  const handleBoxChange = (bIdx: number, field: keyof MysteryBoxItem, val: any) => {
    setData(prev => {
      const nextBoxes = [...prev.boxes];
      nextBoxes[bIdx] = { ...nextBoxes[bIdx], [field]: val };
      return { ...prev, boxes: nextBoxes };
    });
  };

  const handleFeatureChange = (bIdx: number, fIdx: number, val: string) => {
    setData(prev => {
      const nextBoxes = [...prev.boxes];
      const nextFeatures = [...nextBoxes[bIdx].features];
      nextFeatures[fIdx] = val;
      nextBoxes[bIdx] = { ...nextBoxes[bIdx], features: nextFeatures };
      return { ...prev, boxes: nextBoxes };
    });
  };

  const handleAddFeature = (bIdx: number) => {
    setData(prev => {
      const nextBoxes = [...prev.boxes];
      nextBoxes[bIdx] = { ...nextBoxes[bIdx], features: [...nextBoxes[bIdx].features, "New surprise item or treat"] };
      saveToFirestore({ ...prev, boxes: nextBoxes });
      return { ...prev, boxes: nextBoxes };
    });
  };

  const handleDeleteFeature = (bIdx: number, fIdx: number) => {
    setData(prev => {
      const nextBoxes = [...prev.boxes];
      nextBoxes[bIdx] = { ...nextBoxes[bIdx], features: nextBoxes[bIdx].features.filter((_, idx) => idx !== fIdx) };
      saveToFirestore({ ...prev, boxes: nextBoxes });
      return { ...prev, boxes: nextBoxes };
    });
  };

  const handleAddBox = () => {
    const newBox: MysteryBoxItem = {
      id: "box_" + Date.now(),
      title: "New Mystery Edition",
      target: "Custom Size",
      price: "From €30",
      tagline: "Description of the new mystery box tier.",
      features: [
        "1x Mystery hand-painted luxury set",
        "1x Complete application kit",
        "1x Cute gift bag"
      ],
      howToOrder: "Send me a DM to order this mystery box tier!"
    };
    setData(prev => {
      const next = { ...prev, boxes: [...prev.boxes, newBox] };
      saveToFirestore(next);
      return next;
    });
  };

  const handleDeleteBox = (bIdx: number) => {
    if (!confirm("Delete this mystery box card?")) return;
    setData(prev => {
      const next = { ...prev, boxes: prev.boxes.filter((_, idx) => idx !== bIdx) };
      saveToFirestore(next);
      return next;
    });
  };

  // Deets handlers
  const handleDeetChange = (dIdx: number, field: keyof DeetsPoint, val: string) => {
    setData(prev => {
      const nextPoints = [...prev.deetsPoints];
      nextPoints[dIdx] = { ...nextPoints[dIdx], [field]: val };
      return { ...prev, deetsPoints: nextPoints };
    });
  };

  const handleAddDeet = () => {
    const newDeet: DeetsPoint = {
      id: "deet_" + Date.now(),
      label: "New Preference Field",
      desc: "Describe what the customer can specify (e.g. finish preference, occasion)."
    };
    setData(prev => {
      const next = { ...prev, deetsPoints: [...prev.deetsPoints, newDeet] };
      saveToFirestore(next);
      return next;
    });
  };

  const handleDeleteDeet = (dIdx: number) => {
    setData(prev => {
      const next = { ...prev, deetsPoints: prev.deetsPoints.filter((_, idx) => idx !== dIdx) };
      saveToFirestore(next);
      return next;
    });
  };

  const handleResetDefaults = async () => {
    setData(DEFAULT_MYSTERY_DATA);
    await saveToFirestore(DEFAULT_MYSTERY_DATA);
  };

  
  useEffect(() => {
    setPageTitle("Mystery Boxes");
    setSaveHandler(() => saveToFirestore(data));
    setResetHandler(() => handleResetDefaults());
    return () => {
      setPageTitle(undefined);
      setSaveHandler(undefined);
      setResetHandler(undefined);
    };
  }, [data, setPageTitle, setSaveHandler, setResetHandler, saveToFirestore]);

  useEffect(() => {
    setIsSaving(saving);
  }, [saving, setIsSaving]);

  useEffect(() => {
    setAdminLastSaved(lastSaved);
  }, [lastSaved, setAdminLastSaved]);

  return (
    <div className="min-h-screen bg-[#FFF5F8] text-[#1A1A1A] pb-20 relative selection:bg-pink-200">

      {/* Ambient Pink Glows */}
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#FF5C9D] rounded-full mix-blend-multiply filter blur-[200px] opacity-[0.10] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#FFB6D5] rounded-full mix-blend-multiply filter blur-[200px] opacity-[0.10] pointer-events-none z-0"></div>

      {/* Header */}
      <div className="relative z-10 pt-8 sm:pt-14 pb-8 sm:pb-12 text-center px-4 max-w-4xl mx-auto">
        <Link href="/" className="inline-block mb-4 sm:mb-6">
          <Image src="/logo_cropped.png" alt="UnHolly Nails" width={180} height={70} className="w-32 sm:w-40 h-auto object-contain mx-auto" />
        </Link>

        {editMode ? (
          <div className="flex flex-col gap-2 max-w-xl mx-auto">
            <input
              type="text"
              value={data.eyebrow}
              onChange={e => setData(prev => ({ ...prev, eyebrow: e.target.value }))}
              onBlur={() => saveToFirestore(data)}
              className="w-full text-center bg-pink-50 border border-pink-300 rounded-lg px-3 py-1 font-brand text-xs font-bold text-[#FF5C9D] uppercase tracking-widest outline-none"
            />
            <input
              type="text"
              value={data.title}
              onChange={e => setData(prev => ({ ...prev, title: e.target.value }))}
              onBlur={() => saveToFirestore(data)}
              className="w-full text-center bg-pink-50 border border-pink-300 rounded-lg px-3 py-1 font-brand font-bold text-2xl sm:text-3xl text-neutral-900 outline-none"
            />
            <textarea
              value={data.subtitle}
              onChange={e => setData(prev => ({ ...prev, subtitle: e.target.value }))}
              onBlur={() => saveToFirestore(data)}
              rows={2}
              className="w-full text-center bg-pink-50 border border-pink-300 rounded-lg px-3 py-1 font-brand text-xs text-neutral-600 outline-none resize-none"
            />
          </div>
        ) : (
          <>
            <span className="font-brand font-bold text-xs uppercase tracking-widest text-[#FF5C9D] block mb-2">{data.eyebrow}</span>
            <h1 className="font-brand font-bold text-3xl sm:text-5xl text-neutral-900 tracking-tight mb-3">{data.title}</h1>
            <p className="font-brand text-xs sm:text-sm text-neutral-500 max-w-md mx-auto">
              {data.subtitle}
            </p>
          </>
        )}
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 space-y-10">
        {/* Boxes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.boxes.map((box, bIdx) => (
            <div key={box.id || bIdx} className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm border border-pink-100 flex flex-col justify-between relative">
              {editMode && (
                <button
                  onClick={() => handleDeleteBox(bIdx)}
                  className="absolute top-3 right-3 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-full border border-red-200 transition font-brand font-bold cursor-pointer z-20"
                >
                  ✕ Delete
                </button>
              )}

              <div>
                <div className="flex items-center justify-between mb-4 gap-2">
                  {editMode ? (
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="text"
                        value={box.target}
                        onChange={e => handleBoxChange(bIdx, "target", e.target.value)}
                        onBlur={() => saveToFirestore(data)}
                        className="bg-pink-50 border border-pink-300 rounded px-2 py-0.5 text-[10px] font-brand font-bold text-pink-700 uppercase tracking-wider outline-none"
                      />
                      <input
                        type="text"
                        value={box.price}
                        onChange={e => handleBoxChange(bIdx, "price", e.target.value)}
                        onBlur={() => saveToFirestore(data)}
                        placeholder="Price"
                        className="w-28 text-right bg-pink-50 border border-pink-400 rounded-full px-3 py-1 font-brand font-bold text-sm text-[#FF5C9D] outline-none"
                      />
                    </div>
                  ) : (
                    <>
                      <span className="font-brand font-bold text-[10px] uppercase tracking-wider px-3 py-1 rounded-full bg-pink-100 text-pink-700 border border-pink-200">
                        {box.target}
                      </span>
                      <span className="font-brand font-bold text-lg text-[#FF5C9D]">{box.price}</span>
                    </>
                  )}
                </div>

                {editMode ? (
                  <div className="flex flex-col gap-2 mb-4">
                    <input
                      type="text"
                      value={box.title}
                      onChange={e => handleBoxChange(bIdx, "title", e.target.value)}
                      onBlur={() => saveToFirestore(data)}
                      className="w-full bg-white border border-pink-300 rounded px-2 py-1 font-brand font-bold text-xl text-neutral-900 outline-none"
                    />
                    <textarea
                      value={box.tagline}
                      onChange={e => handleBoxChange(bIdx, "tagline", e.target.value)}
                      onBlur={() => saveToFirestore(data)}
                      rows={2}
                      className="w-full bg-pink-50 border border-pink-200 rounded p-2 font-brand text-xs text-neutral-700 outline-none resize-none"
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="font-brand font-bold text-2xl text-neutral-900 tracking-tight mb-3">{box.title}</h2>
                    <p className="font-brand text-xs sm:text-sm text-neutral-700 leading-relaxed mb-6 bg-pink-50/50 p-3.5 rounded-xl border border-pink-100">
                      {box.tagline}
                    </p>
                  </>
                )}

                <div className="space-y-2 mb-6">
                  <span className="font-brand font-bold text-[11px] uppercase tracking-wider text-neutral-500 block">What&apos;s Inside?</span>
                  {box.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2.5 text-xs text-neutral-600 font-brand">
                      <span className="text-[#FF5C9D] font-bold mt-0.5">✓</span>
                      {editMode ? (
                        <div className="flex-1 flex items-center gap-1">
                          <input
                            type="text"
                            value={feature}
                            onChange={e => handleFeatureChange(bIdx, fIdx, e.target.value)}
                            onBlur={() => saveToFirestore(data)}
                            className="flex-1 bg-white border border-pink-200 rounded px-2 py-0.5 text-xs font-brand text-neutral-700 outline-none"
                          />
                          <button
                            onClick={() => handleDeleteFeature(bIdx, fIdx)}
                            className="text-neutral-400 hover:text-red-500 text-xs px-1 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span>{feature}</span>
                      )}
                    </div>
                  ))}

                  {editMode && (
                    <button
                      onClick={() => handleAddFeature(bIdx)}
                      className="text-[11px] font-brand font-bold text-pink-600 hover:text-pink-800 bg-pink-50 px-2 py-1 rounded transition cursor-pointer mt-1"
                    >
                      + Add Item to Box
                    </button>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-[#FFF5F8]/70 border border-pink-100 text-xs text-neutral-600 font-brand mb-6">
                  <strong className="text-neutral-900 block mb-0.5 uppercase text-[10px] tracking-wider">How to order:</strong>
                  {editMode ? (
                    <textarea
                      value={box.howToOrder}
                      onChange={e => handleBoxChange(bIdx, "howToOrder", e.target.value)}
                      onBlur={() => saveToFirestore(data)}
                      rows={2}
                      className="w-full bg-white border border-pink-200 rounded p-1.5 font-brand text-xs text-neutral-700 outline-none resize-none mt-1"
                    />
                  ) : (
                    box.howToOrder
                  )}
                </div>
              </div>

              <div>
                <a
                  href={`https://ig.me/m/unhollynails?text=${encodeURIComponent(`Hi Holly! I'd like to order an ${box.title} (${box.price})!`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full block text-center bg-neutral-900 hover:bg-[#FF5C9D] text-white font-brand font-bold text-xs uppercase tracking-wider py-3.5 rounded-full transition shadow-sm"
                >
                  Order via DM
                </a>
              </div>
            </div>
          ))}
        </div>

        {editMode && (
          <div className="text-center py-2">
            <button
              onClick={handleAddBox}
              className="bg-neutral-900 hover:bg-black text-white font-brand font-bold text-xs px-6 py-2.5 rounded-full transition shadow cursor-pointer"
            >
              + Add Another Mystery Box Card
            </button>
          </div>
        )}

        {/* The Deets Section */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-sm border border-pink-100">
          <div className="text-center mb-8">
            {editMode ? (
              <div className="max-w-md mx-auto flex flex-col gap-2">
                <input
                  type="text"
                  value={data.deetsEyebrow}
                  onChange={e => setData(prev => ({ ...prev, deetsEyebrow: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-0.5 font-brand font-bold text-[11px] text-[#FF5C9D] uppercase tracking-widest outline-none"
                />
                <input
                  type="text"
                  value={data.deetsTitle}
                  onChange={e => setData(prev => ({ ...prev, deetsTitle: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-1 font-brand font-bold text-xl sm:text-2xl text-neutral-900 outline-none"
                />
                <input
                  type="text"
                  value={data.deetsSubtitle}
                  onChange={e => setData(prev => ({ ...prev, deetsSubtitle: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-1 font-brand text-xs text-neutral-500 outline-none"
                />
              </div>
            ) : (
              <>
                <span className="font-brand font-bold text-[11px] sm:text-xs text-[#FF5C9D] uppercase tracking-widest block mb-1">{data.deetsEyebrow}</span>
                <h2 className="font-brand font-bold text-2xl sm:text-3xl text-neutral-900 tracking-tight">{data.deetsTitle}</h2>
                <p className="font-brand text-xs sm:text-sm text-neutral-500 max-w-md mx-auto mt-1">
                  {data.deetsSubtitle}
                </p>
                <div className="w-16 h-0.5 bg-pink-300 mx-auto mt-2"></div>
              </>
            )}
          </div>

          <div className="space-y-4 max-w-2xl mx-auto">
            {data.deetsPoints.map((point, dIdx) => (
              <div key={point.id || dIdx} className="p-4 rounded-xl border border-pink-100 bg-pink-50/30 flex items-start gap-4 relative">
                {editMode && (
                  <button
                    onClick={() => handleDeleteDeet(dIdx)}
                    className="absolute top-2 right-2 text-neutral-400 hover:text-red-500 text-xs p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
                <div className="w-8 h-8 rounded-full bg-pink-100 text-[#FF5C9D] font-brand font-bold text-sm flex items-center justify-center shrink-0">
                  {dIdx + 1}
                </div>
                <div className="flex-1">
                  {editMode ? (
                    <div className="flex flex-col gap-1.5">
                      <input
                        type="text"
                        value={point.label}
                        onChange={e => handleDeetChange(dIdx, "label", e.target.value)}
                        onBlur={() => saveToFirestore(data)}
                        className="bg-white border border-pink-300 rounded px-2 py-0.5 font-brand font-bold text-xs text-neutral-900 outline-none"
                      />
                      <textarea
                        value={point.desc}
                        onChange={e => handleDeetChange(dIdx, "desc", e.target.value)}
                        onBlur={() => saveToFirestore(data)}
                        rows={2}
                        className="bg-white border border-pink-200 rounded p-1.5 font-brand text-xs text-neutral-600 outline-none resize-none"
                      />
                    </div>
                  ) : (
                    <>
                      <h3 className="font-brand font-bold text-sm text-neutral-900 mb-0.5">{point.label}</h3>
                      <p className="font-brand text-xs text-neutral-600 leading-relaxed">{point.desc}</p>
                    </>
                  )}
                </div>
              </div>
            ))}

            {editMode && (
              <div className="text-center pt-2">
                <button
                  onClick={handleAddDeet}
                  className="bg-neutral-900 hover:bg-black text-white font-brand font-bold text-xs px-4 py-2 rounded-full transition cursor-pointer"
                >
                  + Add Preference Detail
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
