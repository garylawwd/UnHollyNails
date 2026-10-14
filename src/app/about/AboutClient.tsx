"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAdmin } from "@/context/AdminContext";

interface AboutData {
  eyebrow: string;
  title: string;
  subtitle: string;
  p1: string;
  p2: string;
  calloutTitle: string;
  calloutText: string;
  signoffTop: string;
  signoffName: string;
}

export const DEFAULT_ABOUT_DATA: AboutData = {
  eyebrow: "The Studio",
  title: "About UnHolly Nails",
  subtitle: "Handcrafted luxury press-on artistry, custom sized and painted with love.",
  p1: "Welcome to UnHolly Nails! Every single set is hand-painted and customized specifically for you using salon-grade professional products.",
  p2: "I don't do mass-produced factory tips. Every set takes time, precision, and artistry — with a standard turnaround of 5–10 business days to ensure your nails are durable, perfectly shaped, and made to last.",
  calloutTitle: "Made To Fit You",
  calloutText: "Whether you order via a Sizing Kit, the Masking Tape Method, or the Coin Photo Method, each set is tailored to your exact natural nail beds so you get that flawless salon look at home.",
  signoffTop: "Stay UnHolly,",
  signoffName: "Holly ✨"
};

export default function AboutClient() {
  const {
    editMode,
    setPageTitle,
    setIsSaving,
    setLastSaved: setAdminLastSaved,
    setSaveHandler,
    setResetHandler
  } = useAdmin();
  const [data, setData] = useState<AboutData>(DEFAULT_ABOUT_DATA);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const vendorUid = process.env.NEXT_PUBLIC_VENDOR_UID || "CMzpkonBxKeLboaVTUYwDWgiwNG3";

  useEffect(() => {
    const loadContent = async () => {
      try {
        const snap = await getDoc(doc(db, "users", vendorUid, "store_settings", "about_content"));
        if (snap.exists()) {
          const remoteData = snap.data() as Partial<AboutData>;
          setData(prev => ({ ...prev, ...remoteData }));
        }
      } catch (err) {
        console.warn("Could not load about_content, using defaults", err);
      }
    };
    loadContent();
  }, [vendorUid]);

  const saveToFirestore = useCallback(async (dataToSave: AboutData) => {
    setSaving(true);
    try {
      await setDoc(doc(db, "users", vendorUid, "store_settings", "about_content"), dataToSave, { merge: true });
      setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to save about_content:", err);
    } finally {
      setSaving(false);
    }
  }, [vendorUid]);

  const handleResetDefaults = async () => {
    setData(DEFAULT_ABOUT_DATA);
    await saveToFirestore(DEFAULT_ABOUT_DATA);
  };

  
  useEffect(() => {
    setPageTitle("About Studio");
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

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-sm border border-pink-100 text-center space-y-6">
          {editMode ? (
            <div className="flex flex-col gap-3 text-left">
              <span className="text-[10px] uppercase font-bold text-neutral-400 font-brand">Paragraph 1:</span>
              <textarea
                value={data.p1}
                onChange={e => setData(prev => ({ ...prev, p1: e.target.value }))}
                onBlur={() => saveToFirestore(data)}
                rows={3}
                className="w-full bg-pink-50 border border-pink-200 rounded p-2 text-xs sm:text-sm font-brand outline-none resize-none"
              />

              <span className="text-[10px] uppercase font-bold text-neutral-400 font-brand">Paragraph 2:</span>
              <textarea
                value={data.p2}
                onChange={e => setData(prev => ({ ...prev, p2: e.target.value }))}
                onBlur={() => saveToFirestore(data)}
                rows={3}
                className="w-full bg-pink-50 border border-pink-200 rounded p-2 text-xs sm:text-sm font-brand outline-none resize-none"
              />
            </div>
          ) : (
            <>
              <p className="font-brand text-sm sm:text-base text-neutral-700 leading-relaxed">
                {data.p1}
              </p>
              <p className="font-brand text-xs sm:text-sm text-neutral-600 leading-relaxed">
                {data.p2}
              </p>
            </>
          )}

          <div className="p-4 rounded-2xl bg-pink-50/70 border border-pink-100 font-brand text-xs sm:text-sm text-neutral-700 leading-relaxed">
            {editMode ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={data.calloutTitle}
                  onChange={e => setData(prev => ({ ...prev, calloutTitle: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="bg-white border border-pink-300 rounded px-2 py-0.5 font-bold text-[#FF5C9D] text-xs uppercase outline-none text-center"
                />
                <textarea
                  value={data.calloutText}
                  onChange={e => setData(prev => ({ ...prev, calloutText: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  rows={3}
                  className="w-full bg-white border border-pink-200 rounded p-1.5 text-xs font-brand outline-none resize-none"
                />
              </div>
            ) : (
              <>
                <p className="font-bold text-[#FF5C9D] uppercase tracking-wider mb-1">{data.calloutTitle}</p>
                <p>{data.calloutText}</p>
              </>
            )}
          </div>

          <div className="pt-4">
            {editMode ? (
              <div className="max-w-xs mx-auto flex flex-col gap-1">
                <input
                  type="text"
                  value={data.signoffTop}
                  onChange={e => setData(prev => ({ ...prev, signoffTop: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="bg-white border border-pink-200 rounded px-2 py-0.5 text-xs text-center outline-none"
                />
                <input
                  type="text"
                  value={data.signoffName}
                  onChange={e => setData(prev => ({ ...prev, signoffName: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="bg-white border border-pink-300 rounded px-2 py-0.5 text-xs text-pink-600 font-bold text-center outline-none"
                />
              </div>
            ) : (
              <>
                <p className="font-brand font-bold text-sm text-neutral-900">{data.signoffTop}</p>
                <p className="font-brand text-pink-600 font-semibold text-sm">{data.signoffName}</p>
              </>
            )}
          </div>

          <div className="pt-4 flex flex-wrap gap-3 justify-center">
            <Link 
              href="/collections/all" 
              className="bg-neutral-900 text-white px-7 py-3 rounded-full font-brand font-bold text-xs uppercase tracking-wider hover:bg-[#FF5C9D] transition-colors shadow-md"
            >
              Shop All Sets →
            </Link>
            <Link 
              href="/menu" 
              className="bg-white border border-pink-200 text-neutral-900 px-7 py-3 rounded-full font-brand font-bold text-xs uppercase tracking-wider hover:border-[#FF5C9D] hover:text-[#FF5C9D] transition-colors"
            >
              View Price Menu
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
