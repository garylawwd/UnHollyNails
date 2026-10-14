"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAdmin } from "@/context/AdminContext";

interface ContactData {
  eyebrow: string;
  title: string;
  subtitle: string;
  introText: string;
  instagramHandle: string;
  instagramLink: string;
  facebookText: string;
  facebookLink: string;
  hoursTitle: string;
  hoursDays: string;
  hoursNote: string;
}

export const DEFAULT_CONTACT_DATA: ContactData = {
  eyebrow: "Get In Touch",
  title: "Direct Contact & DMs",
  subtitle: "Every set is hand-painted by Holly. The fastest way to chat, consult on sizes, or order a bespoke design is via DM!",
  introText: "Have an idea for a custom set, want to join the UnHollyNails Club, or need help finding your size with the Coin Photo Method? Send me a DM directly!",
  instagramHandle: "DM @unhollynails",
  instagramLink: "https://instagram.com/unhollynails",
  facebookText: "Message Facebook",
  facebookLink: "https://www.facebook.com/profile.php?id=61575660355121",
  hoursTitle: "✨ Fast Response Hours:",
  hoursDays: "Monday – Saturday: DMs checked multiple times daily",
  hoursNote: "Please include your order details or sizing measurements when reaching out."
};

export default function ContactClient() {
  const {
    editMode,
    setPageTitle,
    setIsSaving,
    setLastSaved: setAdminLastSaved,
    setSaveHandler,
    setResetHandler
  } = useAdmin();
  const [data, setData] = useState<ContactData>(DEFAULT_CONTACT_DATA);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const vendorUid = process.env.NEXT_PUBLIC_VENDOR_UID || "CMzpkonBxKeLboaVTUYwDWgiwNG3";

  useEffect(() => {
    const loadContent = async () => {
      try {
        const snap = await getDoc(doc(db, "users", vendorUid, "store_settings", "contact_content"));
        if (snap.exists()) {
          const remoteData = snap.data() as Partial<ContactData>;
          setData(prev => ({ ...prev, ...remoteData }));
        }
      } catch (err) {
        console.warn("Could not load contact_content, using defaults", err);
      }
    };
    loadContent();
  }, [vendorUid]);

  const saveToFirestore = useCallback(async (dataToSave: ContactData) => {
    setSaving(true);
    try {
      await setDoc(doc(db, "users", vendorUid, "store_settings", "contact_content"), dataToSave, { merge: true });
      setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to save contact_content:", err);
    } finally {
      setSaving(false);
    }
  }, [vendorUid]);

  const handleResetDefaults = async () => {
    setData(DEFAULT_CONTACT_DATA);
    await saveToFirestore(DEFAULT_CONTACT_DATA);
  };

  
  useEffect(() => {
    setPageTitle("Contact & Socials");
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
        <div className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-sm border border-pink-100 text-center">
          {editMode ? (
            <textarea
              value={data.introText}
              onChange={e => setData(prev => ({ ...prev, introText: e.target.value }))}
              onBlur={() => saveToFirestore(data)}
              rows={3}
              className="w-full bg-pink-50 border border-pink-200 rounded p-2 text-xs sm:text-sm font-brand text-neutral-700 outline-none mb-6 resize-none"
            />
          ) : (
            <p className="font-brand text-xs sm:text-sm text-neutral-600 mb-8 leading-relaxed max-w-md mx-auto">
              {data.introText}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8 max-w-md mx-auto">
            {/* Instagram */}
            <a 
              href={data.instagramLink || "https://instagram.com/unhollynails"} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full flex-1 inline-flex items-center justify-center gap-2.5 bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 text-white px-6 py-3.5 rounded-full font-brand font-bold uppercase tracking-wider text-xs hover:opacity-95 hover:scale-105 transition-all shadow-md shadow-pink-500/25"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              {data.instagramHandle}
            </a>

            {/* Facebook */}
            <a 
              href={data.facebookLink || "https://www.facebook.com/profile.php?id=61575660355121"} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full flex-1 inline-flex items-center justify-center gap-2.5 bg-[#1877F2] text-white px-6 py-3.5 rounded-full font-brand font-bold uppercase tracking-wider text-xs hover:opacity-95 hover:scale-105 transition-all shadow-md shadow-blue-500/25"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              {data.facebookText}
            </a>
          </div>

          <div className="p-4 rounded-xl bg-pink-50/60 border border-pink-100 text-xs text-neutral-600 font-brand space-y-1 text-left">
            {editMode ? (
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  value={data.hoursTitle}
                  onChange={e => setData(prev => ({ ...prev, hoursTitle: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="bg-white border border-pink-300 rounded px-2 py-0.5 font-bold text-neutral-900 outline-none"
                />
                <input
                  type="text"
                  value={data.hoursDays}
                  onChange={e => setData(prev => ({ ...prev, hoursDays: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="bg-white border border-pink-200 rounded px-2 py-0.5 text-neutral-700 outline-none"
                />
                <input
                  type="text"
                  value={data.hoursNote}
                  onChange={e => setData(prev => ({ ...prev, hoursNote: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="bg-white border border-pink-200 rounded px-2 py-0.5 text-neutral-500 italic text-[11px] outline-none"
                />
              </div>
            ) : (
              <>
                <p className="font-bold text-neutral-900">{data.hoursTitle}</p>
                <p>{data.hoursDays}</p>
                <p className="text-[11px] text-neutral-500 italic">{data.hoursNote}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
