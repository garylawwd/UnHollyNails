"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAdmin } from "@/context/AdminContext";

interface MenuItem {
  id: string;
  name: string;
  price: string;
  desc: string;
}

interface MenuSection {
  id: string;
  title: string;
  eyebrow: string;
  items: MenuItem[];
}

interface MenuData {
  eyebrow: string;
  title: string;
  subtitle: string;
  sections: MenuSection[];
  footerEyebrow: string;
  footerTitle: string;
  footerSubtitle: string;
  footerCtaText: string;
  footerCtaLink: string;
}

export const DEFAULT_MENU_DATA: MenuData = {
  eyebrow: "Official Price List",
  title: "UnHollyNails Menu",
  subtitle: "Every set is 100% hand-painted and customized to your exact nails. See standard pricing and extras below.",
  sections: [
    {
      id: "luxury-press-ons",
      title: "Luxury Press Ons",
      eyebrow: "Handcrafted Salon Artistry",
      items: [
        { id: "1", name: "Plain Colour", price: "From €30", desc: "Solid salon-grade gel polish in your choice of shade and finish." },
        { id: "2", name: "Minimal Art", price: "From €40", desc: "Subtle accents, clean french tips, chrome details, or minimal line art." },
        { id: "3", name: "Full Design", price: "From €50", desc: "Intricate multi-finger artwork, gems, textured designs, and custom themes." },
        { id: "4", name: "Character Sets", price: "From €60", desc: "Hand-painted character art, anime, pop culture, and detailed portraits." },
        { id: "5", name: "Mini Sets (Ages 5–12)", price: "€25", desc: "Gentle sized press-on sets designed specifically for little hands (sticky tabs only)." },
        { id: "6", name: "Replacement Nails", price: "From €5", desc: "Lost or damaged a single nail? Get an exact replacement without buying a whole set." },
      ]
    },
    {
      id: "keychains",
      title: "Keychains",
      eyebrow: "Custom Resin & Acrylic Accessories",
      items: [
        { id: "k1", name: "3D Keychains", price: "From €30", desc: "Sculpted 3D custom charm keychains made to match your favorite theme." },
        { id: "k2", name: "Smart Keychains", price: "From €35", desc: "Tech-enabled NFC smart keychains programmed to share your links or socials." },
        { id: "k3", name: "Custom 2D Keychains", price: "From €15", desc: "Handcrafted 2D custom art keychains with matching accents." },
        { id: "k4", name: "Fidget / Schoolbag Keychains", price: "From €25", desc: "Sensory, durable keychains perfect for schoolbags, backpacks, or keys." },
      ]
    },
    {
      id: "extras",
      title: "Extras & Gifts",
      eyebrow: "Kits, Add-Ons & Curated Gift Sets",
      items: [
        { id: "e1", name: "Sizing Kits", price: "€10", desc: "Essential numbered blank tips in your preferred shape/length. BONUS: Receive €5 back off your first custom order!" },
        { id: "e2", name: "Extra Application Kit", price: "€8", desc: "Includes nail glue, adhesive tabs, wooden cuticle stick, buffer block & alcohol wipe." },
        { id: "e3", name: "Custom Earrings", price: "From €12", desc: "Handcrafted earrings designed to match your nail set or worn as standalone statements." },
        { id: "e4", name: "Pamper Prep Kit", price: "€12", desc: "Deluxe prep & cuticle care kit to pamper your natural nails before and after wear." },
        { id: "e5", name: "Mystery Boxes", price: "From €35", desc: "Surprise luxury press-on set, application kit, gift bag of goodies & discount scratcher!" },
        { id: "e6", name: "Mini Mystery Boxes", price: "From €25", desc: "Surprise mini set (ages 5–12) with sticky tabs and a fun gift bag of treats!" },
        { id: "e7", name: "UnHollyNails Bundle", price: "From €90", desc: "The ultimate luxury gift box: custom set, prep kit, matching keychain, earrings & beauty gift." },
        { id: "e8", name: "Gift Vouchers", price: "Upon Request", desc: "Give the gift of bespoke nails! Available in any custom amount via DM." },
      ]
    }
  ],
  footerEyebrow: "Ready to Order?",
  footerTitle: "Have a Custom Idea in Mind?",
  footerSubtitle: "Send me a DM with your inspo photos, shape, length, and sizing to get your personalized quote!",
  footerCtaText: "Send DM on Instagram",
  footerCtaLink: "https://ig.me/m/unhollynails"
};

export default function MenuClient() {
  const {
    editMode,
    setPageTitle,
    setIsSaving,
    setLastSaved: setAdminLastSaved,
    setSaveHandler,
    setResetHandler
  } = useAdmin();
  const [data, setData] = useState<MenuData>(DEFAULT_MENU_DATA);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const vendorUid = process.env.NEXT_PUBLIC_VENDOR_UID || "CMzpkonBxKeLboaVTUYwDWgiwNG3";

  // Load from Firestore
  useEffect(() => {
    const loadContent = async () => {
      try {
        const snap = await getDoc(doc(db, "users", vendorUid, "store_settings", "menu_content"));
        if (snap.exists()) {
          const remoteData = snap.data() as Partial<MenuData>;
          setData(prev => ({
            ...prev,
            ...remoteData,
            sections: Array.isArray(remoteData.sections) && remoteData.sections.length > 0 
              ? remoteData.sections 
              : prev.sections
          }));
        }
      } catch (err) {
        console.warn("Could not load menu_content from Firestore, using defaults", err);
      }
    };
    loadContent();
  }, [vendorUid]);

  const saveToFirestore = useCallback(async (dataToSave: MenuData) => {
    setSaving(true);
    try {
      await setDoc(doc(db, "users", vendorUid, "store_settings", "menu_content"), dataToSave, { merge: true });
      setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to save menu_content:", err);
    } finally {
      setSaving(false);
    }
  }, [vendorUid]);

  // Handle section item edits
  const handleItemChange = (sectionIdx: number, itemIdx: number, field: keyof MenuItem, val: string) => {
    setData(prev => {
      const next = { ...prev };
      const nextSections = [...next.sections];
      const nextItems = [...nextSections[sectionIdx].items];
      nextItems[itemIdx] = { ...nextItems[itemIdx], [field]: val };
      nextSections[sectionIdx] = { ...nextSections[sectionIdx], items: nextItems };
      next.sections = nextSections;
      return next;
    });
  };

  const handleAddItem = (sectionIdx: number) => {
    const newItem: MenuItem = {
      id: "item_" + Date.now(),
      name: "New Item / Service",
      price: "€0",
      desc: "Add a short description of what this includes or how it is customized."
    };
    setData(prev => {
      const next = { ...prev };
      const nextSections = [...next.sections];
      nextSections[sectionIdx] = {
        ...nextSections[sectionIdx],
        items: [...nextSections[sectionIdx].items, newItem]
      };
      next.sections = nextSections;
      saveToFirestore(next);
      return next;
    });
  };

  const handleDeleteItem = (sectionIdx: number, itemIdx: number) => {
    if (!confirm("Are you sure you want to delete this menu item?")) return;
    setData(prev => {
      const next = { ...prev };
      const nextSections = [...next.sections];
      const nextItems = nextSections[sectionIdx].items.filter((_, idx) => idx !== itemIdx);
      nextSections[sectionIdx] = { ...nextSections[sectionIdx], items: nextItems };
      next.sections = nextSections;
      saveToFirestore(next);
      return next;
    });
  };

  const handleAddSection = () => {
    const newSection: MenuSection = {
      id: "section_" + Date.now(),
      title: "New Category",
      eyebrow: "Custom Services",
      items: [
        { id: "item_" + Date.now(), name: "First Item", price: "From €20", desc: "Description of the first item in this category." }
      ]
    };
    setData(prev => {
      const next = { ...prev, sections: [...prev.sections, newSection] };
      saveToFirestore(next);
      return next;
    });
  };

  const handleDeleteSection = (sectionIdx: number) => {
    if (!confirm("Are you sure you want to delete this whole category and all its items?")) return;
    setData(prev => {
      const next = { ...prev, sections: prev.sections.filter((_, idx) => idx !== sectionIdx) };
      saveToFirestore(next);
      return next;
    });
  };

  const handleResetDefaults = async () => {
    setData(DEFAULT_MENU_DATA);
    await saveToFirestore(DEFAULT_MENU_DATA);
  };

  
  useEffect(() => {
    setPageTitle("Price List Menu");
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
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-pink-500 font-brand">Eyebrow:</span>
              <input
                type="text"
                value={data.eyebrow}
                onChange={e => setData(prev => ({ ...prev, eyebrow: e.target.value }))}
                onBlur={() => saveToFirestore(data)}
                className="w-full bg-pink-50 border border-pink-300 rounded-lg px-3 py-1 font-brand text-xs font-bold text-[#FF5C9D] uppercase tracking-widest outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-pink-500 font-brand">Page Title:</span>
              <input
                type="text"
                value={data.title}
                onChange={e => setData(prev => ({ ...prev, title: e.target.value }))}
                onBlur={() => saveToFirestore(data)}
                className="w-full bg-pink-50 border border-pink-300 rounded-lg px-3 py-1 font-brand font-bold text-2xl text-neutral-900 outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-pink-500 font-brand">Subtitle:</span>
              <textarea
                value={data.subtitle}
                onChange={e => setData(prev => ({ ...prev, subtitle: e.target.value }))}
                onBlur={() => saveToFirestore(data)}
                rows={2}
                className="w-full bg-pink-50 border border-pink-300 rounded-lg px-3 py-1 font-brand text-xs text-neutral-600 outline-none focus:ring-2 focus:ring-pink-500 resize-none"
              />
            </div>
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

      {/* Menu Cards */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 space-y-10">
        {data.sections.map((section, sIdx) => (
          <section key={section.id || sIdx} className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-sm border border-pink-100 relative">
            {editMode && (
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <button
                  onClick={() => handleDeleteSection(sIdx)}
                  className="text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full border border-red-200 transition font-brand font-bold cursor-pointer"
                  title="Delete this entire category"
                >
                  ✕ Delete Category
                </button>
              </div>
            )}

            <div className="text-center mb-8">
              {editMode ? (
                <div className="max-w-md mx-auto flex flex-col gap-2">
                  <input
                    type="text"
                    value={section.eyebrow}
                    onChange={e => {
                      const val = e.target.value;
                      setData(prev => {
                        const nextSections = [...prev.sections];
                        nextSections[sIdx] = { ...nextSections[sIdx], eyebrow: val };
                        return { ...prev, sections: nextSections };
                      });
                    }}
                    onBlur={() => saveToFirestore(data)}
                    placeholder="Category Eyebrow"
                    className="text-center bg-pink-50 border border-pink-200 rounded-lg px-2 py-0.5 font-brand font-bold text-[11px] text-[#FF5C9D] uppercase tracking-widest outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  <input
                    type="text"
                    value={section.title}
                    onChange={e => {
                      const val = e.target.value;
                      setData(prev => {
                        const nextSections = [...prev.sections];
                        nextSections[sIdx] = { ...nextSections[sIdx], title: val };
                        return { ...prev, sections: nextSections };
                      });
                    }}
                    onBlur={() => saveToFirestore(data)}
                    placeholder="Category Title"
                    className="text-center bg-pink-50 border border-pink-200 rounded-lg px-2 py-1 font-brand font-bold text-xl sm:text-2xl text-neutral-900 outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              ) : (
                <>
                  <span className="font-brand font-bold text-[11px] sm:text-xs text-[#FF5C9D] uppercase tracking-widest block mb-1">{section.eyebrow}</span>
                  <h2 className="font-brand font-bold text-2xl sm:text-3xl text-neutral-900 tracking-tight">{section.title}</h2>
                  <div className="w-16 h-0.5 bg-pink-300 mx-auto mt-2"></div>
                </>
              )}
            </div>

            <div className="divide-y divide-pink-100/70">
              {section.items.map((item, iIdx) => (
                <div key={item.id || iIdx} className={`py-4 sm:py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 px-2 rounded-xl transition ${editMode ? 'bg-pink-50/30 border border-pink-200/50 mb-3' : 'hover:bg-pink-50/20'}`}>
                  {editMode ? (
                    <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1 w-full flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold text-neutral-400 font-brand">Name:</span>
                          <input
                            type="text"
                            value={item.name}
                            onChange={e => handleItemChange(sIdx, iIdx, "name", e.target.value)}
                            onBlur={() => saveToFirestore(data)}
                            className="flex-1 bg-white border border-pink-300 rounded px-2 py-1 font-brand font-bold text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-pink-500"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold text-neutral-400 font-brand">Desc:</span>
                          <input
                            type="text"
                            value={item.desc}
                            onChange={e => handleItemChange(sIdx, iIdx, "desc", e.target.value)}
                            onBlur={() => saveToFirestore(data)}
                            className="flex-1 bg-white border border-pink-300 rounded px-2 py-1 font-brand text-xs text-neutral-600 outline-none focus:ring-2 focus:ring-pink-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] uppercase font-bold text-pink-500 font-brand">Price:</span>
                        <input
                          type="text"
                          value={item.price}
                          onChange={e => handleItemChange(sIdx, iIdx, "price", e.target.value)}
                          onBlur={() => saveToFirestore(data)}
                          className="w-28 bg-white border border-pink-400 rounded-full px-3 py-1 font-brand font-bold text-xs text-[#FF5C9D] text-center outline-none focus:ring-2 focus:ring-pink-500 shadow-sm"
                        />
                        <button
                          onClick={() => handleDeleteItem(sIdx, iIdx)}
                          className="text-neutral-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition cursor-pointer"
                          title="Delete item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="pr-4">
                        <h3 className="font-brand font-bold text-sm sm:text-base text-neutral-900 mb-0.5">{item.name}</h3>
                        <p className="font-brand text-xs text-neutral-500 leading-relaxed max-w-xl">{item.desc}</p>
                      </div>
                      <div className="shrink-0 mt-1 sm:mt-0">
                        <span className="font-brand font-bold text-sm sm:text-base text-[#FF5C9D] bg-pink-50 px-3 py-1 rounded-full border border-pink-100">
                          {item.price}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {editMode && (
              <div className="mt-4 pt-4 border-t border-dashed border-pink-200 text-center">
                <button
                  onClick={() => handleAddItem(sIdx)}
                  className="bg-neutral-900 hover:bg-black text-white font-brand font-bold text-xs px-4 py-2 rounded-full transition shadow-sm cursor-pointer"
                >
                  + Add Item to {section.title || "Category"}
                </button>
              </div>
            )}
          </section>
        ))}

        {editMode && (
          <div className="text-center py-4">
            <button
              onClick={handleAddSection}
              className="bg-gradient-to-r from-[#FF5C9D] to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-brand font-bold text-sm px-6 py-3 rounded-full transition shadow-lg cursor-pointer"
            >
              + Add Brand New Category Section
            </button>
          </div>
        )}

        {/* CTA Callout */}
        <div className="bg-gradient-to-br from-neutral-950 via-neutral-900 to-pink-950/60 text-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center shadow-xl border border-pink-500/30">
          {editMode ? (
            <div className="max-w-md mx-auto flex flex-col gap-2">
              <input
                type="text"
                value={data.footerEyebrow}
                onChange={e => setData(prev => ({ ...prev, footerEyebrow: e.target.value }))}
                onBlur={() => saveToFirestore(data)}
                className="bg-white/10 border border-pink-400/50 rounded px-2 py-1 font-brand font-bold text-[11px] text-[#FF5C9D] uppercase tracking-widest text-center outline-none"
              />
              <input
                type="text"
                value={data.footerTitle}
                onChange={e => setData(prev => ({ ...prev, footerTitle: e.target.value }))}
                onBlur={() => saveToFirestore(data)}
                className="bg-white/10 border border-pink-400/50 rounded px-2 py-1 font-brand font-bold text-xl text-white text-center outline-none"
              />
              <textarea
                value={data.footerSubtitle}
                onChange={e => setData(prev => ({ ...prev, footerSubtitle: e.target.value }))}
                onBlur={() => saveToFirestore(data)}
                rows={2}
                className="bg-white/10 border border-pink-400/50 rounded px-2 py-1 font-brand text-xs text-neutral-300 text-center outline-none resize-none"
              />
              <input
                type="text"
                value={data.footerCtaText}
                onChange={e => setData(prev => ({ ...prev, footerCtaText: e.target.value }))}
                onBlur={() => saveToFirestore(data)}
                className="bg-white/10 border border-pink-400/50 rounded px-2 py-1 font-brand font-bold text-xs text-pink-300 text-center outline-none"
              />
            </div>
          ) : (
            <>
              <span className="font-brand font-bold text-[11px] uppercase tracking-widest text-[#FF5C9D] block mb-1">{data.footerEyebrow}</span>
              <h3 className="font-brand font-bold text-xl sm:text-2xl mb-2 text-white">{data.footerTitle}</h3>
              <p className="font-brand text-xs sm:text-sm text-neutral-300 max-w-md mx-auto mb-6">
                {data.footerSubtitle}
              </p>
            </>
          )}

          <div className="flex flex-wrap gap-3 justify-center mt-4">
            <a
              href={data.footerCtaLink || "https://ig.me/m/unhollynails"}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#FF5C9D] hover:bg-pink-600 text-white font-brand font-bold text-xs uppercase tracking-wider px-6 sm:px-8 py-3 rounded-full transition shadow-md shadow-pink-500/20"
            >
              {data.footerCtaText || "Send DM on Instagram"}
            </a>
            <Link
              href="/guides"
              className="bg-white/10 hover:bg-white/20 text-white font-brand font-bold text-xs uppercase tracking-wider px-6 sm:px-8 py-3 rounded-full transition border border-white/20"
            >
              View Sizing Guide
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
