"use client";

import { useState, useEffect, useRef } from "react";
import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { db, auth, storage } from "@/lib/firebase";
import { collection, setDoc, doc, query, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from "firebase/auth";
import { VENDOR_UID } from "@/lib/constants";
import {
  FINGER_MAP,
  formatHandSizesSummary,
  hasAnyFingerSize,
  HandSizesMap,
} from "@/components/InteractiveHandSizer";

interface VaultInspoImage {
  syncId: string;
  uri: string;
  notes?: string;
  orderDate?: number | null;
}

interface PendingInspoUpload {
  id: string;
  file: File;
  previewUrl: string;
}

export default function CheckoutPage() {
  const { items, cartTotal, clearCart, removeFromCart } = useCart();
  const router = useRouter();

  const vendorUid = VENDOR_UID;

  const [user, setUser] = useState<User | null>(null);
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  // Inspiration Photos State (Max 3 combined between Vault picks and new uploads)
  const [vaultInspoPhotos, setVaultInspoPhotos] = useState<VaultInspoImage[]>([]);
  const [selectedVaultIds, setSelectedVaultIds] = useState<string[]>([]);
  const [uploadedInspoFiles, setUploadedInspoFiles] = useState<PendingInspoUpload[]>([]);
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSelectedInspoCount = selectedVaultIds.length + uploadedInspoFiles.length;

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    instagram: "",
    phone: "",
    address: "",
    notes: "",
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && u.email) {
        try {
          const q = query(
            collection(db, "users", vendorUid, "clients"),
            where("email", "==", u.email)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const docSnap = snap.docs[0];
            const raw = docSnap.data();
            const profile: any = {
              ...raw,
              id: 0,
              syncId: raw.syncId || docSnap.id,
            };
            setClientProfile(profile);
            setFormData((prev) => ({
              ...prev,
              name: profile.name || u.displayName || "",
              email: profile.email || u.email || "",
              instagram: profile.instagram || "",
              phone: profile.phone || "",
              address: profile.address || "",
            }));

            // Fetch existing Inspiration photos from the client's Nail Vault
            const imgQ = query(
              collection(db, "users", vendorUid, "client_images"),
              where("clientSyncId", "==", profile.syncId)
            );
            const imgSnap = await getDocs(imgQ);
            const inspos: VaultInspoImage[] = [];
            imgSnap.forEach((d) => {
              const data = d.data();
              const isCompleted =
                data.imageType === "completed" ||
                (typeof data.uri === "string" && data.uri.includes("completed"));
              if (!isCompleted && data.imageType !== "wishlist" && data.uri) {
                inspos.push({
                  syncId: data.syncId || d.id,
                  uri: data.uri,
                  notes: data.notes || "",
                  orderDate: data.orderDate ?? null,
                });
              }
            });
            setVaultInspoPhotos(inspos);
          } else {
            // Logged in with Google, but no client profile document created yet
            setFormData((prev) => ({
              ...prev,
              name: u.displayName || "",
              email: u.email || "",
            }));
          }
        } catch (error) {
          console.error("Error fetching profile on checkout:", error);
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, [vendorUid]);

  // Redirect if cart is empty
  useEffect(() => {
    if (!loading && items.length === 0 && !submitting) {
      router.push("/");
    }
  }, [items, loading, submitting, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleInspoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesArray = Array.from(e.target.files);
    const remainingSlots = 3 - totalSelectedInspoCount;
    if (remainingSlots <= 0) {
      alert("You can attach up to 3 inspiration photos per order.");
      return;
    }

    const toAdd = filesArray.slice(0, remainingSlots).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setUploadedInspoFiles((prev) => [...prev, ...toAdd]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveUploadedInspo = (id: string) => {
    setUploadedInspoFiles((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const toggleVaultPhotoSelection = (syncId: string) => {
    setSelectedVaultIds((prev) => {
      if (prev.includes(syncId)) {
        return prev.filter((id) => id !== syncId);
      }
      if (prev.length + uploadedInspoFiles.length >= 3) {
        alert("You can attach up to 3 inspiration photos per order.");
        return prev;
      }
      return [...prev, syncId];
    });
  };

  const generateOrderId = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "UHN-";
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  /**
   * Saves 10-finger millimeter measurements into `users/{vendorUid}/nail_sizes`
   * if the client doesn't already have saved profile sizes (e.g. Guest or new profile).
   */
  const syncHandSizesToClientProfile = async (
    targetClientSyncId: string,
    handSizes: HandSizesMap
  ) => {
    try {
      const existingSnap = await getDocs(
        query(
          collection(db, "users", vendorUid, "nail_sizes"),
          where("clientSyncId", "==", targetClientSyncId)
        )
      );
      if (!existingSnap.empty) {
        // Client already has saved sizes on their profile; don't overwrite them silently
        return;
      }

      const now = Date.now();
      const entries = Object.entries(FINGER_MAP);
      await Promise.all(
        entries.map(async ([key, fingerIndex]) => {
          const rawVal = handSizes[key]?.sizeMm;
          if (rawVal === undefined || rawVal === null || rawVal === "") return;
          const numericMm = parseFloat(String(rawVal));
          if (isNaN(numericMm)) return;

          const sizeSyncId = crypto.randomUUID();
          await setDoc(doc(db, "users", vendorUid, "nail_sizes", sizeSyncId), {
            syncId: sizeSyncId,
            clientId: 0,
            clientSyncId: targetClientSyncId,
            fingerIndex,
            sizeMm: numericMm,
            updatedAt: now,
          });
        })
      );
    } catch (err) {
      console.error("Failed to sync hand sizes to nail_sizes:", err);
    }
  };

  const submitOrder = async (finalClientSyncId: string) => {
    try {
      const sharedOrderDate = Date.now();
      const orderNumber = generateOrderId();

      // 1. If any item has custom hand sizes (or guest localStorage has sizes), sync to nail_sizes if profile has none
      const itemWithCustomSizes = items.find(
        (i) => i.customSizes && hasAnyFingerSize(i.customSizes)
      );
      let guestSizesToSync: HandSizesMap | undefined = itemWithCustomSizes?.customSizes;
      if (!guestSizesToSync) {
        try {
          const rawGuest = localStorage.getItem("unholly_guest_sizes");
          if (rawGuest) {
            const parsed = JSON.parse(rawGuest);
            if (hasAnyFingerSize(parsed)) {
              guestSizesToSync = parsed;
            }
          }
        } catch {
          // ignore
        }
      }
      if (guestSizesToSync) {
        await syncHandSizesToClientProfile(finalClientSyncId, guestSizesToSync);
      }

      // 2. Upload/Link up to 3 Inspiration Photos with `orderDate: sharedOrderDate`
      // 2a. Newly uploaded files
      for (let idx = 0; idx < uploadedInspoFiles.length; idx++) {
        const pending = uploadedInspoFiles[idx];
        const storageRef = ref(
          storage,
          `users/${vendorUid}/client_images/inspo_${sharedOrderDate}_${idx}_${pending.file.name}`
        );
        await uploadBytes(storageRef, pending.file);
        const downloadUrl = await getDownloadURL(storageRef);
        const imgSyncId = crypto.randomUUID();

        await setDoc(doc(db, "users", vendorUid, "client_images", imgSyncId), {
          syncId: imgSyncId,
          clientId: 0,
          clientSyncId: finalClientSyncId,
          linkedClientSyncIds: [],
          uri: downloadUrl,
          imageType: "inspo",
          orderDate: sharedOrderDate,
          isPublic: false,
          tags: [],
          notes: `Order #${orderNumber} Reference`,
          messages: [],
          updatedAt: sharedOrderDate,
        });
      }

      // 2b. Existing Nail Vault photos selected by logged-in user
      for (const vaultSyncId of selectedVaultIds) {
        const vaultImg = vaultInspoPhotos.find((v) => v.syncId === vaultSyncId);
        if (!vaultImg) continue;

        if (!vaultImg.orderDate) {
          // Link this unassigned vault photo directly to this order's timestamp
          await setDoc(
            doc(db, "users", vendorUid, "client_images", vaultImg.syncId),
            {
              orderDate: sharedOrderDate,
              updatedAt: sharedOrderDate,
            },
            { merge: true }
          );
        } else {
          // Photo was already linked to a previous order; create a linked copy for this order
          const copySyncId = crypto.randomUUID();
          await setDoc(doc(db, "users", vendorUid, "client_images", copySyncId), {
            syncId: copySyncId,
            clientId: 0,
            clientSyncId: finalClientSyncId,
            linkedClientSyncIds: [],
            uri: vaultImg.uri,
            imageType: "inspo",
            orderDate: sharedOrderDate,
            isPublic: false,
            tags: [],
            notes: vaultImg.notes || `Order #${orderNumber} Reference`,
            messages: [],
            updatedAt: sharedOrderDate,
          });
        }
      }

      // 3. Write ONE `Order` document per cart item sharing `orderDate: sharedOrderDate` and `orderNumber`
      //    matching PressOnPro's `Order` data class in `Client.kt` (`orderId: 0` Int!)
      await Promise.all(
        items.map(async (item, index) => {
          const itemOrderSyncId = doc(collection(db, "users", vendorUid, "orders")).id;
          const lowerName = item.product.name.toLowerCase();
          const isSizingKit = lowerName.includes("sizing kit");
          const isKeychain =
            item.product.type === "Keychains" || lowerName.includes("keychain");

          const orderType = isSizingKit
            ? "Sizing Kit"
            : isKeychain
            ? "Keychain"
            : "Standard";

          const noteParts: string[] = [];
          if (item.size && item.size !== "N/A") {
            noteParts.push(`Size: ${item.size}`);
          }
          if (item.customSizes && hasAnyFingerSize(item.customSizes)) {
            noteParts.push(
              `Custom mm [${formatHandSizesSummary(item.customSizes)}]`
            );
          }
          if (item.product.priceOnAsk) {
            noteParts.push("POA (Price On Ask)");
          }
          // Attach customer's general checkout notes on the first item (or all items if single)
          if (formData.notes.trim() && index === 0) {
            noteParts.push(formData.notes.trim());
          }

          const orderPayload = {
            orderId: 0, // Must be Int 0 for Android Firestore deserialization!
            orderNumber, // "UHN-XXXXX"
            clientId: 0,
            clientSyncId: finalClientSyncId,
            setName: item.product.name,
            orderDate: sharedOrderDate,
            status: "Pending",
            price: item.product.priceOnAsk
              ? 0
              : Number((item.product.basePrice * item.quantity).toFixed(2)),
            setCount: item.quantity,
            orderType,
            shapeOverride:
              item.shape && item.shape !== "N/A" ? item.shape : null,
            lengthOverride:
              item.length && item.length !== "N/A" ? item.length : null,
            isLoyaltyEligible: !isSizingKit && !isKeychain,
            isLoyaltyReward: false,
            notes: noteParts.join(" | "),
            syncId: itemOrderSyncId,
            isStorefrontOrder: true,
            paidDate: null,
            sentDate: null,
            isItemCompleted: false,
            amountPaid: 0,
            updatedAt: sharedOrderDate,
          };

          await setDoc(
            doc(db, "users", vendorUid, "orders", itemOrderSyncId),
            orderPayload
          );
        })
      );

      // 4. Write an Admin Notification (`NEW_WEB_ORDER`) for Holly & Gary
      const totalSetsCount = items.reduce((sum, item) => sum + item.quantity, 0);
      const hasPOAItem = items.some((i) => i.product.priceOnAsk);
      const notifId = doc(
        collection(db, "users", vendorUid, "admin_notifications")
      ).id;
      await setDoc(
        doc(db, "users", vendorUid, "admin_notifications", notifId),
        {
          id: notifId,
          type: "NEW_WEB_ORDER",
          orderNumber,
          orderDate: sharedOrderDate,
          clientSyncId: finalClientSyncId,
          clientName: formData.name.trim(),
          message: `New web order ${orderNumber} from ${formData.name.trim()} (${totalSetsCount} item${
            totalSetsCount === 1 ? "" : "s"
          } — €${cartTotal.toFixed(2)}${hasPOAItem ? " + POA" : ""})`,
          timestamp: sharedOrderDate,
          read: false,
        }
      );

      clearCart();
      router.push("/checkout/success");
    } catch (error) {
      console.error("Error submitting order:", error);
      alert("Failed to submit order. Please try again.");
      setSubmitting(false);
    }
  };

  const buildNewClientPayload = (
    syncId: string,
    email: string,
    name: string,
    designNote: string
  ) => {
    const firstValidShape =
      items.find((i) => i.shape && i.shape !== "N/A")?.shape || "Almond";
    const firstValidLength =
      items.find((i) => i.length && i.length !== "N/A")?.length || "M";
    const now = Date.now();

    return {
      id: 0,
      syncId,
      name: name.trim(),
      instagram: formData.instagram.replace(/^@/, "").trim().toLowerCase(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      defaultShape: firstValidShape,
      defaultLength: firstValidLength,
      additionalComments: "",
      designNotes: designNote,
      birthday: null, // Must be null or Long for PressOnPro Client.kt
      email: email.trim(),
      adminUid: vendorUid,
      loyaltyMilestones: {},
      updatedAt: now,
      listPriority: 0.0,
    };
  };

  const handleCreateGhostProfile = async () => {
    setSubmitting(true);
    setShowGuestPrompt(false);
    try {
      const syncId = doc(collection(db, "users", vendorUid, "clients")).id;
      const newClient = buildNewClientPayload(
        syncId,
        formData.email,
        formData.name,
        "Guest Web Order"
      );
      await setDoc(doc(db, "users", vendorUid, "clients", syncId), newClient);
      await submitOrder(syncId);
    } catch (error) {
      console.error("Ghost profile error:", error);
      alert("Something went wrong processing your guest order.");
      setSubmitting(false);
    }
  };

  const handleCreateRealProfile = async () => {
    setSubmitting(true);
    setShowGuestPrompt(false);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const u = result.user;

      // Check if this Google user already has a client profile
      let targetSyncId = "";
      if (u.email) {
        const existingSnap = await getDocs(
          query(
            collection(db, "users", vendorUid, "clients"),
            where("email", "==", u.email)
          )
        );
        if (!existingSnap.empty) {
          const existingDoc = existingSnap.docs[0];
          const existingData = existingDoc.data();
          targetSyncId = existingData.syncId || existingDoc.id;
          await setDoc(
            existingDoc.ref,
            {
              ...existingData,
              id: 0,
              syncId: targetSyncId,
              name: formData.name || existingData.name || u.displayName || "",
              instagram:
                formData.instagram.replace(/^@/, "").trim().toLowerCase() ||
                existingData.instagram ||
                "",
              phone: formData.phone || existingData.phone || "",
              address: formData.address || existingData.address || "",
              birthday:
                typeof existingData.birthday === "number"
                  ? existingData.birthday
                  : null,
              updatedAt: Date.now(),
            },
            { merge: true }
          );
        }
      }

      if (!targetSyncId) {
        targetSyncId = doc(collection(db, "users", vendorUid, "clients")).id;
        const newClient = buildNewClientPayload(
          targetSyncId,
          u.email || formData.email,
          formData.name || u.displayName || "Client",
          "Profile created during checkout"
        );
        await setDoc(
          doc(db, "users", vendorUid, "clients", targetSyncId),
          newClient
        );
      }

      await submitOrder(targetSyncId);
    } catch (error) {
      console.error("Profile creation error:", error);
      alert("Authentication failed. Proceeding with a guest order instead.");
      await handleCreateGhostProfile();
    }
  };

  const handlePlaceOrderClick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.address) {
      alert("Please fill in your Name, Email, and Address to place an order.");
      return;
    }

    if (user && clientProfile?.syncId) {
      setSubmitting(true);
      // Keep client contact details up to date if they filled in address/instagram/phone
      try {
        await setDoc(
          doc(db, "users", vendorUid, "clients", clientProfile.syncId),
          {
            id: 0,
            name: formData.name.trim() || clientProfile.name || "",
            instagram:
              formData.instagram.replace(/^@/, "").trim().toLowerCase() ||
              clientProfile.instagram ||
              "",
            phone: formData.phone.trim() || clientProfile.phone || "",
            address: formData.address.trim() || clientProfile.address || "",
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn("Could not update client contact info:", err);
      }
      await submitOrder(clientProfile.syncId);
    } else if (user) {
      // Logged in with Google, but didn't have a client document yet
      setSubmitting(true);
      try {
        const syncId = doc(collection(db, "users", vendorUid, "clients")).id;
        const newClient = buildNewClientPayload(
          syncId,
          user.email || formData.email,
          formData.name || user.displayName || "Client",
          "Profile created during checkout"
        );
        await setDoc(doc(db, "users", vendorUid, "clients", syncId), newClient);
        await submitOrder(syncId);
      } catch (err) {
        console.error("Error creating profile for signed-in user:", err);
        setSubmitting(false);
      }
    } else {
      // Guest user — ask if they want to save a profile or continue as guest
      setShowGuestPrompt(true);
    }
  };

  if (loading || (items.length === 0 && !submitting)) {
    return (
      <div className="min-h-screen bg-[#FFF5F8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  const hasPOA = items.some((i) => i.product.priceOnAsk);

  return (
    <div className="min-h-screen bg-[#FFF5F8] text-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-20 flex flex-col lg:flex-row gap-12">
        {/* Left Col: Form */}
        <div className="flex-grow lg:w-2/3">
          <Link
            href="/"
            className="inline-block text-sm font-bold text-neutral-400 hover:text-black mb-8 transition-colors"
          >
            ← Back to Shopping
          </Link>
          <h1 className="text-3xl font-black mb-8 uppercase tracking-widest">
            Order Request
          </h1>

          {!user && (
            <div className="bg-white p-6 rounded-2xl border border-pink-100 shadow-sm mb-8 flex justify-between items-center flex-wrap gap-4">
              <div>
                <h3 className="font-bold text-black">
                  Already part of the club?
                </h3>
                <p className="text-sm text-neutral-500">
                  Sign in for faster checkout, saved hand sizes, and digital
                  loyalty stamps.
                </p>
              </div>
              <button
                type="button"
                onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
                className="bg-black text-white px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Sign In
              </button>
            </div>
          )}

          <form
            id="checkout-form"
            onSubmit={handlePlaceOrderClick}
            className="space-y-6 bg-white p-6 sm:p-10 rounded-3xl border border-pink-100 shadow-sm"
          >
            <h2 className="text-xl font-bold mb-4">Contact Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">
                  Instagram Handle (For easier contact)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">
                    @
                  </span>
                  <input
                    type="text"
                    name="instagram"
                    value={formData.instagram}
                    onChange={handleChange}
                    className="w-full border border-neutral-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. 087 123 4567"
                  className="w-full border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                />
              </div>
            </div>

            <h2 className="text-xl font-bold mb-4 mt-10">
              Delivery Information
            </h2>
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">
                Shipping Address (Include Eircode) *
              </label>
              <textarea
                name="address"
                required
                rows={3}
                value={formData.address}
                onChange={handleChange}
                className="w-full border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all resize-none"
              ></textarea>
            </div>

            {/* INSPIRATION PHOTOS SECTION (UP TO 3) */}
            <div className="pt-4 border-t border-pink-100">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div>
                  <h2 className="text-xl font-bold">
                    Inspiration Photos{" "}
                    <span className="text-xs font-bold text-pink-500 uppercase tracking-wider ml-1">
                      (Optional · {totalSelectedInspoCount}/3)
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Attach up to 3 reference photos for custom sets, colour
                    changes, or design inspo.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {user && vaultInspoPhotos.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowVaultPicker((prev) => !prev)}
                      className="px-3.5 py-2 rounded-full text-xs font-bold border border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100 transition cursor-pointer"
                    >
                      {showVaultPicker
                        ? "Hide Nail Vault"
                        : `✨ Choose from Vault (${vaultInspoPhotos.length})`}
                    </button>
                  )}

                  {totalSelectedInspoCount < 3 && (
                    <label className="cursor-pointer bg-black hover:bg-neutral-800 text-white px-4 py-2 rounded-full text-xs font-bold transition shadow-xs">
                      + Upload Photo
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleInspoFileSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Vault Picker Drawer (For Signed-In Users) */}
              {showVaultPicker && vaultInspoPhotos.length > 0 && (
                <div className="mt-3 p-4 rounded-2xl bg-[#FFF5F8] border border-pink-200">
                  <p className="text-xs font-bold text-pink-800 mb-2.5">
                    Tap any photo from your Nail Vault to attach it to this
                    order:
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 max-h-48 overflow-y-auto pr-1">
                    {vaultInspoPhotos.map((img) => {
                      const isSelected = selectedVaultIds.includes(img.syncId);
                      return (
                        <button
                          key={img.syncId}
                          type="button"
                          onClick={() => toggleVaultPhotoSelection(img.syncId)}
                          className={`relative aspect-square rounded-xl overflow-hidden border-2 transition cursor-pointer ${
                            isSelected
                              ? "border-pink-500 ring-2 ring-pink-400 scale-[0.98]"
                              : "border-transparent opacity-80 hover:opacity-100"
                          }`}
                        >
                          <Image
                            src={img.uri}
                            alt={img.notes || "Vault Inspo"}
                            fill
                            className="object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-pink-500/30 flex items-center justify-center">
                              <span className="w-6 h-6 rounded-full bg-pink-500 text-white text-xs font-black flex items-center justify-center shadow">
                                ✓
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected & Uploaded Preview Strip */}
              {totalSelectedInspoCount > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {selectedVaultIds.map((id) => {
                    const img = vaultInspoPhotos.find((v) => v.syncId === id);
                    if (!img) return null;
                    return (
                      <div
                        key={id}
                        className="relative w-20 h-20 rounded-2xl overflow-hidden border border-pink-200 bg-pink-50 shadow-xs"
                      >
                        <Image
                          src={img.uri}
                          alt="Vault Inspo"
                          fill
                          className="object-cover"
                        />
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          Vault
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleVaultPhotoSelection(id)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center cursor-pointer"
                          title="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}

                  {uploadedInspoFiles.map((item) => (
                    <div
                      key={item.id}
                      className="relative w-20 h-20 rounded-2xl overflow-hidden border border-pink-200 bg-pink-50 shadow-xs"
                    >
                      <Image
                        src={item.previewUrl}
                        alt="Uploaded Inspo"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <span className="absolute bottom-1 left-1 bg-pink-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        New
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveUploadedInspo(item.id)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center cursor-pointer"
                        title="Remove photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <h2 className="text-xl font-bold mb-4 mt-6">Order Notes</h2>
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">
                Special Requests or Design Tweaks
              </label>
              <textarea
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleChange}
                placeholder="Any extra notes, colour tweaks, or special requests..."
                className="w-full border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all resize-none"
              ></textarea>
            </div>
          </form>
        </div>

        {/* Right Col: Summary */}
        <div className="w-full lg:w-1/3">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-pink-100 shadow-xl sticky top-24">
            <h2 className="text-xl font-black mb-6 uppercase tracking-widest">
              Order Summary
            </h2>

            <div className="space-y-4 mb-8 max-h-[42vh] overflow-y-auto pr-2">
              {items.map((item) => (
                <div
                  key={item.cartItemId}
                  className="flex gap-4 border-b border-neutral-100 pb-4"
                >
                  <div className="w-16 h-16 relative rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                    <Image
                      src={item.product.imagePath}
                      alt={item.product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-col justify-center flex-grow min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-black text-sm line-clamp-1">
                        {item.product.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.cartItemId)}
                        className="text-neutral-300 hover:text-red-500 ml-2 flex-shrink-0 cursor-pointer"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {item.shape} • {item.size} • {item.length} • Qty:{" "}
                      {item.quantity}
                    </p>
                    {item.customSizes && hasAnyFingerSize(item.customSizes) && (
                      <p className="text-[10px] text-pink-600 font-medium mt-0.5 truncate">
                        📏 {formatHandSizesSummary(item.customSizes)}
                      </p>
                    )}
                    <p className="text-pink-500 font-bold mt-1 text-sm">
                      {item.product.priceOnAsk
                        ? "POA"
                        : `€${(item.product.basePrice * item.quantity).toFixed(2)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-neutral-100 pt-6 space-y-3 mb-8">
              <div className="flex justify-between text-sm text-neutral-500 font-medium">
                <span>Subtotal</span>
                <span>
                  €{cartTotal.toFixed(2)} {hasPOA && "(+ POA)"}
                </span>
              </div>
              <div className="flex justify-between text-sm text-neutral-500 font-medium">
                <span>Shipping</span>
                <span>Confirmed via DM</span>
              </div>
              {totalSelectedInspoCount > 0 && (
                <div className="flex justify-between text-xs text-pink-600 font-bold">
                  <span>Inspiration Photos</span>
                  <span>{totalSelectedInspoCount} attached</span>
                </div>
              )}
            </div>

            <button
              form="checkout-form"
              type="submit"
              disabled={submitting}
              className="w-full bg-[#FF5C9D] text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-pink-600 transition-colors shadow-lg shadow-pink-500/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? "Processing..." : "Submit Order Request"}
            </button>
            <p className="text-[10px] text-neutral-400 text-center mt-4 uppercase tracking-widest leading-relaxed">
              No payment is taken today.
              <br />I will DM or email you to confirm details & payment.
            </p>
          </div>
        </div>
      </div>

      {/* Guest Prompt Modal */}
      {showGuestPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowGuestPrompt(false)}
          />
          <div className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-fade-in text-center border-2 border-pink-100">
            <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="#FF5C9D"
                className="w-8 h-8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-black mb-3">
              Save your details?
            </h3>
            <p className="text-neutral-500 text-sm mb-8 leading-relaxed">
              Create a free UnHolly profile to save your custom finger sizes,
              collect digital loyalty stamps, and track your order live!
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleCreateRealProfile}
                className="w-full bg-black text-white py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-neutral-800 transition shadow-md cursor-pointer"
              >
                Yes, Create Profile & Save Sizes
              </button>
              <button
                onClick={handleCreateGhostProfile}
                className="w-full bg-white text-neutral-500 py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs border border-neutral-200 hover:bg-neutral-50 transition cursor-pointer"
              >
                No, Continue as Guest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
