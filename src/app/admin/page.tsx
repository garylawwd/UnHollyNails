"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { collection, collectionGroup, getDocs, doc, writeBatch, setDoc, getDoc, deleteDoc, query, where } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/context/AdminContext";
import { Product } from "@/lib/types";
import { VENDOR_UID, VALID_ADMINS, formatStorageImageUrl } from "@/lib/constants";
import { useNailOptions } from "@/hooks/useNailOptions";

interface CollectionMeta {
  tag: string;
  title: string;
  description: string;
  backgroundImageUrl: string; cardImageUrl?: string; cardBgScale?: number;
  inRibbon?: boolean;
    isFeatured?: boolean;
  headerColor?: string;
  descriptionColor?: string;
  ombreStart?: string;
  ombreEnd?: string;
  bgScale?: number;
  includedProductIds?: string[];
}

const STORE_OWNER_UID = VENDOR_UID;

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  const router = useRouter();
  const { setEditMode, setEditingProduct: setGlobalEditingProduct } = useAdmin();
  const {
    shapes: nailShapes,
    lengths: nailLengths,
    addShape,
    removeShape,
    renameShape,
    addLength,
    removeLength,
    renameLength,
  } = useNailOptions();
  const [newShapeInput, setNewShapeInput] = useState("");
  const [newLengthInput, setNewLengthInput] = useState("");
  const [editingShapeItem, setEditingShapeItem] = useState<{ old: string; current: string } | null>(null);
  const [editingLengthItem, setEditingLengthItem] = useState<{ old: string; current: string } | null>(null);

  // Loyalty & Client Milestone State
  const [defaultLoyaltyReward, setDefaultLoyaltyReward] = useState<string>("Free Delivery");
  const [secondaryLoyaltyReward, setSecondaryLoyaltyReward] = useState<string>("Free Gift");
  const [loyaltyQuickPresets, setLoyaltyQuickPresets] = useState<string[]>([
    "Free Delivery",
    "Free Gift",
    "Free Application Pack",
    "Free Sizing Kit for a Friend",
    "Free Nail Book",
    "€10 Off Next Set",
  ]);
  const [savingDefaultLoyalty, setSavingDefaultLoyalty] = useState(false);
  const [adminClients, setAdminClients] = useState<any[]>([]);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [selectedClientForLoyalty, setSelectedClientForLoyalty] = useState<any | null>(null);
  const [clientMilestonesDraft, setClientMilestonesDraft] = useState<Record<string, string>>({});
  const [savingClientMilestones, setSavingClientMilestones] = useState(false);

  const [activeTab, setActiveTab] = useState<"inventory" | "collections" | "studio">("inventory");
  
  const [inventory, setInventory] = useState<Product[]>([]);
  const [inventoryFilter, setInventoryFilter] = useState<string>("All");
  const [loadingInventory, setLoadingInventory] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagInput, setBulkTagInput] = useState("");
  
  const [collectionMetadata, setCollectionMetadata] = useState<Record<string, CollectionMeta>>({});
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; message: string; isConfirm: boolean; onConfirm?: () => void }>({ isOpen: false, title: "", message: "", isConfirm: false });

  const showModal = (title: string, message: string) => {
    setModalState({ isOpen: true, title, message, isConfirm: false });
  };

  const confirmModal = (title: string, message: string, onConfirm: () => void) => {
    setModalState({ isOpen: true, title, message, isConfirm: true, onConfirm });
  };

  const handleOpenPageInEditMode = (route: string) => {
    setEditMode(true);
    router.push(route);
  };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  
  const bgInputRef = useRef<HTMLInputElement>(null);
  const cardBgInputRef = useRef<HTMLInputElement>(null);
  const productImgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setLoadingAuth(false);
      if (currentUser && VALID_ADMINS.includes(currentUser.uid)) {
        setUser(currentUser);
        fetchInventory(STORE_OWNER_UID);
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      if (!VALID_ADMINS.includes(result.user.uid)) {
        await signOut(auth);
        showModal("Access Denied", `Your account (${result.user.uid}) does not have administrator privileges.`);
      }
    } catch (err) {
      console.error("Admin login failed:", err);
    }
  };

  const handleSaveDefaultLoyaltyReward = async () => {
    const cleanedDefault = defaultLoyaltyReward.trim() || "Free Delivery";
    const cleanedSecondary = secondaryLoyaltyReward.trim() || "Free Gift";
    setSavingDefaultLoyalty(true);
    try {
      await setDoc(
        doc(db, "users", STORE_OWNER_UID, "store_settings", "loyalty_config"),
        {
          defaultReward: cleanedDefault,
          secondaryReward: cleanedSecondary,
          quickPresets: loyaltyQuickPresets,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      setDefaultLoyaltyReward(cleanedDefault);
      setSecondaryLoyaltyReward(cleanedSecondary);
      showModal("Saved", `Global loyalty defaults saved! (5th: "${cleanedDefault}", 10th: "${cleanedSecondary}")`);
    } catch (err) {
      console.error("Failed to save default loyalty reward:", err);
      showModal("Error", "Could not save default loyalty rewards.");
    } finally {
      setSavingDefaultLoyalty(false);
    }
  };

  const handleSelectClientForLoyalty = (clientObj: any) => {
    setSelectedClientForLoyalty(clientObj);
    const existing: Record<string, string> =
      clientObj.loyaltyMilestones && typeof clientObj.loyaltyMilestones === "object"
        ? { ...clientObj.loyaltyMilestones }
        : {};
    setClientMilestonesDraft(existing);
  };

  const handleSaveClientMilestones = async () => {
    if (!selectedClientForLoyalty) return;
    setSavingClientMilestones(true);
    try {
      const cleanedMap: Record<string, string> = {};
      Object.entries(clientMilestonesDraft).forEach(([k, v]) => {
        if (typeof v === "string" && v.trim()) {
          cleanedMap[k] = v.trim();
        }
      });
      const targetId = selectedClientForLoyalty.syncId || selectedClientForLoyalty.docId;
      await setDoc(
        doc(db, "users", STORE_OWNER_UID, "clients", targetId),
        {
          id: 0,
          loyaltyMilestones: cleanedMap,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      setAdminClients((prev) =>
        prev.map((c) =>
          (c.syncId || c.docId) === targetId
            ? { ...c, loyaltyMilestones: cleanedMap }
            : c
        )
      );
      setSelectedClientForLoyalty((prev: any) =>
        prev ? { ...prev, loyaltyMilestones: cleanedMap } : null
      );
      showModal(
        "Saved",
        `Custom loyalty milestones saved for ${selectedClientForLoyalty.name || "client"}!`
      );
    } catch (err) {
      console.error("Failed to save client milestones:", err);
      showModal("Error", "Could not save client milestones.");
    } finally {
      setSavingClientMilestones(false);
    }
  };

  const fetchInventory = async (uid: string) => {
    setLoadingInventory(true);
    try {
      // Load global default loyalty reward & client list for Loyalty Manager
      try {
        const loyaltySnap = await getDoc(doc(db, "users", uid, "store_settings", "loyalty_config"));
        if (loyaltySnap.exists()) {
          const lData = loyaltySnap.data();
          if (typeof lData.defaultReward === "string") {
            setDefaultLoyaltyReward(lData.defaultReward || "Free Delivery");
          }
          if (typeof lData.secondaryReward === "string") {
            setSecondaryLoyaltyReward(lData.secondaryReward || "Free Gift");
          }
          if (Array.isArray(lData.quickPresets) && lData.quickPresets.length > 0) {
            setLoyaltyQuickPresets(lData.quickPresets);
          }
        }
        const clientsSnap = await getDocs(collection(db, "users", uid, "clients"));
        const loadedClients = clientsSnap.docs
          .map((d) => ({ docId: d.id, ...d.data() } as any))
          .filter((c) => !c.isDeleted)
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setAdminClients(loadedClients);
      } catch (e) {
        console.warn("Could not load loyalty config or clients:", e);
      }

      // Fetch all items for this user (no isForSale filter)
      const q = collection(db, "users", uid, "nail_sets");
      const snapshot = await getDocs(q);
      
      // Fetch the Android app's separate multi-photo collection for this vendor
      const imagesSnapshot = await getDocs(collection(db, "users", uid, "set_images"));
      const allSetImages = imagesSnapshot.docs.map(doc => doc.data());

      const items = snapshot.docs.map(d => {
        const data = d.data();
        const syncId = data.syncId || d.id;
        
        const androidExtraImages = allSetImages
          .filter(img => img.setSyncId === syncId && img.uri)
          .sort((a, b) => (a.position || 0) - (b.position || 0))
          .map(img => formatStorageImageUrl(img.uri as string, uid));
          
        const webExtraImages = (data.additionalImages || []).map((url: string) =>
          formatStorageImageUrl(url, uid)
        );
        const mergedExtras = Array.from(new Set([...webExtraImages, ...androidExtraImages]));

        let primaryImage = data.imagePath;
        if ((!primaryImage || !primaryImage.startsWith('http')) && mergedExtras.length > 0) {
          primaryImage = mergedExtras.find(img => img.startsWith("http")) || mergedExtras[0];
        } else {
          primaryImage = formatStorageImageUrl(primaryImage, uid);
        }

        // Deduplicate the primary image from the extra images list so it's not doubled up
        const finalExtraImages = mergedExtras.filter(img => img !== primaryImage);

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
          isPromo: data.isPromo === true,
          category: data.category || 'Uncategorized',
          tags: data.tags || [],
          syncId: syncId,
          isForSale: data.isForSale === true,
          type: data.type || 'Sets'
        } as Product & { isForSale: boolean };
      });
      setInventory(items);
      
      // Extract unique tags and fetch their metadata
      const tags = new Set<string>();
      items.forEach(i => i.tags?.forEach((t: string) => tags.add(t)));
      
      const metaRecord: Record<string, CollectionMeta> = {};
      
      // Fetch all collections from collection_settings
      const collectionSettingsSnap = await getDocs(collection(db, "users", uid, "collection_settings"));
      collectionSettingsSnap.docs.forEach(doc => {
          if (doc.id === "--ribbon_layout--") return;
        metaRecord[doc.id] = doc.data() as CollectionMeta;
      });

      // Also ensure any tags present on items are included, even if they don't have settings yet
      for (const tag of Array.from(tags)) {
        if (!metaRecord[tag]) {
          const metaDoc = await getDoc(doc(db, "users", uid, "collection_settings", tag));
          if (metaDoc.exists()) {
            metaRecord[tag] = metaDoc.data() as CollectionMeta;
          }
        }
      }
      setCollectionMetadata(metaRecord);

    } catch (error) {
      console.error("Error fetching inventory:", error);
      showModal("Error", "Error fetching inventory. Check permissions.");
    } finally {
      setLoadingInventory(false);
    }
  };

  const uniqueTags = useMemo(() => {
    const basePages = ["all", "special-offers", "sets", "minis", "keychains", "earrings", "accessories", "basics"];
    const customPages = Object.keys(collectionMetadata).filter(k => !basePages.includes(k));
    return [...basePages, ...customPages];
  }, [collectionMetadata]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (selectedIds.size === inventory.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(inventory.map(i => i.id)));
  };

  const handleBulkAddTag = async () => {
    if (!user || !bulkTagInput.trim() || selectedIds.size === 0) return;
    const tagToAdd = bulkTagInput.trim();
    
    try {
      const batch = writeBatch(db);
      const updatedInventory = [...inventory];
      
      selectedIds.forEach(id => {
        const itemIndex = updatedInventory.findIndex(i => i.id === id);
        if (itemIndex > -1) {
          const item = updatedInventory[itemIndex];
          if (!item.tags.includes(tagToAdd)) {
            const newTags = [...item.tags, tagToAdd];
            updatedInventory[itemIndex] = { ...item, tags: newTags };
            batch.update(doc(db, item.docPath), { tags: newTags });
          }
        }
      });
      
      await batch.commit();
      setInventory(updatedInventory);
      setBulkTagInput("");
      setSelectedIds(new Set());
      showModal("Success", `Tag "${tagToAdd}" added to selected items!`);
    } catch (error) {
      console.error(error);
      showModal("Error", "Failed to bulk tag.");
    }
  };

  const handleBulkToggleVisibility = async (makeVisible: boolean) => {
    if (!user || selectedIds.size === 0) return;
    try {
      const batch = writeBatch(db);
      const updatedInventory = [...inventory];
      
      selectedIds.forEach(id => {
        const itemIndex = updatedInventory.findIndex(i => i.id === id);
        if (itemIndex > -1) {
          updatedInventory[itemIndex] = { ...updatedInventory[itemIndex], isForSale: makeVisible };
          batch.update(doc(db, updatedInventory[itemIndex].docPath), { isForSale: makeVisible });
        }
      });
      
      await batch.commit();
      setInventory(updatedInventory);
      setSelectedIds(new Set());
    } catch (error) {
      console.error(error);
      showModal("Error", "Failed to update visibility.");
    }
  };

  const saveProductDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSavingProduct(true);
    try {
      let newImgUrl = editingProduct.imagePath;

      if (productImgRef.current?.files && productImgRef.current.files.length > 0) {
        const file = productImgRef.current.files[0];
        const storageReference = ref(storage, `users/${STORE_OWNER_UID}/images/product_${Date.now()}_${file.name}`);
        await uploadBytes(storageReference, file);
        newImgUrl = await getDownloadURL(storageReference);
      }

      const updatedProduct: Product = {
        ...editingProduct,
        imagePath: newImgUrl || "",
        description: editingProduct.description || "",
        updatedAt: Date.now()
      };

      const targetSyncId = editingProduct.syncId || editingProduct.id;
      const firestorePayload = {
        id: 0,
        syncId: targetSyncId,
        name: updatedProduct.name,
        description: updatedProduct.description || "",
        basePrice: Number(updatedProduct.basePrice) || 0,
        priceOnAsk: Boolean(updatedProduct.priceOnAsk),
        type: updatedProduct.type || "Sets",
        isPromo: Boolean(updatedProduct.isPromo),
        isForSale: updatedProduct.isForSale !== undefined ? Boolean(updatedProduct.isForSale) : true,
        tags: updatedProduct.tags || [],
        imagePath: updatedProduct.imagePath || "",
        additionalImages: updatedProduct.additionalImages || [],
        defaultShape: updatedProduct.defaultShape || "Almond",
        defaultLength: updatedProduct.defaultLength || "Medium",
        updatedAt: Date.now()
      };

      await setDoc(doc(db, editingProduct.docPath), firestorePayload, { merge: true });
      
      setInventory(prev => {
        const exists = prev.find(p => p.id === updatedProduct.id);
        if (exists) return prev.map(p => p.id === updatedProduct.id ? updatedProduct : p);
        return [updatedProduct, ...prev];
      });
      showModal("Success", "Product saved successfully!");
      setEditingProduct(null);
    } catch (err) {
      console.error(err);
      showModal("Error", "Failed to save product.");
    } finally {
      setSavingProduct(false);
    }
  };

  const saveCollectionMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTag) return;
    
    setSavingCollection(true);
    try {
      const meta = collectionMetadata[selectedTag] || { 
        tag: selectedTag, 
        title: selectedTag, 
        description: "", 
        backgroundImageUrl: "", 
        inRibbon: false,
        isFeatured: false,
        headerColor: "#171717",
        headerBgColor: "#ffffff",
        descriptionColor: "#4b5563",
        ombreStart: "#fbcfe8",
        ombreEnd: "#ffffff",
        bgScale: 100
      };
      let newImageUrl = meta.backgroundImageUrl;
        let newCardImageUrl = meta.cardImageUrl;
  
        if (bgInputRef.current?.files && bgInputRef.current.files.length > 0) {
          const file = bgInputRef.current.files[0];
          const storageReference = ref(storage, `users/${STORE_OWNER_UID}/images/bg_${Date.now()}_${file.name}`);
          await uploadBytes(storageReference, file);
          newImageUrl = await getDownloadURL(storageReference);
        }

        if (cardBgInputRef.current?.files && cardBgInputRef.current.files.length > 0) {
          const file = cardBgInputRef.current.files[0];
          const storageReference = ref(storage, `users/${STORE_OWNER_UID}/images/card_${Date.now()}_${file.name}`);
          await uploadBytes(storageReference, file);
          newCardImageUrl = await getDownloadURL(storageReference);
        }
  
        const updatedMeta = { ...meta, backgroundImageUrl: newImageUrl || "", cardImageUrl: newCardImageUrl || "" };
      
      if (updatedMeta.tag && updatedMeta.tag !== selectedTag) {
        // They renamed the custom slug!
        const newSlug = updatedMeta.tag.toLowerCase().replace(/\s+/g, '-');
        updatedMeta.tag = newSlug;
        await setDoc(doc(db, "users", STORE_OWNER_UID, "collection_settings", newSlug), updatedMeta);
        
        // Only delete old one if it wasn't a brand new unsaved page
        if (selectedTag && selectedTag !== newSlug) { await deleteDoc(doc(db, "users", STORE_OWNER_UID, "collection_settings", selectedTag)); }
        
        setCollectionMetadata(prev => {
          const next = { ...prev };
          delete next[selectedTag];
          next[newSlug] = updatedMeta;
          return next;
        });
        setSelectedTag(newSlug);
      } else {
        await setDoc(doc(db, "users", STORE_OWNER_UID, "collection_settings", selectedTag), updatedMeta);
        setCollectionMetadata(prev => ({ ...prev, [selectedTag]: updatedMeta }));
      }
      
      showModal("Success", "Collection settings saved!");
    } catch (err) {
      console.error(err);
      showModal("Error", "Failed to save collection settings.");
    } finally {
      setSavingCollection(false);
    }
  };

  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-neutral-500 mb-6 text-sm">Please sign in to manage your store.</p>
          <button onClick={handleLogin} className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-neutral-800 transition">
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-neutral-50 text-neutral-900 font-sans">
      {/* Mobile Top Nav */}
      <div className="md:hidden flex flex-col bg-white border-b sticky top-0 z-50 shadow-sm w-full">
          <div className="flex items-center justify-between p-3 border-b">
            <h1 className="font-black tracking-tight text-lg">UnHolly Admin</h1>
            <button onClick={() => signOut(auth)} className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-full border border-red-100 active:scale-95 transition-transform">Logout</button>
          </div>
          <div className="flex p-2 gap-2 bg-neutral-100">
            <a 
                href="/"
                className="flex-1 py-2 flex items-center justify-center gap-1.5 rounded-lg bg-pink-50 text-pink-500 shadow-sm border border-pink-200 active:scale-95 transition-transform"
                title="Return to Storefront"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" /></svg>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" /></svg>
              </a>
            <button 
              onClick={() => setActiveTab("inventory")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg active:scale-95 transition-all ${activeTab === "inventory" ? "bg-black text-white shadow-md ring-2 ring-black ring-offset-2 ring-offset-neutral-100" : "bg-white text-neutral-600 shadow-sm border border-neutral-200"}`}
            >
              Inventory
            </button>
            <button 
              onClick={() => setActiveTab("collections")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg active:scale-95 transition-all ${activeTab === "collections" ? "bg-black text-white shadow-md ring-2 ring-black ring-offset-2 ring-offset-neutral-100" : "bg-white text-neutral-600 shadow-sm border border-neutral-200"}`}
            >
              Collections
            </button>
            <button 
              onClick={() => setActiveTab("studio")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg active:scale-95 transition-all ${activeTab === "studio" ? "bg-black text-white shadow-md ring-2 ring-black ring-offset-2 ring-offset-neutral-100" : "bg-white text-neutral-600 shadow-sm border border-neutral-200"}`}
            >
              Studio & Pricing
            </button>
          </div>
        </div>

      {/* Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r h-screen sticky top-0 flex-col">
        <div className="hidden md:block p-6 border-b">
          <h1 className="font-black text-xl tracking-tight">UnHolly Admin</h1>
          <p className="text-xs text-neutral-500 mt-1">{user.email}</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <a 
            href="/"
            className="block w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition text-pink-600 hover:bg-pink-50 border border-pink-100"
          >
            ← Return to Storefront
          </a>
          <button 
            onClick={() => { setActiveTab("inventory"); setMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition ${activeTab === "inventory" ? "bg-black text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
          >
            📦 Inventory Master
          </button>
          <button 
            onClick={() => { setActiveTab("collections"); setMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition ${activeTab === "collections" ? "bg-black text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
          >
            🎨 Collection Pages
          </button>
          <button 
            onClick={() => { setActiveTab("studio"); setMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition ${activeTab === "studio" ? "bg-black text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
          >
            ✨ Studio Pages & Pricing
          </button>
        </nav>
        <div className="p-4 border-t">
          <button onClick={() => signOut(auth)} className="w-full text-left px-4 py-2 text-sm text-red-500 font-bold hover:bg-red-50 rounded-lg transition">Log Out</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto block">
        
        {/* INVENTORY TAB */}
        {activeTab === "inventory" && (
          <div className="p-8">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                <h2 className="text-3xl font-black mb-2">Inventory Master</h2>
                <p className="text-neutral-500 text-sm">Manage all your designs, including private portfolio items.</p>
              </div>
              <button 
                onClick={() => {
                  const newId = crypto.randomUUID();
                  setEditingProduct({
                    id: newId,
                    syncId: newId,
                    docPath: `users/${STORE_OWNER_UID}/nail_sets/${newId}`,
                    name: "New Item",
                    description: "",
                    basePrice: 0,
                    priceOnAsk: false,
                    type: "Sets",
                    category: "Basics",
                    isPromo: false,
                    tags: [],
                    isForSale: false,
                    imagePath: "",
                    additionalImages: []
                  } as Product);
                }}
                className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-neutral-800 transition shadow text-sm w-full md:w-auto"
              >
                + Create New Item
              </button>
            </header>

            {/* Filter Chips */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">
              {['All', 'Sets', 'Minis', 'Keychains', 'Earrings', 'Accessories', 'Basics'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setInventoryFilter(filter)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors border ${inventoryFilter === filter ? 'bg-black text-white border-black' : 'bg-white text-neutral-500 border-neutral-200 hover:border-black hover:text-black'}`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
              <div className="bg-pink-50 border border-pink-200 rounded-2xl p-3 md:p-4 mb-6 flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4 sticky top-4 z-10 shadow-lg shadow-pink-100/50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-pink-800 bg-pink-200 px-3 py-1 rounded-full text-xs md:text-sm whitespace-nowrap">{selectedIds.size} selected</span>
                  {/* Mobile Bulk Actions */}
                  <div className="flex sm:hidden items-center gap-2">
                    <button onClick={() => handleBulkToggleVisibility(true)} className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">Live</button>
                    <button onClick={() => handleBulkToggleVisibility(false)} className="bg-neutral-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">Hide</button>
                  </div>
                </div>
                
                <div className="flex bg-white rounded-lg p-1 border shadow-sm w-full md:w-auto md:ml-auto">
                  <input type="text" value={bulkTagInput} onChange={e => setBulkTagInput(e.target.value)} placeholder="e.g. Halloween" className="px-3 py-1 text-sm outline-none w-full min-w-0" />
                  <button onClick={handleBulkAddTag} className="bg-black text-white px-4 py-1.5 rounded text-sm font-bold shrink-0">Add Tag</button>
                </div>

                <div className="h-6 w-px bg-pink-300 mx-2 hidden sm:block"></div>
                
                <div className="hidden sm:flex items-center gap-3">
                  <button onClick={() => handleBulkToggleVisibility(true)} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition">Publish to Store</button>
                  <button onClick={() => handleBulkToggleVisibility(false)} className="bg-neutral-800 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-bold transition">Hide from Store</button>
                </div>
              </div>
            )}

            {loadingInventory ? (
              <div className="animate-pulse flex space-x-4"><div className="h-10 bg-neutral-200 rounded w-full"></div></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                {inventory.filter(i => inventoryFilter === "All" ? true : i.type === inventoryFilter).map(item => {
                  // @ts-ignore
                  const isPublic = item.isForSale;
                  return (
                    <div key={item.id} className={`bg-white rounded-xl md:rounded-2xl border p-3 md:p-4 shadow-sm flex flex-col gap-2 transition ${selectedIds.has(item.id) ? 'ring-2 ring-pink-500 border-pink-500' : 'hover:border-neutral-300'}`}>
                      <div className="flex justify-between items-start">
                        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelection(item.id)} className="w-4 h-4 md:w-5 md:h-5 accent-pink-500" />
                        {isPublic ? <span className="bg-green-100 text-green-700 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[10px] md:text-xs font-bold">Live</span> : <span className="bg-neutral-100 text-neutral-500 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[10px] md:text-xs font-bold">Hidden</span>}
                      </div>
                      <div className="flex items-center gap-2 md:gap-4 mt-1">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-neutral-100 rounded-xl overflow-hidden relative border shrink-0">
                          {item.imagePath ? (
                            <Image src={item.imagePath} alt="" fill className="object-cover" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-[8px] md:text-[10px] text-center text-neutral-400 font-bold p-1 leading-tight">No Image</div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm md:text-base leading-tight text-neutral-900 truncate">{item.name}</span>
                          <span className="font-bold text-pink-600 text-xs md:text-sm mt-0.5">{item.priceOnAsk ? 'POA' : `€${item.basePrice.toFixed(2)}`}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1 hidden md:flex">
                        {item.tags?.map((t: string) => <span key={t} className="bg-neutral-100 border text-neutral-600 text-[10px] px-2 py-0.5 rounded-full">{t}</span>)}
                        {(!item.tags || item.tags.length === 0) && <span className="text-neutral-400 italic text-xs">No tags</span>}
                      </div>
                      <button 
                        onClick={() => setEditingProduct(item)}
                        className="mt-auto pt-2 border-t w-full text-center text-xs md:text-sm font-bold text-black hover:text-pink-600 transition"
                      >
                        Edit
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* COLLECTIONS TAB */}
        {activeTab === "collections" && (
          <div className="p-8">
            <header className="mb-8">
              <h2 className="text-3xl font-black mb-2">Collection Designer</h2>
              <p className="text-neutral-500 text-sm">Design custom landing pages for your tagged collections (e.g. Halloween).</p>
            </header>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
              <div className="w-full lg:w-1/3 bg-white border rounded-2xl p-4 shadow-sm">
                <h3 className="font-bold mb-4 px-2 text-neutral-500 text-xs uppercase tracking-wider">Your Pages</h3>
                <div className="space-y-1 mb-4">
                  {uniqueTags.map(tag => {
                    const displayName = tag.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    return (
                      <button 
                        key={tag} 
                        onClick={() => setSelectedTag(tag)}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm transition font-bold flex justify-between items-center ${selectedTag === tag ? 'bg-pink-50 text-pink-600 border border-pink-200' : 'hover:bg-neutral-50 border border-transparent'}`}
                      >
                        {displayName}
                        {collectionMetadata[tag]?.backgroundImageUrl && <span className="text-[10px] bg-pink-100 text-pink-500 px-2 py-0.5 rounded-full">Designed</span>}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => {
                    setSelectedTag("new-custom-page");
                    if (!collectionMetadata["new-custom-page"]) {
                      setCollectionMetadata(p => ({...p, "new-custom-page": { tag: "new-custom-page", title: "New Page", description: "", backgroundImageUrl: "" }}));
                    }
                  }}
                  className="w-full bg-black text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-neutral-800 transition shadow"
                >
                  + Create Custom Page
                </button>
              </div>

              <div className="w-full lg:flex-1 bg-white border rounded-2xl shadow-sm overflow-hidden">
                {!selectedTag ? (
                  <div className="p-12 text-center text-neutral-400">
                    <span className="text-4xl mb-4 hidden lg:block">👈</span>
                    <span className="text-4xl mb-4 lg:hidden">👆</span>
                    <p>Select a page from the list to design its landing page.</p>
                  </div>
                ) : (
                  <form onSubmit={saveCollectionMeta} className="flex flex-col h-full">
                    <div className="p-4 sm:p-6 border-b bg-neutral-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-black text-xl truncate">Design /{selectedTag}</h3>
                        <p className="text-xs text-neutral-500 mt-1 truncate">unhollynails.com/collections/{selectedTag.toLowerCase().replace(/\s+/g, '-')}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {!["all", "special-offers", "sets", "minis", "keychains", "earrings", "accessories", "basics"].includes(selectedTag) && (
                          <button 
                            type="button" 
                            onClick={() => {
                              confirmModal("Delete Page", "Are you sure you want to delete this custom page?", async () => {
                                try {
                                  await deleteDoc(doc(db, "users", STORE_OWNER_UID, "collection_settings", selectedTag));
                                  setCollectionMetadata(prev => {
                                    const next = { ...prev };
                                    delete next[selectedTag];
                                    return next;
                                  });
                                  setSelectedTag(null);
                                  } catch(e: any) {
                                    console.error("Delete failed", e);
                                    showModal("Delete Failed", "Failed to delete page: " + (e.message || "Unknown error"));
                                  }
                                });
                              }}
                            className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-100 transition text-sm whitespace-nowrap"
                          >
                            Delete
                          </button>
                        )}
                        <button type="submit" disabled={savingCollection} className="bg-black text-white px-6 py-2 rounded-lg font-bold hover:bg-neutral-800 disabled:opacity-50 text-sm whitespace-nowrap">
                          {savingCollection ? "Saving..." : "Save Page"}
                        </button>
                      </div>
                    </div>

                    <div className="p-4 sm:p-6 space-y-6">
                      {!["all", "special-offers", "sets", "minis", "keychains", "earrings", "accessories", "basics"].includes(selectedTag) && (
                        <div>
                          <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Page URL Slug</label>
                          <input 
                            type="text" 
                            value={collectionMetadata[selectedTag]?.tag ?? selectedTag} 
                            onChange={e => setCollectionMetadata(p => ({...p, [selectedTag]: {...(p[selectedTag] || {}), tag: e.target.value.toLowerCase().replace(/\s+/g, '-')}}))}
                            className="w-full border rounded-xl px-4 py-3 font-medium text-sm bg-neutral-50"
                            placeholder="e.g. winter-collection"
                          />
                          <p className="text-xs text-neutral-400 mt-1">Changing this will change the URL of the page.</p>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Display Title</label>
                        <input 
                          type="text" 
                          value={collectionMetadata[selectedTag]?.title ?? selectedTag} 
                          onChange={e => setCollectionMetadata(p => ({...p, [selectedTag]: {...(p[selectedTag] || {}), title: e.target.value, tag: selectedTag}}))}
                          className="w-full border rounded-xl px-4 py-3 font-bold text-lg"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Description / Subtitle (Optional)</label>
                        <textarea 
                          value={collectionMetadata[selectedTag]?.description || ""} 
                          onChange={e => setCollectionMetadata(p => ({...p, [selectedTag]: {...(p[selectedTag] || {}), description: e.target.value, tag: selectedTag}}))}
                          className="w-full border rounded-xl px-4 py-3 h-24"
                          placeholder="Get ready for spooky season..."
                        />
                      </div>

                      {!["all", "special-offers", "sets", "minis", "keychains", "earrings", "accessories", "basics"].includes(selectedTag) && (
                        <div className="mb-6">
                          <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Included Products</label>
                        <div className="h-64 overflow-y-auto border rounded-xl p-2 bg-white flex flex-col gap-1 shadow-inner">
                          {inventory.map(item => (
                            <label key={item.id} className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-lg cursor-pointer transition">
                              <input 
                                type="checkbox" 
                                checked={collectionMetadata[selectedTag]?.includedProductIds?.includes(item.id) || false}
                                onChange={(e) => {
                                  const currentIds = collectionMetadata[selectedTag]?.includedProductIds || [];
                                  const newIds = e.target.checked 
                                    ? [...currentIds, item.id] 
                                    : currentIds.filter(id => id !== item.id);
                                  setCollectionMetadata(p => ({...p, [selectedTag]: {...(p[selectedTag] || {}), includedProductIds: newIds, tag: selectedTag}}));
                                }}
                                className="w-5 h-5 text-pink-500 rounded border-gray-300 focus:ring-pink-500"
                              />
                              <div className="flex items-center gap-3">
                                <Image src={item.imagePath} alt="" width={40} height={40} className="w-10 h-10 rounded-md object-cover border" />
                                <span className="text-sm font-bold text-neutral-800">{item.name}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-neutral-400 mt-2">If no items are selected, this page will automatically pull products tagged with exactly "{selectedTag}". If you select specific items here, it will ONLY pull the selected items.</p>
                      </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Title Text Color</label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="color" 
                              value={collectionMetadata[selectedTag]?.headerColor || "#171717"}
                              onChange={e => setCollectionMetadata(p => ({...p, [selectedTag]: {...(p[selectedTag] || {}), headerColor: e.target.value, tag: selectedTag}}))}
                              className="w-12 h-12 rounded cursor-pointer border-0 p-0"
                            />
                            <span className="text-sm font-mono">{collectionMetadata[selectedTag]?.headerColor || "#171717"}</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Description Color</label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="color" 
                              value={collectionMetadata[selectedTag]?.descriptionColor || "#4b5563"}
                              onChange={e => setCollectionMetadata(p => ({...p, [selectedTag]: {...(p[selectedTag] || {}), descriptionColor: e.target.value, tag: selectedTag}}))}
                              className="w-12 h-12 rounded cursor-pointer border-0 p-0"
                            />
                            <span className="text-sm font-mono">{collectionMetadata[selectedTag]?.descriptionColor || "#4b5563"}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Ombre Gradient</label>
                        <div className="flex items-center gap-3">
                          <input type="color" value={collectionMetadata[selectedTag]?.ombreStart || "#fbcfe8"} onChange={e => setCollectionMetadata(p => ({...p, [selectedTag]: {...(p[selectedTag] || {}), ombreStart: e.target.value, tag: selectedTag}}))} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                          <div className="flex-1 h-8 rounded-lg" style={{ background: `linear-gradient(to right, ${collectionMetadata[selectedTag]?.ombreStart || '#fbcfe8'}, ${collectionMetadata[selectedTag]?.ombreEnd || '#ffffff'})` }}></div>
                          <input type="color" value={collectionMetadata[selectedTag]?.ombreEnd || "#ffffff"} onChange={e => setCollectionMetadata(p => ({...p, [selectedTag]: {...(p[selectedTag] || {}), ombreEnd: e.target.value, tag: selectedTag}}))} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-2 flex justify-between">
                          <span>Custom Splashback / Overlay Image</span>
                          <span className="text-pink-500 font-normal">Optional</span>
                        </label>
                        <div className="border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center bg-neutral-50 hover:bg-neutral-100 transition relative overflow-hidden group">
                          {collectionMetadata[selectedTag]?.backgroundImageUrl && (
                            <div className="absolute inset-0 z-0 opacity-50 group-hover:opacity-20 transition flex items-center justify-center">
                              <div style={{ transform: `scale(${(collectionMetadata[selectedTag]?.bgScale || 100) / 100})`, width: '100%', height: '100%', position: 'relative' }}>
                                <Image src={collectionMetadata[selectedTag].backgroundImageUrl} alt="bg" fill className="object-cover" />
                                </div>
                                <button onClick={(e) => { e.preventDefault(); setCollectionMetadata(p => ({...p, [selectedTag]: {...(p[selectedTag] || {}), backgroundImageUrl: ""}})); if(bgInputRef.current) bgInputRef.current.value = ""; }} className="absolute bottom-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow z-[9999]">Remove</button>
                              </div>
                            )}
                          <div className="relative z-10 flex flex-col items-center bg-white/90 backdrop-blur p-4 rounded-xl shadow-sm w-full max-w-sm">
                            <input type="file" ref={bgInputRef} accept="image/*" className="text-sm w-full mb-4" />
                            
                            <div className="w-full">
                              <label className="block text-xs font-bold text-neutral-500 mb-1">Image Scale: {collectionMetadata[selectedTag]?.bgScale || 100}%</label>
                              <input 
                                type="range" 
                                min="10" max="300" 
                                value={collectionMetadata[selectedTag]?.bgScale || 100}
                                onChange={e => setCollectionMetadata(p => ({...p, [selectedTag]: {...(p[selectedTag] || {}), bgScale: parseInt(e.target.value), tag: selectedTag}}))}
                                className="w-full accent-pink-500"
                              />
                            </div>
                            
                            <p className="text-[10px] text-neutral-500 mt-3 text-center leading-tight">Upload a transparent PNG to overlay on top of the ombre, or a full photo.</p>
                          </div>
                        </div>
                      </div>
                        <div>
                          <label className="block text-xs font-bold text-neutral-500 uppercase mb-2 flex justify-between">
                            <span>Home Page Featured Card Image</span>
                            <span className="text-pink-500 font-normal">Optional</span>
                          </label>
                          <div className="border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center bg-neutral-50 hover:bg-neutral-100 transition relative overflow-hidden group">
                            {collectionMetadata[selectedTag]?.cardImageUrl && (
                              <div className="absolute inset-0 z-0 opacity-50 group-hover:opacity-20 transition flex items-center justify-center">
                                <div style={{ transform: `scale(${(collectionMetadata[selectedTag]?.cardBgScale || collectionMetadata[selectedTag]?.bgScale || 100) / 100})`, width: '100%', height: '100%', position: 'relative' }}>
                                  <Image src={collectionMetadata[selectedTag].cardImageUrl} alt="card-bg" fill className="object-contain" />
                                </div>
                                <button onClick={(e) => { e.preventDefault(); setCollectionMetadata(p => ({...p, [selectedTag]: {...(p[selectedTag] || {}), cardImageUrl: ""}})); if(cardBgInputRef.current) cardBgInputRef.current.value = ""; }} className="absolute bottom-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow z-[9999]">Remove</button>
                              </div>
                            )}
                            <div className="relative z-10 flex flex-col items-center bg-white/90 backdrop-blur p-4 rounded-xl shadow-sm w-full max-w-sm">
                              <input type="file" ref={cardBgInputRef} accept="image/*" className="text-sm w-full mb-4" />
                              
                              <div className="w-full">
                                <label className="block text-xs font-bold text-neutral-500 mb-1">Card Image Scale: {collectionMetadata[selectedTag]?.cardBgScale || collectionMetadata[selectedTag]?.bgScale || 100}%</label>
                                <input 
                                  type="range" 
                                  min="10" max="300" 
                                  value={collectionMetadata[selectedTag]?.cardBgScale || collectionMetadata[selectedTag]?.bgScale || 100}
                                  onChange={e => setCollectionMetadata(p => ({...p, [selectedTag]: {...(p[selectedTag] || {}), cardBgScale: parseInt(e.target.value), tag: selectedTag}}))}
                                  className="w-full accent-pink-500"
                                />
                              </div>
                              
                              <p className="text-[10px] text-neutral-500 mt-3 text-center leading-tight">Different image just for the home page card. Falls back to splashback if empty.</p>
                            </div>
                          </div>
                        </div>

                      
                      <div className="pt-4 border-t">
                          <label className="flex items-center gap-3 cursor-pointer p-4 border rounded-xl hover:bg-neutral-50 transition bg-white relative z-10">
                            <input 
                              type="checkbox" 
                              checked={collectionMetadata[selectedTag]?.isFeatured || false}
                              onChange={e => setCollectionMetadata(p => ({...p, [selectedTag]: {...(p[selectedTag] || {}), isFeatured: e.target.checked, tag: selectedTag}}))}
                              className="w-5 h-5 accent-pink-500"
                            />
                            <div>
                              <span className="font-bold block">Show in Featured Collections (Home Page)</span>
                              <span className="text-xs text-neutral-500">Display this collection as a featured card on the Home Page.</span>
                            </div>
                          </label>
                      </div>

                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STUDIO PAGES & PRICING TAB */}
        {activeTab === "studio" && (
          <div className="p-4 sm:p-8 max-w-6xl mx-auto">
            <header className="mb-8">
              <span className="text-xs font-bold text-[#FF5C9D] uppercase tracking-widest block mb-1">Live Storefront Editing</span>
              <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">Studio Pages, Pricing & Guides</h2>
              <p className="text-sm text-neutral-500 max-w-2xl mt-1">
                Click any page below to open it in <strong>Live Edit Mode</strong>. You can click into any price, title, or description directly on the page, add or remove items, and your changes will save automatically to Firestore.
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  title: "Price List Menu",
                  route: "/menu",
                  icon: "📋",
                  desc: "Edit luxury press on tier prices (Plain €20, Minimal €25, Detailed €30, Character €35–€40), sizing kit voucher offers, keychains, and gift extras.",
                  badge: "Prices & Services",
                  color: "border-pink-200 hover:border-pink-400"
                },
                {
                  title: "Gift Bundles",
                  route: "/bundles",
                  icon: "🎁",
                  desc: "Edit Mini Me Matching Bundle (€55), Ultimate Luxury Bundle (€90), package perks, and Matchy-Matchy accessory add-on pricing.",
                  badge: "Gift Packs",
                  color: "border-pink-200 hover:border-pink-400"
                },
                {
                  title: "Mystery Boxes",
                  route: "/mystery-boxes",
                  icon: "✨",
                  desc: "Edit Kids' Mini Mystery Box (€25), Adult Mystery Box (€35), package items, and customer preference guidelines.",
                  badge: "Surprise Packs",
                  color: "border-pink-200 hover:border-pink-400"
                },
                {
                  title: "UnHollyNails Club",
                  route: "/club",
                  icon: "💳",
                  desc: "Edit digital loyalty stamp rewards (free delivery every 5 orders), complimentary birthday sets, account sign-in & DM join instructions.",
                  badge: "Loyalty Club",
                  color: "border-pink-200 hover:border-pink-400"
                },
                {
                  title: "Policies & Shipping",
                  route: "/policies",
                  icon: "📦",
                  desc: "Update An Post shipping rates (from €4.85 standard / €9 tracked), order size variations, 5–10 business day turnaround times, and cancellation rules.",
                  badge: "Shipping & Terms",
                  color: "border-neutral-200 hover:border-neutral-400"
                },
                {
                  title: "Sizing & Care Guides",
                  route: "/guides",
                  icon: "📏",
                  desc: "Edit the 3 sizing methods, millimeter sizing chart (XS-XL), sticky tab hairdryer application trick, and gentle removal instructions.",
                  badge: "Sizing Charts",
                  color: "border-pink-200 hover:border-pink-400"
                },
                {
                  title: "Contact & DMs",
                  route: "/contact",
                  icon: "💬",
                  desc: "Update Instagram handle (@unhollynails), Facebook links, customer order checklist, and response hours.",
                  badge: "Direct Orders",
                  color: "border-neutral-200 hover:border-neutral-400"
                },
                {
                  title: "About Studio",
                  route: "/about",
                  icon: "💖",
                  desc: "Edit Holly's studio story, turnaround details, bespoke hand-painted values, and signoff signature.",
                  badge: "Studio Bio",
                  color: "border-pink-200 hover:border-pink-400"
                },
              ].map((card) => (
                <div key={card.route} className={`bg-white rounded-2xl p-6 border ${card.color} shadow-sm flex flex-col justify-between transition-all hover:shadow-md group`}>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-3xl">{card.icon}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-pink-50 text-[#FF5C9D] border border-pink-100">
                        {card.badge}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg text-neutral-900 group-hover:text-[#FF5C9D] transition-colors mb-2">
                      {card.title}
                    </h3>
                    <p className="text-xs text-neutral-500 leading-relaxed mb-6">
                      {card.desc}
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenPageInEditMode(card.route)}
                    className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-[#FF5C9D] text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <span>✏️ Edit Page Now</span>
                    <span>→</span>
                  </button>
                </div>
              ))}
            </div>

            {/* DYNAMIC NAIL SHAPES & LENGTHS MANAGER */}
            <div className="mt-10 bg-white rounded-3xl p-6 sm:p-8 border border-pink-200 shadow-sm">
              <div className="mb-6">
                <span className="text-xs font-bold text-[#FF5C9D] uppercase tracking-widest block mb-1">
                  Synced Store & App Options
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                  💅 Manage Nail Shapes & Lengths
                </h3>
                <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                  Add, rename, or remove the standard nail shapes and lengths shown on the storefront and in PressOnPro. (&ldquo;Other&rdquo; is always included automatically so customers can type custom requests.)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Shapes Manager */}
                <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200">
                  <h4 className="font-bold text-sm uppercase tracking-wider text-neutral-800 mb-3">
                    Standard Nail Shapes ({nailShapes.length})
                  </h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {nailShapes.map((shape) => (
                      <div
                        key={shape}
                        className="flex items-center gap-1.5 bg-white border border-pink-200 rounded-xl px-3 py-1.5 shadow-xs"
                      >
                        {editingShapeItem?.old === shape ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingShapeItem.current}
                              onChange={(e) =>
                                setEditingShapeItem({
                                  old: shape,
                                  current: e.target.value,
                                })
                              }
                              className="w-24 border border-pink-400 rounded px-1.5 py-0.5 text-xs font-bold"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                await renameShape(shape, editingShapeItem.current);
                                setEditingShapeItem(null);
                              }}
                              className="text-xs font-bold text-green-600 hover:underline px-1 cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingShapeItem(null)}
                              className="text-xs text-neutral-400 hover:text-black px-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-xs font-bold text-neutral-800">
                              {shape}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingShapeItem({ old: shape, current: shape })
                              }
                              className="text-[10px] text-neutral-400 hover:text-pink-600 ml-1 cursor-pointer"
                              title="Rename shape"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                confirmModal(
                                  "Remove Shape",
                                  `Remove "${shape}" from standard store shapes?`,
                                  () => removeShape(shape)
                                )
                              }
                              className="text-xs text-neutral-400 hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                              title="Remove shape"
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newShapeInput}
                      onChange={(e) => setNewShapeInput(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && newShapeInput.trim()) {
                          e.preventDefault();
                          await addShape(newShapeInput);
                          setNewShapeInput("");
                        }
                      }}
                      placeholder="Add new shape (e.g. Ballerina, Duck)..."
                      className="flex-1 bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-pink-500"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!newShapeInput.trim()) return;
                        await addShape(newShapeInput);
                        setNewShapeInput("");
                      }}
                      className="px-4 py-2 rounded-xl bg-black hover:bg-[#FF5C9D] text-white text-xs font-bold transition cursor-pointer"
                    >
                      + Add Shape
                    </button>
                  </div>
                </div>

                {/* Lengths Manager */}
                <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200">
                  <h4 className="font-bold text-sm uppercase tracking-wider text-neutral-800 mb-3">
                    Standard Nail Lengths ({nailLengths.length})
                  </h4>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {nailLengths.map((len) => (
                      <div
                        key={len}
                        className="flex items-center gap-1.5 bg-white border border-pink-200 rounded-xl px-3 py-1.5 shadow-xs"
                      >
                        {editingLengthItem?.old === len ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingLengthItem.current}
                              onChange={(e) =>
                                setEditingLengthItem({
                                  old: len,
                                  current: e.target.value,
                                })
                              }
                              className="w-20 border border-pink-400 rounded px-1.5 py-0.5 text-xs font-bold"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                await renameLength(len, editingLengthItem.current);
                                setEditingLengthItem(null);
                              }}
                              className="text-xs font-bold text-green-600 hover:underline px-1 cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingLengthItem(null)}
                              className="text-xs text-neutral-400 hover:text-black px-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-xs font-bold text-neutral-800">
                              {len}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingLengthItem({ old: len, current: len })
                              }
                              className="text-[10px] text-neutral-400 hover:text-pink-600 ml-1 cursor-pointer"
                              title="Rename length"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                confirmModal(
                                  "Remove Length",
                                  `Remove "${len}" from standard store lengths?`,
                                  () => removeLength(len)
                                )
                              }
                              className="text-xs text-neutral-400 hover:text-red-500 font-bold ml-0.5 cursor-pointer"
                              title="Remove length"
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newLengthInput}
                      onChange={(e) => setNewLengthInput(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && newLengthInput.trim()) {
                          e.preventDefault();
                          await addLength(newLengthInput);
                          setNewLengthInput("");
                        }
                      }}
                      placeholder="Add new length (e.g. XXL, Short-Med)..."
                      className="flex-1 bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-pink-500"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!newLengthInput.trim()) return;
                        await addLength(newLengthInput);
                        setNewLengthInput("");
                      }}
                      className="px-4 py-2 rounded-xl bg-black hover:bg-[#FF5C9D] text-white text-xs font-bold transition cursor-pointer"
                    >
                      + Add Length
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* LOYALTY CLUB & CLIENT MILESTONE REWARDS MANAGER */}
            <div className="mt-10 bg-white rounded-3xl p-6 sm:p-8 border border-pink-200 shadow-sm">
              <div className="mb-6">
                <span className="text-xs font-bold text-[#FF5C9D] uppercase tracking-widest block mb-1">
                  Customisable Stamp Rewards
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                  🎁 Loyalty Milestones & Per-Client Rewards
                </h3>
                <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                  Set the studio&apos;s default 5-order reward (e.g. &ldquo;Free Delivery&rdquo; or &ldquo;Free Application Pack&rdquo;), or customise future milestone gifts for a specific client (e.g. 5th Order = Free Delivery, 10th Order = Free Sizing Kit for a Friend).
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Global Default Reward */}
                <div className="lg:col-span-5 bg-neutral-50 rounded-2xl p-5 border border-neutral-200 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-sm uppercase tracking-wider text-neutral-800 mb-2">
                      Studio Alternating Default Rewards
                    </h4>
                    <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
                      Odd milestones (5th, 15th, 25th...) default to Reward 1. Even milestones (10th, 20th, 30th...) default to Reward 2 unless customized for that specific client.
                    </p>
                    
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                      5th, 15th, 25th Order Default
                    </label>
                    <input
                      type="text"
                      value={defaultLoyaltyReward}
                      onChange={(e) => setDefaultLoyaltyReward(e.target.value)}
                      placeholder="e.g. Free Delivery"
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-sm font-bold text-neutral-900 focus:outline-none focus:border-pink-500 mb-3"
                    />

                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                      10th, 20th, 30th Order Default
                    </label>
                    <input
                      type="text"
                      value={secondaryLoyaltyReward}
                      onChange={(e) => setSecondaryLoyaltyReward(e.target.value)}
                      placeholder="e.g. Free Gift"
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-sm font-bold text-neutral-900 focus:outline-none focus:border-pink-500 mb-3"
                    />

                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                      Quick-Fill Preset Chips
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {loyaltyQuickPresets.map((preset) => (
                        <span
                          key={preset}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border border-pink-200 text-pink-600 shadow-2xs"
                        >
                          {preset}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveDefaultLoyaltyReward}
                    disabled={savingDefaultLoyalty}
                    className="w-full py-2.5 px-4 rounded-xl bg-black hover:bg-[#FF5C9D] text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer disabled:opacity-50"
                  >
                    {savingDefaultLoyalty
                      ? "Saving..."
                      : "Save Studio Default Rewards"}
                  </button>
                </div>

                {/* Per-Client Custom Milestone Overrides */}
                <div className="lg:col-span-7 bg-neutral-50 rounded-2xl p-5 border border-neutral-200">
                  <h4 className="font-bold text-sm uppercase tracking-wider text-neutral-800 mb-2">
                    Per-Client Custom Milestone Rewards
                  </h4>
                  <p className="text-xs text-neutral-500 mb-4">
                    Select any client below to customise their 5th, 10th, 15th, 20th, 25th, or 30th order reward. Leave any box blank to use the studio default ({defaultLoyaltyReward || "Free Delivery"}).
                  </p>

                  {/* Client Search & Selector */}
                  <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input
                      type="text"
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      placeholder="Search client by name, @instagram, or email..."
                      className="flex-1 bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-pink-500"
                    />
                    <select
                      value={
                        selectedClientForLoyalty
                          ? selectedClientForLoyalty.syncId ||
                            selectedClientForLoyalty.docId
                          : ""
                      }
                      onChange={(e) => {
                        const found = adminClients.find(
                          (c) => (c.syncId || c.docId) === e.target.value
                        );
                        if (found) handleSelectClientForLoyalty(found);
                        else setSelectedClientForLoyalty(null);
                      }}
                      className="bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-xs font-bold text-neutral-800 focus:outline-none focus:border-pink-500 sm:max-w-[240px]"
                    >
                      <option value="">Select a Client ({adminClients.length})...</option>
                      {adminClients
                        .filter((c) => {
                          if (!clientSearchQuery.trim()) return true;
                          const q = clientSearchQuery.toLowerCase();
                          return (
                            (c.name || "").toLowerCase().includes(q) ||
                            (c.instagram || "").toLowerCase().includes(q) ||
                            (c.email || "").toLowerCase().includes(q)
                          );
                        })
                        .map((c) => {
                          const cid = c.syncId || c.docId;
                          return (
                            <option key={cid} value={cid}>
                              {c.name || "Unnamed"}{" "}
                              {c.instagram ? `(@${c.instagram})` : ""}
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  {selectedClientForLoyalty ? (
                    <div className="bg-white rounded-2xl p-4 border border-pink-200 space-y-4">
                      <div className="flex items-center justify-between border-b border-pink-50 pb-2.5">
                        <div>
                          <span className="font-black text-sm text-neutral-900">
                            {selectedClientForLoyalty.name || "Client"}
                          </span>
                          {selectedClientForLoyalty.instagram && (
                            <span className="text-xs text-pink-500 font-bold ml-2">
                              @{selectedClientForLoyalty.instagram}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setClientMilestonesDraft({})}
                          className="text-[11px] font-bold text-neutral-400 hover:text-red-500 cursor-pointer"
                        >
                          Reset All to Default
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {["5", "10", "15", "20", "25", "30"].map((mKey) => (
                          <div key={mKey}>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-pink-600 mb-1">
                              {mKey}th Order Reward
                            </label>
                            <input
                              type="text"
                              value={clientMilestonesDraft[mKey] || ""}
                              onChange={(e) =>
                                setClientMilestonesDraft((prev) => ({
                                  ...prev,
                                  [mKey]: e.target.value,
                                }))
                              }
                              placeholder={`Default (${defaultLoyaltyReward || "Free Delivery"})`}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-900 focus:outline-none focus:border-pink-500 focus:bg-white"
                            />
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveClientMilestones}
                        disabled={savingClientMilestones}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#FF5C9D] hover:bg-pink-600 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer disabled:opacity-50 shadow-xs"
                      >
                        {savingClientMilestones
                          ? "Saving Client Milestones..."
                          : `Save Rewards for ${selectedClientForLoyalty.name || "Client"}`}
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-neutral-300 bg-white/60 text-xs text-neutral-400 font-medium">
                      Select or search for a client above to view and customize their 5th, 10th, 15th+ order rewards.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* PRODUCT EDITOR MODAL (Mobile-Friendly Slide-up / Full Screen) */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col md:p-8 md:bg-neutral-900/50">
          <div className="flex-1 bg-white md:rounded-3xl shadow-2xl flex flex-col md:max-w-2xl md:mx-auto md:w-full overflow-hidden">
            <header className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="font-black text-xl">Edit Details</h3>
              <div className="flex gap-2 items-center">
                <button type="button" onClick={() => {
                  confirmModal("Delete Product", "Are you sure you want to permanently delete this item from your inventory?", async () => {
                    setSavingProduct(true);
                    try {
                      await deleteDoc(doc(db, editingProduct.docPath));
                      const targetSyncId = editingProduct.syncId || editingProduct.id;
                      if (targetSyncId) {
                        const existingImgsSnap = await getDocs(
                          query(collection(db, "users", STORE_OWNER_UID, "set_images"), where("setSyncId", "==", targetSyncId))
                        );
                        await Promise.all(existingImgsSnap.docs.map(d => deleteDoc(d.ref)));
                      }
                      setInventory(prev => prev.filter(p => p.id !== editingProduct.id));
                      setEditingProduct(null);
                    } catch(err) {
                      console.error(err);
                      showModal("Error", "Failed to delete product.");
                    } finally {
                      setSavingProduct(false);
                      }
                    });
                  }} className="px-4 py-2 font-bold text-red-500 hover:bg-red-50 rounded-lg transition text-sm">Delete</button>
                <button type="button" onClick={() => setEditingProduct(null)} className="px-4 py-2 font-bold text-neutral-500 hover:text-black text-sm">Cancel</button>
                <button type="button" onClick={saveProductDetails} disabled={savingProduct} className="bg-black text-white px-6 py-2 rounded-lg font-bold hover:bg-neutral-800 disabled:opacity-50 text-sm">
                  {savingProduct ? "Saving..." : "Save"}
                </button>
              </div>
            </header>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex gap-4 items-center">
                <div className="flex flex-col gap-2 shrink-0">
                  <div className="w-24 h-24 bg-neutral-100 rounded-xl overflow-hidden relative border shrink-0">
                    {editingProduct.imagePath && <Image src={editingProduct.imagePath} alt="" fill className="object-cover" />}
                  </div>
                  <input type="file" ref={productImgRef} accept="image/*" className="text-[10px] w-24 overflow-hidden" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Display Name</label>
                  <input type="text" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full border rounded-xl px-4 py-3 font-bold text-lg bg-neutral-50" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Description</label>
                <textarea value={editingProduct.description || ""} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} rows={3} className="w-full border rounded-xl px-4 py-3 text-sm bg-neutral-50" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Base Price (€)</label>
                  <input type="number" step="0.01" value={editingProduct.basePrice} onChange={e => setEditingProduct({...editingProduct, basePrice: parseFloat(e.target.value) || 0})} className="w-full border rounded-xl px-4 py-3 font-mono text-sm bg-neutral-50" />
                </div>
                <div className="flex items-center mt-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={editingProduct.priceOnAsk} onChange={e => setEditingProduct({...editingProduct, priceOnAsk: e.target.checked})} className="w-5 h-5 accent-pink-500" />
                    <span className="text-sm font-bold">Price On Ask (POA)</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Category (Type)</label>
                  <select value={editingProduct.type || "Sets"} onChange={e => setEditingProduct({...editingProduct, type: e.target.value})} className="w-full border rounded-xl px-4 py-3 text-sm bg-neutral-50 font-bold">
                    <option value="Sets">Sets</option>
                    <option value="Minis">Minis</option>
                    <option value="Keychains">Keychains</option>
                    <option value="Earrings">Earrings</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Basics">Basics</option>
                  </select>
                </div>
                <div className="flex items-center mt-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={editingProduct.isPromo} onChange={e => setEditingProduct({...editingProduct, isPromo: e.target.checked})} className="w-5 h-5 accent-pink-500" />
                    <span className="text-sm font-bold">Special Offer</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Tags (Comma Separated)</label>
                <input 
                  type="text" 
                  value={(editingProduct.tags || []).join(", ")} 
                  onChange={e => {
                    const tags = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    setEditingProduct({...editingProduct, tags});
                  }}
                  className="w-full border rounded-xl px-4 py-3 font-mono text-sm bg-neutral-50" 
                />
              </div>

              <div className="pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    const prod = editingProduct;
                    setEditingProduct(null);
                    setGlobalEditingProduct(prod);
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-pink-50 hover:bg-pink-100 text-[#FF5C9D] font-bold text-xs uppercase tracking-widest border border-pink-200 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>📸 Manage Extra Photos ({editingProduct.additionalImages?.length || 0}) & Default Shape/Length</span>
                  <span>→</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {modalState.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}></div>
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden relative shadow-2xl animate-slide-up">
            <div className="p-6 text-center">
              <h3 className="font-black uppercase tracking-widest text-lg mb-2">{modalState.title}</h3>
              <p className="text-neutral-500 text-sm mb-6">{modalState.message}</p>
              <div className="flex gap-3">
                {modalState.isConfirm ? (
                  <>
                    <button onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-3 text-sm font-bold text-neutral-500 hover:bg-neutral-100 rounded-xl transition-colors">Cancel</button>
                    <button onClick={() => { setModalState(prev => ({ ...prev, isOpen: false })); if (modalState.onConfirm) modalState.onConfirm(); }} className="flex-1 py-3 text-sm font-bold text-white bg-black hover:bg-neutral-800 rounded-xl transition-colors">Confirm</button>
                  </>
                ) : (
                  <button onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-3 text-sm font-bold text-white bg-black hover:bg-neutral-800 rounded-xl transition-colors">OK</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
