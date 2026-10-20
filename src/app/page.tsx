"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useMemo, useRef, KeyboardEvent } from "react";
import { collectionGroup, collection, getDocs, doc, updateDoc, query, where, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "@/lib/firebase";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAdmin } from "@/context/AdminContext";

import { Product } from "@/lib/types";
import ProductLightbox from "@/components/ProductLightbox";
import ShapeSizingGuideModal from "@/components/ShapeSizingGuideModal";
import ProductDetailDrawer from "@/components/ProductDetailDrawer";
import { VENDOR_UID, VALID_ADMINS, DEFAULT_SHAPES, DEFAULT_LENGTHS, DEFAULT_SIZES, formatStorageImageUrl } from "@/lib/constants";

const SHAPE_OPTIONS = [...DEFAULT_SHAPES, "Other"];
const SIZE_OPTIONS = [...DEFAULT_SIZES, "Other"];
const LENGTH_OPTIONS = [...DEFAULT_LENGTHS, "Other"];

function getColorLuminance(hex?: string): number {
  if (!hex) return 0;
  const clean = hex.replace("#", "").trim();
  let r = 0, g = 0, b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.substring(0, 2), 16);
    g = parseInt(clean.substring(2, 4), 16);
    b = parseInt(clean.substring(4, 6), 16);
  } else {
    return 0;
  }
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function isCollectionCardLight(collection: any): boolean {
  const custom = !!collection?.customCardColors;
  // Use card-specific themeMode if custom, else page themeMode
  const mode = custom ? (collection?.cardThemeMode || 'auto') : (collection?.themeMode || 'auto');
  if (mode === 'light') return true;
  if (mode === 'dark') return false;
  
  // Use card-specific ombre if custom, else page ombre
  const start = (custom && collection?.cardOmbreStart) ? collection.cardOmbreStart : (collection?.ombreStart || '#f472b6');
  const end = (custom && collection?.cardOmbreEnd) ? collection.cardOmbreEnd : (collection?.ombreEnd || '#000000');
  
  const startLum = getColorLuminance(start);
  const endLum = getColorLuminance(end);
  const avgLum = (startLum + endLum) / 2;
  return avgLum > 128 || endLum > 160 || startLum > 160;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { editMode, setEditMode, editingProduct, setEditingProduct } = useAdmin();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const [selectedShape, setSelectedShape] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedLength, setSelectedLength] = useState<string>("");
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showShapeGuide, setShowShapeGuide] = useState(false);

  const openLightbox = (idx: number = 0) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [ribbonCollections, setRibbonCollections] = useState<{tag: string, title: string}[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user && VALID_ADMINS.includes(user.uid as any)) {
        setAdminUser(user);
      } else {
        setAdminUser(null);
      }
      if (user && user.email) {
        try {
          const vendorUid = VENDOR_UID;
          const q = query(collection(db, "users", vendorUid, "clients"), where("email", "==", user.email));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setClientProfile(snap.docs[0].data());
          }
        } catch (e) { console.error("Failed to fetch client profile", e); }
      } else {
        setClientProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

    const [allCollections, setAllCollections] = useState<any[]>([]);
  const [showFeaturePicker, setShowFeaturePicker] = useState(false);
  const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null);
  const [confirmRemoveSlot, setConfirmRemoveSlot] = useState<number | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorTab, setEditorTab] = useState<'card' | 'page' | 'info'>('card');
  const [editData, setEditData] = useState<any>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const cardBgFileRef = useRef<HTMLInputElement>(null);

  const [homeContent, setHomeContent] = useState({
    heroTitle: "Luxury Hand-Painted<br/>Press-On Nails",
    heroSubtitle: "Salon-quality custom nail sets perfectly sized and delivered directly to your door.",
    feature1Title: "Bespoke Artistry",
    feature1Sub: "100% Hand-Painted in Studio",
    feature2Title: "Salon-Grade Gel",
    feature2Sub: "Reusable Luxury Soft Gel Tips",
    feature3Title: "Custom Millimeter Fit",
    feature3Sub: "Tailored to Your Exact Nail Beds",
    feature4Title: "Complete Prep Kit",
    feature4Sub: "Includes File, Buffer, Tabs & Glue",
    collectionsEyebrow: "Curated Sets",
    collectionsTitle: "Featured Collections",
    collectionsSubtitle: "Explore my exclusive themed sets hand-painted just for you.",
    newArrivalsEyebrow: "Fresh From Studio",
    newArrivalsTitle: "New Arrivals",
    newArrivalsSubtitle: "Fresh out of the studio. Grab them before they're gone.",
    sizingEyebrow: "Guaranteed Flawless Fit",
    sizingTitle: "New to UnHolly Nails?",
    sizingSubtitle: "Don't guess your size! Order a sizing kit first to guarantee a flawless, salon-perfect fit for your custom sets.",
    sizingButtonText: "Order Kit (€5)",
    featuredProductIds: [] as string[],
  });



  
  
  const moveRibbon = async (index: number, direction: number) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === ribbonCollections.length - 1) return;
    const newItems = [...ribbonCollections];
    const temp = newItems[index];
    newItems[index] = newItems[index + direction];
    newItems[index + direction] = temp;
    
    setRibbonCollections(newItems);
    const vendorUid = VENDOR_UID;
    await setDoc(doc(db, 'users', vendorUid, 'store_settings', 'featured_order'), {
      order: newItems.map(c => c.tag)
    }, { merge: true });
  };

  const moveArrival = async (index: number, direction: number) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === 9) return;
    const vendorUid = VENDOR_UID;
    let newIds = (homeContent.featuredProductIds && homeContent.featuredProductIds.length > 0)
          ? [...homeContent.featuredProductIds]
          : products.slice(0, 10).map(pr => pr.id);
    while(newIds.length < 10) newIds.push("");
    
    const temp = newIds[index];
    newIds[index] = newIds[index + direction];
    newIds[index + direction] = temp;
    
    setHomeContent(prev => ({...prev, featuredProductIds: newIds}));
    await setDoc(doc(db, "users", vendorUid, "store_settings", "home_content"), { featuredProductIds: newIds }, { merge: true });
  };

  const saveInlineEdits = async () => {
    if (!adminUser || !editData) return;
    setSavingEdit(true);
    try {
      const vendorUid = VENDOR_UID;
      let newImageUrl = editData.backgroundImageUrl;
      let newCardImageUrl = editData.cardImageUrl;

      if (bgFileRef.current?.files && bgFileRef.current.files.length > 0) {
        const file = bgFileRef.current.files[0];
        const storageRef = ref(storage, `users/${vendorUid}/images/bg_${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        newImageUrl = await getDownloadURL(storageRef);
      }

      if (cardBgFileRef.current?.files && cardBgFileRef.current.files.length > 0) {
        const file = cardBgFileRef.current.files[0];
        const storageRef = ref(storage, `users/${vendorUid}/images/card_${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        newCardImageUrl = await getDownloadURL(storageRef);
      }

      const rawTag = editData.tag;
      const isCoreTag = ['sets', 'minis', 'keychains', 'earrings', 'accessories', 'basics', 'special-offers', 'all'].includes(rawTag.toLowerCase());
      const canonicalTag = isCoreTag ? rawTag.toLowerCase() : rawTag;

      const updatedMeta = { 
        ...editData, 
        tag: canonicalTag,
        backgroundImageUrl: newImageUrl || '', 
        cardImageUrl: newCardImageUrl || '' 
      };
      await setDoc(doc(db, 'users', vendorUid, 'collection_settings', canonicalTag), updatedMeta, { merge: true });
      
      if (rawTag !== canonicalTag) {
        try {
          await deleteDoc(doc(db, 'users', vendorUid, 'collection_settings', rawTag));
        } catch(e) {}
      }
      
      // Update UI state immediately
      setRibbonCollections((prev: any) => prev.map((c: any) => c.tag.toLowerCase() === canonicalTag ? updatedMeta : c));
      setAllCollections((prev: any) => prev.map((c: any) => c.tag.toLowerCase() === canonicalTag ? updatedMeta : c));
      
      setShowEditor(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save.');
    } finally {
      setSavingEdit(false);
    }
  };


  const fetchProducts = async () => {
    try {
      const vendorUid = VENDOR_UID;
      
      try {
        const homeRef = doc(db, "users", vendorUid, "store_settings", "home_content");
        const homeSnap = await getDoc(homeRef);
        if (homeSnap.exists()) {
          setHomeContent(prev => ({ ...prev, ...homeSnap.data() }));
        }
      } catch (e) {
        console.error("Error fetching home content", e);
      }
      
      // Fetch Ribbon Collections
      const allCollSnap = await getDocs(collection(db, "users", vendorUid, "collection_settings"));
      const collMap = new Map<string, any>();
      allCollSnap.docs.forEach(d => {
        if (d.id === '--ribbon_layout--') return;
        const lower = d.id.toLowerCase();
        const data = d.data();
        const existing = collMap.get(lower);
        if (!existing || (!existing.backgroundImageUrl && data.backgroundImageUrl)) {
          collMap.set(lower, {
            tag: lower,
            title: data.title || (lower.charAt(0).toUpperCase() + lower.slice(1)),
            ...data,
          });
        }
      });
      setAllCollections(Array.from(collMap.values()));

      const ribbonSnap = await getDocs(query(collection(db, "users", vendorUid, "collection_settings"), where("isFeatured", "==", true)));
      const ribbonsMap = new Map<string, any>();
      ribbonSnap.docs.forEach(d => {
        const data = d.data();
        const rawTag = data.tag || d.id;
        const lower = rawTag.toLowerCase();
        const existing = ribbonsMap.get(lower);
        if (!existing || (!existing.backgroundImageUrl && data.backgroundImageUrl) || (!existing.cardImageUrl && data.cardImageUrl)) {
          ribbonsMap.set(lower, {
            ...data,
            tag: lower,
            title: data.title || (lower.charAt(0).toUpperCase() + lower.slice(1)),
            description: data.description || "",
            backgroundImageUrl: data.backgroundImageUrl || "",
            ombreStart: data.ombreStart || "#f472b6",
            ombreEnd: data.ombreEnd || "#000000",
            bgScale: data.bgScale || 100,
            cardImageUrl: data.cardImageUrl || "",
            cardBgScale: data.cardBgScale || data.bgScale || 100,
            headerColor: data.headerColor || "",
            descriptionColor: data.descriptionColor || "",
            themeMode: data.themeMode || "auto",
            customCardColors: data.customCardColors || false,
            cardOmbreStart: data.cardOmbreStart || "",
            cardOmbreEnd: data.cardOmbreEnd || "",
            cardHeaderColor: data.cardHeaderColor || "",
            cardDescriptionColor: data.cardDescriptionColor || "",
            cardThemeMode: data.cardThemeMode || "auto",
          });
        }
      });
      const ribbons = Array.from(ribbonsMap.values());
      
      const orderSnap = await getDoc(doc(db, 'users', vendorUid, 'store_settings', 'featured_order'));
      if (orderSnap.exists() && orderSnap.data().order) {
        const order = orderSnap.data().order.map((t: string) => t.toLowerCase());
        ribbons.sort((a: any, b: any) => {
          const idxA = order.indexOf(a.tag.toLowerCase());
          const idxB = order.indexOf(b.tag.toLowerCase());
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
      }
      setRibbonCollections(ribbons as any);


      const q = query(collection(db, "users", vendorUid, "nail_sets"), where("isForSale", "==", true));

      const snapshot = await getDocs(q);

      // Fetch the Android app's separate multi-photo collection for this vendor
      const imagesSnapshot = await getDocs(collection(db, "users", vendorUid, "set_images"));
      const allSetImages = imagesSnapshot.docs.map(doc => doc.data());

      const fetchedProducts = snapshot.docs.map(d => {
        const data = d.data();
        const syncId = data.syncId || d.id;

        // Extract extra photos uploaded via Android app
        const androidExtraImages = allSetImages
          .filter(img => img.setSyncId === syncId && img.uri)
          .sort((a, b) => (a.position || 0) - (b.position || 0))
          .map(img => formatStorageImageUrl(img.uri as string, vendorUid));

        // Merge web-uploaded images (additionalImages array) with Android-uploaded images
        const mergedExtraImages = Array.from(new Set([...(data.additionalImages || []).map((u: string) => formatStorageImageUrl(u, vendorUid)), ...androidExtraImages]));

        let primaryImage = data.imagePath;
        if ((!primaryImage || !primaryImage.startsWith('http')) && mergedExtraImages.length > 0) {
          primaryImage = mergedExtraImages.find(img => img.startsWith("http")) || mergedExtraImages[0];
        } else {
          primaryImage = formatStorageImageUrl(primaryImage, vendorUid);
        }

        // Ensure the primary image isn't duplicated in the gallery carousel
        const finalExtraImages = mergedExtraImages.filter(img => img !== primaryImage);

        return {
          id: d.id,
          docPath: d.ref.path,
          name: data.name || 'Unnamed Set',
          basePrice: data.basePrice || 0,
          priceOnAsk: data.priceOnAsk === true,
          imagePath: primaryImage || 'https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?auto=format&fit=crop&q=80&w=800',
          additionalImages: finalExtraImages,
          description: data.description || '',
          defaultShape: data.defaultShape || 'Almond',
          defaultLength: data.defaultLength || 'M',
          hiddenShapes: Array.isArray(data.hiddenShapes) ? data.hiddenShapes : [],
          hiddenLengths: Array.isArray(data.hiddenLengths) ? data.hiddenLengths : [],
          isPromo: data.isPromo === true,
          category: data.category || 'Uncategorized',
          tags: data.tags || [],
          syncId: syncId,
        } as Product;
      });

      const uniqueProducts = Array.from(new Map(fetchedProducts.map(item => [item.id, item])).values());

      setProducts(uniqueProducts);
    } catch (error) {
      console.error("Error fetching nail sets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct || editingProduct || showLogin) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedProduct, editingProduct, showLogin]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      
      const VALID_ADMINS = ["0TMvGP1VIja7VzVM87MPQaacoY03", "CMzpkonBxKeLboaVTUYwDWgiwNG3"];
      if (!VALID_ADMINS.includes(result.user.uid)) {
        await signOut(auth);
        setLoginError("Access Denied: You do not have administrator privileges.");
        return;
      }
      
      setShowLogin(false);
      setEditMode(true);
    } catch (err: any) {
      setLoginError(err.message || "Failed to login with Google");
    }
  };


  const openDrawer = (product: Product) => {
    setSelectedProduct(product);
    setSelectedShape(clientProfile?.defaultShape || product.defaultShape || "Almond");
    setSelectedSize(clientProfile ? "Profile Sizes" : "M");
    setSelectedLength(clientProfile?.defaultLength || product.defaultLength || "M");
    setSelectedQuantity(1);
  };

  const closeDrawer = () => {
    setSelectedProduct(null);
  };

  const handleAddToBag = () => {
    if (selectedProduct) {
      const name = selectedProduct.name.toLowerCase();
      const isSizingKit = name.includes('sizing');
      const isMiniSet = name.includes('mini') || name.includes('kids') || selectedProduct.type?.toLowerCase() === 'minis' || (selectedProduct.tags || []).some((t: string) => t.toLowerCase() === 'minis');
      
      const finalSize = isSizingKit ? 'N/A' : selectedSize;
      const finalShape = isMiniSet ? 'N/A' : selectedShape;
      const finalLength = isMiniSet ? 'N/A' : selectedLength;

      addToCart(selectedProduct, finalShape, finalSize, finalLength, selectedQuantity);
      closeDrawer();
    }
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollGallery = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const { clientWidth } = scrollContainerRef.current;
      scrollContainerRef.current.scrollBy({ 
        left: direction === 'left' ? -clientWidth : clientWidth, 
        behavior: 'smooth' 
      });
    }
  };

  const promoProducts = useMemo(() => products.filter(p => p.isPromo), [products]);
  
  // dynamicFilters and displayedProducts removed since ribbon acts as global nav

  return (
    <div className="min-h-screen font-sans bg-[#FFF5F8] text-[#1A1A1A] pb-10 sm:pb-20 selection:bg-pink-200 selection:text-pink-900 relative">
      {/* Seamless Soft Pink Glows */}
      <div className="fixed top-[-20%] left-[-10%] w-[70%] h-[70%] bg-[#FF5C9D] rounded-full mix-blend-multiply filter blur-[200px] opacity-[0.12] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#FF5C9D] rounded-full mix-blend-multiply filter blur-[200px] opacity-[0.12] pointer-events-none z-0"></div>
      <div className="fixed top-[40%] left-[30%] w-[50%] h-[50%] bg-[#FFB6D5] rounded-full mix-blend-multiply filter blur-[250px] opacity-[0.08] pointer-events-none z-0"></div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <main className="w-full flex-grow flex flex-col">
          {loading ? (
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-20 space-y-12 animate-pulse">
              {/* Hero Skeleton */}
              <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-4">
                <div className="w-48 sm:w-64 h-24 rounded-2xl bg-pink-200/40" />
                <div className="w-3/4 h-10 sm:h-14 rounded-2xl bg-pink-200/50" />
                <div className="w-2/3 h-5 rounded-xl bg-pink-200/30" />
                <div className="flex gap-3 pt-2">
                  <div className="w-40 h-11 rounded-full bg-pink-300/50" />
                  <div className="w-36 h-11 rounded-full bg-pink-200/40" />
                </div>
              </div>
              {/* Editorial Studio Features Skeleton */}
              <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="h-24 rounded-2xl bg-white/70 border border-pink-100 p-4 flex flex-col justify-center space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-pink-100" />
                    <div className="w-3/4 h-3.5 rounded bg-pink-100/80" />
                    <div className="w-1/2 h-2.5 rounded bg-pink-100/50" />
                  </div>
                ))}
              </div>
              {/* Sizing Banner Skeleton */}
              <div className="max-w-5xl mx-auto h-36 rounded-3xl bg-neutral-900/80 p-6 flex items-center justify-between">
                <div className="space-y-2.5 w-1/2">
                  <div className="w-32 h-3 rounded bg-pink-400/40" />
                  <div className="w-64 h-6 rounded bg-white/20" />
                  <div className="w-80 h-3.5 rounded bg-white/10" />
                </div>
                <div className="w-36 h-11 rounded-full bg-pink-500/40 hidden sm:block" />
              </div>
              {/* Featured Collections Skeleton */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(n => (
                  <div key={n} className="h-72 sm:h-80 rounded-[2rem] bg-pink-200/40 border border-pink-100" />
                ))}
              </div>
              {/* New Arrivals Skeleton */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map(n => (
                  <div key={n} className="bg-white/70 rounded-3xl p-3.5 border border-pink-100 space-y-3">
                    <div className="aspect-square rounded-2xl bg-pink-100/70" />
                    <div className="h-3.5 w-3/4 rounded bg-pink-100/80" />
                    <div className="h-3 w-1/3 rounded bg-pink-100/60" />
                    <div className="h-8 w-full rounded-xl bg-pink-100/50" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Hero Section */}
              <div className="relative w-full flex flex-col items-center justify-start pt-6 sm:pt-10 pb-4 sm:pb-10">
                <div className="relative z-10 text-center px-4 max-w-4xl mx-auto flex flex-col items-center">
                  <Image 
                    src="/logo_cropped.png" 
                    alt="UnHolly Nails" 
                    width={360} 
                    height={150} 
                    className="w-44 sm:w-72 h-auto object-contain mb-4 sm:mb-6" 
                    priority 
                  />
                  {editMode ? (
                    <div className="w-full max-w-2xl mx-auto flex flex-col gap-3">
                      <input 
                        type="text" 
                        value={homeContent.heroTitle.replace(/<br\/>/g, ' ')} 
                        onChange={e => setHomeContent(prev => ({...prev, heroTitle: e.target.value}))} 
                        onBlur={async (e) => { 
                          const vendorUid = VENDOR_UID; 
                          await setDoc(doc(db, "users", vendorUid, "store_settings", "home_content"), { heroTitle: e.target.value }, { merge: true }); 
                        }} 
                        className="relative z-50 pointer-events-auto ring-2 ring-pink-500 rounded-xl p-2.5 bg-pink-50/80 font-brand font-bold text-3xl sm:text-5xl text-neutral-900 text-center tracking-tight leading-tight w-full outline-none"
                      />
                      <textarea 
                        value={homeContent.heroSubtitle.replace(/<br\/>/g, '\n')} 
                        onChange={e => setHomeContent(prev => ({...prev, heroSubtitle: e.target.value}))} 
                        onBlur={async (e) => { 
                          const vendorUid = VENDOR_UID; 
                          await setDoc(doc(db, "users", vendorUid, "store_settings", "home_content"), { heroSubtitle: e.target.value.replace(/\n/g, '<br/>') }, { merge: true }); 
                        }} 
                        className="relative z-50 pointer-events-auto ring-2 ring-pink-500 rounded-xl p-2.5 bg-pink-50/80 font-brand text-sm sm:text-base text-neutral-600 text-center w-full resize-none font-normal outline-none"
                        rows={2}
                      />
                    </div>
                  ) : (
                    <>
                      <h1 
                        className="font-brand font-bold text-3xl sm:text-5xl lg:text-6xl text-neutral-900 mb-3 sm:mb-5 tracking-tight leading-tight"
                        dangerouslySetInnerHTML={{ __html: homeContent.heroTitle }}
                      />
                      <p 
                        className="font-brand text-sm sm:text-base text-neutral-600 mb-6 sm:mb-8 font-normal max-w-xl leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: homeContent.heroSubtitle }}
                      />
                    </>
                  )}
                  <div className="flex flex-wrap gap-3 sm:gap-4 justify-center">
                    <Link href="/collections/all" className="bg-[#FF5C9D] text-white px-7 sm:px-9 py-3 sm:py-3.5 rounded-full font-brand font-bold text-xs tracking-wider uppercase hover:bg-pink-600 hover:scale-105 transition-all shadow-md shadow-pink-500/25">Shop All Designs</Link>
                    <Link href="/collections/special-offers" className="bg-white/90 backdrop-blur-sm border border-pink-200 text-neutral-800 px-7 sm:px-9 py-3 sm:py-3.5 rounded-full font-brand font-bold text-xs tracking-wider uppercase hover:border-[#FF5C9D] hover:text-[#FF5C9D] hover:scale-105 transition-all shadow-sm">View Promos</Link>
                  </div>
                </div>
              </div>

              {/* Modern Editorial Studio Features Showcase */}
              <div className="w-full px-4 sm:px-6 relative z-20 mb-2 sm:mb-4">
                <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {[
                    {
                      titleKey: "feature1Title",
                      subKey: "feature1Sub",
                      defaultTitle: "Bespoke Artistry",
                      defaultSub: "100% Hand-Painted in Studio",
                      icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF5C9D]">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                        </svg>
                      )
                    },
                    {
                      titleKey: "feature2Title",
                      subKey: "feature2Sub",
                      defaultTitle: "Salon-Grade Gel",
                      defaultSub: "Reusable Luxury Soft Gel Tips",
                      icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF5C9D]">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                        </svg>
                      )
                    },
                    {
                      titleKey: "feature3Title",
                      subKey: "feature3Sub",
                      defaultTitle: "Custom Millimeter Fit",
                      defaultSub: "Tailored to Your Exact Nail Beds",
                      icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF5C9D]">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                        </svg>
                      )
                    },
                    {
                      titleKey: "feature4Title",
                      subKey: "feature4Sub",
                      defaultTitle: "Complete Prep Kit",
                      defaultSub: "Includes File, Buffer, Tabs & Glue",
                      icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF5C9D]">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                      )
                    }
                  ].map((feat, idx) => {
                    const tVal = (homeContent as any)[feat.titleKey] || feat.defaultTitle;
                    const sVal = (homeContent as any)[feat.subKey] || feat.defaultSub;
                    return (
                      <div
                        key={idx}
                        className="group relative bg-white/80 backdrop-blur-xl border border-pink-100/90 hover:border-pink-300/80 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden"
                      >
                        <div className="absolute -right-6 -top-6 w-20 h-20 bg-pink-200/30 rounded-full blur-xl pointer-events-none group-hover:bg-pink-300/40 transition-colors" />
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center mb-2.5 sm:mb-3 group-hover:scale-105 transition-transform">
                          {feat.icon}
                        </div>
                        {editMode ? (
                          <div className="space-y-1.5 relative z-10">
                            <input
                              type="text"
                              value={tVal}
                              onChange={e => setHomeContent(prev => ({ ...prev, [feat.titleKey]: e.target.value }))}
                              onBlur={async e => {
                                await setDoc(
                                  doc(db, "users", VENDOR_UID, "store_settings", "home_content"),
                                  { [feat.titleKey]: e.target.value },
                                  { merge: true }
                                );
                              }}
                              className="w-full text-xs font-brand font-bold text-neutral-900 bg-pink-50/90 ring-1 ring-pink-400 rounded px-2 py-1 outline-none"
                            />
                            <input
                              type="text"
                              value={sVal}
                              onChange={e => setHomeContent(prev => ({ ...prev, [feat.subKey]: e.target.value }))}
                              onBlur={async e => {
                                await setDoc(
                                  doc(db, "users", VENDOR_UID, "store_settings", "home_content"),
                                  { [feat.subKey]: e.target.value },
                                  { merge: true }
                                );
                              }}
                              className="w-full text-[11px] font-brand text-neutral-600 bg-pink-50/90 ring-1 ring-pink-400 rounded px-2 py-1 outline-none"
                            />
                          </div>
                        ) : (
                          <div className="relative z-10">
                            <h3 className="font-brand font-bold text-xs sm:text-sm text-neutral-900 tracking-tight mb-0.5">
                              {tVal}
                            </h3>
                            <p className="font-brand text-[11px] sm:text-xs text-neutral-500 leading-snug">
                              {sVal}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sizing Kit Promo Banner (Sleek Nail Studio Glam) */}
              <div className="w-full px-4 sm:px-6 relative z-20 my-3 sm:my-8">
                <div className="max-w-5xl mx-auto bg-gradient-to-br from-neutral-950 via-neutral-900 to-pink-950/60 border border-pink-500/30 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-xl shadow-pink-500/5 flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-8 transform hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#FF5C9D] rounded-full filter blur-[90px] opacity-20 pointer-events-none"></div>
                  
                  {editMode ? (
                    <div className="w-full flex flex-col gap-2 relative z-10 text-white">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-brand font-bold text-pink-400">Eyebrow:</span>
                        <input 
                          type="text" 
                          value={homeContent.sizingEyebrow || "Guaranteed Flawless Fit"} 
                          onChange={e => setHomeContent(prev => ({...prev, sizingEyebrow: e.target.value}))} 
                          onBlur={async (e) => { 
                            const vendorUid = VENDOR_UID; 
                            await setDoc(doc(db, "users", vendorUid, "store_settings", "home_content"), { sizingEyebrow: e.target.value }, { merge: true }); 
                          }} 
                          className="relative z-50 ring-2 ring-pink-500 rounded px-2 py-1 bg-pink-950/70 font-brand font-bold text-[11px] uppercase tracking-widest text-[#FF5C9D] flex-1 outline-none"
                        />
                      </div>
                      <input 
                        type="text" 
                        value={homeContent.sizingTitle || "New to UnHolly Nails?"} 
                        onChange={e => setHomeContent(prev => ({...prev, sizingTitle: e.target.value}))} 
                        onBlur={async (e) => { 
                          const vendorUid = VENDOR_UID; 
                          await setDoc(doc(db, "users", vendorUid, "store_settings", "home_content"), { sizingTitle: e.target.value }, { merge: true }); 
                        }} 
                        className="relative z-50 ring-2 ring-pink-500 rounded p-1.5 bg-pink-950/70 font-brand font-bold text-xl sm:text-2xl tracking-tight text-white w-full outline-none"
                      />
                      <textarea 
                        value={homeContent.sizingSubtitle || "Don't guess your size! Order a sizing kit first to guarantee a flawless, salon-perfect fit for your custom sets."} 
                        onChange={e => setHomeContent(prev => ({...prev, sizingSubtitle: e.target.value}))} 
                        onBlur={async (e) => { 
                          const vendorUid = VENDOR_UID; 
                          await setDoc(doc(db, "users", vendorUid, "store_settings", "home_content"), { sizingSubtitle: e.target.value }, { merge: true }); 
                        }} 
                        className="relative z-50 ring-2 ring-pink-500 rounded p-1.5 bg-pink-950/70 font-brand text-neutral-300 font-normal text-xs sm:text-sm w-full resize-none outline-none"
                        rows={2}
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] uppercase font-brand font-bold text-neutral-400">Button:</span>
                        <input 
                          type="text" 
                          value={homeContent.sizingButtonText || "Order Kit (€5)"} 
                          onChange={e => setHomeContent(prev => ({...prev, sizingButtonText: e.target.value}))} 
                          onBlur={async (e) => { 
                            const vendorUid = VENDOR_UID; 
                            await setDoc(doc(db, "users", vendorUid, "store_settings", "home_content"), { sizingButtonText: e.target.value }, { merge: true }); 
                          }} 
                          className="relative z-50 ring-2 ring-pink-500 rounded p-1 bg-pink-950/70 font-brand text-xs font-bold text-white w-36 text-center outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-white text-center md:text-left relative z-10">
                      <span className="text-[#FF5C9D] font-brand font-bold text-[11px] uppercase tracking-widest block mb-1">
                        {homeContent.sizingEyebrow || "Guaranteed Flawless Fit"}
                      </span>
                      <h2 className="font-brand font-bold text-xl sm:text-2xl lg:text-3xl tracking-tight mb-1.5 text-white">
                        {homeContent.sizingTitle || "New to UnHolly Nails?"}
                      </h2>
                      <p className="font-brand text-neutral-300 font-normal text-xs sm:text-sm max-w-lg leading-relaxed">
                        {homeContent.sizingSubtitle || "Don't guess your size! Order a sizing kit first to guarantee a flawless, salon-perfect fit for your custom sets."}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-row gap-3 shrink-0 w-full sm:w-auto justify-center relative z-10">
                    <button 
                      onClick={() => {
                        let kit = products.find(p => p.name.toLowerCase().includes('sizing kit') || p.name.toLowerCase().includes('sizing'));
                        if (!kit) {
                          kit = {
                            id: "placeholder-sizing-kit",
                            docPath: "placeholder/sizing-kit",
                            name: "Sizing Kit",
                            basePrice: 5.00,
                            priceOnAsk: false,
                            imagePath: "/logo_cropped.png",
                            additionalImages: [],
                            description: "Sizing kit to guarantee a flawless fit.",
                            category: "Accessories",
                            tags: [],
                            isForSale: true,
                            isPromo: false,
                            syncId: "sizing-kit",
                            type: "Accessories"
                          } as Product;
                        }
                        addToCart(kit, kit.defaultShape || 'Almond', 'N/A', kit.defaultLength || 'M', 1);
                      }} 
                      className="bg-[#FF5C9D] text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-full font-brand font-bold text-xs uppercase tracking-wider hover:bg-pink-600 transition-colors shadow-md shadow-pink-500/30 whitespace-nowrap flex-1 sm:flex-initial text-center"
                    >
                      {homeContent.sizingButtonText || "Order Kit (€5)"}
                    </button>
                    <Link href="/guides" className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-6 sm:px-8 py-3 sm:py-3.5 rounded-full font-brand font-bold text-xs uppercase tracking-wider transition-colors whitespace-nowrap text-center flex-1 sm:flex-initial">
                      How to measure →
                    </Link>
                  </div>
                </div>
              </div>

              {/* Section Divider */}
              <div className="max-w-xs mx-auto h-px bg-gradient-to-r from-transparent via-pink-300 to-transparent my-2 sm:my-4"></div>

              {/* Featured Collections Grid */}
              {((ribbonCollections.length > 0 || allCollections.filter(c => c.tag && c.tag !== '--ribbon_layout--' && c.tag !== 'all').length > 0) || (editMode && adminUser)) && (
                <div className="py-6 sm:py-12 px-4 sm:px-6 w-full relative z-20">
                  <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-6 sm:mb-10">
                      {editMode ? (
                        <div className="w-full max-w-2xl mx-auto flex flex-col gap-2">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[10px] uppercase font-brand font-bold text-pink-400">Eyebrow:</span>
                            <input 
                              type="text" 
                              value={homeContent.collectionsEyebrow || "Curated Sets"} 
                              onChange={e => setHomeContent(prev => ({...prev, collectionsEyebrow: e.target.value}))} 
                              onBlur={async (e) => { 
                                const vendorUid = VENDOR_UID; 
                                await setDoc(doc(db, "users", vendorUid, "store_settings", "home_content"), { collectionsEyebrow: e.target.value }, { merge: true }); 
                              }} 
                              className="relative z-50 pointer-events-auto ring-2 ring-pink-500 rounded px-2 py-1 bg-pink-50/80 font-brand font-bold text-xs uppercase tracking-widest text-[#FF5C9D] text-center w-64 outline-none"
                            />
                          </div>
                          <input 
                            type="text" 
                            value={homeContent.collectionsTitle.replace(/<br\/>/g, ' ')} 
                            onChange={e => setHomeContent(prev => ({...prev, collectionsTitle: e.target.value}))} 
                            onBlur={async (e) => { 
                              const vendorUid = VENDOR_UID; 
                              await setDoc(doc(db, "users", vendorUid, "store_settings", "home_content"), { collectionsTitle: e.target.value }, { merge: true }); 
                            }} 
                            className="relative z-50 pointer-events-auto ring-2 ring-pink-500 rounded-xl p-2 bg-pink-50/80 font-brand font-bold text-2xl sm:text-4xl tracking-tight text-neutral-900 text-center w-full outline-none"
                          />
                          <textarea 
                            value={homeContent.collectionsSubtitle.replace(/<br\/>/g, '\n')} 
                            onChange={e => setHomeContent(prev => ({...prev, collectionsSubtitle: e.target.value}))} 
                            onBlur={async (e) => { 
                              const vendorUid = VENDOR_UID; 
                              await setDoc(doc(db, "users", vendorUid, "store_settings", "home_content"), { collectionsSubtitle: e.target.value.replace(/\n/g, '<br/>') }, { merge: true }); 
                            }} 
                            className="relative z-50 pointer-events-auto ring-2 ring-pink-500 rounded-xl p-2 bg-pink-50/80 font-brand text-neutral-500 font-normal text-xs sm:text-sm text-center w-full resize-none outline-none"
                            rows={2}
                          />
                        </div>
                      ) : (
                        <>
                          <span className="font-brand font-bold text-[11px] sm:text-xs text-[#FF5C9D] uppercase tracking-widest block mb-1">
                            {homeContent.collectionsEyebrow || "Curated Sets"}
                          </span>
                          <h2 
                            className="font-brand font-bold text-2xl sm:text-4xl text-neutral-900 mb-1.5 sm:mb-2 tracking-tight"
                            dangerouslySetInnerHTML={{ __html: homeContent.collectionsTitle }}
                          />
                          <p 
                            className="font-brand text-neutral-500 font-normal text-xs sm:text-sm max-w-lg mx-auto"
                            dangerouslySetInnerHTML={{ __html: homeContent.collectionsSubtitle }}
                          />
                        </>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
                      {(ribbonCollections.length > 0 
                        ? ribbonCollections 
                        : allCollections.filter(c => c.tag && c.tag !== '--ribbon_layout--' && c.tag !== 'all').slice(0, 3).map(c => ({
                            ...c,
                            tag: c.tag,
                            title: c.title || c.tag,
                            description: c.description || "View this collection",
                            backgroundImageUrl: c.backgroundImageUrl || "",
                            ombreStart: c.ombreStart || "#f472b6",
                            ombreEnd: c.ombreEnd || "#000000",
                            bgScale: c.bgScale || 100,
                            cardImageUrl: c.cardImageUrl || "",
                            cardBgScale: c.cardBgScale || c.bgScale || 100,
                            headerColor: c.headerColor || "",
                            descriptionColor: c.descriptionColor || "",
                            themeMode: c.themeMode || "auto",
                            customCardColors: c.customCardColors || false,
                            cardOmbreStart: c.cardOmbreStart || "",
                            cardOmbreEnd: c.cardOmbreEnd || "",
                            cardHeaderColor: c.cardHeaderColor || "",
                            cardDescriptionColor: c.cardDescriptionColor || "",
                            cardThemeMode: c.cardThemeMode || "auto",
                          }))
                      ).map((collection: any, index: number) => {
                        const isLight = isCollectionCardLight(collection);
                        const custom = !!collection.customCardColors;
                        const cardStart = (custom && collection.cardOmbreStart) ? collection.cardOmbreStart : (collection.ombreStart || '#f472b6');
                        const cardEnd = (custom && collection.cardOmbreEnd) ? collection.cardOmbreEnd : (collection.ombreEnd || '#000000');
                        const defaultTitleColor = isLight ? '#171717' : '#ffffff';
                        const defaultDescColor = isLight ? '#525252' : '#e5e5e5';
                        const titleColor = (custom && collection.cardHeaderColor) ? collection.cardHeaderColor : (collection.headerColor || defaultTitleColor);
                        const descColor = (custom && collection.cardDescriptionColor) ? collection.cardDescriptionColor : (collection.descriptionColor || defaultDescColor);

                        return (
                          <div key={collection.tag} className="relative group">
                            {editMode && adminUser && (
                              <div className="absolute top-3 left-3 z-20 flex gap-1">
                                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveRibbon(index, -1); }} className="bg-black text-white p-2 rounded-full hover:bg-neutral-800 shadow-md transition-transform hover:scale-110 disabled:opacity-50" disabled={index === 0} title="Move Left">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                                </button>
                                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveRibbon(index, 1); }} className="bg-black text-white p-2 rounded-full hover:bg-neutral-800 shadow-md transition-transform hover:scale-110 disabled:opacity-50" disabled={index === ribbonCollections.length - 1} title="Move Right">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                                </button>
                              </div>
                            )}
                            <Link 
                              href={`/collections/${collection.tag}`} 
                              className={`relative h-64 sm:h-80 lg:h-96 rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-lg block transform transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl z-0 ${isLight ? 'border border-pink-200/80 shadow-pink-100/40' : 'border border-pink-100/20'}`}
                            >
                              <div 
                                className="absolute inset-0 transition duration-700 group-hover:scale-105" 
                                style={{ background: `linear-gradient(to bottom right, ${cardStart}, ${cardEnd})` }}
                              >
                                {(collection.cardImageUrl || collection.backgroundImageUrl) && (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div style={{ transform: `scale(${((collection.cardImageUrl ? collection.cardBgScale : collection.bgScale) || 100) / 100})`, width: '100%', height: '100%', position: 'relative' }}>
                                      <Image 
                                        src={collection.cardImageUrl || collection.backgroundImageUrl} 
                                        alt={collection.title || "Background"} 
                                        fill 
                                        className={`object-contain transition-opacity ${isLight ? 'opacity-40 mix-blend-multiply' : 'opacity-60 mix-blend-overlay'}`} 
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Adaptive Bottom Fade Overlay */}
                              {isLight ? (
                                <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-white/95 via-white/50 to-transparent pointer-events-none"></div>
                              ) : (
                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none"></div>
                              )}

                              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 flex flex-col justify-end h-full z-10 pointer-events-none">
                                <span className={`font-brand font-bold text-[10px] tracking-widest uppercase mb-1 ${isLight ? 'text-pink-600' : 'text-pink-300 drop-shadow-md'}`}>
                                  Collection
                                </span>
                                <h3 
                                  className={`text-2xl sm:text-3xl font-brand font-bold mb-1.5 leading-tight tracking-tight ${isLight ? 'drop-shadow-none' : 'drop-shadow-lg'}`} 
                                  style={{ color: titleColor }}
                                >
                                  {collection.title}
                                </h3>
                                <p 
                                  className={`font-brand font-normal line-clamp-2 text-xs sm:text-sm ${isLight ? 'drop-shadow-none' : 'drop-shadow-sm'}`} 
                                  style={{ color: descColor }}
                                >
                                  {collection.description || "View this collection →"}
                                </p>
                              </div>
                            </Link>
                            {editMode && adminUser && (
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditData({ ...collection }); setEditorTab('card'); setShowEditor(true); }}
                                className="absolute top-3 right-3 z-20 bg-black/70 hover:bg-black text-white p-2.5 rounded-full shadow-lg transition-transform hover:scale-110"
                                title="Edit Collection"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                              </button>
                            )}
                          </div>
                        );
                      })}

                        {editMode && adminUser && (
                          <div 
                            onClick={() => setShowFeaturePicker(true)}
                            className="h-64 sm:h-80 lg:h-96 rounded-2xl sm:rounded-[2rem] border-2 border-dashed border-pink-300 hover:border-pink-500 bg-pink-50/50 hover:bg-pink-100 cursor-pointer flex flex-col items-center justify-center transition-all group shadow-sm hover:shadow-md"
                          >
                            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform mb-3 sm:mb-4">
                              <span className="text-2xl sm:text-3xl text-pink-500 font-light">+</span>
                            </div>
                            <span className="font-bold text-pink-500 uppercase tracking-widest text-xs sm:text-sm text-center px-4">Add Featured<br/>Collection</span>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              )}

              {/* Section Divider */}
              <div className="max-w-xs mx-auto h-px bg-gradient-to-r from-transparent via-pink-300 to-transparent"></div>

              {/* New Arrivals */}
                {products.length > 0 && (
                  <div className="py-6 sm:py-12 px-4 sm:px-6 w-full relative z-20">
                    <div className="max-w-7xl mx-auto">
                      <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end mb-5 sm:mb-8 gap-4">
                        <div className="text-center sm:text-left w-full">
                          {editMode ? (
                            <div className="w-full flex flex-col gap-2">
                              <div className="flex items-center gap-2 justify-center sm:justify-start">
                                <span className="text-[10px] uppercase font-brand font-bold text-pink-400">Eyebrow:</span>
                                <input 
                                  type="text" 
                                  value={homeContent.newArrivalsEyebrow || "Fresh From Studio"} 
                                  onChange={e => setHomeContent(prev => ({...prev, newArrivalsEyebrow: e.target.value}))} 
                                  onBlur={async (e) => { 
                                    const vendorUid = VENDOR_UID; 
                                    await setDoc(doc(db, "users", vendorUid, "store_settings", "home_content"), { newArrivalsEyebrow: e.target.value }, { merge: true }); 
                                  }} 
                                  className="relative z-50 ring-2 ring-pink-500 rounded px-2 py-1 bg-pink-50/80 font-brand font-bold text-xs uppercase tracking-widest text-[#FF5C9D] w-56 text-center sm:text-left outline-none"
                                />
                              </div>
                              <input 
                                type="text" 
                                value={homeContent.newArrivalsTitle.replace(/<br\/>/g, ' ')} 
                                onChange={e => setHomeContent(prev => ({...prev, newArrivalsTitle: e.target.value}))} 
                                onBlur={async (e) => { 
                                    const vendorUid = VENDOR_UID; 
                                    await setDoc(doc(db, "users", vendorUid, "store_settings", "home_content"), { newArrivalsTitle: e.target.value }, { merge: true }); 
                                  }} 
                                className="relative z-50 ring-2 ring-pink-500 rounded-xl p-2 bg-pink-50/80 font-brand font-bold text-2xl sm:text-4xl tracking-tight text-neutral-900 text-center sm:text-left w-full outline-none"
                              />
                              <textarea 
                                value={homeContent.newArrivalsSubtitle.replace(/<br\/>/g, '\n')} 
                                onChange={e => setHomeContent(prev => ({...prev, newArrivalsSubtitle: e.target.value}))} 
                                onBlur={async (e) => { 
                                  const vendorUid = VENDOR_UID; 
                                  await setDoc(doc(db, "users", vendorUid, "store_settings", "home_content"), { newArrivalsSubtitle: e.target.value.replace(/\n/g, '<br/>') }, { merge: true }); 
                                }} 
                                className="relative z-50 ring-2 ring-pink-500 rounded-xl p-2 bg-pink-50/80 font-brand text-neutral-500 font-normal text-xs sm:text-sm text-center sm:text-left w-full resize-none outline-none"
                                rows={2}
                              />
                            </div>
                          ) : (
                            <>
                              <span className="font-brand font-bold text-[11px] sm:text-xs text-[#FF5C9D] uppercase tracking-widest block mb-1">
                                {homeContent.newArrivalsEyebrow || "Fresh From Studio"}
                              </span>
                              <h2 
                                className="font-brand font-bold text-2xl sm:text-4xl text-neutral-900 mb-1 sm:mb-1.5 tracking-tight"
                                dangerouslySetInnerHTML={{ __html: homeContent.newArrivalsTitle }}
                              />
                              <p 
                                className="font-brand text-neutral-500 font-normal text-xs sm:text-sm"
                                dangerouslySetInnerHTML={{ __html: homeContent.newArrivalsSubtitle }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6">
                        {(() => {
                          let actualIds = (homeContent.featuredProductIds && homeContent.featuredProductIds.length > 0)
                            ? [...homeContent.featuredProductIds]
                            : products.slice(0, 10).map(p => p.id);
                          
                          if (editMode) {
                            while(actualIds.length < 10) actualIds.push("");
                          }

                          if (editMode) {
                            return actualIds.slice(0, 10).map((prodId, i) => {
                              const product = prodId ? products.find(p => p.id === prodId) : null;
                              if (product) {
                                return (
                                  <div key={`slot-${i}`} className="bg-white/70 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm border border-pink-500 ring-2 ring-pink-500/20 flex flex-col relative group">
                                    <div className="absolute top-2 left-2 z-30 flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveArrival(i, -1); }} disabled={i === 0} className="bg-black text-white p-2 rounded-full hover:bg-neutral-800 shadow-md disabled:opacity-50" title="Move Left"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></button>
                                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveArrival(i, 1); }} disabled={i === 9} className="bg-black text-white p-2 rounded-full hover:bg-neutral-800 shadow-md disabled:opacity-50" title="Move Right"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></button>
                                    </div>
                                    <div className="absolute top-2 right-2 flex gap-1 z-30 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPickerSlotIndex(i); }} className="bg-black text-white p-2 rounded-full hover:bg-neutral-800 shadow-md" title="Swap Design"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg></button>
                                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmRemoveSlot(i); }} className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-md" title="Remove"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                                    </div>
                                    <div className="relative aspect-square overflow-hidden rounded-xl sm:rounded-2xl bg-pink-50 mb-2.5 sm:mb-3 cursor-pointer" onClick={() => setEditingProduct(product)}>
                                      <Image src={product.imagePath} alt={product.name} fill className="object-cover" sizes="(max-width: 640px) 50vw, 20vw" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity text-white font-bold text-xs uppercase tracking-widest backdrop-blur-sm">Edit Data</div>
                                    </div>
                                    <div className="flex flex-col flex-grow px-1 text-center">
                                      <h3 className="text-xs sm:text-sm font-brand font-bold text-neutral-900 truncate mb-0.5">{product.name}</h3>
                                      <p className="font-brand font-bold text-[11px] sm:text-xs text-[#FF5C9D]">{product.priceOnAsk ? "POA" : `€${product.basePrice.toFixed(2)}`}</p>
                                    </div>
                                  </div>
                                );
                              } else {
                                return (
                                  <div key={`slot-${i}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPickerSlotIndex(i); }} className="border-2 border-dashed border-pink-300 flex flex-col items-center justify-center cursor-pointer h-full min-h-[180px] sm:min-h-[220px] rounded-2xl sm:rounded-3xl bg-pink-50/50 hover:bg-pink-100 transition shadow-sm hover:shadow-md group">
                                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform mb-2 sm:mb-3">
                                      <span className="text-xl sm:text-2xl text-pink-500 font-light">+</span>
                                    </div>
                                    <span className="text-pink-500 font-brand font-bold text-[10px] uppercase tracking-widest text-center px-2 sm:px-4">Select<br/>Design</span>
                                  </div>
                                );
                              }
                            });
                          } else {
                            const displayProducts = actualIds.map(id => products.find(p => p.id === id)).filter(Boolean);
                            return displayProducts.map((product: any) => (
                              <div key={product.id} id={`product-${product.id}`} className="bg-white/70 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm border border-pink-100/60 flex flex-col group relative transform transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                                {!editMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleWishlist(product);
                        }}
                        className={`absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all backdrop-blur-md cursor-pointer ${
                          isWishlisted(product.id)
                            ? 'bg-pink-500 text-white shadow-md scale-105'
                            : 'bg-white/80 text-neutral-600 hover:text-pink-500 hover:bg-white shadow-sm'
                        }`}
                        title={isWishlisted(product.id) ? "Remove from wishlist" : "Save to wishlist"}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isWishlisted(product.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isWishlisted(product.id) ? 0 : 2} className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                        </svg>
                      </button>
                    )}
                    {product.isPromo && (
                                  <div className="absolute top-4 left-4 bg-[#FF5C9D] text-white text-[8px] sm:text-[9px] font-brand font-bold px-2.5 py-1 rounded-full z-10 shadow-sm uppercase tracking-widest">PROMO</div>
                                )}
                                <div className="relative aspect-square overflow-hidden rounded-xl sm:rounded-2xl bg-pink-50 cursor-pointer mb-3 sm:mb-4 group/cardimg" onClick={() => openDrawer(product)}>
                                  <Image 
                                    src={product.imagePath} 
                                    alt={product.name} 
                                    fill 
                                    className={`object-cover transition-all duration-700 ease-out group-hover:scale-110 ${product.additionalImages && product.additionalImages.length > 0 ? 'lg:group-hover:opacity-0' : ''}`} 
                                    sizes="(max-width: 640px) 50vw, 20vw" 
                                  />
                                  {product.additionalImages && product.additionalImages.length > 0 && (
                                    <Image 
                                      src={product.additionalImages[0]} 
                                      alt={`${product.name} alternate angle`} 
                                      fill 
                                      className="object-cover transition-all duration-700 ease-out opacity-0 lg:group-hover:opacity-100 lg:group-hover:scale-110" 
                                      sizes="(max-width: 640px) 50vw, 20vw" 
                                    />
                                  )}
                                  {/* Mobile multi-photo indicator */}
                                  {product.additionalImages && product.additionalImages.length > 0 && (
                                    <div className="absolute bottom-2 right-2 z-10 bg-black/60 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 lg:hidden">
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                                      <span>{product.additionalImages.length + 1}</span>
                                    </div>
                                  )}</div>
                                <div className="flex flex-col flex-grow px-0.5">
                                  <h3 className="text-xs sm:text-sm font-brand font-bold text-neutral-900 truncate mb-0.5 sm:mb-1">{product.name}</h3>
                                  <p className={`font-brand font-bold text-xs sm:text-sm mb-2.5 sm:mb-4 ${product.priceOnAsk ? 'text-[#FF5C9D]' : 'text-neutral-500'}`}>
                                    {product.priceOnAsk ? "Price on Ask" : `€${product.basePrice.toFixed(2)}`}
                                  </p>
                                  <div className="mt-auto">
                                    <button onClick={() => openDrawer(product)} className="w-full bg-white text-neutral-900 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[9px] sm:text-[10px] font-brand font-bold transition-all hover:bg-neutral-900 hover:text-white uppercase tracking-wider border border-pink-100 shadow-sm">Select Options</button>
                                  </div>
                                </div>
                              </div>
                            ));
                          }
                        })()}
                      </div>
                      
                      <div className="mt-6 sm:mt-12 flex justify-center z-30 relative">
                        <Link href="/collections/all" className="bg-neutral-900 text-white px-8 sm:px-10 py-3.5 sm:py-4 rounded-full font-brand font-bold text-xs hover:bg-[#FF5C9D] uppercase tracking-wider transition-all hover:scale-105 shadow-lg shadow-neutral-900/10 hover:shadow-pink-500/20">View All Designs →</Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section Divider */}
                <div className="max-w-xs mx-auto h-px bg-gradient-to-r from-transparent via-pink-300 to-transparent my-4"></div>

                {/* Studio Specials: Bundles, Mystery Boxes & UnHollyNails Club */}
                <div className="py-6 sm:py-12 px-4 sm:px-6 w-full relative z-20">
                  <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-6 sm:mb-10">
                      <span className="font-brand font-bold text-[11px] sm:text-xs text-[#FF5C9D] uppercase tracking-widest block mb-1">
                        Bespoke Experiences
                      </span>
                      <h2 className="font-brand font-bold text-2xl sm:text-4xl text-neutral-900 mb-1.5 tracking-tight">
                        Bundles, Mystery Boxes & The Club
                      </h2>
                      <p className="font-brand text-neutral-500 font-normal text-xs sm:text-sm max-w-md mx-auto">
                        Curated matching gift boxes, surprise bespoke artistry, and member rewards.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
                      {/* Card 1: Bundles */}
                      <Link href="/bundles" className="group bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-7 shadow-sm border border-pink-100/80 hover:border-pink-300 hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <span className="bg-pink-100 text-pink-700 text-[10px] font-brand font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                              Matching Sets
                            </span>
                            <span className="font-brand font-bold text-xs text-[#FF5C9D]">From €55</span>
                          </div>
                          <h3 className="font-brand font-bold text-xl text-neutral-900 group-hover:text-[#FF5C9D] transition-colors mb-2">
                            UnHollyNails Bundles
                          </h3>
                          <p className="font-brand text-xs text-neutral-600 leading-relaxed mb-4">
                            The Mini Me matching pack for you & your little bestie, or the Ultimate Luxury Box with custom press-ons, matching keychain, earrings & treats!
                          </p>
                        </div>
                        <span className="font-brand font-bold text-xs text-[#FF5C9D] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          Explore Bundles →
                        </span>
                      </Link>

                      {/* Card 2: Mystery Boxes */}
                      <Link href="/mystery-boxes" className="group bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-7 shadow-sm border border-pink-100/80 hover:border-pink-300 hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <span className="bg-pink-100 text-pink-700 text-[10px] font-brand font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                              Surprise Artistry
                            </span>
                            <span className="font-brand font-bold text-xs text-[#FF5C9D]">From €25</span>
                          </div>
                          <h3 className="font-brand font-bold text-xl text-neutral-900 group-hover:text-[#FF5C9D] transition-colors mb-2">
                            Mystery Boxes
                          </h3>
                          <p className="font-brand text-xs text-neutral-600 leading-relaxed mb-4">
                            Can&apos;t pick a design? Leave it to Holly! Available in pre-sized adult sets or safe kids&apos; mini boxes with goodies & discount scratchers.
                          </p>
                        </div>
                        <span className="font-brand font-bold text-xs text-[#FF5C9D] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          Discover Mystery Boxes →
                        </span>
                      </Link>

                      {/* Card 3: UnHollyNails Club */}
                      <Link href="/club" className="group bg-gradient-to-br from-neutral-950 via-neutral-900 to-pink-950/60 rounded-2xl sm:rounded-3xl p-6 sm:p-7 shadow-lg border border-pink-500/30 text-white hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <span className="bg-[#FF5C9D] text-white text-[10px] font-brand font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                              Free Birthday Set
                            </span>
                            <span className="font-brand font-bold text-xs text-pink-300">Club Perks</span>
                          </div>
                          <h3 className="font-brand font-bold text-xl text-white group-hover:text-pink-300 transition-colors mb-2">
                            UnHollyNails Club!
                          </h3>
                          <p className="font-brand text-xs text-neutral-300 leading-relaxed mb-4">
                            Every client with an account is a member! Earn digital stamps on your loyalty card, unlock free delivery & bespoke gifts, and celebrate with birthday treats.
                          </p>
                        </div>
                        <span className="font-brand font-bold text-xs text-[#FF5C9D] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          Join The Club →
                        </span>
                      </Link>
                    </div>

                    {/* Quick Studio Nav Banner */}
                    <div className="mt-8 p-5 sm:p-6 bg-white/60 backdrop-blur-md rounded-2xl border border-pink-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                      <div>
                        <span className="font-brand font-bold text-xs text-neutral-900 block mb-0.5">Need sizing help or want to see full pricing?</span>
                        <p className="font-brand text-[11px] text-neutral-500">Check out Holly&apos;s complete price list, sizing guides, and turnaround policies.</p>
                      </div>
                      <div className="flex flex-wrap gap-2.5 justify-center">
                        <Link href="/menu" className="bg-white border border-pink-200 text-neutral-900 px-4 py-2 rounded-full font-brand font-bold text-xs hover:border-[#FF5C9D] hover:text-[#FF5C9D] transition-colors">
                          Price Menu
                        </Link>
                        <Link href="/guides" className="bg-white border border-pink-200 text-neutral-900 px-4 py-2 rounded-full font-brand font-bold text-xs hover:border-[#FF5C9D] hover:text-[#FF5C9D] transition-colors">
                          Sizing & Care
                        </Link>
                        <Link href="/policies" className="bg-white border border-pink-200 text-neutral-900 px-4 py-2 rounded-full font-brand font-bold text-xs hover:border-[#FF5C9D] hover:text-[#FF5C9D] transition-colors">
                          Store Policies
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
  
          

        

        

        </main>

      </div>{/* end z-10 wrapper */}

      {selectedProduct && !editMode && (
        <ProductDetailDrawer
          product={selectedProduct}
          onClose={closeDrawer}
          currentUser={currentUser}
          clientProfile={clientProfile}
          onOpenLightbox={openLightbox}
          onOpenShapeGuide={() => setShowShapeGuide(true)}
        />
      )}
    

        {/* Collection Feature Picker Modal */}
        {showFeaturePicker && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowFeaturePicker(false)} />
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden text-black animate-slide-up flex flex-col max-h-[80vh]">
              <div className="bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <h2 className="font-brand font-bold text-lg tracking-tight text-neutral-900 uppercase">Feature Collection</h2>
                <button onClick={() => setShowFeaturePicker(false)} className="text-neutral-400 hover:text-black text-2xl font-bold leading-none">&times;</button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 bg-neutral-50">
                {allCollections.filter(c => !c.isFeatured && c.tag !== '--ribbon_layout--').length === 0 ? (
                  <div className="text-center p-8 text-neutral-400 font-medium">All available collections are already featured.</div>
                ) : (
                  <div className="space-y-2">
                    {allCollections.filter(c => !c.isFeatured && c.tag !== '--ribbon_layout--').map(c => (
                      <button
                        key={c.tag}
                        onClick={async () => {
                          const vendorUid = VENDOR_UID;
                          const canonical = ['sets', 'minis', 'keychains', 'earrings', 'accessories', 'basics', 'special-offers', 'all'].includes(c.tag.toLowerCase()) ? c.tag.toLowerCase() : c.tag;
                          await setDoc(doc(db, 'users', vendorUid, 'collection_settings', canonical), { isFeatured: true }, { merge: true });
                          const updated = { ...c, tag: canonical, isFeatured: true };
                          setRibbonCollections((prev: any) => [...prev.filter((item: any) => item.tag.toLowerCase() !== canonical), updated]);
                          setAllCollections((prev: any) => prev.map((item: any) => item.tag.toLowerCase() === canonical ? updated : item));
                          setShowFeaturePicker(false);
                        }}
                        className="w-full text-left p-4 bg-white border rounded-xl hover:border-pink-300 hover:bg-pink-50 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <h3 className="font-bold text-lg">{c.title || c.tag}</h3>
                          {c.description && <p className="text-xs text-neutral-500 line-clamp-1">{c.description}</p>}
                        </div>
                        <span className="text-pink-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Add +</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Collection Inline Theme Editor Modal */}
        {showEditor && editData && (() => {
          const isEditPageLight = (() => {
            if (editData.themeMode === 'light') return true;
            if (editData.themeMode === 'dark') return false;
            const sLum = getColorLuminance(editData.ombreStart || '#f472b6');
            const eLum = getColorLuminance(editData.ombreEnd || '#000000');
            return ((sLum + eLum) / 2) > 128 || sLum > 160 || eLum > 160;
          })();

          const isEditCardLight = isCollectionCardLight(editData);
          const editCardCustom = !!editData.customCardColors;
          const editCardStart = (editCardCustom && editData.cardOmbreStart) ? editData.cardOmbreStart : (editData.ombreStart || '#f472b6');
          const editCardEnd = (editCardCustom && editData.cardOmbreEnd) ? editData.cardOmbreEnd : (editData.ombreEnd || '#000000');
          const editCardTitle = (editCardCustom && editData.cardHeaderColor) ? editData.cardHeaderColor : (editData.headerColor || (isEditCardLight ? '#171717' : '#ffffff'));
          const editCardDesc = (editCardCustom && editData.cardDescriptionColor) ? editData.cardDescriptionColor : (editData.descriptionColor || (isEditCardLight ? '#525252' : '#e5e5e5'));

          return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowEditor(false)} />
              <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden text-black animate-slide-up flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-white border-b px-6 py-4 flex items-center justify-between z-10 shrink-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-brand font-bold text-lg tracking-tight text-neutral-900 uppercase">Edit Collection</h2>
                    <span className="text-[10px] font-mono font-bold bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full">{editData.tag}</span>
                  </div>
                  <button onClick={() => setShowEditor(false)} className="text-neutral-400 hover:text-black text-2xl font-bold leading-none">&times;</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b bg-neutral-50 px-6 gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditorTab('card')}
                    className={`py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                      editorTab === 'card'
                        ? 'border-pink-500 text-pink-600 bg-white -mb-px rounded-t-lg'
                        : 'border-transparent text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    <span>Featured Card</span>
                    {editData.customCardColors && (
                      <span className="w-2 h-2 rounded-full bg-pink-500" title="Custom card colors active" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('page')}
                    className={`py-3 px-3 text-xs font-bold border-b-2 transition-all ${
                      editorTab === 'page'
                        ? 'border-pink-500 text-pink-600 bg-white -mb-px rounded-t-lg'
                        : 'border-transparent text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    <span>Collection Page Theme</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('info')}
                    className={`py-3 px-3 text-xs font-bold border-b-2 transition-all ${
                      editorTab === 'info'
                        ? 'border-pink-500 text-pink-600 bg-white -mb-px rounded-t-lg'
                        : 'border-transparent text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    <span>Title & Info</span>
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                  {editorTab === 'card' && (
                    <div className="space-y-6">
                      {/* Live Card Preview */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Live Card Preview</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isEditCardLight ? 'bg-amber-100 text-amber-800' : 'bg-neutral-800 text-neutral-200'}`}>
                            {isEditCardLight ? 'Light Theme Card' : 'Dark Theme Card'}
                          </span>
                        </div>
                        <div 
                          className={`relative h-44 rounded-2xl overflow-hidden shadow-md flex flex-col justify-end p-5 transition-all ${isEditCardLight ? 'border border-pink-200' : 'border border-neutral-800'}`}
                          style={{ background: `linear-gradient(to bottom right, ${editCardStart}, ${editCardEnd})` }}
                        >
                          {(editData.cardImageUrl || editData.backgroundImageUrl) && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div style={{ transform: `scale(${((editData.cardImageUrl ? editData.cardBgScale : editData.bgScale) || 100) / 100})`, width: '100%', height: '100%', position: 'relative' }}>
                                <Image 
                                  src={editData.cardImageUrl || editData.backgroundImageUrl} 
                                  alt="Preview" 
                                  fill 
                                  className={`object-contain ${isEditCardLight ? 'opacity-40 mix-blend-multiply' : 'opacity-60 mix-blend-overlay'}`} 
                                />
                              </div>
                            </div>
                          )}

                          {isEditCardLight ? (
                            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-white/95 via-white/50 to-transparent pointer-events-none"></div>
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none"></div>
                          )}

                          <div className="relative z-10 pointer-events-none">
                            <span className={`text-[9px] font-bold uppercase tracking-wider block mb-0.5 ${isEditCardLight ? 'text-pink-600' : 'text-pink-300 drop-shadow-md'}`}>
                              Collection
                            </span>
                            <h4 
                              className={`text-lg font-brand font-bold leading-tight ${isEditCardLight ? 'drop-shadow-none' : 'drop-shadow-lg'}`}
                              style={{ color: editCardTitle }}
                            >
                              {editData.title || 'Collection Title'}
                            </h4>
                            <p 
                              className={`text-xs font-brand line-clamp-1 mt-0.5 ${isEditCardLight ? 'drop-shadow-none' : 'drop-shadow-sm'}`}
                              style={{ color: editCardDesc }}
                            >
                              {editData.description || 'Collection description preview'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Toggle Independent Card Theming */}
                      <div className="bg-pink-50/60 border border-pink-200/80 rounded-2xl p-4">
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!editData.customCardColors}
                            onChange={e => {
                              const checked = e.target.checked;
                              setEditData((p: any) => ({
                                ...p,
                                customCardColors: checked,
                                ...(checked && !p.cardOmbreStart ? {
                                  cardOmbreStart: p.ombreStart || '#f472b6',
                                  cardOmbreEnd: p.ombreEnd || '#000000',
                                  cardHeaderColor: p.headerColor || '',
                                  cardDescriptionColor: p.descriptionColor || '',
                                  cardThemeMode: p.themeMode || 'auto'
                                } : {})
                              }));
                            }}
                            className="mt-0.5 w-4 h-4 rounded text-pink-600 focus:ring-pink-500 border-neutral-300 accent-pink-600 cursor-pointer"
                          />
                          <div>
                            <span className="block text-xs font-bold text-neutral-900 uppercase">Customize Featured Card Colors Separately</span>
                            <span className="block text-[11px] text-neutral-600 mt-0.5">
                              {editData.customCardColors 
                                ? 'Card is using separate colors from the collection page.'
                                : 'Card currently inherits colors directly from the collection page theme.'}
                            </span>
                          </div>
                        </label>
                      </div>

                      {/* Card Color Controls (Shown when custom is enabled) */}
                      {editData.customCardColors && (
                        <div className="space-y-4 pt-1">
                          {/* Card Presets */}
                          <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Card Quick Presets</label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setEditData((p: any) => ({
                                  ...p,
                                  cardOmbreStart: '#ffffff',
                                  cardOmbreEnd: '#ffffff',
                                  cardHeaderColor: '#171717',
                                  cardDescriptionColor: '#4b5563',
                                  cardThemeMode: 'light'
                                }))}
                                className="flex items-center gap-2 p-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition shadow-sm text-left"
                              >
                                <span className="w-5 h-5 rounded-full border border-neutral-300 bg-white inline-block shrink-0 shadow-inner"></span>
                                <span>Pure White</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditData((p: any) => ({
                                  ...p,
                                  cardOmbreStart: '#fce7f3',
                                  cardOmbreEnd: '#fdf2f8',
                                  cardHeaderColor: '#171717',
                                  cardDescriptionColor: '#4b5563',
                                  cardThemeMode: 'light'
                                }))}
                                className="flex items-center gap-2 p-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition shadow-sm text-left"
                              >
                                <span className="w-5 h-5 rounded-full border border-pink-200 bg-pink-100 inline-block shrink-0"></span>
                                <span>Soft Pink</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditData((p: any) => ({
                                  ...p,
                                  cardOmbreStart: '#fbcfe8',
                                  cardOmbreEnd: '#ffffff',
                                  cardHeaderColor: '#171717',
                                  cardDescriptionColor: '#4b5563',
                                  cardThemeMode: 'light'
                                }))}
                                className="flex items-center gap-2 p-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition shadow-sm text-left"
                              >
                                <span className="w-5 h-5 rounded-full bg-gradient-to-r from-pink-300 to-white inline-block shrink-0 shadow-inner"></span>
                                <span>Pink to White</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditData((p: any) => ({
                                  ...p,
                                  cardOmbreStart: '#f472b6',
                                  cardOmbreEnd: '#000000',
                                  cardHeaderColor: '#ffffff',
                                  cardDescriptionColor: '#e5e5e5',
                                  cardThemeMode: 'dark'
                                }))}
                                className="flex items-center gap-2 p-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition shadow-sm text-left"
                              >
                                <span className="w-5 h-5 rounded-full bg-gradient-to-r from-pink-400 to-black inline-block shrink-0"></span>
                                <span>Unholly Ombre</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditData((p: any) => ({
                                  ...p,
                                  cardOmbreStart: '#262626',
                                  cardOmbreEnd: '#0a0a0a',
                                  cardHeaderColor: '#ffffff',
                                  cardDescriptionColor: '#d4d4d4',
                                  cardThemeMode: 'dark'
                                }))}
                                className="col-span-2 flex items-center gap-2 p-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition shadow-sm text-left"
                              >
                                <span className="w-5 h-5 rounded-full bg-neutral-900 inline-block shrink-0"></span>
                                <span>Charcoal Luxe</span>
                              </button>
                            </div>
                          </div>

                          {/* Card Ombre Inputs */}
                          <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Card Ombre Gradient</label>
                            <div className="flex items-center gap-3 bg-neutral-50 p-3 rounded-2xl border">
                              <input 
                                type="color" 
                                value={editData.cardOmbreStart || editData.ombreStart || '#f472b6'} 
                                onChange={e => setEditData((p: any) => ({ ...p, cardOmbreStart: e.target.value }))} 
                                className="w-9 h-9 rounded cursor-pointer border-0 p-0" 
                              />
                              <div 
                                className="flex-1 h-8 rounded-lg shadow-inner" 
                                style={{ background: `linear-gradient(to right, ${editData.cardOmbreStart || editData.ombreStart || '#f472b6'}, ${editData.cardOmbreEnd || editData.ombreEnd || '#000000'})` }}
                              />
                              <input 
                                type="color" 
                                value={editData.cardOmbreEnd || editData.ombreEnd || '#000000'} 
                                onChange={e => setEditData((p: any) => ({ ...p, cardOmbreEnd: e.target.value }))} 
                                className="w-9 h-9 rounded cursor-pointer border-0 p-0" 
                              />
                            </div>
                          </div>

                          {/* Card Contrast Mode */}
                          <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Card Contrast Mode</label>
                            <div className="grid grid-cols-3 gap-2">
                              <button
                                type="button"
                                onClick={() => setEditData((p: any) => ({ ...p, cardThemeMode: 'auto' }))}
                                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${(editData.cardThemeMode || 'auto') === 'auto' ? 'bg-black text-white border-black' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'}`}
                              >
                                <span>Auto Detect</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditData((p: any) => ({ ...p, cardThemeMode: 'light' }))}
                                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${editData.cardThemeMode === 'light' ? 'bg-black text-white border-black' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'}`}
                              >
                                <span>Light Mode</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditData((p: any) => ({ ...p, cardThemeMode: 'dark' }))}
                                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${editData.cardThemeMode === 'dark' ? 'bg-black text-white border-black' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'}`}
                              >
                                <span>Dark Mode</span>
                              </button>
                            </div>
                          </div>

                          {/* Card Title & Desc Colors */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-neutral-500 uppercase mb-1.5">Card Title Color</label>
                              <div className="flex items-center gap-2 border border-neutral-200 rounded-xl p-2 bg-neutral-50">
                                <input
                                  type="color"
                                  value={editData.cardHeaderColor || (isEditCardLight ? '#171717' : '#ffffff')}
                                  onChange={e => setEditData((p: any) => ({ ...p, cardHeaderColor: e.target.value }))}
                                  className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
                                />
                                <input
                                  type="text"
                                  value={editData.cardHeaderColor || (isEditCardLight ? '#171717' : '#ffffff')}
                                  onChange={e => setEditData((p: any) => ({ ...p, cardHeaderColor: e.target.value }))}
                                  className="w-full text-xs font-mono font-medium uppercase bg-transparent outline-none"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-neutral-500 uppercase mb-1.5">Card Desc Color</label>
                              <div className="flex items-center gap-2 border border-neutral-200 rounded-xl p-2 bg-neutral-50">
                                <input
                                  type="color"
                                  value={editData.cardDescriptionColor || (isEditCardLight ? '#525252' : '#e5e5e5')}
                                  onChange={e => setEditData((p: any) => ({ ...p, cardDescriptionColor: e.target.value }))}
                                  className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
                                />
                                <input
                                  type="text"
                                  value={editData.cardDescriptionColor || (isEditCardLight ? '#525252' : '#e5e5e5')}
                                  onChange={e => setEditData((p: any) => ({ ...p, cardDescriptionColor: e.target.value }))}
                                  className="w-full text-xs font-mono font-medium uppercase bg-transparent outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Card Image */}
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Home Page Card Image</label>
                        <div className="border-2 border-dashed rounded-2xl p-4 bg-neutral-50 space-y-3">
                          {editData.cardImageUrl && (
                            <>
                              <div className="relative w-full h-24 rounded-xl overflow-hidden shadow-sm">
                                <Image src={editData.cardImageUrl} alt="Card" fill className="object-contain" />
                              </div>
                              <button onClick={(e) => { e.preventDefault(); setEditData((p: any) => ({ ...p, cardImageUrl: "" })); if(cardBgFileRef.current) cardBgFileRef.current.value = ""; }} className="text-red-500 text-xs font-bold mt-1 block">Remove Image</button>
                            </>
                          )}
                          <input type="file" ref={cardBgFileRef} accept="image/*" className="text-sm w-full font-medium file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100" />
                          <div>
                            <label className="block text-xs font-bold text-neutral-500 mb-1">Scale: {editData.cardBgScale || editData.bgScale || 100}%</label>
                            <input type="range" min="10" max="300" value={editData.cardBgScale || editData.bgScale || 100} onChange={e => setEditData((p: any) => ({ ...p, cardBgScale: parseInt(e.target.value) }))} className="w-full accent-pink-500" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {editorTab === 'page' && (
                    <div className="space-y-5">
                      <div className="bg-neutral-50 border rounded-2xl p-3.5 text-xs text-neutral-600">
                        These theme settings style the dedicated collection page (<span className="font-mono text-neutral-800">/collections/{editData.tag}</span>).
                      </div>

                      {/* Page Presets */}
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Page Quick Presets</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setEditData((p: any) => ({
                              ...p,
                              ombreStart: '#ffffff',
                              ombreEnd: '#ffffff',
                              headerColor: '#171717',
                              descriptionColor: '#4b5563',
                              themeMode: 'light'
                            }))}
                            className="flex items-center gap-2 p-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition shadow-sm text-left"
                          >
                            <span className="w-5 h-5 rounded-full border border-neutral-300 bg-white inline-block shrink-0 shadow-inner"></span>
                            <span>Pure White</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditData((p: any) => ({
                              ...p,
                              ombreStart: '#fce7f3',
                              ombreEnd: '#fdf2f8',
                              headerColor: '#171717',
                              descriptionColor: '#4b5563',
                              themeMode: 'light'
                            }))}
                            className="flex items-center gap-2 p-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition shadow-sm text-left"
                          >
                            <span className="w-5 h-5 rounded-full border border-pink-200 bg-pink-100 inline-block shrink-0"></span>
                            <span>Soft Pink</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditData((p: any) => ({
                              ...p,
                              ombreStart: '#fbcfe8',
                              ombreEnd: '#ffffff',
                              headerColor: '#171717',
                              descriptionColor: '#4b5563',
                              themeMode: 'light'
                            }))}
                            className="flex items-center gap-2 p-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition shadow-sm text-left"
                          >
                            <span className="w-5 h-5 rounded-full bg-gradient-to-r from-pink-300 to-white inline-block shrink-0 shadow-inner"></span>
                            <span>Pink to White</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditData((p: any) => ({
                              ...p,
                              ombreStart: '#f472b6',
                              ombreEnd: '#000000',
                              headerColor: '#ffffff',
                              descriptionColor: '#e5e5e5',
                              themeMode: 'dark'
                            }))}
                            className="flex items-center gap-2 p-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition shadow-sm text-left"
                          >
                            <span className="w-5 h-5 rounded-full bg-gradient-to-r from-pink-400 to-black inline-block shrink-0"></span>
                            <span>Unholly Ombre</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditData((p: any) => ({
                              ...p,
                              ombreStart: '#262626',
                              ombreEnd: '#0a0a0a',
                              headerColor: '#ffffff',
                              descriptionColor: '#d4d4d4',
                              themeMode: 'dark'
                            }))}
                            className="col-span-2 flex items-center gap-2 p-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition shadow-sm text-left"
                          >
                            <span className="w-5 h-5 rounded-full bg-neutral-900 inline-block shrink-0"></span>
                            <span>Charcoal Luxe</span>
                          </button>
                        </div>
                      </div>

                      {/* Ombre Gradient */}
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Page Background Gradient</label>
                        <div className="flex items-center gap-3 bg-neutral-50 p-4 rounded-2xl border">
                          <input type="color" value={editData.ombreStart || '#f472b6'} onChange={e => setEditData((p: any) => ({ ...p, ombreStart: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                          <div className="flex-1 h-8 rounded-lg shadow-inner" style={{ background: `linear-gradient(to right, ${editData.ombreStart || '#f472b6'}, ${editData.ombreEnd || '#000000'})` }}></div>
                          <input type="color" value={editData.ombreEnd || '#000000'} onChange={e => setEditData((p: any) => ({ ...p, ombreEnd: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                        </div>
                      </div>

                      {/* Page Contrast Mode */}
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Page Contrast Mode</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setEditData((p: any) => ({ ...p, themeMode: 'auto' }))}
                            className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${(editData.themeMode || 'auto') === 'auto' ? 'bg-black text-white border-black' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'}`}
                          >
                            <span>Auto Detect</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditData((p: any) => ({ ...p, themeMode: 'light' }))}
                            className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${editData.themeMode === 'light' ? 'bg-black text-white border-black' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'}`}
                          >
                            <span>Light Mode</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditData((p: any) => ({ ...p, themeMode: 'dark' }))}
                            className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${editData.themeMode === 'dark' ? 'bg-black text-white border-black' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'}`}
                          >
                            <span>Dark Mode</span>
                          </button>
                        </div>
                      </div>

                      {/* Page Text Colors */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-neutral-500 uppercase mb-1.5">Page Header Color</label>
                          <div className="flex items-center gap-2 border border-neutral-200 rounded-xl p-2 bg-neutral-50">
                            <input
                              type="color"
                              value={editData.headerColor || (isEditPageLight ? '#171717' : '#ffffff')}
                              onChange={e => setEditData((p: any) => ({ ...p, headerColor: e.target.value }))}
                              className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
                            />
                            <input
                              type="text"
                              value={editData.headerColor || (isEditPageLight ? '#171717' : '#ffffff')}
                              onChange={e => setEditData((p: any) => ({ ...p, headerColor: e.target.value }))}
                              className="w-full text-xs font-mono font-medium uppercase bg-transparent outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-neutral-500 uppercase mb-1.5">Page Desc Color</label>
                          <div className="flex items-center gap-2 border border-neutral-200 rounded-xl p-2 bg-neutral-50">
                            <input
                              type="color"
                              value={editData.descriptionColor || (isEditPageLight ? '#525252' : '#e5e5e5')}
                              onChange={e => setEditData((p: any) => ({ ...p, descriptionColor: e.target.value }))}
                              className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
                            />
                            <input
                              type="text"
                              value={editData.descriptionColor || (isEditPageLight ? '#525252' : '#e5e5e5')}
                              onChange={e => setEditData((p: any) => ({ ...p, descriptionColor: e.target.value }))}
                              className="w-full text-xs font-mono font-medium uppercase bg-transparent outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Splashback Image */}
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Collection Page Splashback</label>
                        <div className="border-2 border-dashed rounded-2xl p-4 bg-neutral-50 space-y-3">
                          {editData.backgroundImageUrl && (
                            <>
                              <div className="relative w-full h-24 rounded-xl overflow-hidden shadow-sm">
                                <Image src={editData.backgroundImageUrl} alt="Splashback" fill className="object-cover" />
                              </div>
                              <button onClick={(e) => { e.preventDefault(); setEditData((p: any) => ({ ...p, backgroundImageUrl: "" })); if(bgFileRef.current) bgFileRef.current.value = ""; }} className="text-red-500 text-xs font-bold mt-1 block">Remove Image</button>
                            </>
                          )}
                          <input type="file" ref={bgFileRef} accept="image/*" className="text-sm w-full font-medium file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100" />
                          <div>
                            <label className="block text-xs font-bold text-neutral-500 mb-1">Scale: {editData.bgScale || 100}%</label>
                            <input type="range" min="10" max="300" value={editData.bgScale || 100} onChange={e => setEditData((p: any) => ({ ...p, bgScale: parseInt(e.target.value) }))} className="w-full accent-pink-500" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {editorTab === 'info' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Display Title</label>
                        <input type="text" value={editData.title || ''} onChange={e => setEditData((p: any) => ({ ...p, title: e.target.value }))} className="w-full border-2 border-neutral-200 rounded-xl px-4 py-3 text-sm focus:border-pink-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Description</label>
                        <textarea value={editData.description || ''} onChange={e => setEditData((p: any) => ({ ...p, description: e.target.value }))} rows={2} className="w-full border-2 border-neutral-200 rounded-xl px-4 py-3 text-sm focus:border-pink-500 focus:outline-none resize-none" />
                      </div>

                      {/* Remove from Featured */}
                      <div className="pt-4 border-t border-neutral-100">
                        <button
                          type="button"
                          onClick={async () => {
                            const vendorUid = VENDOR_UID;
                            await setDoc(doc(db, 'users', vendorUid, 'collection_settings', editData.tag), { isFeatured: false }, { merge: true });
                            setRibbonCollections((prev: any) => prev.filter((c: any) => c.tag.toLowerCase() !== editData.tag.toLowerCase()));
                            setAllCollections((prev: any) => prev.map((c: any) => c.tag.toLowerCase() === editData.tag.toLowerCase() ? { ...c, isFeatured: false } : c));
                            setShowEditor(false);
                          }}
                          className="w-full py-3 text-red-500 font-bold hover:bg-red-50 rounded-xl transition-colors text-sm"
                        >
                          Remove from Featured Collections
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <div className="shrink-0 bg-white border-t p-4">
                  <button onClick={saveInlineEdits} disabled={savingEdit} className="w-full bg-neutral-900 text-white py-3.5 rounded-xl font-brand font-bold text-xs uppercase tracking-wider hover:bg-[#FF5C9D] disabled:opacity-50 transition-colors shadow-md">
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Product Slot Picker Modal */}
        {pickerSlotIndex !== null && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPickerSlotIndex(null)} />
            <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden text-black animate-slide-up flex flex-col max-h-[85vh]">
              <div className="bg-white border-b px-6 py-4 flex items-center justify-between z-10 shrink-0">
                <h2 className="font-brand font-bold text-lg tracking-tight text-neutral-900 uppercase">Select Design for Slot {pickerSlotIndex + 1}</h2>
                <button onClick={() => setPickerSlotIndex(null)} className="text-neutral-400 hover:text-black text-2xl font-bold leading-none">&times;</button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 bg-neutral-50 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                {products.filter(p => !homeContent.featuredProductIds?.includes(p.id)).map(p => (
                  <button
                    key={p.id}
                    onClick={async () => {
                      const vendorUid = VENDOR_UID;
                      let newIds = (homeContent.featuredProductIds && homeContent.featuredProductIds.length > 0)
                            ? [...homeContent.featuredProductIds]
                            : products.slice(0, 10).map(pr => pr.id);
                      while(newIds.length < 10) newIds.push("");
                      
                      newIds[pickerSlotIndex] = p.id;
                      setHomeContent(prev => ({...prev, featuredProductIds: newIds}));
                      await setDoc(doc(db, "users", vendorUid, "store_settings", "home_content"), { featuredProductIds: newIds }, { merge: true });
                      setPickerSlotIndex(null);
                    }}
                    className="flex flex-col bg-white border rounded-xl overflow-hidden hover:border-pink-500 hover:ring-2 hover:ring-pink-500/30 transition-all text-left shadow-sm group"
                  >
                    <div className="relative aspect-square w-full bg-pink-50">
                      <Image src={p.imagePath} alt={p.name} fill className="object-cover" sizes="150px" />
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-xs truncate group-hover:text-pink-600 transition-colors">{p.name}</h3>
                      <p className="text-[10px] text-neutral-500">{p.priceOnAsk ? "POA" : `€${p.basePrice}`}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}



        {/* Remove Confirmation Modal */}
        {confirmRemoveSlot !== null && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmRemoveSlot(null)} />
            <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden text-black animate-slide-up flex flex-col">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                </div>
                <h3 className="text-xl font-brand font-bold text-neutral-900 mb-2">Remove Design?</h3>
                <p className="text-neutral-500 text-sm mb-6">Are you sure you want to clear this slot from New Arrivals?</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmRemoveSlot(null)} className="flex-1 bg-neutral-100 text-neutral-700 py-3 rounded-xl font-bold hover:bg-neutral-200 transition-colors">Cancel</button>
                  <button onClick={async () => {
                    const vendorUid = VENDOR_UID;
                    let newIds = (homeContent.featuredProductIds && homeContent.featuredProductIds.length > 0)
                          ? [...homeContent.featuredProductIds]
                          : products.slice(0, 10).map(pr => pr.id);
                    while(newIds.length < 10) newIds.push("");
                    
                    newIds[confirmRemoveSlot] = "";
                    setHomeContent(prev => ({...prev, featuredProductIds: newIds}));
                    await setDoc(doc(db, "users", vendorUid, "store_settings", "home_content"), { featuredProductIds: newIds }, { merge: true });
                    setConfirmRemoveSlot(null);
                  }} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-colors shadow-md">Remove</button>
                </div>
              </div>
            </div>
          </div>
        )}


      {/* High-Resolution Uncropped Product Lightbox */}
      {selectedProduct && (
        <ProductLightbox
          isOpen={lightboxOpen}
          images={[selectedProduct.imagePath, ...(selectedProduct.additionalImages || [])]}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          title={selectedProduct.name}
        />
      )}

      {/* Interactive In-Drawer Shape & Sizing Guide Modal */}
      <ShapeSizingGuideModal
        isOpen={showShapeGuide}
        onClose={() => setShowShapeGuide(false)}
      />
</div>
  );
}

