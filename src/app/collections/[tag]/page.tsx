"use client";

import { useEffect, useState, useMemo, useRef, useCallback, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Dancing_Script } from "next/font/google";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, collectionGroup, getDoc, doc, setDoc, deleteDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const dancingScript = Dancing_Script({ subsets: ["latin"] });
import { db, auth, storage } from "@/lib/firebase";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAdmin } from "@/context/AdminContext";
import { Product } from "@/lib/types";
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

import ItemPickerModal from "@/components/ItemPickerModal";
import ProductLightbox from "@/components/ProductLightbox";
import ShapeSizingGuideModal from "@/components/ShapeSizingGuideModal";
import ProductDetailDrawer from "@/components/ProductDetailDrawer";

function CollectionPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Ensure we safely handle array params or string params
  const rawTag = Array.isArray(params?.tag) ? params.tag[0] : params?.tag;
  const tag = rawTag ? decodeURIComponent(rawTag) : "";
  const isCoreTag = ['sets', 'minis', 'keychains', 'earrings', 'accessories', 'basics', 'special-offers', 'all'].includes(tag.toLowerCase());
  const canonicalTag = isCoreTag ? tag.toLowerCase() : tag;

  useEffect(() => {
    if (tag && isCoreTag && tag !== canonicalTag) {
      router.replace(`/collections/${canonicalTag}`);
    }
  }, [tag, isCoreTag, canonicalTag, router]);

  const [products, setProducts] = useState<Product[]>([]);
  const [collectionInfo, setCollectionInfo] = useState<{ title: string; description: string; backgroundImageUrl: string; headerColor?: string; descriptionColor?: string; ombreStart?: string; ombreEnd?: string; bgScale?: number; inRibbon?: boolean; tag?: string; includedProductIds?: string[]; itemOrder?: string[]; themeMode?: 'auto' | 'light' | 'dark' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<string>('newest'); // 'newest', 'oldest', 'az', 'za', 'price-asc', 'price-desc'
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [itemToRemove, setItemToRemove] = useState<Product | null>(null);
  const [dismissedHighlightId, setDismissedHighlightId] = useState<string | null>(null);

  // Admin inline editing state
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);

  // Current active ombre colors (reflects real-time slider edits if editor modal is open)
  const currentOmbreStart = (showEditor && editData?.ombreStart) || collectionInfo?.ombreStart || '#fbcfe8';
  const currentOmbreEnd = (showEditor && editData?.ombreEnd) || collectionInfo?.ombreEnd || '#ffffff';
  const currentThemeMode = (showEditor && editData?.themeMode) || collectionInfo?.themeMode || 'auto';

  const isThemeLight = useMemo(() => {
    if (currentThemeMode === 'light') return true;
    if (currentThemeMode === 'dark') return false;
    const startLum = getColorLuminance(currentOmbreStart);
    const endLum = getColorLuminance(currentOmbreEnd);
    const avgLum = (startLum + endLum) / 2;
    // Considered light if average luminance is > 128 (standard WCAG midpoint)
    // or if either end is bright (e.g. pink to white, white to soft pink)
    return avgLum > 128 || endLum > 160 || startLum > 160;
  }, [currentOmbreStart, currentOmbreEnd, currentThemeMode]);

  // Drawer state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedShape, setSelectedShape] = useState<string>("Almond");
  const [selectedSize, setSelectedSize] = useState<string>("M");
  const [selectedLength, setSelectedLength] = useState<string>("Medium");
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showShapeGuide, setShowShapeGuide] = useState(false);

  const openLightbox = (idx: number = 0) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { editMode, setEditingProduct } = useAdmin();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [clientProfile, setClientProfile] = useState<any>(null);

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

  // Find target product from query params (?product=..., ?name=..., ?img=...) or URL hash
  const prodQuery = searchParams.get("product");
  const nameQuery = searchParams.get("name");
  const imgQuery = searchParams.get("img");

  const targetProduct = useMemo(() => {
    if (!products || products.length === 0) return null;
    const hashTarget = typeof window !== 'undefined' ? window.location.hash.replace('#product-', '').replace('#', '') : '';
    const idTarget = prodQuery || hashTarget;

    if (!idTarget && !nameQuery && !imgQuery) return null;

    return products.find(p => {
      // 1. Check ID or syncId
      if (idTarget) {
        const t = idTarget.toLowerCase();
        if (p.id?.toLowerCase() === t || p.syncId?.toLowerCase() === t) return true;
        if (p.syncId && t.includes(p.syncId.toLowerCase())) return true;
        if (p.id && t.includes(p.id.toLowerCase())) return true;
      }
      // 2. Check Name (case-insensitive & trimmed)
      if (nameQuery) {
        if (p.name?.trim().toLowerCase() === nameQuery.trim().toLowerCase()) return true;
      }
      // 3. Check Image URL or filename
      if (imgQuery) {
        if (p.imagePath === imgQuery) return true;
        if (p.additionalImages?.includes(imgQuery)) return true;
        const filename = imgQuery.split('/').pop()?.split('?')[0];
        if (filename && p.imagePath?.includes(filename)) return true;
      }
      return false;
    }) || null;
  }, [products, prodQuery, nameQuery, imgQuery]);

  // Ensure active filters do not hide the targeted item from wishlist
  useEffect(() => {
    if (targetProduct && activeFilters.length > 0) {
      const matchesFilter = activeFilters.some(f => targetProduct.tags?.includes(f));
      if (!matchesFilter) {
        setActiveFilters([]);
      }
    }
  }, [targetProduct, activeFilters]);

  // When opened with a target wishlist product, start at top so the scroll down is visible
  useEffect(() => {
    if (prodQuery || nameQuery || imgQuery) {
      window.scrollTo(0, 0);
    }
  }, [prodQuery, nameQuery, imgQuery]);

  // Smooth animated scroll with cubic easing for a visible, professional glide down
  const smoothScrollToTarget = useCallback(() => {
    if (!targetProduct) return;
    const el = document.getElementById(`product-${targetProduct.id}`);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
    const targetY = Math.max(0, rect.top + currentScrollY - (window.innerHeight / 2) + (rect.height / 2));

    const distance = targetY - currentScrollY;
    if (Math.abs(distance) < 20) return;

    // Duration scales with distance for natural pacing (850ms - 1200ms)
    const duration = Math.min(1200, Math.max(850, Math.abs(distance) * 0.45));
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeInOutCubic curve: gentle takeoff, fast mid-scroll, silky-smooth slowdown
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      window.scrollTo(0, currentScrollY + distance * ease);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [targetProduct]);

  useEffect(() => {
    if (loading || !targetProduct) return;

    // Give 380ms for collection products to mount into the DOM, then glide smoothly down
    const scrollTimer = setTimeout(() => {
      smoothScrollToTarget();
    }, 380);

    // Secondary safety adjustment in case late image loading shifted the grid
    const adjustTimer = setTimeout(() => {
      const el = document.getElementById(`product-${targetProduct.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const currentCenter = rect.top + (rect.height / 2);
        const windowCenter = window.innerHeight / 2;
        if (Math.abs(currentCenter - windowCenter) > 60) {
          smoothScrollToTarget();
        }
      }
    }, 1500);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(adjustTimer);
    };
  }, [loading, targetProduct, smoothScrollToTarget]);

  useEffect(() => {
    if (!canonicalTag) return;
    fetchCollectionData();
  }, [canonicalTag]);

  const fetchCollectionData = async () => {
    try {
      const vendorUid = VENDOR_UID;
      
      let currentSettings: any = null;

      // 1. Fetch Collection Info
      const settingsRef = doc(db, "users", vendorUid, "collection_settings", canonicalTag);
      const settingsSnap = await getDoc(settingsRef);
      let fetchedSettings: any = null;
      if (settingsSnap.exists()) {
        fetchedSettings = settingsSnap.data();
      }

      // If canonical doc didn't exist or had no background image, also check non-canonical tag (e.g. capitalized 'Accessories')
      if ((!fetchedSettings || !fetchedSettings.backgroundImageUrl) && tag !== canonicalTag) {
        const altRef = doc(db, "users", vendorUid, "collection_settings", tag);
        const altSnap = await getDoc(altRef);
        if (altSnap.exists()) {
          fetchedSettings = { ...altSnap.data(), ...(fetchedSettings || {}) };
        }
      }

      if (fetchedSettings) {
        currentSettings = { ...fetchedSettings, tag: canonicalTag };
        setCollectionInfo(currentSettings);
      } else {
        // Fallback default info if no custom splashback is set
        let fallbackTitle = canonicalTag.charAt(0).toUpperCase() + canonicalTag.slice(1).replace(/-/g, " ");
        let fallbackDesc = `Explore the gorgeous ${canonicalTag.replace(/-/g, " ")} collection.`;
        
        if (canonicalTag === "special-offers") {
          fallbackTitle = "Special Offers";
          fallbackDesc = "Check out the latest deals and promos!";
        } else if (canonicalTag === "all") {
          fallbackTitle = "All Designs";
          fallbackDesc = "Browse my entire collection of handcrafted press-ons.";
        }

        currentSettings = {
          title: fallbackTitle,
          description: fallbackDesc,
          backgroundImageUrl: "",
          headerColor: "#171717",
          descriptionColor: "#4b5563",
          ombreStart: "#fbcfe8",
          ombreEnd: "#ffffff",
          themeMode: "light",
          bgScale: 100,
          tag: canonicalTag
        };
        setCollectionInfo(currentSettings);
      }

      // 2. Fetch Products (Bypass Firebase composite index by filtering in JS)
      const baseQuery = collection(db, "users", vendorUid, "nail_sets");
      const q = query(baseQuery, where("isForSale", "==", true));
      const snapshot = await getDocs(q);

      // Fetch the Android app's separate multi-photo collection for this vendor
      const imagesSnapshot = await getDocs(collection(db, "users", vendorUid, "set_images"));
      const allSetImages = imagesSnapshot.docs.map(doc => doc.data());

      let fetchedProducts = snapshot.docs.map(d => {
        const data = d.data();
        const syncId = data.syncId || d.id;

        const androidExtraImages = allSetImages
          .filter(img => img.setSyncId === syncId && img.uri)
          .sort((a, b) => (a.position || 0) - (b.position || 0))
          .map(img => formatStorageImageUrl(img.uri as string, vendorUid));

        const mergedExtraImages = Array.from(new Set([...(data.additionalImages || []).map((u: string) => formatStorageImageUrl(u, vendorUid)), ...androidExtraImages]));

        let primaryImage = data.imagePath;
        if ((!primaryImage || !primaryImage.startsWith('http')) && mergedExtraImages.length > 0) {
          primaryImage = mergedExtraImages.find(img => img.startsWith("http")) || mergedExtraImages[0];
        } else {
          primaryImage = formatStorageImageUrl(primaryImage, vendorUid);
        }

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
          category: data.category || 'Standard',
          tags: data.tags || [],
          syncId,
          type: data.type || 'Sets',
          updatedAt: data.updatedAt || 0
        };
      });

      // Filter products based on the current collection tag
      if (tag === "special-offers") {
        fetchedProducts = fetchedProducts.filter(p => p.isPromo);
      } else if (tag !== "all") {
        const topLevelMap: Record<string, string> = {
          "sets": "Sets",
          "minis": "Minis",
          "keychains": "Keychains",
          "keyrings": "Keychains",
          "earrings": "Earrings",
          "accessories": "Accessories",
          "basics": "Basics",
          "sizing-kit": "Sizing Kit"
        };
        const mappedType = topLevelMap[tag.toLowerCase()];
        if (mappedType) {
          if (mappedType === "Basics") {
            fetchedProducts = fetchedProducts.filter(p => p.type?.toLowerCase() === "basics" || p.type?.toLowerCase() === "sizing kit" || (p.tags && p.tags.map((t: string)=>t.toLowerCase()).includes("basics")));
          } else {
            fetchedProducts = fetchedProducts.filter(p => p.type?.toLowerCase() === mappedType.toLowerCase() || (p.tags && p.tags.map((t: string)=>t.toLowerCase()).includes(mappedType.toLowerCase())));
          }
        } else {
          const includedIds = currentSettings?.includedProductIds;
          if (includedIds && includedIds.length > 0) {
            fetchedProducts = fetchedProducts.filter(p => includedIds.includes(p.id));
            // Sort custom collection by includedProductIds array order
            fetchedProducts.sort((a, b) => includedIds.indexOf(a.id) - includedIds.indexOf(b.id));
          } else {
            fetchedProducts = fetchedProducts.filter(p => p.tags && p.tags.includes(tag));
          }
        }
      }

      // If there's an explicit itemOrder on this collection (e.g. for a core tag), apply it
      if (currentSettings?.itemOrder && currentSettings.itemOrder.length > 0) {
        fetchedProducts.sort((a, b) => {
          const aIdx = currentSettings.itemOrder!.indexOf(a.id);
          const bIdx = currentSettings.itemOrder!.indexOf(b.id);
          if (aIdx === -1 && bIdx === -1) return 0;
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
      }

      setProducts(fetchedProducts);
    } catch (error) {
      console.error("Error fetching collection:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProduct) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedProduct]);

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

  // Admin auth detection + current user tracking
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setCurrentUser(u);
      if (u && VALID_ADMINS.includes(u.uid as any)) {
        setAdminUser(u);
      } else {
        setAdminUser(null);
      }
      if (u && u.email) {
        try {
          const vendorUid = VENDOR_UID;
          const q = query(collection(db, "users", vendorUid, "clients"), where("email", "==", u.email));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setClientProfile(snap.docs[0].data());
          }
        } catch (e) { console.error("Failed to fetch client profile", e); }
      }
    });
    return () => unsub();
  }, []);

  const openInlineEditor = () => {
    setEditData({
      ...collectionInfo,
      themeMode: collectionInfo?.themeMode || 'auto',
    });
    setShowEditor(true);
  };

  const saveInlineEdits = async () => {
    if (!adminUser || !editData) return;
    setSavingEdit(true);
    try {
      const vendorUid = VENDOR_UID;
      let newImageUrl = editData.backgroundImageUrl;

      if (bgFileRef.current?.files && bgFileRef.current.files.length > 0) {
        const file = bgFileRef.current.files[0];
        const storageRef = ref(storage, `users/${vendorUid}/images/bg_${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        newImageUrl = await getDownloadURL(storageRef);
      }

      const updatedMeta = { ...editData, backgroundImageUrl: newImageUrl || '', tag: canonicalTag };
      await setDoc(doc(db, 'users', vendorUid, 'collection_settings', canonicalTag), updatedMeta, { merge: true });
      if (tag !== canonicalTag) {
        try {
          await deleteDoc(doc(db, 'users', vendorUid, 'collection_settings', tag));
        } catch(e) {}
      }
      setCollectionInfo(updatedMeta);
      setShowEditor(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className={`min-h-screen selection:bg-pink-100 relative ${isThemeLight ? 'bg-transparent text-neutral-900' : 'bg-transparent text-white'}`}>
      {/* Full Page Background (Gradient + Optional Image Overlay) */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none transition-colors duration-500" 
        style={{ background: `linear-gradient(to bottom right, ${currentOmbreStart}, ${currentOmbreEnd})` }}
      >
        {collectionInfo?.backgroundImageUrl && (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <div style={{ transform: `scale(${(collectionInfo?.bgScale || 100) / 100})`, width: '100%', height: '100%', position: 'relative' }}>
              <Image 
                src={collectionInfo.backgroundImageUrl} 
                alt={collectionInfo?.title || "Background"} 
                fill 
                className={`object-contain ${isThemeLight ? 'opacity-25 mix-blend-multiply' : 'opacity-40 mix-blend-overlay'}`} 
                priority 
              />
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="pt-16 pb-6 sm:pt-28 sm:pb-12 text-center px-4 relative mt-4">
          {adminUser && editMode && (
              <button 
                onClick={openInlineEditor}
              className={`absolute top-4 right-6 sm:top-12 sm:right-8 bg-black/70 text-white p-3 rounded-full hover:bg-black transition-all shadow-lg z-30 group ${editMode ? 'ring-2 ring-pink-500 animate-pulse' : ''}`}
              title="Theme Collection"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 group-hover:scale-110 transition-transform"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
            </button>
          )}
          <div className="flex flex-col items-center gap-4 relative z-10 w-full max-w-4xl mx-auto">
            <div className="relative group/title flex justify-center w-full">
              {editMode ? (
                <input 
                  type="text"
                  value={collectionInfo?.title || tag}
                  onChange={e => setCollectionInfo((prev: any) => ({...prev, title: e.target.value}))}
                  onBlur={async (e) => {
                    if(!adminUser) return;
                    const vendorUid = VENDOR_UID;
                    await setDoc(doc(db, "users", vendorUid, "collection_settings", canonicalTag), { title: e.target.value }, { merge: true });
                  }}
                  className={`relative z-50 pointer-events-auto ${dancingScript.className} text-6xl sm:text-8xl ${isThemeLight ? 'drop-shadow-sm' : 'drop-shadow-2xl'} bg-transparent border-none outline-none text-center hover:ring-2 ring-pink-500 rounded p-2`} 
                  style={{ color: collectionInfo?.headerColor || (isThemeLight ? '#171717' : '#ffffff'), minWidth: '300px' }}
                />
              ) : (
                <h1 
                  className={`${dancingScript.className} text-6xl sm:text-8xl ${isThemeLight ? 'drop-shadow-sm' : 'drop-shadow-2xl'}`} 
                  style={{ color: collectionInfo?.headerColor || (isThemeLight ? '#171717' : '#ffffff') }}
                >
                  {collectionInfo?.title || tag}
                </h1>
              )}
              {editMode && (
                <div className="absolute -right-2 sm:-right-14 top-0 sm:top-1/2 sm:-translate-y-1/2 flex items-center justify-center bg-white rounded-full p-2 shadow-xl opacity-100 transition-opacity z-[60]">
                  <input type="color" value={collectionInfo?.headerColor || (isThemeLight ? '#171717' : '#ffffff')} onChange={async (e) => {
                    setCollectionInfo((prev: any) => ({...prev, headerColor: e.target.value}));
                    if(!adminUser) return;
                    const vendorUid = VENDOR_UID;
                    await setDoc(doc(db, "users", vendorUid, "collection_settings", canonicalTag), { headerColor: e.target.value }, { merge: true });
                  }} className="w-8 h-8 rounded cursor-pointer border-0 p-0" title="Title Color" />
                </div>
              )}
            </div>

            {(collectionInfo?.description || editMode) && (
              <div className="relative group/desc flex justify-center w-full">
                {editMode ? (
                  <textarea 
                    value={collectionInfo?.description || ''}
                    onChange={e => setCollectionInfo((prev: any) => ({...prev, description: e.target.value}))}
                    onBlur={async (e) => {
                      if(!adminUser) return;
                      const vendorUid = VENDOR_UID;
                      await setDoc(doc(db, "users", vendorUid, "collection_settings", canonicalTag), { description: e.target.value }, { merge: true });
                    }}
                    className={`relative z-50 pointer-events-auto text-lg sm:text-xl font-medium ${isThemeLight ? 'drop-shadow-none' : 'drop-shadow-md'} w-full max-w-2xl bg-transparent border-none outline-none text-center hover:ring-2 ring-pink-500 rounded p-2 resize-none overflow-hidden`}
                    style={{ color: collectionInfo?.descriptionColor || (isThemeLight ? '#4b5563' : '#e5e5e5') }}
                    rows={2}
                    placeholder="Collection description..."
                  />
                ) : (
                  <p 
                    className={`text-lg sm:text-xl font-medium ${isThemeLight ? 'drop-shadow-none' : 'drop-shadow-md'} max-w-2xl text-center`}
                    style={{ color: collectionInfo?.descriptionColor || (isThemeLight ? '#4b5563' : '#e5e5e5') }}
                  >{collectionInfo?.description}</p>
                )}
                {editMode && (
                  <div className="absolute -right-2 sm:-right-14 top-0 sm:top-1/2 sm:-translate-y-1/2 flex items-center justify-center bg-white rounded-full p-2 shadow-xl opacity-100 transition-opacity z-[60]">
                    <input type="color" value={collectionInfo?.descriptionColor || (isThemeLight ? '#4b5563' : '#e5e5e5')} onChange={async (e) => {
                      setCollectionInfo((prev: any) => ({...prev, descriptionColor: e.target.value}));
                      if(!adminUser) return;
                      const vendorUid = VENDOR_UID;
                      await setDoc(doc(db, "users", vendorUid, "collection_settings", canonicalTag), { descriptionColor: e.target.value }, { merge: true });
                    }} className="w-8 h-8 rounded cursor-pointer border-0 p-0" title="Description Color" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-3 sm:px-6 mb-20 w-full flex-grow">
          {/* Top Control Bar (Inline Search + Filter/Sort) */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-md">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${isThemeLight ? 'text-neutral-500' : 'text-white/70'}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search in this collection (name, description, tags)..."
                className={`w-full pl-10 pr-9 py-2 rounded-full text-xs sm:text-sm font-bold outline-none backdrop-blur-md transition ${
                  isThemeLight 
                    ? 'bg-white/90 hover:bg-white focus:bg-white border border-neutral-300 text-neutral-900 placeholder:text-neutral-400 shadow-sm focus:ring-2 focus:ring-pink-500/30' 
                    : 'bg-white/15 hover:bg-white/20 focus:bg-white/25 border border-white/25 text-white placeholder:text-white/60'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold cursor-pointer ${isThemeLight ? 'text-neutral-500 hover:text-black' : 'text-white/70 hover:text-white'}`}
                >
                  ✕
                </button>
              )}
            </div>

            <button 
              onClick={() => setShowFilterModal(true)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition backdrop-blur-md shrink-0 cursor-pointer ${
                isThemeLight
                  ? 'bg-white/90 hover:bg-white border border-neutral-300 text-neutral-800 shadow-sm'
                  : 'bg-white/10 hover:bg-white/20 border border-white/20 text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>
              Filter & Sort
              {activeFilters.length > 0 && <span className="ml-1 bg-pink-500 text-white text-xs px-1.5 py-0.5 rounded-full">{activeFilters.length}</span>}
            </button>
          </div>

          {showFilterModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFilterModal(false)}></div>
              <div className="bg-white rounded-3xl w-full max-w-md p-6 relative z-10 animate-slide-up">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-black">Filter & Sort</h3>
                  <button onClick={() => setShowFilterModal(false)} className="p-2 text-neutral-400 hover:text-black">✕</button>
                </div>
                
                <div className="mb-8">
                  <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-3">Sort By</h4>
                  <select 
                    value={sortOption} 
                    onChange={e => setSortOption(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 text-black px-4 py-3 rounded-xl font-bold appearance-none cursor-pointer"
                  >
                    <option value="newest">Newest to Oldest</option>
                    <option value="oldest">Oldest to Newest</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="az">A to Z (Ascending)</option>
                    <option value="za">Z to A (Descending)</option>
                  </select>
                </div>

                <div className="mb-6">
                  <h4 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-3">Filter By Style</h4>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(products.flatMap(p => p.tags || []))).sort().map(chip => (
                      <button
                        key={chip}
                        onClick={() => setActiveFilters(prev => prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip])}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activeFilters.includes(chip) ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-neutral-100">
                  <button 
                    onClick={() => { setActiveFilters([]); setSortOption('newest'); setSearchQuery(''); }}
                    className="px-6 py-3 rounded-xl font-bold text-neutral-500 hover:bg-neutral-100 transition flex-1"
                  >
                    Clear All
                  </button>
                  <button 
                    onClick={() => setShowFilterModal(false)}
                    className="px-6 py-3 bg-[#FF5C9D] text-white rounded-xl font-bold hover:bg-pink-600 transition flex-1 shadow-lg shadow-pink-500/30"
                  >
                    Apply Settings
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 animate-pulse">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <div key={n} className="bg-white/20 backdrop-blur-md rounded-2xl p-3 border border-white/15 flex flex-col space-y-3">
                  <div className="aspect-square rounded-xl bg-white/25" />
                  <div className="h-4 w-3/4 rounded bg-white/30" />
                  <div className="h-3.5 w-1/3 rounded bg-white/20" />
                  <div className="h-9 w-full rounded-full bg-white/25 mt-auto" />
                </div>
              ))}
            </div>
          ) : products.length === 0 && !editMode ? (
            <div className="text-center py-20 px-4 bg-black/40 backdrop-blur-sm rounded-3xl border border-white/10">
              <h3 className="text-xl font-bold text-white mb-2">No designs found</h3>
              <p className="text-neutral-400">There are currently no items in this collection.</p>
              <Link href="/" className="inline-block mt-6 px-6 py-3 bg-white text-black rounded-full font-bold hover:bg-neutral-200 transition">Back to Store</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
              {editMode && (
                <div 
                  onClick={() => setShowItemPicker(true)}
                  className="bg-white/50 backdrop-blur-md rounded-2xl p-3 shadow-inner border-2 border-dashed border-pink-300 flex flex-col items-center justify-center cursor-pointer hover:bg-pink-50 transition-colors min-h-[200px]"
                >
                  <div className="w-16 h-16 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                    +
                  </div>
                  <span className="font-bold text-pink-600 text-center uppercase tracking-widest text-xs">
                    {['sets', 'minis', 'keychains', 'earrings', 'accessories', 'basics', 'special-offers'].includes(tag.toLowerCase()) || tag === 'all' ? 'Publish Unlisted Items' : 'Add Items to Collection'}
                  </span>
                </div>
              )}
              {(() => {
                const q = searchQuery.trim().toLowerCase();
                const searchTerms = q ? q.split(/\s+/).filter(Boolean) : [];
                let displayed = products.filter(p => {
                  const matchesTagFilter = activeFilters.length === 0 || activeFilters.some(f => p.tags?.includes(f));
                  if (!matchesTagFilter) return false;
                  if (searchTerms.length === 0) return true;
                  const haystack = [
                    p.name || "",
                    p.description || "",
                    p.type || "",
                    p.category || "",
                    ...(p.tags || [])
                  ].join(" ").toLowerCase();
                  return searchTerms.every(term => haystack.includes(term));
                });
                if (sortOption === 'az') displayed.sort((a, b) => a.name.localeCompare(b.name));
                else if (sortOption === 'za') displayed.sort((a, b) => b.name.localeCompare(a.name));
                else if (sortOption === 'price-asc') displayed.sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0));
                else if (sortOption === 'price-desc') displayed.sort((a, b) => (b.basePrice || 0) - (a.basePrice || 0));
                else if (sortOption === 'oldest') displayed.sort((a, b) => (a.updatedAt && b.updatedAt) ? a.updatedAt - b.updatedAt : a.id.localeCompare(b.id)); 
                else {
                  // For 'newest', if we have a custom item order, we maintain the array's current order (which we sorted in fetchProducts).
                  // Otherwise, we sort by newest.
                  const hasCustomOrder = collectionInfo?.itemOrder?.length || collectionInfo?.includedProductIds?.length;
                  if (!hasCustomOrder) {
                    displayed.sort((a, b) => (a.updatedAt && b.updatedAt) ? b.updatedAt - a.updatedAt : b.id.localeCompare(a.id));
                  }
                }
                return displayed;
              })().map((product, index) => {
                const isHighlighted = Boolean(
                  targetProduct && targetProduct.id === product.id && dismissedHighlightId !== product.id
                );

                return (
                  <div 
                    key={product.id} 
                    id={`product-${product.id}`}
                    data-product-id={product.id}
                    draggable={editMode && sortOption === 'newest' && activeFilters.length === 0}
                    onDragStart={(e) => {
                      if (editMode && sortOption === 'newest' && activeFilters.length === 0) {
                        setDraggedItemIndex(index);
                        e.dataTransfer.effectAllowed = "move";
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedItemIndex === null || draggedItemIndex === index) return;
                      if (editMode && sortOption === 'newest' && activeFilters.length === 0) {
                        setProducts(prev => {
                          const newProducts = [...prev];
                          const item = newProducts[draggedItemIndex];
                          if (!item) return prev;
                          newProducts.splice(draggedItemIndex, 1);
                          newProducts.splice(index, 0, item);
                          return newProducts;
                        });
                        setDraggedItemIndex(index);
                      }
                    }}
                    onDragEnd={async () => {
                      setDraggedItemIndex(null);
                      if (editMode && sortOption === 'newest' && activeFilters.length === 0) {
                        const newOrder = products.map(p => p.id);
                        const vendorUid = VENDOR_UID;
                        
                        // Save to the appropriate array (includedProductIds for custom collections, itemOrder for core tags)
                        if (!isCoreTag) {
                          await setDoc(doc(db, "users", vendorUid, "collection_settings", canonicalTag), { includedProductIds: newOrder }, { merge: true });
                          setCollectionInfo((prev: any) => ({...prev, includedProductIds: newOrder}));
                        } else {
                          await setDoc(doc(db, "users", vendorUid, "collection_settings", canonicalTag), { itemOrder: newOrder }, { merge: true });
                          setCollectionInfo((prev: any) => ({...prev, itemOrder: newOrder}));
                        }
                      }
                    }}
                    className={`bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-2xl border flex flex-col group relative transform transition-all ${
                      isHighlighted
                        ? 'border-pink-500 ring-4 ring-pink-500/60 shadow-[0_0_35px_rgba(236,72,153,0.45)] scale-[1.03] z-20'
                        : editMode
                        ? 'border-pink-500 ring-2 ring-pink-500/20 cursor-grab active:cursor-grabbing hover:-translate-y-1'
                        : 'border-white/20 hover:-translate-y-1'
                    } ${draggedItemIndex === index ? 'opacity-50 scale-95' : ''}`}
                  >
                    {isHighlighted && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 text-white text-[11px] font-black px-3.5 py-1 rounded-full shadow-lg z-30 flex items-center gap-1.5 animate-bounce whitespace-nowrap">
                        <span>❤️</span>
                        <span>From Your Wishlist</span>
                        <button 
                          type="button" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setDismissedHighlightId(product.id); 
                          }} 
                          className="ml-1 opacity-75 hover:opacity-100 text-xs font-bold leading-none cursor-pointer"
                          title="Dismiss highlight"
                        >
                          &times;
                        </button>
                      </div>
                    )}
                  {editMode && (
                    <div className="absolute top-4 right-4 flex gap-1 z-20">
                      <button onClick={() => setEditingProduct(product)} className="bg-black text-white px-3 py-1.5 rounded-full text-[10px] font-bold hover:bg-neutral-800 shadow-md">✏️ EDIT</button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemToRemove(product);
                        }}
                        className="bg-red-500 text-white w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold hover:bg-red-600 shadow-md"
                        title="Remove Item"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  {!editMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleWishlist(product);
                        }}
                        className={`absolute top-3 right-3 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all backdrop-blur-md cursor-pointer ${
                          isWishlisted(product.id)
                            ? 'bg-pink-500 text-white shadow-md scale-105'
                            : 'bg-white/80 text-neutral-600 hover:text-pink-500 hover:bg-white shadow-sm'
                        }`}
                        title={isWishlisted(product.id) ? "Remove from wishlist" : "Save to wishlist"}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isWishlisted(product.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isWishlisted(product.id) ? 0 : 2} className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                        </svg>
                      </button>
                    )}
                    {product.isPromo && (
                    <div className="absolute top-4 left-4 bg-pink-500 text-white text-[9px] font-bold px-2.5 py-1 rounded-full z-10 shadow-sm uppercase tracking-wider">PROMO</div>
                  )}
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-pink-50 cursor-pointer group/cardimg" onClick={() => !editMode && openDrawer(product)}>
                    <Image 
                      src={product.imagePath} 
                      alt={product.name} 
                      fill 
                      className={`object-cover transition-all duration-500 ease-out group-hover:scale-105 ${product.additionalImages && product.additionalImages.length > 0 ? 'lg:group-hover:opacity-0' : ''}`} 
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" 
                    />
                    {product.additionalImages && product.additionalImages.length > 0 && (
                      <Image 
                        src={product.additionalImages[0]} 
                        alt={`${product.name} alternate angle`} 
                        fill 
                        className="object-cover transition-all duration-500 ease-out opacity-0 lg:group-hover:opacity-100 lg:group-hover:scale-105" 
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" 
                      />
                    )}
                    {product.additionalImages && product.additionalImages.length > 0 && (
                      <div className="absolute bottom-2 right-2 z-10 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 lg:hidden">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                        <span>{product.additionalImages.length + 1}</span>
                      </div>
                    )}
                    {editMode && product.tags && product.tags.length > 0 && (
                      <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1 z-10">
                        {product.tags.map(t => <span key={t} className="bg-black/70 backdrop-blur-md text-white text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">{t}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex flex-col flex-grow">
                    <h2 className="text-sm sm:text-base font-bold text-[#1A1A1A] truncate">{product.name}</h2>
                    <p className={`font-medium text-sm mt-0.5 mb-3 ${product.priceOnAsk ? 'text-pink-600 font-bold' : 'text-neutral-600'}`}>
                      {product.priceOnAsk ? "Price on Ask" : `€${product.basePrice.toFixed(2)}`}
                    </p>
                    {!editMode && (
                      <div className="mt-auto">
                        <button onClick={() => openDrawer(product)} className="w-full bg-black text-white px-4 py-2.5 rounded-full text-sm font-semibold transition-colors hover:bg-neutral-800">Select Options</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </main>
      </div>

      {/* Drawer */}
      {selectedProduct && (
        <ProductDetailDrawer
          product={selectedProduct}
          onClose={closeDrawer}
          currentUser={currentUser}
          clientProfile={clientProfile}
          onOpenLightbox={openLightbox}
          onOpenShapeGuide={() => setShowShapeGuide(true)}
        />
      )}

      {/* Admin Inline Theming Modal */}
      {showEditor && editData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowEditor(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden text-black animate-slide-up">
            <div className="bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-black text-lg">Theme Collection</h2>
              <button onClick={() => setShowEditor(false)} className="text-neutral-400 hover:text-black text-xl font-bold">✕</button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Ombre Gradient */}
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Background Gradient</label>
                <div className="flex items-center gap-3 bg-neutral-50 p-4 rounded-2xl border mb-3">
                  <input type="color" value={editData.ombreStart || '#fbcfe8'} onChange={e => setEditData((p: any) => ({ ...p, ombreStart: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                  <div className="flex-1 h-8 rounded-lg shadow-inner" style={{ background: `linear-gradient(to right, ${editData.ombreStart || '#fbcfe8'}, ${editData.ombreEnd || '#ffffff'})` }}></div>
                  <input type="color" value={editData.ombreEnd || '#ffffff'} onChange={e => setEditData((p: any) => ({ ...p, ombreEnd: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                </div>
                
                {/* Quick Presets */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">Quick Presets</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                        ombreStart: '#fdf2f8',
                        ombreEnd: '#fce7f3',
                        headerColor: '#831843',
                        descriptionColor: '#9d174d',
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
                      <span>UnHolly Ombre Light</span>
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
                      <span>UnHolly Ombre Dark</span>
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
                      className="flex items-center gap-2 p-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition shadow-sm text-left"
                    >
                      <span className="w-5 h-5 rounded-full bg-neutral-900 inline-block shrink-0"></span>
                      <span>Charcoal Luxe</span>
                    </button>
                  </div>
                </div>

                {/* Contrast / Text Mode */}
                <div className="mt-3 pt-3 border-t border-neutral-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Contrast / Text Mode</span>
                    <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full">
                      Currently: {isThemeLight ? 'Light Theme (Dark Text)' : 'Dark Theme (White Text)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'auto', label: '⚡ Auto Detect' },
                      { id: 'light', label: '☀️ Light Mode' },
                      { id: 'dark', label: '🌙 Dark Mode' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setEditData((p: any) => ({ ...p, themeMode: mode.id }))}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                          (editData?.themeMode || 'auto') === mode.id
                            ? 'bg-black text-white border-black shadow-sm'
                            : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Splashback Image */}
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">
                  Splashback / Overlay Image
                </label>
                <div className="border-2 border-dashed rounded-2xl p-4 bg-neutral-50 space-y-3">
                  {editData.backgroundImageUrl && (
                    <>
                      <div className="relative w-full h-32 rounded-xl overflow-hidden shadow-sm">
                        <Image src={editData.backgroundImageUrl} alt="Current background" fill className="object-cover" />
                      </div>
                      <button onClick={(e) => { e.preventDefault(); setEditData((p: any) => ({ ...p, backgroundImageUrl: "" })); if(bgFileRef.current) bgFileRef.current.value = ""; }} className="text-red-500 text-xs font-bold mt-1 block">Remove Image</button>
                    </>)}
                  <input type="file" ref={bgFileRef} accept="image/*" className="text-sm w-full font-medium file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100" />
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1">Background Scale: {editData.bgScale || 100}%</label>
                    <input 
                      type="range" min="10" max="300" 
                      value={editData.bgScale || 100}
                      onChange={e => setEditData((p: any) => ({ ...p, bgScale: parseInt(e.target.value) }))}
                      className="w-full accent-pink-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="sticky bottom-0 bg-white border-t p-4">
              <button 
                onClick={saveInlineEdits} 
                disabled={savingEdit}
                className="w-full bg-black text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Item Modal */}
      {itemToRemove && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setItemToRemove(null)}></div>
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden relative shadow-2xl animate-slide-up text-center">
            <div className="p-6">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✕</div>
              <h3 className="font-black uppercase tracking-widest text-lg mb-2">Remove Item?</h3>
              <p className="text-neutral-500 text-sm mb-6">
                Are you sure you want to remove <span className="font-bold text-black">"{itemToRemove.name}"</span> from this collection?
                {['sets', 'minis', 'keychains', 'earrings', 'accessories', 'basics', 'all'].includes(tag.toLowerCase()) && 
                  <span className="block mt-2 text-red-500 font-bold">This will unlist it from the live store completely!</span>
                }
              </p>
              <div className="flex gap-3">
                <button onClick={() => setItemToRemove(null)} className="flex-1 py-3 text-sm font-bold text-neutral-500 hover:bg-neutral-100 rounded-xl transition-colors">Cancel</button>
                <button 
                  onClick={async () => {
                    const vendorUid = VENDOR_UID;
                    const lowerTag = tag.toLowerCase();
                    
                    try {
                      if (['sets', 'minis', 'keychains', 'earrings', 'accessories', 'basics', 'all'].includes(lowerTag)) {
                        await setDoc(doc(db, "users", vendorUid, "nail_sets", itemToRemove.id), { isForSale: false }, { merge: true });
                        setProducts(prev => prev.filter(p => p.id !== itemToRemove.id));
                      } else if (lowerTag === 'special-offers') {
                        await setDoc(doc(db, "users", vendorUid, "nail_sets", itemToRemove.id), { isPromo: false }, { merge: true });
                        setProducts(prev => prev.filter(p => p.id !== itemToRemove.id));
                      } else {
                        const newIds = (collectionInfo?.includedProductIds || []).filter(id => id !== itemToRemove.id);
                        await setDoc(doc(db, "users", vendorUid, "collection_settings", canonicalTag), { includedProductIds: newIds }, { merge: true });
                        setCollectionInfo((prev: any) => ({...prev, includedProductIds: newIds}));
                        setProducts(prev => prev.filter(p => p.id !== itemToRemove.id));
                      }
                    } catch (e) {
                      console.error(e);
                    }
                    setItemToRemove(null);
                  }} 
                  className="flex-1 py-3 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-md shadow-red-500/20"
                >
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Picker Modal */}
      {showItemPicker && (
        <ItemPickerModal 
          isOpen={showItemPicker}
          onClose={() => setShowItemPicker(false)}
          tag={canonicalTag}
          collectionMode={
            tag.toLowerCase() === 'special-offers' ? 'promo' :
            ['sets', 'minis', 'keychains', 'earrings', 'accessories', 'basics', 'all'].includes(tag.toLowerCase()) ? 'core' : 'custom'
          }
          currentItems={products}
          onSave={async (selectedIds) => {
            const vendorUid = VENDOR_UID;
            const mode = tag.toLowerCase() === 'special-offers' ? 'promo' :
              ['sets', 'minis', 'keychains', 'earrings', 'accessories', 'basics', 'all'].includes(tag.toLowerCase()) ? 'core' : 'custom';
            
            try {
              if (mode === 'core') {
                // Publish unlisted items
                for (const pid of selectedIds) {
                  await setDoc(doc(db, "users", vendorUid, "nail_sets", pid), { isForSale: true }, { merge: true });
                }
              } else if (mode === 'promo') {
                const currentPromoIds = products.map(p => p.id);
                const toRemove = currentPromoIds.filter(id => !selectedIds.includes(id));
                const toAdd = selectedIds.filter(id => !currentPromoIds.includes(id));

                for (const pid of toAdd) {
                  // Ensure they are also marked for sale so they show up!
                  await setDoc(doc(db, "users", vendorUid, "nail_sets", pid), { isPromo: true, isForSale: true }, { merge: true });
                }
                for (const pid of toRemove) {
                  await setDoc(doc(db, "users", vendorUid, "nail_sets", pid), { isPromo: false }, { merge: true });
                }
              } else {
                // Save custom collection order
                await setDoc(doc(db, "users", vendorUid, "collection_settings", canonicalTag), { includedProductIds: selectedIds }, { merge: true });
                setCollectionInfo((prev: any) => ({ ...prev, includedProductIds: selectedIds }));
                // Ensure they are also marked for sale so they show up!
                for (const pid of selectedIds) {
                  await setDoc(doc(db, "users", vendorUid, "nail_sets", pid), { isForSale: true }, { merge: true });
                }
              }
            } catch (e) {
              console.error(e);
            }
            setShowItemPicker(false);
            window.location.reload(); // Quick refresh to grab new items/order easily
          }}
        />
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

export default function CollectionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black/80">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    }>
      <CollectionPageContent />
    </Suspense>
  );
}
