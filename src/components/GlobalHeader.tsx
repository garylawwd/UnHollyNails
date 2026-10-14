"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useAdmin } from "@/context/AdminContext";
import { useState, useEffect } from "react";
import { onAuthStateChanged, User, signOut, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";

const CORE_TAGS = [
  'home', 
  'all', 
  'special-offers', 
  'Sets', 
  'Minis', 
  'Keychains', 
  'Earrings', 
  'Accessories', 
  'Basics',
  'menu',
  'bundles',
  'mystery-boxes',
  'club',
  'guides',
  'policies'
];

export default function GlobalHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { itemCount, setIsCartOpen } = useCart();
  const { 
    editMode, 
    setEditMode, 
    pageTitle, 
    isSaving, 
    lastSaved, 
    saveHandler, 
    resetHandler 
  } = useAdmin();
  const [user, setUser] = useState<User | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [studioDropdownOpen, setStudioDropdownOpen] = useState(false);
  
  const [allCollections, setAllCollections] = useState<{tag: string, title: string, inRibbon: boolean}[]>([]);
  const [ribbonOrder, setRibbonOrder] = useState<string[]>([]);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  
  // Modal states
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showConfirmHide, setShowConfirmHide] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const fetchRibbon = async () => {
      try {
        const vendorUid = process.env.NEXT_PUBLIC_VENDOR_UID || "CMzpkonBxKeLboaVTUYwDWgiwNG3";
        
        // Fetch all collection settings
        const snap = await getDocs(collection(db, "users", vendorUid, "collection_settings"));
        const collections = snap.docs.map(d => ({
          tag: d.id,
          title: d.data().title || d.id,
          inRibbon: d.data().inRibbon === true
          })).filter(c => c.tag !== "--ribbon_layout--");
        setAllCollections(collections);

        // Fetch ribbon layout
        let layoutData = null;
        try {
          const layoutRef = doc(db, "users", vendorUid, "collection_settings", "--ribbon_layout--");
          const layoutSnap = await getDoc(layoutRef);
          if (layoutSnap.exists()) {
              layoutData = layoutSnap.data();
            } else {
              try {
                const oldLayoutRef = doc(db, "users", vendorUid, "store_settings", "ribbon_layout");
                const oldLayoutSnap = await getDoc(oldLayoutRef);
                if (oldLayoutSnap.exists()) {
                  layoutData = oldLayoutSnap.data();
                  await setDoc(layoutRef, layoutData);
                }
              } catch (e) {}
            }
        } catch (err) {
          console.warn("Could not read ribbon_layout (likely Firebase rules), using default order", err);
        }
        
        if (layoutData && layoutData.order && Array.isArray(layoutData.order) && layoutData.order.length > 0) {
          const defaultCore = ['home', 'all', 'special-offers', 'Sets', 'Minis', 'Keychains', 'Earrings', 'Accessories', 'Basics'];
            const validTags = layoutData.order.filter((tag: string) => {
              const collectionMeta = collections.find(c => c.tag.toLowerCase() === tag.toLowerCase());
              if (defaultCore.map(t => t.toLowerCase()).includes(tag.toLowerCase())) return true;
              return !!collectionMeta; // Ignore legacy inRibbon flags, just ensure it exists
            });
            setRibbonOrder(validTags);
        } else {
          // Default fallback that INCLUDES custom pages!
          const defaultCore = ['home', 'special-offers', 'Sets', 'Minis', 'Keychains', 'Earrings', 'Accessories', 'Basics'];
          const filteredCore = [...defaultCore, 'all'];
            const customInRibbon = collections.filter(c => c.inRibbon && !defaultCore.includes(c.tag)).map(c => c.tag);
            setRibbonOrder([...filteredCore, ...customInRibbon]);
        }
      } catch (e) {
        console.error("Fatal error fetching ribbon", e);
        setRibbonOrder(['home', 'special-offers', 'Sets', 'Minis', 'Keychains', 'Earrings', 'Accessories', 'Basics', 'all']);
      }
    };
    fetchRibbon();
  }, []);

  const saveRibbonOrder = async (newOrder: string[]) => {
    try {
      const vendorUid = process.env.NEXT_PUBLIC_VENDOR_UID || "CMzpkonBxKeLboaVTUYwDWgiwNG3";
      await setDoc(doc(db, "users", vendorUid, "collection_settings", "--ribbon_layout--"), { order: newOrder }, { merge: true });
    } catch(e) { console.error("Error saving order", e); }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;
    
    setRibbonOrder(prevOrder => {
      const newItems = [...prevOrder];
      const item = newItems[draggedItem];
      if (!item) return prevOrder; // Safety check
      newItems.splice(draggedItem, 1);
      newItems.splice(index, 0, item);
      return newItems;
    });
    setDraggedItem(index);
  };

  const handleDragEnd = async () => {
    const finalItem = draggedItem;
    setDraggedItem(null);
    // saveRibbonOrder requires the latest state. We can use a setTimeout or a dedicated save button.
    // However, since we just updated state, we can't reliably read ribbonOrder here immediately.
    // We'll use a functional state update trick to read it and save it.
    setRibbonOrder(prev => {
      saveRibbonOrder(prev);
      return prev;
    });
  };

  const executeHide = async () => {
    if (!showConfirmHide) return;
    const tagToRemove = showConfirmHide;
    setShowConfirmHide(null);
    
    const newOrder = ribbonOrder.filter(t => t !== tagToRemove);
    setRibbonOrder(newOrder);
    await saveRibbonOrder(newOrder);
    
    if (!CORE_TAGS.includes(tagToRemove)) {
      try {
        const vendorUid = process.env.NEXT_PUBLIC_VENDOR_UID || "CMzpkonBxKeLboaVTUYwDWgiwNG3";
        const metaDoc = await getDoc(doc(db, "users", vendorUid, "collection_settings", tagToRemove));
          if (metaDoc.exists()) {
            await setDoc(doc(db, "users", vendorUid, "collection_settings", tagToRemove), { inRibbon: false }, { merge: true });
          }
        setAllCollections(prev => prev.map(c => c.tag === tagToRemove ? { ...c, inRibbon: false } : c));
      } catch(err) {}
    }
  };

  const handleAddExistingPage = async (tagToAdd: string) => {
    setShowAddMenu(false);
    if (!ribbonOrder.includes(tagToAdd)) {
      const newOrder = [...ribbonOrder, tagToAdd];
      setRibbonOrder(newOrder);
      await saveRibbonOrder(newOrder);
      if (!CORE_TAGS.includes(tagToAdd)) {
        try {
          const vendorUid = process.env.NEXT_PUBLIC_VENDOR_UID || "CMzpkonBxKeLboaVTUYwDWgiwNG3";
          await setDoc(doc(db, "users", vendorUid, "collection_settings", tagToAdd), { inRibbon: true }, { merge: true });
          setAllCollections(prev => prev.map(c => c.tag === tagToAdd ? { ...c, inRibbon: true } : c));
        } catch(err) {}
      }
    }
  };

  const handleCreateNewPage = async () => {
    const title = newCollectionTitle.trim();
    if (!title) {
      setShowCreateModal(false);
      return;
    }
    
    setShowCreateModal(false);
    setNewCollectionTitle("");
    const tag = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    if (!tag) return;
    
    try {
      const vendorUid = process.env.NEXT_PUBLIC_VENDOR_UID || "CMzpkonBxKeLboaVTUYwDWgiwNG3";
      await setDoc(doc(db, "users", vendorUid, "collection_settings", tag), {
        tag, title, inRibbon: true
      });
      const newOrder = [...ribbonOrder, tag];
      setRibbonOrder(newOrder);
      await saveRibbonOrder(newOrder);
      setAllCollections(prev => [...prev, { tag, title, inRibbon: true }]);
      router.push(`/collections/${tag}`);
    } catch (e) {
      console.error(e);
      alert("Failed to create page");
    }
  };

  const handleLogout = async () => { await signOut(auth); };
  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
    }
  };

  if (pathname === '/admin') return null;

  const isActive = (path: string) => pathname === path;
  const VALID_ADMINS = ["0TMvGP1VIja7VzVM87MPQaacoY03", "CMzpkonBxKeLboaVTUYwDWgiwNG3"];
  const isAdmin = user?.uid ? VALID_ADMINS.includes(user.uid) : false;

  const getLinkDetails = (tag: string) => {
    if (tag === 'home') return { title: 'HOME', href: '/' };
    if (tag === 'all') return { title: 'ALL DESIGNS', href: '/collections/all' };
    if (tag === 'special-offers') {
      const custom = allCollections.find(c => c.tag === 'special-offers');
      return { title: custom?.title || 'SPECIAL OFFERS', href: '/collections/special-offers' };
    }
    if (tag === 'menu') return { title: 'PRICE MENU', href: '/menu' };
    if (tag === 'bundles') return { title: 'BUNDLES', href: '/bundles' };
    if (tag === 'mystery-boxes') return { title: 'MYSTERY BOXES', href: '/mystery-boxes' };
    if (tag === 'club') return { title: 'UNHOLLY CLUB', href: '/club' };
    if (tag === 'guides') return { title: 'SIZING & CARE', href: '/guides' };
    if (tag === 'policies') return { title: 'POLICIES', href: '/policies' };
    if (['Sets', 'Minis', 'Keychains', 'Earrings', 'Accessories', 'Basics'].includes(tag)) {
      return { title: tag.toUpperCase(), href: `/collections/${tag}` };
    }
    const custom = allCollections.find(c => c.tag === tag);
    if (custom) return { title: custom.title.toUpperCase(), href: `/collections/${tag}` };
    return { title: tag.toUpperCase(), href: `/collections/${tag}` };
  };

  const coreTags = CORE_TAGS;
  const hiddenCollections = allCollections.filter(c => !ribbonOrder.includes(c.tag) && !coreTags.map(t=>t.toLowerCase()).includes(c.tag.toLowerCase()));
  const hiddenCoreTags = coreTags.filter(t => !ribbonOrder.includes(t));

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl shadow-sm border-b border-pink-100/50 w-full">
        {isAdmin && (
          <aside aria-label="Admin Control Bar" className="bg-gradient-to-r from-neutral-950 via-neutral-900 to-pink-950 text-white text-xs py-2 px-3 sm:px-6 border-b border-pink-500/30 w-full transition-all">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
              
              {/* Left Side: Admin State & Edit Toggle */}
              <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 font-bold tracking-widest uppercase text-[10px] text-pink-300">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF5C9D]"></span>
                  </span>
                  Admin Active
                </span>

                <label className="flex items-center gap-1.5 cursor-pointer hover:text-pink-200 transition-colors font-bold text-xs bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-full border border-white/10 select-none">
                  <input
                    type="checkbox"
                    checked={editMode}
                    onChange={e => setEditMode(e.target.checked)}
                    className="accent-pink-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Enable Edit Mode</span>
                </label>

                {editMode && pageTitle && (
                  <span className="font-bold text-[10px] uppercase tracking-wider text-white bg-pink-950/80 border border-pink-500/40 px-2.5 py-0.5 rounded-full">
                    Editing: {pageTitle}
                  </span>
                )}
              </div>

              {/* Right Side: Page Controls, Status & Dashboard */}
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {editMode && (
                  <>
                    {/* Save Status Feedback */}
                    {isSaving && (
                      <span className="text-[11px] text-amber-300 flex items-center gap-1 font-semibold">
                        <svg className="animate-spin h-3 w-3 text-amber-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        Saving...
                      </span>
                    )}
                    {lastSaved && !isSaving && (
                      <span className="text-[11px] text-emerald-400 font-semibold hidden sm:inline">
                        ✓ All changes saved
                      </span>
                    )}

                    {/* Action: Save Now (if page provided saveHandler) */}
                    {saveHandler && (
                      <button
                        onClick={() => saveHandler()}
                        disabled={isSaving}
                        className="bg-[#FF5C9D] hover:bg-pink-600 disabled:opacity-50 text-white font-bold text-xs px-3 py-1 rounded-full transition shadow-sm cursor-pointer"
                      >
                        Save Now
                      </button>
                    )}

                    {/* Action: Reset Defaults (if page provided resetHandler) */}
                    {resetHandler && (
                      <button
                        onClick={() => {
                          if (confirm(`Reset ${pageTitle || 'this page'} to original defaults? This will overwrite your custom text.`)) {
                            resetHandler();
                          }
                        }}
                        className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium text-[11px] px-2.5 py-1 rounded-full transition border border-neutral-700 cursor-pointer"
                        title="Reset page text back to original template"
                      >
                        Reset Defaults
                      </button>
                    )}
                  </>
                )}

                <Link
                  href="/admin"
                  className="text-pink-300 hover:text-white transition-colors underline underline-offset-2 text-xs font-bold whitespace-nowrap ml-1"
                >
                  Dashboard →
                </Link>
              </div>

            </div>
          </aside>
        )}
        <div className="max-w-7xl mx-auto w-full flex flex-col">
          {/* Top Bar: Utilities & Mobile Menu Toggle */}
          <div className="flex justify-between items-center px-4 sm:px-6 py-2">
            <button 
              className="md:hidden p-2 -ml-2 text-neutral-700 hover:text-[#FF5C9D] transition-colors" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle Menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
                )}
              </svg>
            </button>
            
            <div className="hidden md:block flex-1"></div>

            <div className="flex items-center gap-3 ml-auto">
              {!user ? (
                <button onClick={handleSignIn} className="text-[10px] font-bold text-white bg-black hover:bg-neutral-800 px-4 py-2 rounded-full transition whitespace-nowrap">SIGN IN</button>
              ) : (
                <>
                  <Link href="/profile" className={`relative p-2 transition-colors ${isActive('/profile') ? 'text-[#FF5C9D]' : 'text-neutral-700 hover:text-[#FF5C9D]'}`} aria-label="My Profile">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                  </Link>
                  <button onClick={handleLogout} className="text-[10px] font-bold text-pink-500 hover:text-pink-700 bg-pink-50 px-3 py-1.5 rounded-full border border-pink-100 transition whitespace-nowrap ml-1">Logout</button>
                </>
              )}
              <button onClick={() => setIsCartOpen(true)} className="relative p-2 text-neutral-700 hover:text-[#FF5C9D] transition-colors ml-1" aria-label="Shopping Bag">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                {itemCount > 0 && <span className="absolute top-0 right-0 bg-[#FF5C9D] text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{itemCount}</span>}
              </button>
            </div>
          </div>
          
          {/* Ribbon Navigation (Desktop Only) */}
          <div className="hidden md:flex justify-center gap-6 overflow-visible items-center px-6 pb-3 pt-1 w-full border-t border-pink-50/50 relative">
            {ribbonOrder.map((tag, index) => {
              const { title, href } = getLinkDetails(tag);
              return (
                <div 
                  key={tag}
                  draggable={editMode}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-1 group ${editMode ? 'cursor-grab active:cursor-grabbing p-1.5 hover:bg-neutral-100 rounded-lg border border-transparent hover:border-neutral-200 transition-all' : ''} ${draggedItem === index ? 'opacity-50' : ''}`}
                >
                  {editMode && (
                    <button onClick={(e) => { e.preventDefault(); setShowConfirmHide(tag); }} className="text-neutral-300 hover:text-red-500 hidden group-hover:block px-1" title="Remove from ribbon">✕</button>
                  )}
                  <Link href={href} className={`text-xs font-bold transition-colors whitespace-nowrap uppercase tracking-[0.2em] ${isActive(href) ? 'text-[#FF5C9D]' : 'text-neutral-500 hover:text-black'}`}>
                    {title}
                  </Link>
                </div>
              );
            })}

            {/* Studio Dropdown (Desktop) */}
            <div 
              className="relative group py-1"
              onMouseEnter={() => setStudioDropdownOpen(true)}
              onMouseLeave={() => setStudioDropdownOpen(false)}
            >
              <button 
                type="button"
                onClick={() => setStudioDropdownOpen(!studioDropdownOpen)}
                className={`flex items-center gap-1.5 text-xs font-bold transition-colors whitespace-nowrap uppercase tracking-[0.2em] cursor-pointer ${
                  ['/menu', '/bundles', '/mystery-boxes', '/club', '/guides', '/policies', '/contact', '/about'].includes(pathname)
                    ? 'text-[#FF5C9D]' 
                    : 'text-neutral-500 hover:text-black'
                }`}
              >
                <span>STUDIO</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 20 20" 
                  fill="currentColor" 
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${studioDropdownOpen ? 'rotate-180 text-[#FF5C9D]' : 'text-neutral-400 group-hover:text-black'}`}
                >
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Dropdown Panel */}
              {studioDropdownOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50 w-72 animate-in fade-in duration-150">
                  <div className="bg-white/95 backdrop-blur-xl border border-pink-100 rounded-2xl shadow-xl shadow-pink-500/10 p-2.5 flex flex-col gap-0.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FF5C9D] px-3 pt-2 pb-1">
                      The Studio
                    </span>
                    <Link
                      href="/menu"
                      onClick={() => setStudioDropdownOpen(false)}
                      className={`flex flex-col px-3 py-2 rounded-xl transition-colors ${
                        isActive('/menu') ? 'bg-pink-50 text-[#FF5C9D]' : 'hover:bg-pink-50/70 text-neutral-800 hover:text-black'
                      }`}
                    >
                      <span className="text-xs font-bold">Price List Menu</span>
                      <span className="text-[10px] text-neutral-500 font-medium">Bespoke nail art & services</span>
                    </Link>
                    <Link
                      href="/bundles"
                      onClick={() => setStudioDropdownOpen(false)}
                      className={`flex flex-col px-3 py-2 rounded-xl transition-colors ${
                        isActive('/bundles') ? 'bg-pink-50 text-[#FF5C9D]' : 'hover:bg-pink-50/70 text-neutral-800 hover:text-black'
                      }`}
                    >
                      <span className="text-xs font-bold">Gift Bundles</span>
                      <span className="text-[10px] text-neutral-500 font-medium">Curated luxury gift packs</span>
                    </Link>
                    <Link
                      href="/mystery-boxes"
                      onClick={() => setStudioDropdownOpen(false)}
                      className={`flex flex-col px-3 py-2 rounded-xl transition-colors ${
                        isActive('/mystery-boxes') ? 'bg-pink-50 text-[#FF5C9D]' : 'hover:bg-pink-50/70 text-neutral-800 hover:text-black'
                      }`}
                    >
                      <span className="text-xs font-bold">Mystery Boxes</span>
                      <span className="text-[10px] text-neutral-500 font-medium">Surprise press-on sets & extras</span>
                    </Link>
                    <Link
                      href="/club"
                      onClick={() => setStudioDropdownOpen(false)}
                      className={`flex flex-col px-3 py-2 rounded-xl transition-colors ${
                        isActive('/club') ? 'bg-pink-50 text-[#FF5C9D]' : 'hover:bg-pink-50/70 text-neutral-800 hover:text-black'
                      }`}
                    >
                      <span className="text-xs font-bold">UnHollyNails Club</span>
                      <span className="text-[10px] text-neutral-500 font-medium">Digital loyalty card, stamps & perks</span>
                    </Link>

                    <div className="h-px bg-pink-100/80 my-1"></div>

                    <Link
                      href="/guides"
                      onClick={() => setStudioDropdownOpen(false)}
                      className={`flex flex-col px-3 py-2 rounded-xl transition-colors ${
                        isActive('/guides') ? 'bg-pink-50 text-[#FF5C9D]' : 'hover:bg-pink-50/70 text-neutral-800 hover:text-black'
                      }`}
                    >
                      <span className="text-xs font-bold">Sizing & Care Guides</span>
                      <span className="text-[10px] text-neutral-500 font-medium">Sizing kits, coin photo & wear guide</span>
                    </Link>
                    <Link
                      href="/policies"
                      onClick={() => setStudioDropdownOpen(false)}
                      className={`flex flex-col px-3 py-2 rounded-xl transition-colors ${
                        isActive('/policies') ? 'bg-pink-50 text-[#FF5C9D]' : 'hover:bg-pink-50/70 text-neutral-800 hover:text-black'
                      }`}
                    >
                      <span className="text-xs font-bold">Store Policies & Shipping</span>
                      <span className="text-[10px] text-neutral-500 font-medium">Turnaround times & hygiene rules</span>
                    </Link>
                    <Link
                      href="/about"
                      onClick={() => setStudioDropdownOpen(false)}
                      className={`flex flex-col px-3 py-2 rounded-xl transition-colors ${
                        isActive('/about') ? 'bg-pink-50 text-[#FF5C9D]' : 'hover:bg-pink-50/70 text-neutral-800 hover:text-black'
                      }`}
                    >
                      <span className="text-xs font-bold">About The Studio</span>
                      <span className="text-[10px] text-neutral-500 font-medium">Holly's story & hand-painted craft</span>
                    </Link>

                    <div className="h-px bg-pink-100/80 my-1"></div>

                    <a
                      href="https://ig.me/m/unhollynails"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setStudioDropdownOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-pink-50/70 hover:bg-pink-100 text-[#FF5C9D] transition-colors"
                    >
                      <span className="text-xs font-bold">DM on Instagram</span>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              )}
            </div>
            
            {editMode && (
              <button onClick={() => setShowAddMenu(true)} className="w-6 h-6 flex-shrink-0 flex items-center justify-center bg-black text-white rounded-full hover:bg-pink-500 transition-colors text-lg leading-none font-bold ml-2">
                +
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer (Full Slide-over Sheet with Backdrop) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden flex justify-start">
          {/* Dimmed backdrop blur */}
          <div 
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Sheet */}
          <div className="relative w-[85vw] max-w-[320px] h-[100dvh] bg-white shadow-2xl flex flex-col z-10 animate-slide-right overflow-hidden">
            
            {/* Drawer Header: Logo + Close */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-pink-100/70 bg-gradient-to-r from-pink-50/40 via-white to-pink-50/20 flex-shrink-0">
              <Link 
                href="/" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo_cropped.png" alt="UnHolly Nails" className="h-7 w-auto object-contain" />
              </Link>

              <button 
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-neutral-500 hover:text-black rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                aria-label="Close Menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              
              {/* Tier 1: SHOP COLLECTIONS */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-400">
                    Shop
                  </span>
                  {editMode && (
                    <span className="text-[10px] text-pink-500 font-bold">Edit Order</span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {ribbonOrder.map((tag, index) => {
                    const { title, href } = getLinkDetails(tag);
                    return (
                      <div key={tag} className="flex justify-between items-center group rounded-xl hover:bg-pink-50/70 transition-colors">
                        <Link 
                          href={href} 
                          onClick={() => setIsMobileMenuOpen(false)} 
                          className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-between ${
                            isActive(href) ? 'text-[#FF5C9D]' : 'text-neutral-800 group-hover:text-black'
                          }`}
                        >
                          <span>{title}</span>
                          {isActive(href) && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#FF5C9D]"></span>
                          )}
                        </Link>

                        {editMode && (
                          <div className="flex items-center gap-0.5 pr-2">
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                if (index > 0) {
                                  const newOrder = [...ribbonOrder];
                                  [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                                  setRibbonOrder(newOrder);
                                  saveRibbonOrder(newOrder);
                                }
                              }}
                              disabled={index === 0}
                              className="p-1.5 text-neutral-400 hover:text-black disabled:opacity-20 text-xs cursor-pointer"
                            >
                              ↑
                            </button>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                if (index < ribbonOrder.length - 1) {
                                  const newOrder = [...ribbonOrder];
                                  [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
                                  setRibbonOrder(newOrder);
                                  saveRibbonOrder(newOrder);
                                }
                              }}
                              disabled={index === ribbonOrder.length - 1}
                              className="p-1.5 text-neutral-400 hover:text-black disabled:opacity-20 text-xs cursor-pointer"
                            >
                              ↓
                            </button>
                            <button 
                              type="button"
                              onClick={(e) => { e.preventDefault(); setShowConfirmHide(tag); setIsMobileMenuOpen(false); }} 
                              className="text-neutral-300 hover:text-red-500 p-1.5 text-xs cursor-pointer" 
                              title="Remove from ribbon"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {editMode && (
                  <button 
                    type="button"
                    onClick={() => { setShowAddMenu(true); setIsMobileMenuOpen(false); }} 
                    className="mt-2.5 w-full py-2 bg-neutral-900 hover:bg-black text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>+ Add / Manage Collections</span>
                  </button>
                )}
              </div>

              {/* Tier 2: THE STUDIO (2x2 Grid of Bespoke Offerings) */}
              <div>
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FF5C9D]">
                    Studio
                  </span>
                  <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                    Bespoke & Specials
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link 
                    href="/menu" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`p-3 rounded-2xl border transition flex flex-col justify-between min-h-[72px] ${
                      isActive('/menu')
                        ? 'bg-pink-100/70 border-pink-300 text-[#FF5C9D]'
                        : 'bg-pink-50/50 hover:bg-pink-50 border-pink-100/80 text-neutral-800'
                    }`}
                  >
                    <span className="text-xs font-bold">Price Menu</span>
                    <span className="text-[10px] text-neutral-500 font-medium">Bespoke sets & art</span>
                  </Link>

                  <Link 
                    href="/bundles" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`p-3 rounded-2xl border transition flex flex-col justify-between min-h-[72px] ${
                      isActive('/bundles')
                        ? 'bg-pink-100/70 border-pink-300 text-[#FF5C9D]'
                        : 'bg-pink-50/50 hover:bg-pink-50 border-pink-100/80 text-neutral-800'
                    }`}
                  >
                    <span className="text-xs font-bold">Gift Bundles</span>
                    <span className="text-[10px] text-neutral-500 font-medium">Curated packs & kits</span>
                  </Link>

                  <Link 
                    href="/mystery-boxes" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`p-3 rounded-2xl border transition flex flex-col justify-between min-h-[72px] ${
                      isActive('/mystery-boxes')
                        ? 'bg-pink-100/70 border-pink-300 text-[#FF5C9D]'
                        : 'bg-pink-50/50 hover:bg-pink-50 border-pink-100/80 text-neutral-800'
                    }`}
                  >
                    <span className="text-xs font-bold">Mystery Boxes</span>
                    <span className="text-[10px] text-neutral-500 font-medium">Surprise press-ons</span>
                  </Link>

                  <Link 
                    href="/club" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`p-3 rounded-2xl border transition flex flex-col justify-between min-h-[72px] ${
                      isActive('/club')
                        ? 'bg-pink-100/70 border-pink-300 text-[#FF5C9D]'
                        : 'bg-pink-50/50 hover:bg-pink-50 border-pink-100/80 text-neutral-800'
                    }`}
                  >
                    <span className="text-xs font-bold">UnHolly Club</span>
                    <span className="text-[10px] text-neutral-500 font-medium">Loyalty card & rewards</span>
                  </Link>
                </div>
              </div>

              {/* Tier 3: STUDIO INFO & CARE */}
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-400">
                    Help & Info
                  </span>
                </div>

                <div className="space-y-1">
                  <Link 
                    href="/guides" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between py-2 px-3 rounded-xl text-xs font-medium transition-colors ${
                      isActive('/guides') ? 'bg-pink-50 text-[#FF5C9D] font-bold' : 'text-neutral-600 hover:text-black hover:bg-neutral-50'
                    }`}
                  >
                    <span>Sizing & Application Guides</span>
                    <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>

                  <Link 
                    href="/policies" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between py-2 px-3 rounded-xl text-xs font-medium transition-colors ${
                      isActive('/policies') ? 'bg-pink-50 text-[#FF5C9D] font-bold' : 'text-neutral-600 hover:text-black hover:bg-neutral-50'
                    }`}
                  >
                    <span>Store Policies & Shipping</span>
                    <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>

                  <Link 
                    href="/about" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between py-2 px-3 rounded-xl text-xs font-medium transition-colors ${
                      isActive('/about') ? 'bg-pink-50 text-[#FF5C9D] font-bold' : 'text-neutral-600 hover:text-black hover:bg-neutral-50'
                    }`}
                  >
                    <span>About The Studio</span>
                    <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>

                  <Link 
                    href="/contact" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between py-2 px-3 rounded-xl text-xs font-medium transition-colors ${
                      isActive('/contact') ? 'bg-pink-50 text-[#FF5C9D] font-bold' : 'text-neutral-600 hover:text-black hover:bg-neutral-50'
                    }`}
                  >
                    <span>Contact & DM Holly</span>
                    <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>

            </div>

            {/* Drawer Footer: User / Auth Controls */}
            <div className="p-4 border-t border-pink-100 bg-neutral-50/60 flex-shrink-0 mt-auto">
              {!user ? (
                <button 
                  type="button"
                  onClick={() => { setIsMobileMenuOpen(false); handleSignIn(); }}
                  className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl uppercase tracking-widest transition shadow-sm cursor-pointer"
                >
                  Sign In
                </button>
              ) : (
                <div className="flex items-center justify-between">
                  <Link 
                    href="/profile" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-xs font-bold text-neutral-800 hover:text-[#FF5C9D] transition"
                  >
                    <div className="w-7 h-7 rounded-full bg-pink-100 text-[#FF5C9D] flex items-center justify-center font-black text-xs">
                      {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span className="truncate max-w-[150px]">{user.displayName || user.email || 'My Account'}</span>
                  </Link>

                  <button 
                    type="button"
                    onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                    className="text-[11px] font-bold text-pink-500 hover:text-pink-700 bg-pink-50 px-3 py-1.5 rounded-full border border-pink-100 transition cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Global Modals for Ribbon Manager */}
      {/* 1. Add Page Modal */}
      {showAddMenu && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddMenu(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden relative shadow-2xl animate-slide-up flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-neutral-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="font-black uppercase tracking-widest text-sm">Add Page to Navigation</h3>
              <button onClick={() => setShowAddMenu(false)} className="text-neutral-400 hover:text-black">✕</button>
            </div>
            <div className="p-2 overflow-y-auto flex-1">
              {[...hiddenCoreTags, ...hiddenCollections.map(c => c.tag)].map(tag => {
                const { title } = getLinkDetails(tag);
                return (
                  <button key={tag} onClick={() => handleAddExistingPage(tag)} className="w-full text-left text-xs font-bold px-4 py-3 hover:bg-pink-50 rounded-xl transition-colors uppercase tracking-widest text-neutral-600 hover:text-black">
                    + {title}
                  </button>
                )
              })}
            </div>
            <div className="p-4 border-t border-neutral-100 bg-neutral-50 sticky bottom-0 z-10">
              <button onClick={() => { setShowAddMenu(false); setShowCreateModal(true); }} className="w-full text-xs font-bold px-4 py-3 bg-white border border-pink-200 text-pink-600 hover:bg-pink-50 rounded-xl transition-colors uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm">
                <span>✨ Create Brand New Page</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Create New Page Prompt */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden relative shadow-2xl animate-slide-up">
            <div className="p-6">
              <h3 className="font-black uppercase tracking-widest text-lg mb-2">New Collection</h3>
              <p className="text-neutral-500 text-sm mb-6">Enter a title for your new collection page. A URL will be automatically generated.</p>
              <input 
                type="text"
                autoFocus
                value={newCollectionTitle}
                onChange={e => setNewCollectionTitle(e.target.value)}
                onKeyDown={e => { if(e.key === 'Enter') handleCreateNewPage(); }}
                placeholder="e.g. Summer Vibes"
                className="w-full bg-neutral-100 border-none rounded-xl px-4 py-3 mb-6 focus:ring-2 focus:ring-pink-500 outline-none"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 py-3 text-sm font-bold text-neutral-500 hover:bg-neutral-100 rounded-xl transition-colors">Cancel</button>
                <button onClick={handleCreateNewPage} disabled={!newCollectionTitle.trim()} className="flex-1 py-3 text-sm font-bold text-white bg-[#FF5C9D] hover:bg-pink-600 disabled:opacity-50 disabled:hover:bg-[#FF5C9D] rounded-xl transition-colors">Create Page</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Confirm Hide Modal */}
      {showConfirmHide && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowConfirmHide(null)}></div>
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden relative shadow-2xl animate-slide-up">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✕</div>
              <h3 className="font-black uppercase tracking-widest text-lg mb-2">Hide from Ribbon?</h3>
              <p className="text-neutral-500 text-sm mb-6">Are you sure you want to hide <span className="font-bold text-black">"{getLinkDetails(showConfirmHide).title}"</span> from the main navigation?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirmHide(null)} className="flex-1 py-3 text-sm font-bold text-neutral-500 hover:bg-neutral-100 rounded-xl transition-colors">Cancel</button>
                <button onClick={executeHide} className="flex-1 py-3 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-md shadow-red-500/20">Yes, Hide It</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
