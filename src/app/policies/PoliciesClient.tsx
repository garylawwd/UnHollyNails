"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAdmin } from "@/context/AdminContext";

interface PoliciesData {
  eyebrow: string;
  title: string;
  subtitle: string;
  shippingEyebrow: string;
  shippingTitle: string;
  turnaroundNotice: string;
  standardTitle: string;
  standardDesc: string;
  standardPrice: string;
  trackedTitle: string;
  trackedDesc: string;
  trackedPrice: string;
  cancellationsEyebrow: string;
  cancellationsTitle: string;
  finalSaleNotice: string;
  cancellationHeading: string;
  cancellationText: string;
  sizingHeading: string;
  sizingText: string;
  damagedHeading: string;
  damagedText: string;
}

export const DEFAULT_POLICIES_DATA: PoliciesData = {
  eyebrow: "UnHollyNails",
  title: "Store Policies",
  subtitle: "Handmade with care and precision. Please review my shop policies below before placing an order.",
  shippingEyebrow: "Turnaround & Delivery",
  shippingTitle: "Shipping Information",
  turnaroundNotice: "Every set is custom painted so please allow a turnaround time of 5–10 business days for your order to be created before it is shipped.",
  standardTitle: "Standard Shipping",
  standardDesc: "Nationwide via An Post standard delivery.",
  standardPrice: "Flat Rate €4.85",
  trackedTitle: "Tracked Shipping",
  trackedDesc: "Highly recommended for custom orders & gifts. Nationwide via An Post.",
  trackedPrice: "Flat Rate €9.00",
  cancellationsEyebrow: "Orders & Returns",
  cancellationsTitle: "Cancellations & Refunds",
  finalSaleNotice: "Because every single product is hand painted specifically for you, all sales are final.",
  cancellationHeading: "Cancellations",
  cancellationText: "Can only be made within 24 hours of placing your order. After 24 hours, production may have already begun.",
  sizingHeading: "Refunds & Sizing",
  sizingText: "No refunds or exchanges can be given for change of mind or incorrect sizing. Please see the UnHollyNails Size Guide or order a sizing kit to ensure a perfect fit!",
  damagedHeading: "Damaged / Lost Items",
  damagedText: "In the unlikely event your package arrives damaged, please take clear photos and DM me within 48 hours so I can assist you directly."
};

export default function PoliciesClient() {
  const {
    editMode,
    setPageTitle,
    setIsSaving,
    setLastSaved: setAdminLastSaved,
    setSaveHandler,
    setResetHandler
  } = useAdmin();
  const [data, setData] = useState<PoliciesData>(DEFAULT_POLICIES_DATA);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const vendorUid = process.env.NEXT_PUBLIC_VENDOR_UID || "CMzpkonBxKeLboaVTUYwDWgiwNG3";

  useEffect(() => {
    const loadContent = async () => {
      try {
        const snap = await getDoc(doc(db, "users", vendorUid, "store_settings", "policies_content"));
        if (snap.exists()) {
          const remoteData = snap.data() as Partial<PoliciesData>;
          setData(prev => ({ ...prev, ...remoteData }));
        }
      } catch (err) {
        console.warn("Could not load policies_content, using defaults", err);
      }
    };
    loadContent();
  }, [vendorUid]);

  const saveToFirestore = useCallback(async (dataToSave: PoliciesData) => {
    setSaving(true);
    try {
      await setDoc(doc(db, "users", vendorUid, "store_settings", "policies_content"), dataToSave, { merge: true });
      setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to save policies_content:", err);
    } finally {
      setSaving(false);
    }
  }, [vendorUid]);

  const handleResetDefaults = async () => {
    setData(DEFAULT_POLICIES_DATA);
    await saveToFirestore(DEFAULT_POLICIES_DATA);
  };

  
  useEffect(() => {
    setPageTitle("Store Policies & Shipping");
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

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Shipping Information */}
        <section className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm border border-pink-100">
          <div className="text-center mb-6">
            {editMode ? (
              <div className="max-w-md mx-auto flex flex-col gap-2">
                <input
                  type="text"
                  value={data.shippingEyebrow}
                  onChange={e => setData(prev => ({ ...prev, shippingEyebrow: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-0.5 font-brand font-bold text-[11px] text-[#FF5C9D] uppercase tracking-widest outline-none"
                />
                <input
                  type="text"
                  value={data.shippingTitle}
                  onChange={e => setData(prev => ({ ...prev, shippingTitle: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-1 font-brand font-bold text-xl text-neutral-900 outline-none"
                />
              </div>
            ) : (
              <>
                <span className="font-brand font-bold text-[11px] sm:text-xs text-[#FF5C9D] uppercase tracking-widest block mb-1">{data.shippingEyebrow}</span>
                <h2 className="font-brand font-bold text-xl sm:text-2xl text-neutral-900 tracking-tight">{data.shippingTitle}</h2>
                <div className="w-16 h-0.5 bg-pink-300 mx-auto mt-2"></div>
              </>
            )}
          </div>

          <div className="p-4 rounded-xl bg-pink-50/70 border border-pink-100 text-center mb-6">
            {editMode ? (
              <div className="flex flex-col gap-1 text-left">
                <span className="text-[10px] uppercase font-bold text-pink-700 font-brand">Turnaround Notice:</span>
                <textarea
                  value={data.turnaroundNotice}
                  onChange={e => setData(prev => ({ ...prev, turnaroundNotice: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  rows={2}
                  className="w-full bg-white border border-pink-300 rounded p-2 font-brand font-semibold text-xs text-pink-900 outline-none resize-none"
                />
              </div>
            ) : (
              <p className="font-brand font-semibold text-xs sm:text-sm text-pink-900 uppercase tracking-wide">
                {data.turnaroundNotice}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Standard Shipping */}
            <div className="p-4 rounded-xl border border-pink-100 bg-[#FFF5F8]/40 flex flex-col justify-between">
              <div>
                {editMode ? (
                  <div className="flex flex-col gap-1.5 mb-2">
                    <input
                      type="text"
                      value={data.standardTitle}
                      onChange={e => setData(prev => ({ ...prev, standardTitle: e.target.value }))}
                      onBlur={() => saveToFirestore(data)}
                      className="bg-white border border-pink-300 rounded px-2 py-0.5 font-brand font-bold text-xs text-neutral-900 outline-none"
                    />
                    <textarea
                      value={data.standardDesc}
                      onChange={e => setData(prev => ({ ...prev, standardDesc: e.target.value }))}
                      onBlur={() => saveToFirestore(data)}
                      rows={2}
                      className="bg-white border border-pink-200 rounded p-1 font-brand text-xs text-neutral-600 outline-none resize-none"
                    />
                  </div>
                ) : (
                  <>
                    <span className="font-brand font-bold text-xs text-neutral-900 uppercase tracking-wider block mb-1">{data.standardTitle}</span>
                    <p className="font-brand text-xs text-neutral-600 leading-relaxed mb-3">
                      {data.standardDesc}
                    </p>
                  </>
                )}
              </div>

              {editMode ? (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-pink-500 font-bold font-brand uppercase">Rate:</span>
                  <input
                    type="text"
                    value={data.standardPrice}
                    onChange={e => setData(prev => ({ ...prev, standardPrice: e.target.value }))}
                    onBlur={() => saveToFirestore(data)}
                    className="w-full bg-white border border-pink-400 rounded px-2 py-0.5 font-brand font-bold text-xs text-[#FF5C9D] outline-none"
                  />
                </div>
              ) : (
                <span className="font-brand font-bold text-sm text-[#FF5C9D]">{data.standardPrice}</span>
              )}
            </div>

            {/* Tracked Shipping */}
            <div className="p-4 rounded-xl border border-pink-200 bg-pink-50/40 flex flex-col justify-between relative overflow-hidden">
              <span className="absolute top-2 right-2 bg-[#FF5C9D] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Recommended</span>
              <div>
                {editMode ? (
                  <div className="flex flex-col gap-1.5 mb-2">
                    <input
                      type="text"
                      value={data.trackedTitle}
                      onChange={e => setData(prev => ({ ...prev, trackedTitle: e.target.value }))}
                      onBlur={() => saveToFirestore(data)}
                      className="bg-white border border-pink-300 rounded px-2 py-0.5 font-brand font-bold text-xs text-neutral-900 outline-none"
                    />
                    <textarea
                      value={data.trackedDesc}
                      onChange={e => setData(prev => ({ ...prev, trackedDesc: e.target.value }))}
                      onBlur={() => saveToFirestore(data)}
                      rows={2}
                      className="bg-white border border-pink-200 rounded p-1 font-brand text-xs text-neutral-600 outline-none resize-none"
                    />
                  </div>
                ) : (
                  <>
                    <span className="font-brand font-bold text-xs text-neutral-900 uppercase tracking-wider block mb-1">{data.trackedTitle}</span>
                    <p className="font-brand text-xs text-neutral-600 leading-relaxed mb-3">
                      {data.trackedDesc}
                    </p>
                  </>
                )}
              </div>

              {editMode ? (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-pink-500 font-bold font-brand uppercase">Rate:</span>
                  <input
                    type="text"
                    value={data.trackedPrice}
                    onChange={e => setData(prev => ({ ...prev, trackedPrice: e.target.value }))}
                    onBlur={() => saveToFirestore(data)}
                    className="w-full bg-white border border-pink-400 rounded px-2 py-0.5 font-brand font-bold text-xs text-[#FF5C9D] outline-none"
                  />
                </div>
              ) : (
                <span className="font-brand font-bold text-sm text-[#FF5C9D]">{data.trackedPrice}</span>
              )}
            </div>
          </div>
        </section>

        {/* Cancellations & Refunds */}
        <section className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm border border-pink-100">
          <div className="text-center mb-6">
            {editMode ? (
              <div className="max-w-md mx-auto flex flex-col gap-2">
                <input
                  type="text"
                  value={data.cancellationsEyebrow}
                  onChange={e => setData(prev => ({ ...prev, cancellationsEyebrow: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-0.5 font-brand font-bold text-[11px] text-[#FF5C9D] uppercase tracking-widest outline-none"
                />
                <input
                  type="text"
                  value={data.cancellationsTitle}
                  onChange={e => setData(prev => ({ ...prev, cancellationsTitle: e.target.value }))}
                  onBlur={() => saveToFirestore(data)}
                  className="text-center bg-pink-50 border border-pink-200 rounded px-2 py-1 font-brand font-bold text-xl text-neutral-900 outline-none"
                />
              </div>
            ) : (
              <>
                <span className="font-brand font-bold text-[11px] sm:text-xs text-[#FF5C9D] uppercase tracking-widest block mb-1">{data.cancellationsEyebrow}</span>
                <h2 className="font-brand font-bold text-xl sm:text-2xl text-neutral-900 tracking-tight">{data.cancellationsTitle}</h2>
                <div className="w-16 h-0.5 bg-pink-300 mx-auto mt-2"></div>
              </>
            )}
          </div>

          <div className="p-4 rounded-xl bg-pink-50/70 border border-pink-100 text-center mb-6">
            {editMode ? (
              <textarea
                value={data.finalSaleNotice}
                onChange={e => setData(prev => ({ ...prev, finalSaleNotice: e.target.value }))}
                onBlur={() => saveToFirestore(data)}
                rows={2}
                className="w-full bg-white border border-pink-300 rounded p-2 font-brand font-semibold text-xs text-pink-900 outline-none resize-none text-center"
              />
            ) : (
              <p className="font-brand font-semibold text-xs sm:text-sm text-pink-900 uppercase tracking-wide">
                {data.finalSaleNotice}
              </p>
            )}
          </div>

          <div className="space-y-4 text-xs sm:text-sm font-brand text-neutral-600 leading-relaxed">
            <div className="p-4 rounded-xl border border-pink-100 bg-[#FFF5F8]/40">
              {editMode ? (
                <div className="flex flex-col gap-1.5">
                  <input
                    type="text"
                    value={data.cancellationHeading}
                    onChange={e => setData(prev => ({ ...prev, cancellationHeading: e.target.value }))}
                    onBlur={() => saveToFirestore(data)}
                    className="bg-white border border-pink-300 rounded px-2 py-0.5 font-bold text-xs uppercase outline-none"
                  />
                  <textarea
                    value={data.cancellationText}
                    onChange={e => setData(prev => ({ ...prev, cancellationText: e.target.value }))}
                    onBlur={() => saveToFirestore(data)}
                    rows={2}
                    className="w-full bg-white border border-pink-200 rounded p-1.5 text-xs outline-none resize-none"
                  />
                </div>
              ) : (
                <>
                  <h3 className="font-bold text-neutral-900 mb-1 uppercase tracking-wider text-xs">{data.cancellationHeading}</h3>
                  <p>{data.cancellationText}</p>
                </>
              )}
            </div>

            <div className="p-4 rounded-xl border border-pink-100 bg-[#FFF5F8]/40">
              {editMode ? (
                <div className="flex flex-col gap-1.5">
                  <input
                    type="text"
                    value={data.sizingHeading}
                    onChange={e => setData(prev => ({ ...prev, sizingHeading: e.target.value }))}
                    onBlur={() => saveToFirestore(data)}
                    className="bg-white border border-pink-300 rounded px-2 py-0.5 font-bold text-xs uppercase outline-none"
                  />
                  <textarea
                    value={data.sizingText}
                    onChange={e => setData(prev => ({ ...prev, sizingText: e.target.value }))}
                    onBlur={() => saveToFirestore(data)}
                    rows={3}
                    className="w-full bg-white border border-pink-200 rounded p-1.5 text-xs outline-none resize-none"
                  />
                </div>
              ) : (
                <>
                  <h3 className="font-bold text-neutral-900 mb-1 uppercase tracking-wider text-xs">{data.sizingHeading}</h3>
                  <p>{data.sizingText}</p>
                </>
              )}
            </div>

            <div className="p-4 rounded-xl border border-pink-100 bg-[#FFF5F8]/40">
              {editMode ? (
                <div className="flex flex-col gap-1.5">
                  <input
                    type="text"
                    value={data.damagedHeading}
                    onChange={e => setData(prev => ({ ...prev, damagedHeading: e.target.value }))}
                    onBlur={() => saveToFirestore(data)}
                    className="bg-white border border-pink-300 rounded px-2 py-0.5 font-bold text-xs uppercase outline-none"
                  />
                  <textarea
                    value={data.damagedText}
                    onChange={e => setData(prev => ({ ...prev, damagedText: e.target.value }))}
                    onBlur={() => saveToFirestore(data)}
                    rows={2}
                    className="w-full bg-white border border-pink-200 rounded p-1.5 text-xs outline-none resize-none"
                  />
                </div>
              ) : (
                <>
                  <h3 className="font-bold text-neutral-900 mb-1 uppercase tracking-wider text-xs">{data.damagedHeading}</h3>
                  <p>{data.damagedText}</p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Footer DM CTA */}
        <div className="text-center pt-4">
          <p className="font-brand text-xs text-neutral-500 mb-3">
            Have any questions about an upcoming order or shipping timeline?
          </p>
          <a
            href="https://ig.me/m/unhollynails"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#FF5C9D] hover:bg-pink-600 text-white font-brand font-bold text-xs uppercase tracking-wider px-8 py-3 rounded-full transition shadow-md shadow-pink-500/20"
          >
            DM Me on Instagram (@unhollynails)
          </a>
        </div>
      </div>
    </div>
  );
}
