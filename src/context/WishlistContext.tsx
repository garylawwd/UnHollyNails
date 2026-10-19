'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { Product } from '@/lib/types';
import { VENDOR_UID } from '@/lib/constants';

interface WishlistContextType {
  wishlistIds: string[];
  wishlistItems: any[];
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (product: Product) => Promise<void>;
  loading: boolean;
  openLoginModal: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const vendorUid = VENDOR_UID;

  // Track auth
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && u.email) {
        try {
          const q = query(collection(db, "users", vendorUid, "clients"), where("email", "==", u.email));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setClientProfile({ id: snap.docs[0].id, ...snap.docs[0].data() });
          } else {
            setClientProfile(null);
          }
        } catch (e) {
          console.error("Failed to load client profile for wishlist", e);
        }
      } else {
        setClientProfile(null);
        setWishlistItems([]);
      }
      setLoading(false);
    });

    return () => unsubAuth();
  }, [vendorUid]);

  // Real-time listener for client's wishlist items
  useEffect(() => {
    if (!clientProfile?.syncId) {
      setWishlistItems([]);
      return;
    }

    const q = query(
      collection(db, "users", vendorUid, "client_images"),
      where("clientSyncId", "==", clientProfile.syncId),
      where("imageType", "==", "wishlist")
    );

    const unsubWishlist = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ syncId: doc.id, ...doc.data() }));
      setWishlistItems(items);
    });

    return () => unsubWishlist();
  }, [clientProfile, vendorUid]);

  const wishlistIds = wishlistItems.map(item => {
    // tags[0] holds product.id, fallback to extracting from syncId
    return (item.tags && item.tags[0]) || item.syncId.replace(`wish_${clientProfile?.syncId}_`, "");
  });

  const isWishlisted = useCallback((productId: string) => {
    return wishlistIds.includes(productId);
  }, [wishlistIds]);

  const toggleWishlist = async (product: Product) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    // If client profile isn't established yet, create a basic client record
    let activeClient = clientProfile;
    if (!activeClient) {
      try {
        const syncId = crypto.randomUUID();
        const newClient = {
          syncId,
          id: 0,
          name: user.displayName || '',
          email: user.email || '',
          instagram: '',
          phone: '',
          address: '',
          birthday: null,
          defaultShape: 'Almond',
          defaultLength: 'M',
          additionalComments: '',
          designNotes: '',
          adminUid: vendorUid,
          loyaltyStamps: 0,
          loyaltyRewardsAvailable: 0,
          updatedAt: Date.now()
        };
        await setDoc(doc(db, "users", vendorUid, "clients", syncId), newClient);
        activeClient = { ...newClient, id: syncId };
        setClientProfile(activeClient);
      } catch (e) {
        console.error("Failed to create client for wishlist", e);
        return;
      }
    }

    const itemDocId = `wish_${activeClient.syncId}_${product.id}`;
    const alreadyWishlisted = isWishlisted(product.id);

    try {
      if (alreadyWishlisted) {
        // Optimistic UI update
        setWishlistItems(prev => prev.filter(i => !((i.tags && i.tags[0] === product.id) || i.syncId === itemDocId)));
        await deleteDoc(doc(db, "users", vendorUid, "client_images", itemDocId));
      } else {
        const newWishlistRecord = {
          syncId: itemDocId,
          clientId: 0,
          clientSyncId: activeClient.syncId,
          linkedClientSyncIds: [],
          uri: product.imagePath,
          imageType: "wishlist",
          notes: product.name,
          tags: [product.id, ...(product.tags || [])],
          isPublic: false,
          messages: [],
          orderDate: null,
          updatedAt: Date.now()
        };
        // Optimistic UI update
        setWishlistItems(prev => [...prev, newWishlistRecord]);
        await setDoc(doc(db, "users", vendorUid, "client_images", itemDocId), newWishlistRecord);
      }
    } catch (e) {
      console.error("Error toggling wishlist item", e);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setShowLoginModal(false);
    } catch (e) {
      console.error("Google sign in error", e);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        wishlistItems,
        isWishlisted,
        toggleWishlist,
        loading,
        openLoginModal: () => setShowLoginModal(true)
      }}
    >
      {children}

      {/* Login Prompt Modal for Wishlist */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLoginModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl text-center text-black animate-slide-up z-10 flex flex-col items-center">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 font-bold text-lg cursor-pointer"
            >
              &times;
            </button>
            <div className="w-16 h-16 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center text-3xl mb-4">
              ❤️
            </div>
            <h3 className="text-xl font-black mb-2">Save to Your Wishlist</h3>
            <p className="text-neutral-500 text-xs mb-6 leading-relaxed">
              Sign in with your Google account to save your favorite custom designs, view them in your client profile, and share your favorite aesthetic with me!
            </p>
            <button
              onClick={handleGoogleLogin}
              disabled={isSigningIn}
              className="w-full bg-black text-white py-3.5 px-6 rounded-2xl font-bold text-sm hover:bg-neutral-800 transition flex items-center justify-center gap-3 shadow-md disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"/>
              </svg>
              {isSigningIn ? "Signing in..." : "Continue with Google"}
            </button>
          </div>
        </div>
      )}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
