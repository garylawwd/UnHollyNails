"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAdmin } from "@/context/AdminContext";

interface BundleItem {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  tagline: string;
  badge: string;
  badgeColor?: string;
  features: string[];
  ctaText: string;
  dmPrompt: string;
}

interface AddOnItem {
  id: string;
  name: string;
  price: string;
  desc: string;
}

interface BundlesData {
  eyebrow: string;
  title: string;
  subtitle: string;
  bundles: BundleItem[];
  addOnsEyebrow: string;
  addOnsTitle: string;
  addOnsSubtitle: string;
  addOns: AddOnItem[];
}

export const DEFAULT_BUNDLES_DATA: BundlesData = {
  eyebrow: "Curated Gift Boxes",
  title: "UnHollyNails Bundles",
  subtitle: "The ultimate luxury gift packs for yourself or someone special.",
  bundles: [
    {
      id: "mini-me",
      title: "The Mini Me Bundle",
      subtitle: "For you & your little bestie",
      price: "From €55",
      tagline: "The ultimate matching experience for you & your little bestie! Perfect for birthdays, holidays or special occasions!",
      badge: "Matching Experience",
      badgeColor: "bg-pink-100 text-pink-700 border-pink-200",
      features: [
        "One pre-sized adult luxury press-on set",
        "One matching mini set (gentle sticky tabs for ages 5–12)",
        "Full application kits for you both",
        "Gorgeous gift bags for both sets",
        "A fun scratcher to reveal a discount for your next order!"
      ],
      ctaText: "Order Mini Me Bundle via DM",
      dmPrompt: "Hi Holly! I'd love to order the Mini Me Matching Bundle (€55)."
    },
    {
      id: "ultimate",
      title: "The UnHollyNails Ultimate Bundle",
      subtitle: "The big one — absolute luxury",
      price: "From €90",
      tagline: "This is the big one! The absolute ultimate luxury nail experience packed into one gorgeous gift box!",
      badge: "Ultimate Luxury Box",
      badgeColor: "bg-[#FF5C9D] text-white border-transparent",
      features: [
        "A custom luxury press-on set (or pre-sized) of your choice",
        "Full professional prep kit & deluxe gift bag",
        "A matching custom keychain (3D or smart tech)",
        "A matching handcrafted set of earrings",
        "A luxury beauty or hair product included",
        "A fun scratcher to reveal a discount for your next order!"
      ],
      ctaText: "Order Ultimate Bundle via DM",
      dmPrompt: "Hi Holly! I'd love to order the Ultimate Luxury Bundle (€90)."
    }
  ],
  addOnsEyebrow: "Complete The Look",
  addOnsTitle: "Matchy-Matchy Add-Ons",
  addOnsSubtitle: "Upgrade any custom order or bundle with matching accessories.",
  addOns: [
    { id: "a1", name: "Matching Custom Earrings", price: "From €12", desc: "Handcrafted to perfectly mirror the art, colours, or charms on your custom set." },
    { id: "a2", name: "Matching Custom 2D Keychain", price: "From €15", desc: "A sleek, lightweight keychain matching your bespoke nail design." },
    { id: "a3", name: "Matching 3D / Smart Keychain", price: "From €30", desc: "Sculpted 3D or smart NFC keychain programmed to share your digital links." },
  ]
};

export default function BundlesClient() {
  const {
    editMode,
    setPageTitle,
    setIsSaving,
    setLastSaved: setAdminLastSaved,
    setSaveHandler,
    setResetHandler
  } = useAdmin();
  const [data, setData] = useState<BundlesData>(DEFAULT_BUNDLES_DATA);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const vendorUid = process.env.NEXT_PUBLIC_VENDOR_UID || "CMzpkonBxKeLboaVTUYwDWgiwNG3";

  useEffect(() => {
    const loadContent = async () => {
      try {
        const snap = await getDoc(doc(db, "users", vendorUid, "store_settings", "bundles_content"));
        if (snap.exists()) {
          const remoteData = snap.data() as Partial<BundlesData>;
          setData(prev => ({
            ...prev,
            ...remoteData,
            bundles: Array.isArray(remoteData.bundles) && remoteData.bundles.length > 0 ? remoteData.bundles : prev.bundles,
            addOns: Array.isArray(remoteData.addOns) && remoteData.addOns.length > 0 ? remoteData.addOns : prev.addOns,
          }));
        }
      } catch (err) {
        console.warn("Could not load bundles_content, using defaults", err);
      }
    };
    loadContent();
  }, [vendorUid]);

  const saveToFirestore = useCallback(async (dataToSave: BundlesData) => {
    setSaving(true);
    try {
      await setDoc(doc(db, "users", vendorUid, "store_settings", "bundles_content"), dataToSave, { merge: true });
      setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to save bundles_content:", err);
    } finally {
      setSaving(false);
    }
  }, [vendorUid]);

  // Handle bundle editing
  const handleBundleChange = (bIdx: number, field: keyof BundleItem, val: any) => {
    setData(prev => {
      const nextBundles = [...prev.bundles];
      nextBundles[bIdx] = { ...nextBundles[bIdx], [field]: val };
      return { ...prev, bundles: nextBundles };
    });
  };

  const handleFeatureChange = (bIdx: number, fIdx: number, val: string) => {
    setData(prev => {
      const nextBundles = [...prev.bundles];
      const nextFeatures = [...nextBundles[bIdx].features];
      nextFeatures[fIdx] = val;
      nextBundles[bIdx] = { ...nextBundles[bIdx], features: nextFeatures };
      return { ...prev, bundles: nextBundles };
    });
  };

  const handleAddFeature = (bIdx: number) => {
    setData(prev => {
      const nextBundles = [...prev.bundles];
      nextBundles[bIdx] = {
        ...nextBundles[bIdx],
        features: [...nextBundles[bIdx].features, "New included item or perk"]
      };
      saveToFirestore({ ...prev, bundles: nextBundles });
      return { ...prev, bundles: nextBundles };
    });
  };

  const handleDeleteFeature = (bIdx: number, fIdx: number) => {
    setData(prev => {
      const nextBundles = [...prev.bundles];
      nextBundles[bIdx] = {
        ...nextBundles[bIdx],
        features: nextBundles[bIdx].features.filter((_, idx) => idx !== fIdx)
      };
      saveToFirestore({ ...prev, bundles: nextBundles });
      return { ...prev, bundles: nextBundles };
    });
  };

  const handleAddBundle = () => {
    const newBundle: BundleItem = {
      id: "bundle_" + Date.now(),
      title: "New Luxury Bundle",
      subtitle: "Bespoke gift pack",
      price: "From €60",
      tagline: "Description of the new gift bundle package.",
      badge: "Special Edition",
      badgeColor: "bg-pink-100 text-pink-700 border-pink-200",
      features: [
        "1x Custom luxury press-on set",
        "1x Complete prep kit",
        "1x Surprise gift extra"
      ],
      ctaText: "Order via DM",
      dmPrompt: "Hi Holly! I'd love to order the New Luxury Bundle."
    };
    setData(prev => {
      const next = { ...prev, bundles: [...prev.bundles, newBundle] };
      saveToFirestore(next);
      return next;
    });
  };

  const handleDeleteBundle = (bIdx: number) => {
    if (!confirm("Delete this bundle?")) return;
    setData(prev => {
      const next = { ...prev, bundles: prev.bundles.filter((_, idx) => idx !== bIdx) };
      saveToFirestore(next);
      return next;
    });
  };

  // Handle add-ons editing
  const handleAddOnChange = (aIdx: number, field: keyof AddOnItem, val: string) => {
    setData(prev => {
      const nextAddOns = [...prev.addOns];
      nextAddOns[aIdx] = { ...nextAddOns[aIdx], [field]: val };
      return { ...prev, addOns: nextAddOns };
    });
  };

  const handleAddAddOn = () => {
    const newAddOn: AddOnItem = {
      id: "addon_" + Date.now(),
      name: "New Custom Accessory",
      price: "From €15",
      desc: "Description of matching accessory."
    };
    setData(prev => {
      const next = { ...prev, addOns: [...prev.addOns, newAddOn] };
      saveToFirestore(next);
      return next;
    });
  };

  const handleDeleteAddOn = (aIdx: number) => {
    if (!confirm("Delete this add-on item?")) return;
    setData(prev => {
      const next = { ...prev, addOns: prev.addOns.filter((_, idx) => idx !== aIdx) };
      saveToFirestore(next);
      return next;
    });
  };

  const handleResetDefaults = async () => {
    setData(DEFAULT_BUNDLES_DATA);
    await saveToFirestore(DEFAULT_BUNDLES_DATA);
  };

  
  useEffect(() => {
    setPageTitle("Bundles & Gift Packs");
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
        {/* Main Bundles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.bundles.map((bundle, bIdx) => (
            <div key={bundle.id || bIdx} className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm border border-pink-100 flex flex-col justify-between relative overflow-hidden">
              {editMode && (
                <button
                  onClick={() => handleDeleteBundle(bIdx)}
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
                        value={bundle.badge}
                        onChange={e => handleBundleChange(bIdx, "badge", e.target.value)}
                        onBlur={() => saveToFirestore(data)}
                        className="bg-pink-50 border border-pink-300 rounded px-2 py-0.5 text-[10px] font-brand font-bold text-[#FF5C9D] uppercase tracking-wider outline-none"
                      />
                      <input
                        type="text"
                        value={bundle.price}
                        onChange={e => handleBundleChange(bIdx, "price", e.target.value)}
                        onBlur={() => saveToFirestore(data)}
                        placeholder="Price"
                        className="w-28 text-right bg-pink-50 border border-pink-400 rounded-full px-3 py-1 font-brand font-bold text-sm text-[#FF5C9D] outline-none"
                      />
                    </div>
                  ) : (
                    <>
                      <span className={`font-brand font-bold text-[10px] uppercase tracking-wider px-3 py-1 rounded-full border ${bundle.badgeColor || 'bg-pink-100 text-pink-700 border-pink-200'}`}>
                        {bundle.badge}
                      </span>
                      <span className="font-brand font-bold text-lg text-[#FF5C9D]">{bundle.price}</span>
                    </>
                  )}
                </div>

                {editMode ? (
                  <div className="flex flex-col gap-2 mb-4">
                    <input
                      type="text"
                      value={bundle.title}
                      onChange={e => handleBundleChange(bIdx, "title", e.target.value)}
                      onBlur={() => saveToFirestore(data)}
                      className="w-full bg-white border border-pink-300 rounded px-2 py-1 font-brand font-bold text-xl text-neutral-900 outline-none"
                    />
                    <input
                      type="text"
                      value={bundle.subtitle}
                      onChange={e => handleBundleChange(bIdx, "subtitle", e.target.value)}
                      onBlur={() => saveToFirestore(data)}
                      className="w-full bg-white border border-pink-300 rounded px-2 py-1 font-brand text-xs text-neutral-500 outline-none"
                    />
                    <textarea
                      value={bundle.tagline}
                      onChange={e => handleBundleChange(bIdx, "tagline", e.target.value)}
                      onBlur={() => saveToFirestore(data)}
                      rows={2}
                      className="w-full bg-pink-50 border border-pink-200 rounded p-2 font-brand text-xs text-neutral-700 outline-none resize-none"
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="font-brand font-bold text-2xl text-neutral-900 tracking-tight mb-1">{bundle.title}</h2>
                    <p className="font-brand text-xs text-neutral-400 mb-4">{bundle.subtitle}</p>
                    <p className="font-brand text-xs sm:text-sm text-neutral-700 leading-relaxed mb-6 bg-pink-50/50 p-3.5 rounded-xl border border-pink-100">
                      {bundle.tagline}
                    </p>
                  </>
                )}

                <div className="space-y-2.5 mb-8">
                  <span className="font-brand font-bold text-[11px] uppercase tracking-wider text-neutral-500 block">Package Includes:</span>
                  {bundle.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2 text-xs text-neutral-700 font-brand">
                      <span className="text-[#FF5C9D] font-bold mt-0.5">✓</span>
                      {editMode ? (
                        <div className="flex-1 flex items-center gap-1">
                          <input
                            type="text"
                            value={feature}
                            onChange={e => handleFeatureChange(bIdx, fIdx, e.target.value)}
                            onBlur={() => saveToFirestore(data)}
                            className="flex-1 bg-white border border-pink-200 rounded px-2 py-0.5 text-xs font-brand text-neutral-700 outline-none focus:ring-1 focus:ring-pink-400"
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
                      + Add Included Item
                    </button>
                  )}
                </div>
              </div>

              <div>
                {editMode ? (
                  <div className="flex flex-col gap-1 mb-2">
                    <span className="text-[10px] text-neutral-400 uppercase font-bold font-brand">CTA Button Text:</span>
                    <input
                      type="text"
                      value={bundle.ctaText}
                      onChange={e => handleBundleChange(bIdx, "ctaText", e.target.value)}
                      onBlur={() => saveToFirestore(data)}
                      className="w-full bg-white border border-pink-300 rounded px-2 py-1 font-brand text-xs font-bold text-neutral-800 outline-none text-center"
                    />
                  </div>
                ) : (
                  <a
                    href={`https://ig.me/m/unhollynails?text=${encodeURIComponent(bundle.dmPrompt || `Hi Holly! I'd love to order the ${bundle.title} (${bundle.price}).`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full block text-center bg-neutral-900 hover:bg-[#FF5C9D] text-white font-brand font-bold text-xs uppercase tracking-wider py-3.5 rounded-full transition shadow-sm"
                  >
                    {bundle.ctaText || "Order Bundle via DM"}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {editMode && (
          <div className="text-center py-2">
            <button
              onClick={handleAddBundle}
              className="bg-neutral-900 hover:bg-black text-white font-brand font-bold text-xs px-6 py-2.5 rounded-full transition shadow cursor-pointer"
            >
              + Add Another Bundle Card
            </button>
          </div>
        )}

        {/* Add-Ons Section */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-sm border border-pink-100">
          <div className="text-center mb-8">
            {editMode ? (
              <div className="max-w-md mx-auto flex flex-col gap-2">
                <input
                  type="text"
                  value={data.addOnsEyebrow}
                  onChange={e => setData(prev => ({ ...prev, addOnsEyebrow: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-0.5 font-brand font-bold text-[11px] text-[#FF5C9D] uppercase tracking-widest outline-none"
                />
                <input
                  type="text"
                  value={data.addOnsTitle}
                  onChange={e => setData(prev => ({ ...prev, addOnsTitle: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-1 font-brand font-bold text-xl sm:text-2xl text-neutral-900 outline-none"
                />
                <input
                  type="text"
                  value={data.addOnsSubtitle}
                  onChange={e => setData(prev => ({ ...prev, addOnsSubtitle: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-1 font-brand text-xs text-neutral-500 outline-none"
                />
              </div>
            ) : (
              <>
                <span className="font-brand font-bold text-[11px] sm:text-xs text-[#FF5C9D] uppercase tracking-widest block mb-1">{data.addOnsEyebrow}</span>
                <h2 className="font-brand font-bold text-2xl sm:text-3xl text-neutral-900 tracking-tight">{data.addOnsTitle}</h2>
                <p className="font-brand text-xs sm:text-sm text-neutral-500 max-w-md mx-auto mt-1">
                  {data.addOnsSubtitle}
                </p>
                <div className="w-16 h-0.5 bg-pink-300 mx-auto mt-2"></div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.addOns.map((addon, aIdx) => (
              <div key={addon.id || aIdx} className="p-5 rounded-2xl bg-pink-50/40 border border-pink-100 flex flex-col justify-between relative">
                {editMode && (
                  <button
                    onClick={() => handleDeleteAddOn(aIdx)}
                    className="absolute top-2 right-2 text-neutral-400 hover:text-red-500 text-xs p-1 cursor-pointer"
                    title="Delete add-on"
                  >
                    ✕
                  </button>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {editMode ? (
                      <div className="w-full flex items-center gap-2">
                        <input
                          type="text"
                          value={addon.name}
                          onChange={e => handleAddOnChange(aIdx, "name", e.target.value)}
                          onBlur={() => saveToFirestore(data)}
                          className="flex-1 bg-white border border-pink-300 rounded px-2 py-0.5 font-brand font-bold text-xs text-neutral-900 outline-none"
                        />
                        <input
                          type="text"
                          value={addon.price}
                          onChange={e => handleAddOnChange(aIdx, "price", e.target.value)}
                          onBlur={() => saveToFirestore(data)}
                          className="w-20 bg-white border border-pink-400 rounded-full px-2 py-0.5 font-brand font-bold text-[11px] text-[#FF5C9D] text-center outline-none"
                        />
                      </div>
                    ) : (
                      <>
                        <h3 className="font-brand font-bold text-sm text-neutral-900">{addon.name}</h3>
                        <span className="font-brand font-bold text-xs text-[#FF5C9D] bg-white px-2.5 py-0.5 rounded-full border border-pink-100 whitespace-nowrap">
                          {addon.price}
                        </span>
                      </>
                    )}
                  </div>

                  {editMode ? (
                    <textarea
                      value={addon.desc}
                      onChange={e => handleAddOnChange(aIdx, "desc", e.target.value)}
                      onBlur={() => saveToFirestore(data)}
                      rows={2}
                      className="w-full bg-white border border-pink-200 rounded p-1.5 font-brand text-xs text-neutral-600 outline-none resize-none mt-1"
                    />
                  ) : (
                    <p className="font-brand text-xs text-neutral-600 leading-relaxed">{addon.desc}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {editMode && (
            <div className="mt-4 pt-4 border-t border-dashed border-pink-200 text-center">
              <button
                onClick={handleAddAddOn}
                className="bg-neutral-900 hover:bg-black text-white font-brand font-bold text-xs px-4 py-2 rounded-full transition cursor-pointer"
              >
                + Add Another Matchy-Matchy Add-On
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
