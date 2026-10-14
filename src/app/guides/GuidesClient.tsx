"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAdmin } from "@/context/AdminContext";

interface SizeChartRow {
  size: string;
  mm: string;
}

interface SizingMethod {
  id: string;
  number: string;
  title: string;
  priceTag: string;
  desc: string;
  badge: string;
  badgeColor?: string;
}

interface GuidesData {
  eyebrow: string;
  title: string;
  subtitle: string;
  sizingEyebrow: string;
  sizingTitle: string;
  sizingIntro: string;
  methods: SizingMethod[];
  chartEyebrow: string;
  chartTitle: string;
  chartSubtitle: string;
  chartRows: SizeChartRow[];
  appEyebrow: string;
  appTitle: string;
  tabsTitle: string;
  tabsDesc: string;
  glueTitle: string;
  glueDesc: string;
  removalEyebrow: string;
  removalTitle: string;
  removalWarning: string;
  removalDesc: string;
  reusingEyebrow: string;
  reusingTitle: string;
  reusingTabs: string;
  reusingGlue: string;
}

export const DEFAULT_GUIDES_DATA: GuidesData = {
  eyebrow: "UnHollyNails",
  title: "Sizing & Application Guides",
  subtitle: "Everything you need for a flawless, salon-perfect press-on manicure at home.",
  sizingEyebrow: "UnHollyNails Size Guide",
  sizingTitle: "How To Find Your Sizes",
  sizingIntro: "At UnHollyNails, there are 3 methods I use to find your perfect sizes!",
  methods: [
    {
      id: "m1",
      number: "1",
      title: "Sizing Kit",
      priceTag: "€10 (BONUS: €5 OFF first custom order!)",
      desc: "By far the most accurate method! A physical sizing kit contains sample tips in your preferred shape & length to try on your bare nails. Order via DM or store.",
      badge: "Most Accurate",
      badgeColor: "bg-pink-100 text-[#FF5C9D] border-pink-200"
    },
    {
      id: "m2",
      number: "2",
      title: "Masking Tape & Ruler",
      priceTag: "Free at Home",
      desc: "Place a piece of masking tape across the widest part of each nail bed. Press into the sidewalls and mark with a pen. Peel off and measure between marks against a metric millimeter (mm) ruler.",
      badge: "At Home",
      badgeColor: "bg-neutral-100 text-neutral-700 border-neutral-200"
    },
    {
      id: "m3",
      number: "3",
      title: "Coin Photo Aerial Method",
      priceTag: "Free DM Assistance",
      desc: "Take 4 clear, top-down photos with your natural bare hand flat on a smooth surface next to a 1 Euro or 2 Euro coin. DM them to me and I will calculate your approximate sizes!",
      badge: "Photo Help",
      badgeColor: "bg-pink-50 text-pink-700 border-pink-100"
    }
  ],
  chartEyebrow: "Standard Pre-Sized Chart",
  chartTitle: "Pre-Sized Sets (XS to XL)",
  chartSubtitle: "Measurements from Thumb to Pinky in millimeters (mm):",
  chartRows: [
    { size: "XS", mm: "14mm, 11mm, 12mm, 10mm, 8mm" },
    { size: "S", mm: "15mm, 12mm, 13mm, 11mm, 9mm" },
    { size: "M", mm: "16mm, 13mm, 14mm, 12mm, 10mm" },
    { size: "L", mm: "18mm, 14mm, 15mm, 13mm, 11mm" },
    { size: "XL", mm: "19mm, 15mm, 16mm, 14mm, 12mm" },
  ],
  appEyebrow: "Flawless Application",
  appTitle: "How to Apply Your Nails",
  tabsTitle: "Option A: 1–2 Days Wear (Sticky Tabs)",
  tabsDesc: "Pro tip from Holly: Use a hairdryer on warm air for a few seconds to warm up the sticky tabs before applying! This activates the adhesive for maximum grip without damaging the nail, making your set 100% reusable.",
  glueTitle: "Option B: 2–3 Weeks Wear (Nail Glue)",
  glueDesc: "Apply a small drop of glue to your natural nail and the well of the press on. Place the nail at a 45-degree angle starting at your cuticle line and press down slowly to prevent air bubbles. Hold firmly for 30 seconds.",
  removalEyebrow: "Zero Damage Removal",
  removalTitle: "How to Remove Your Nails",
  removalWarning: "NEVER rip, pry, or force press-on nails off your natural nails!",
  removalDesc: "Fill a bowl with warm water, a generous splash of washing up liquid, and a few drops of cuticle oil or baby oil. Soak hands for 10–15 minutes until the adhesive dissolves naturally.",
  reusingEyebrow: "Care & Maintenance",
  reusingTitle: "Reusing Your Sets",
  reusingTabs: "Sticky Tabs: Simply peel the gummy tab residue off the underside of the nail with your wooden cuticle stick. Ready to wear again!",
  reusingGlue: "Nail Glue: Use a gentle file or buffer to smooth out dried glue residue inside the nail well. Store back in your luxury UnHollyNails box."
};

export default function GuidesClient() {
  const {
    editMode,
    setPageTitle,
    setIsSaving,
    setLastSaved: setAdminLastSaved,
    setSaveHandler,
    setResetHandler
  } = useAdmin();
  const [data, setData] = useState<GuidesData>(DEFAULT_GUIDES_DATA);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const vendorUid = process.env.NEXT_PUBLIC_VENDOR_UID || "CMzpkonBxKeLboaVTUYwDWgiwNG3";

  useEffect(() => {
    const loadContent = async () => {
      try {
        const snap = await getDoc(doc(db, "users", vendorUid, "store_settings", "guides_content"));
        if (snap.exists()) {
          const remoteData = snap.data() as Partial<GuidesData>;
          setData(prev => ({
            ...prev,
            ...remoteData,
            methods: Array.isArray(remoteData.methods) && remoteData.methods.length > 0 ? remoteData.methods : prev.methods,
            chartRows: Array.isArray(remoteData.chartRows) && remoteData.chartRows.length > 0 ? remoteData.chartRows : prev.chartRows,
          }));
        }
      } catch (err) {
        console.warn("Could not load guides_content, using defaults", err);
      }
    };
    loadContent();
  }, [vendorUid]);

  const saveToFirestore = useCallback(async (dataToSave: GuidesData) => {
    setSaving(true);
    try {
      await setDoc(doc(db, "users", vendorUid, "store_settings", "guides_content"), dataToSave, { merge: true });
      setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to save guides_content:", err);
    } finally {
      setSaving(false);
    }
  }, [vendorUid]);

  const handleMethodChange = (mIdx: number, field: keyof SizingMethod, val: string) => {
    setData(prev => {
      const nextMethods = [...prev.methods];
      nextMethods[mIdx] = { ...nextMethods[mIdx], [field]: val };
      return { ...prev, methods: nextMethods };
    });
  };

  const handleChartChange = (rIdx: number, field: keyof SizeChartRow, val: string) => {
    setData(prev => {
      const nextRows = [...prev.chartRows];
      nextRows[rIdx] = { ...nextRows[rIdx], [field]: val };
      return { ...prev, chartRows: nextRows };
    });
  };

  const handleResetDefaults = async () => {
    setData(DEFAULT_GUIDES_DATA);
    await saveToFirestore(DEFAULT_GUIDES_DATA);
  };

  
  useEffect(() => {
    setPageTitle("Sizing & Care Guides");
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

      {/* Header Banner */}
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

        {/* 1. SIZING GUIDE (Holly's Exact 3 Methods) */}
        <section className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-sm border border-pink-100">
          <div className="text-center mb-8">
            {editMode ? (
              <div className="max-w-md mx-auto flex flex-col gap-2">
                <input
                  type="text"
                  value={data.sizingEyebrow}
                  onChange={e => setData(prev => ({ ...prev, sizingEyebrow: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-0.5 font-brand font-bold text-[11px] text-[#FF5C9D] uppercase tracking-widest outline-none"
                />
                <input
                  type="text"
                  value={data.sizingTitle}
                  onChange={e => setData(prev => ({ ...prev, sizingTitle: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-1 font-brand font-bold text-xl sm:text-2xl text-neutral-900 outline-none"
                />
                <input
                  type="text"
                  value={data.sizingIntro}
                  onChange={e => setData(prev => ({ ...prev, sizingIntro: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-1 font-brand text-xs text-neutral-600 outline-none"
                />
              </div>
            ) : (
              <>
                <span className="font-brand font-bold text-[11px] sm:text-xs text-[#FF5C9D] uppercase tracking-widest block mb-1">{data.sizingEyebrow}</span>
                <h2 className="font-brand font-bold text-2xl sm:text-3xl text-neutral-900 tracking-tight">{data.sizingTitle}</h2>
                <div className="w-16 h-0.5 bg-pink-300 mx-auto mt-2 mb-3"></div>
                <p className="font-brand text-xs sm:text-sm text-neutral-600 max-w-xl mx-auto">
                  {data.sizingIntro}
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {data.methods.map((method, mIdx) => (
              <div key={method.id || mIdx} className="bg-pink-50/40 border border-pink-100 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-8 h-8 rounded-full bg-[#FF5C9D] text-white font-brand font-bold text-sm flex items-center justify-center">
                      {method.number}
                    </span>
                    {editMode ? (
                      <input
                        type="text"
                        value={method.badge}
                        onChange={e => handleMethodChange(mIdx, "badge", e.target.value)}
                        onBlur={() => saveToFirestore(data)}
                        className="bg-white border border-pink-300 rounded px-2 py-0.5 text-[10px] font-brand font-bold text-[#FF5C9D] uppercase tracking-wider outline-none"
                      />
                    ) : (
                      <span className={`text-[10px] font-brand font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${method.badgeColor || 'bg-pink-100 text-[#FF5C9D] border-pink-200'}`}>
                        {method.badge}
                      </span>
                    )}
                  </div>

                  {editMode ? (
                    <div className="flex flex-col gap-2 mb-2">
                      <input
                        type="text"
                        value={method.title}
                        onChange={e => handleMethodChange(mIdx, "title", e.target.value)}
                        onBlur={() => saveToFirestore(data)}
                        className="bg-white border border-pink-300 rounded px-2 py-0.5 font-brand font-bold text-sm text-neutral-900 outline-none"
                      />
                      <input
                        type="text"
                        value={method.priceTag}
                        onChange={e => handleMethodChange(mIdx, "priceTag", e.target.value)}
                        onBlur={() => saveToFirestore(data)}
                        className="bg-white border border-pink-400 rounded px-2 py-0.5 font-brand font-bold text-[11px] text-[#FF5C9D] outline-none"
                      />
                      <textarea
                        value={method.desc}
                        onChange={e => handleMethodChange(mIdx, "desc", e.target.value)}
                        onBlur={() => saveToFirestore(data)}
                        rows={4}
                        className="bg-white border border-pink-200 rounded p-1.5 font-brand text-xs text-neutral-600 outline-none resize-none"
                      />
                    </div>
                  ) : (
                    <>
                      <h3 className="font-brand font-bold text-base text-neutral-900 mb-1">{method.title}</h3>
                      <p className="font-brand text-xs font-bold text-[#FF5C9D] mb-3">{method.priceTag}</p>
                      <p className="font-brand text-xs text-neutral-600 leading-relaxed">
                        {method.desc}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Sizing Chart Table */}
          <div className="mt-10 pt-8 border-t border-pink-100">
            <div className="text-center mb-6">
              {editMode ? (
                <div className="max-w-md mx-auto flex flex-col gap-1.5">
                  <input
                    type="text"
                    value={data.chartEyebrow}
                    onChange={e => setData(prev => ({ ...prev, chartEyebrow: e.target.value }))}
                    onBlur={() => saveToFirestore(data)}
                    className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-0.5 font-brand font-bold text-[10px] text-pink-600 uppercase tracking-widest outline-none"
                  />
                  <input
                    type="text"
                    value={data.chartTitle}
                    onChange={e => setData(prev => ({ ...prev, chartTitle: e.target.value }))}
                    onBlur={() => saveToFirestore(data)}
                    className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-0.5 font-brand font-bold text-lg text-neutral-900 outline-none"
                  />
                  <input
                    type="text"
                    value={data.chartSubtitle}
                    onChange={e => setData(prev => ({ ...prev, chartSubtitle: e.target.value }))}
                    onBlur={() => saveToFirestore(data)}
                    className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-0.5 font-brand text-xs text-neutral-500 outline-none"
                  />
                </div>
              ) : (
                <>
                  <span className="font-brand font-bold text-[10px] uppercase tracking-widest text-pink-600 block mb-1">{data.chartEyebrow}</span>
                  <h3 className="font-brand font-bold text-lg text-neutral-900">{data.chartTitle}</h3>
                  <p className="font-brand text-xs text-neutral-500 mt-1">{data.chartSubtitle}</p>
                </>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs font-brand border-collapse">
                <thead>
                  <tr className="bg-pink-100/60 text-neutral-800 uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4 text-left font-bold rounded-l-xl">Size</th>
                    <th className="py-2.5 px-4 text-left font-bold rounded-r-xl">Millimeter Measurements (Thumb → Pinky)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pink-100">
                  {data.chartRows.map((row, rIdx) => (
                    <tr key={row.size || rIdx} className="hover:bg-pink-50/50">
                      <td className="py-3 px-4 font-bold text-neutral-900">
                        {editMode ? (
                          <input
                            type="text"
                            value={row.size}
                            onChange={e => handleChartChange(rIdx, "size", e.target.value)}
                            onBlur={() => saveToFirestore(data)}
                            className="w-12 bg-white border border-pink-300 rounded px-1.5 py-0.5 font-bold outline-none"
                          />
                        ) : (
                          row.size
                        )}
                      </td>
                      <td className="py-3 px-4 text-neutral-600">
                        {editMode ? (
                          <input
                            type="text"
                            value={row.mm}
                            onChange={e => handleChartChange(rIdx, "mm", e.target.value)}
                            onBlur={() => saveToFirestore(data)}
                            className="w-full bg-white border border-pink-300 rounded px-2 py-0.5 outline-none"
                          />
                        ) : (
                          row.mm
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 2. APPLICATION GUIDE */}
        <section className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-sm border border-pink-100">
          <div className="text-center mb-8">
            <span className="font-brand font-bold text-[11px] sm:text-xs text-[#FF5C9D] uppercase tracking-widest block mb-1">{data.appEyebrow}</span>
            <h2 className="font-brand font-bold text-2xl sm:text-3xl text-neutral-900 tracking-tight">{data.appTitle}</h2>
            <div className="w-16 h-0.5 bg-pink-300 mx-auto mt-2"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-pink-50/40 border border-pink-100 flex flex-col justify-between">
              <div>
                <span className="font-brand font-bold text-xs uppercase tracking-wider text-[#FF5C9D] block mb-1">Weekend Wear</span>
                {editMode ? (
                  <div className="flex flex-col gap-1.5 mb-2">
                    <input
                      type="text"
                      value={data.tabsTitle}
                      onChange={e => setData(prev => ({ ...prev, tabsTitle: e.target.value }))}
                      onBlur={() => saveToFirestore(data)}
                      className="bg-white border border-pink-300 rounded px-2 py-0.5 font-brand font-bold text-base outline-none"
                    />
                    <textarea
                      value={data.tabsDesc}
                      onChange={e => setData(prev => ({ ...prev, tabsDesc: e.target.value }))}
                      onBlur={() => saveToFirestore(data)}
                      rows={4}
                      className="bg-white border border-pink-200 rounded p-1.5 font-brand text-xs text-neutral-600 outline-none resize-none"
                    />
                  </div>
                ) : (
                  <>
                    <h3 className="font-brand font-bold text-lg text-neutral-900 mb-2">{data.tabsTitle}</h3>
                    <p className="font-brand text-xs sm:text-sm text-neutral-600 leading-relaxed">
                      {data.tabsDesc}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-pink-50/40 border border-pink-100 flex flex-col justify-between">
              <div>
                <span className="font-brand font-bold text-xs uppercase tracking-wider text-pink-700 block mb-1">Long-Lasting Wear</span>
                {editMode ? (
                  <div className="flex flex-col gap-1.5 mb-2">
                    <input
                      type="text"
                      value={data.glueTitle}
                      onChange={e => setData(prev => ({ ...prev, glueTitle: e.target.value }))}
                      onBlur={() => saveToFirestore(data)}
                      className="bg-white border border-pink-300 rounded px-2 py-0.5 font-brand font-bold text-base outline-none"
                    />
                    <textarea
                      value={data.glueDesc}
                      onChange={e => setData(prev => ({ ...prev, glueDesc: e.target.value }))}
                      onBlur={() => saveToFirestore(data)}
                      rows={4}
                      className="bg-white border border-pink-200 rounded p-1.5 font-brand text-xs text-neutral-600 outline-none resize-none"
                    />
                  </div>
                ) : (
                  <>
                    <h3 className="font-brand font-bold text-lg text-neutral-900 mb-2">{data.glueTitle}</h3>
                    <p className="font-brand text-xs sm:text-sm text-neutral-600 leading-relaxed">
                      {data.glueDesc}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 3. SAFE REMOVAL & REUSE */}
        <section className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-sm border border-pink-100">
          <div className="text-center mb-8">
            <span className="font-brand font-bold text-[11px] sm:text-xs text-[#FF5C9D] uppercase tracking-widest block mb-1">{data.removalEyebrow}</span>
            <h2 className="font-brand font-bold text-2xl sm:text-3xl text-neutral-900 tracking-tight">{data.removalTitle}</h2>
            <div className="w-16 h-0.5 bg-pink-300 mx-auto mt-2"></div>
          </div>

          <div className="p-4 rounded-xl bg-pink-50/70 border border-pink-100 text-center mb-6">
            {editMode ? (
              <textarea
                value={data.removalWarning}
                onChange={e => setData(prev => ({ ...prev, removalWarning: e.target.value }))}
                onBlur={() => saveToFirestore(data)}
                rows={1}
                className="w-full bg-white border border-pink-300 rounded p-1.5 font-brand font-bold text-xs text-pink-900 outline-none resize-none text-center"
              />
            ) : (
              <p className="font-brand font-bold text-xs sm:text-sm text-pink-900 uppercase tracking-wide">
                ⚠️ {data.removalWarning}
              </p>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-[#FFF5F8]/40 border border-pink-100 mb-6">
            {editMode ? (
              <textarea
                value={data.removalDesc}
                onChange={e => setData(prev => ({ ...prev, removalDesc: e.target.value }))}
                onBlur={() => saveToFirestore(data)}
                rows={3}
                className="w-full bg-white border border-pink-300 rounded p-2 font-brand text-xs text-neutral-700 outline-none resize-none"
              />
            ) : (
              <p className="font-brand text-xs sm:text-sm text-neutral-700 leading-relaxed">
                {data.removalDesc}
              </p>
            )}
          </div>

          {/* Reusing Tips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-pink-100 bg-pink-50/30">
              <span className="font-brand font-bold text-xs uppercase tracking-wider text-neutral-900 block mb-1">With Sticky Tabs</span>
              {editMode ? (
                <textarea
                  value={data.reusingTabs}
                  onChange={e => setData(prev => ({ ...prev, reusingTabs: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  rows={2}
                  className="w-full bg-white border border-pink-200 rounded p-1 font-brand text-xs outline-none resize-none"
                />
              ) : (
                <p className="font-brand text-xs text-neutral-600 leading-relaxed">
                  {data.reusingTabs}
                </p>
              )}
            </div>

            <div className="p-4 rounded-xl border border-pink-100 bg-pink-50/30">
              <span className="font-brand font-bold text-xs uppercase tracking-wider text-neutral-900 block mb-1">With Nail Glue</span>
              {editMode ? (
                <textarea
                  value={data.reusingGlue}
                  onChange={e => setData(prev => ({ ...prev, reusingGlue: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  rows={2}
                  className="w-full bg-white border border-pink-200 rounded p-1 font-brand text-xs outline-none resize-none"
                />
              ) : (
                <p className="font-brand text-xs text-neutral-600 leading-relaxed">
                  {data.reusingGlue}
                </p>
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
