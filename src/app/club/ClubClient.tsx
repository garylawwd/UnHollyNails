"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAdmin } from "@/context/AdminContext";

interface PerkItem {
  id: string;
  icon: string;
  title: string;
  desc: string;
}

interface StepItem {
  id: string;
  number: string;
  title: string;
  desc: string;
}

interface ClubData {
  eyebrow: string;
  title: string;
  subtitle: string;
  perks: PerkItem[];
  joinTitle: string;
  joinSubtitle: string;
  steps: StepItem[];
  ctaText: string;
  ctaSubtext: string;
}

export const DEFAULT_CLUB_DATA: ClubData = {
  eyebrow: "Member Loyalty & Rewards",
  title: "UnHollyNails Club",
  subtitle: "Every client with an account is automatically an UnHollyNails Club member! Collect digital stamps with every set, unlock free delivery & rewards, and celebrate with birthday treats.",
  perks: [
    {
      id: "p1",
      icon: "💳",
      title: "Digital Loyalty Card",
      desc: "Receive digital stamps for every custom set or order. 5th order receives free delivery and unlocks bespoke gifts, tracked right in your client profile!"
    },
    {
      id: "p2",
      icon: "🎂",
      title: "Birthday Month Treats",
      desc: "Share your birth date to receive an exclusive birthday discount, complimentary mini celebration set, and special gift bag treats during your birthday month."
    },
    {
      id: "p3",
      icon: "🎁",
      title: "Order Goodies & Previews",
      desc: "Enjoy secret bonus goodies tucked into your orders, plus first-look previews at upcoming seasonal drops, mystery boxes, and limited custom art slots."
    }
  ],
  joinTitle: "How to Join the UnHollyNails Club",
  joinSubtitle: "100% free! Simply create an account on the website or connect via Instagram DM.",
  steps: [
    { id: "s1", number: "1", title: "Create an Account or DM", desc: "Sign in with 1 click right here or send 'CLUB' to @unhollynails on Instagram." },
    { id: "s2", number: "2", title: "Set Up Your Profile", desc: "Add your birthday and nail preferences to unlock celebration gifts and personalized rewards." },
    { id: "s3", number: "3", title: "Collect Digital Stamps", desc: "Order custom sets and watch your stamps fill up directly on your loyalty card in your profile!" }
  ],
  ctaText: "Join via Instagram DM ('CLUB')",
  ctaSubtext: "100% free forever. No fees or subscription required to join."
};

export default function ClubClient() {
  const {
    editMode,
    setPageTitle,
    setIsSaving,
    setLastSaved: setAdminLastSaved,
    setSaveHandler,
    setResetHandler
  } = useAdmin();
  const [data, setData] = useState<ClubData>(DEFAULT_CLUB_DATA);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const vendorUid = process.env.NEXT_PUBLIC_VENDOR_UID || "CMzpkonBxKeLboaVTUYwDWgiwNG3";

  // Auth state listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Sign in error:", err);
    } finally {
      setSigningIn(false);
    }
  };

  useEffect(() => {
    const loadContent = async () => {
      try {
        const snap = await getDoc(doc(db, "users", vendorUid, "store_settings", "club_content"));
        if (snap.exists()) {
          const remoteData = snap.data() as Partial<ClubData>;
          setData(prev => ({
            ...prev,
            ...remoteData,
            perks: Array.isArray(remoteData.perks) && remoteData.perks.length > 0 ? remoteData.perks : prev.perks,
            steps: Array.isArray(remoteData.steps) && remoteData.steps.length > 0 ? remoteData.steps : prev.steps,
          }));
        }
      } catch (err) {
        console.warn("Could not load club_content, using defaults", err);
      }
    };
    loadContent();
  }, [vendorUid]);

  const saveToFirestore = useCallback(async (dataToSave: ClubData) => {
    setSaving(true);
    try {
      await setDoc(doc(db, "users", vendorUid, "store_settings", "club_content"), dataToSave, { merge: true });
      setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to save club_content:", err);
    } finally {
      setSaving(false);
    }
  }, [vendorUid]);

  // Perk handlers
  const handlePerkChange = (pIdx: number, field: keyof PerkItem, val: string) => {
    setData(prev => {
      const nextPerks = [...prev.perks];
      nextPerks[pIdx] = { ...nextPerks[pIdx], [field]: val };
      return { ...prev, perks: nextPerks };
    });
  };

  const handleAddPerk = () => {
    const newPerk: PerkItem = {
      id: "perk_" + Date.now(),
      icon: "⭐",
      title: "New Club Benefit",
      desc: "Describe what club members receive."
    };
    setData(prev => {
      const next = { ...prev, perks: [...prev.perks, newPerk] };
      saveToFirestore(next);
      return next;
    });
  };

  const handleDeletePerk = (pIdx: number) => {
    if (!confirm("Delete this perk?")) return;
    setData(prev => {
      const next = { ...prev, perks: prev.perks.filter((_, idx) => idx !== pIdx) };
      saveToFirestore(next);
      return next;
    });
  };

  // Step handlers
  const handleStepChange = (sIdx: number, field: keyof StepItem, val: string) => {
    setData(prev => {
      const nextSteps = [...prev.steps];
      nextSteps[sIdx] = { ...nextSteps[sIdx], [field]: val };
      return { ...prev, steps: nextSteps };
    });
  };

  const handleAddStep = () => {
    const nextNum = (data.steps.length + 1).toString();
    const newStep: StepItem = {
      id: "step_" + Date.now(),
      number: nextNum,
      title: "New Step",
      desc: "Instruction for the customer."
    };
    setData(prev => {
      const next = { ...prev, steps: [...prev.steps, newStep] };
      saveToFirestore(next);
      return next;
    });
  };

  const handleDeleteStep = (sIdx: number) => {
    setData(prev => {
      const next = { ...prev, steps: prev.steps.filter((_, idx) => idx !== sIdx) };
      saveToFirestore(next);
      return next;
    });
  };

  const handleResetDefaults = async () => {
    setData(DEFAULT_CLUB_DATA);
    await saveToFirestore(DEFAULT_CLUB_DATA);
  };

  useEffect(() => {
    setPageTitle("UnHollyNails Club");
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
      <div className="relative z-10 pt-8 sm:pt-14 pb-6 sm:pb-8 text-center px-4 max-w-4xl mx-auto">
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
        
        {/* Real-time Member Status / Instant Join Banner */}
        {user ? (
          <div className="bg-gradient-to-r from-pink-500 via-[#FF5C9D] to-pink-600 text-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-lg shadow-pink-500/20 text-center relative overflow-hidden">
            <div className="relative z-10 max-w-lg mx-auto flex flex-col items-center">
              <span className="bg-white/20 backdrop-blur-md text-white border border-white/30 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                ✓ You are a Member
              </span>
              <h2 className="font-brand font-bold text-2xl sm:text-3xl mb-2">
                Welcome to the Club, {user.displayName || user.email?.split('@')[0] || 'Friend'}!
              </h2>
              <p className="text-pink-100 text-xs sm:text-sm mb-5 leading-relaxed font-brand">
                Your account is active and collecting stamps on every order. Check your live digital Loyalty Card and order progress in your client profile.
              </p>
              <Link
                href="/profile?tab=orders"
                className="inline-flex items-center gap-2 bg-white text-[#FF5C9D] hover:bg-pink-50 font-brand font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-full transition shadow-md hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>View My Digital Loyalty Card</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white/90 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm border border-pink-200 text-center">
            <div className="max-w-md mx-auto flex flex-col items-center">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF5C9D] mb-2 font-brand">
                Free Instant Membership
              </span>
              <h2 className="font-brand font-bold text-xl sm:text-2xl text-neutral-900 mb-2">
                Sign In to Activate Your Loyalty Card
              </h2>
              <p className="font-brand text-xs text-neutral-500 mb-5 leading-relaxed">
                Creating an account or signing in automatically adds you to the UnHollyNails Club! Start collecting digital stamps on your loyalty card today.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={signingIn}
                  className="w-full sm:w-auto bg-neutral-900 hover:bg-black text-white font-brand font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-full transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{signingIn ? "Connecting..." : "Sign In to Join Free"}</span>
                </button>
                <a
                  href="https://ig.me/m/unhollynails?text=CLUB"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto bg-pink-50 hover:bg-pink-100 text-[#FF5C9D] border border-pink-200 font-brand font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-full transition text-center"
                >
                  Join via Instagram DM
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Perks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data.perks.map((perk, pIdx) => (
            <div key={perk.id || pIdx} className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm border border-pink-100 flex flex-col justify-between relative">
              {editMode && (
                <button
                  onClick={() => handleDeletePerk(pIdx)}
                  className="absolute top-2 right-2 text-neutral-400 hover:text-red-500 text-xs p-1 cursor-pointer"
                  title="Delete perk"
                >
                  ✕
                </button>
              )}

              <div>
                <div className="w-12 h-12 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center text-2xl mb-4">
                  {editMode ? (
                    <input
                      type="text"
                      value={perk.icon}
                      onChange={e => handlePerkChange(pIdx, "icon", e.target.value)}
                      onBlur={() => saveToFirestore(data)}
                      className="w-8 text-center bg-transparent border-none outline-none font-brand text-xl"
                    />
                  ) : (
                    perk.icon
                  )}
                </div>

                {editMode ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={perk.title}
                      onChange={e => handlePerkChange(pIdx, "title", e.target.value)}
                      onBlur={() => saveToFirestore(data)}
                      className="bg-white border border-pink-300 rounded px-2 py-1 font-brand font-bold text-base text-neutral-900 outline-none"
                    />
                    <textarea
                      value={perk.desc}
                      onChange={e => handlePerkChange(pIdx, "desc", e.target.value)}
                      onBlur={() => saveToFirestore(data)}
                      rows={3}
                      className="bg-white border border-pink-200 rounded p-1.5 font-brand text-xs text-neutral-600 outline-none resize-none"
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="font-brand font-bold text-lg text-neutral-900 mb-2">{perk.title}</h2>
                    <p className="font-brand text-xs text-neutral-600 leading-relaxed">{perk.desc}</p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {editMode && (
          <div className="text-center py-2">
            <button
              onClick={handleAddPerk}
              className="bg-neutral-900 hover:bg-black text-white font-brand font-bold text-xs px-5 py-2.5 rounded-full transition cursor-pointer"
            >
              + Add Another Club Perk
            </button>
          </div>
        )}

        {/* Future VIP Subscription Teaser Card */}
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 text-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-neutral-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-2 bg-pink-500/20 text-pink-300 border border-pink-500/30 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                <span>★</span> Coming Soon: UnHolly VIP
              </div>
              <h3 className="font-brand font-bold text-xl sm:text-2xl text-white">
                The Future VIP Subscription Tier
              </h3>
              <p className="font-brand text-xs sm:text-sm text-neutral-400 max-w-xl leading-relaxed">
                We're designing an all-inclusive VIP subscription tier! VIP members will receive quarterly custom sets made to their exact aesthetic preference, complimentary repairs & tip replacements for broken or lost nails, and deluxe surprise beauty gifts in every delivery.
              </p>
            </div>
            <div className="flex-shrink-0">
              <span className="inline-block bg-white/10 text-neutral-300 border border-white/10 text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap">
                In Development · Stay Tuned
              </span>
            </div>
          </div>
        </div>

        {/* How to Join Section */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-sm border border-pink-100">
          <div className="text-center mb-8">
            {editMode ? (
              <div className="max-w-md mx-auto flex flex-col gap-2">
                <input
                  type="text"
                  value={data.joinTitle}
                  onChange={e => setData(prev => ({ ...prev, joinTitle: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-1 font-brand font-bold text-xl sm:text-2xl text-neutral-900 outline-none"
                />
                <input
                  type="text"
                  value={data.joinSubtitle}
                  onChange={e => setData(prev => ({ ...prev, joinSubtitle: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-1 font-brand text-xs text-neutral-500 outline-none"
                />
              </div>
            ) : (
              <>
                <h2 className="font-brand font-bold text-2xl sm:text-3xl text-neutral-900 tracking-tight">{data.joinTitle}</h2>
                <p className="font-brand text-xs sm:text-sm text-neutral-500 max-w-md mx-auto mt-1">
                  {data.joinSubtitle}
                </p>
                <div className="w-16 h-0.5 bg-pink-300 mx-auto mt-2"></div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {data.steps.map((step, sIdx) => (
              <div key={step.id || sIdx} className="text-center p-5 rounded-2xl bg-pink-50/40 border border-pink-100 relative">
                {editMode && (
                  <button
                    onClick={() => handleDeleteStep(sIdx)}
                    className="absolute top-2 right-2 text-neutral-400 hover:text-red-500 text-xs p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
                <div className="w-10 h-10 rounded-full bg-neutral-900 text-white font-brand font-bold text-sm flex items-center justify-center mx-auto mb-3">
                  {step.number}
                </div>
                {editMode ? (
                  <div className="flex flex-col gap-1.5">
                    <input
                      type="text"
                      value={step.title}
                      onChange={e => handleStepChange(sIdx, "title", e.target.value)}
                      onBlur={() => saveToFirestore(data)}
                      className="bg-white border border-pink-300 rounded px-2 py-0.5 text-center font-brand font-bold text-sm text-neutral-900 outline-none"
                    />
                    <textarea
                      value={step.desc}
                      onChange={e => handleStepChange(sIdx, "desc", e.target.value)}
                      onBlur={() => saveToFirestore(data)}
                      rows={2}
                      className="bg-white border border-pink-200 rounded p-1.5 text-center font-brand text-xs text-neutral-600 outline-none resize-none"
                    />
                  </div>
                ) : (
                  <>
                    <h3 className="font-brand font-bold text-sm text-neutral-900 mb-1">{step.title}</h3>
                    <p className="font-brand text-xs text-neutral-600 leading-relaxed">{step.desc}</p>
                  </>
                )}
              </div>
            ))}
          </div>

          {editMode && (
            <div className="text-center pt-4">
              <button
                onClick={handleAddStep}
                className="bg-neutral-900 hover:bg-black text-white font-brand font-bold text-xs px-4 py-2 rounded-full transition cursor-pointer"
              >
                + Add Step
              </button>
            </div>
          )}

          <div className="text-center mt-8 pt-6 border-t border-pink-100">
            {editMode ? (
              <div className="max-w-sm mx-auto flex flex-col gap-1.5 mb-2">
                <input
                  type="text"
                  value={data.ctaText}
                  onChange={e => setData(prev => ({ ...prev, ctaText: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="bg-white border border-pink-300 rounded px-3 py-1 font-brand font-bold text-xs text-center outline-none"
                />
                <input
                  type="text"
                  value={data.ctaSubtext}
                  onChange={e => setData(prev => ({ ...prev, ctaSubtext: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="bg-white border border-pink-200 rounded px-3 py-1 font-brand text-[11px] text-center text-neutral-400 outline-none"
                />
              </div>
            ) : (
              <>
                <a
                  href="https://ig.me/m/unhollynails?text=CLUB"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-[#FF5C9D] hover:bg-pink-600 text-white font-brand font-bold text-xs uppercase tracking-wider px-8 py-3.5 rounded-full transition shadow-md shadow-pink-500/20"
                >
                  {data.ctaText || "Join via Instagram DM ('CLUB')"}
                </a>
                <p className="font-brand text-[11px] text-neutral-400 mt-2">
                  {data.ctaSubtext}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
