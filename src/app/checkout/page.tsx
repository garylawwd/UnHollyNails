"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, setDoc, doc, query, where, getDocs } from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from "firebase/auth";

export default function CheckoutPage() {
  const { items, cartTotal, clearCart, removeFromCart } = useCart();
  const router = useRouter();
  
  const vendorUid = "CMzpkonBxKeLboaVTUYwDWgiwNG3";

  const [user, setUser] = useState<User | null>(null);
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    instagram: "",
    address: "",
    notes: ""
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && u.email) {
        // Fetch their client profile to auto-fill
        try {
          const q = query(collection(db, "users", vendorUid, "clients"), where("email", "==", u.email));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const profile = snap.docs[0].data();
            setClientProfile(profile);
            setFormData({
              name: profile.name || u.displayName || "",
              email: profile.email || u.email || "",
              instagram: profile.instagram || "",
              address: profile.address || "",
              notes: ""
            });
          } else {
            // Profile doesn't exist yet but logged in
            setFormData(prev => ({ ...prev, name: u.displayName || "", email: u.email || "" }));
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, [vendorUid]);

  // Redirect if cart is empty
  useEffect(() => {
    if (!loading && items.length === 0) {
      router.push("/");
    }
  }, [items, loading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const generateOrderId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'UHN-';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const submitOrder = async (finalClientSyncId: string) => {
    try {
      const orderSyncId = doc(collection(db, "users", vendorUid, "orders")).id;
      const orderDate = Date.now();
      
      const orderPayload = {
        id: 0,
        syncId: orderSyncId,
        orderId: generateOrderId(),
        clientSyncId: finalClientSyncId,
        type: "Standard",
        setName: items.map(i => i.product.name).join(" + "),
        price: cartTotal,
        paymentDate: 0,
        sentDate: 0,
        orderDate: orderDate,
        status: "Pending",
        notes: formData.notes,
        earnsStamp: true,
        setCount: items.reduce((sum, item) => sum + item.quantity, 0),
        items: items.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          shape: item.shape,
          length: item.length,
          quantity: item.quantity,
          basePrice: item.product.basePrice,
          priceOnAsk: item.product.priceOnAsk || false,
          imagePath: item.product.imagePath
        })),
        createdAt: orderDate,
        updatedAt: orderDate,
        isDeleted: false
      };

      await setDoc(doc(db, "users", vendorUid, "orders", orderSyncId), orderPayload);
      clearCart();
      router.push("/checkout/success");
    } catch (error) {
      console.error("Error submitting order:", error);
      alert("Failed to submit order. Please try again.");
      setSubmitting(false);
    }
  };

  const handleCreateGhostProfile = async () => {
    setSubmitting(true);
    setShowGuestPrompt(false);
    try {
      const syncId = doc(collection(db, "users", vendorUid, "clients")).id;
      const newClient = {
        id: 0,
        syncId: syncId,
        name: formData.name,
        instagram: formData.instagram.replace("@", ""),
        email: formData.email,
        phone: "",
        address: formData.address,
        loyaltyPoints: 0,
        birthday: 0,
        notes: "Ghost Profile from Guest Web Order",
        defaultShape: "Almond",
        defaultLength: "M",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDeleted: false
      };
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
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      
      const syncId = doc(collection(db, "users", vendorUid, "clients")).id;
      const newClient = {
        id: 0,
        syncId: syncId,
        name: formData.name || u.displayName,
        instagram: formData.instagram.replace("@", ""),
        email: u.email,
        phone: "",
        address: formData.address,
        loyaltyPoints: 0,
        birthday: 0,
        notes: "Profile created during checkout",
        defaultShape: "Almond",
        defaultLength: "M",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDeleted: false
      };
      await setDoc(doc(db, "users", vendorUid, "clients", syncId), newClient);
      await submitOrder(syncId);
    } catch (error) {
      console.error("Profile creation error:", error);
      alert("Authentication failed. Proceeding with a guest order instead.");
      await handleCreateGhostProfile(); // Fallback to ghost
    }
  };

  const handlePlaceOrderClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.address) {
      alert("Please fill in your Name, Email, and Address to place an order.");
      return;
    }

    if (user && clientProfile?.syncId) {
      // They are already logged in and have a profile
      setSubmitting(true);
      submitOrder(clientProfile.syncId);
    } else {
      // They are a guest, show the prompt
      setShowGuestPrompt(true);
    }
  };

  if (loading || items.length === 0) {
    return <div className="min-h-screen bg-[#FFF5F8] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div></div>;
  }

  const hasPOA = items.some(i => i.product.priceOnAsk);

  return (
    <div className="min-h-screen bg-[#FFF5F8] text-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-20 flex flex-col lg:flex-row gap-12">
        
        {/* Left Col: Form */}
        <div className="flex-grow lg:w-2/3">
          <Link href="/" className="inline-block text-sm font-bold text-neutral-400 hover:text-black mb-8 transition-colors">← Back to Shopping</Link>
          <h1 className="text-3xl font-black mb-8 uppercase tracking-widest">Order Request</h1>
          
          {!user && (
            <div className="bg-white p-6 rounded-2xl border border-pink-100 shadow-sm mb-8 flex justify-between items-center flex-wrap gap-4">
              <div>
                <h3 className="font-bold text-black">Already part of the club?</h3>
                <p className="text-sm text-neutral-500">Sign in for faster checkout and to link to your profile.</p>
              </div>
              <button 
                type="button" 
                onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} 
                className="bg-black text-white px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
              >
                Sign In
              </button>
            </div>
          )}

          <form id="checkout-form" onSubmit={handlePlaceOrderClick} className="space-y-6 bg-white p-6 sm:p-10 rounded-3xl border border-pink-100 shadow-sm">
            <h2 className="text-xl font-bold mb-4">Contact Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Full Name *</label>
                <input type="text" name="name" required value={formData.name} onChange={handleChange} className="w-full border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Email *</label>
                <input type="email" name="email" required value={formData.email} onChange={handleChange} className="w-full border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Instagram Handle (For easier contact)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">@</span>
                <input type="text" name="instagram" value={formData.instagram} onChange={handleChange} className="w-full border border-neutral-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all" />
              </div>
            </div>

            <h2 className="text-xl font-bold mb-4 mt-10">Delivery Information</h2>
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Shipping Address *</label>
              <textarea name="address" required rows={3} value={formData.address} onChange={handleChange} className="w-full border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all resize-none"></textarea>
            </div>
            
            <h2 className="text-xl font-bold mb-4 mt-10">Order Notes</h2>
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Custom Sizing or Special Requests</label>
              <textarea name="notes" rows={3} value={formData.notes} onChange={handleChange} placeholder="e.g. Thumb: 16mm, Index: 12mm..." className="w-full border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all resize-none"></textarea>
            </div>
          </form>
        </div>

        {/* Right Col: Summary */}
        <div className="w-full lg:w-1/3">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-pink-100 shadow-xl sticky top-24">
            <h2 className="text-xl font-black mb-6 uppercase tracking-widest">Order Summary</h2>
            
            <div className="space-y-4 mb-8 max-h-[40vh] overflow-y-auto pr-2">
              {items.map((item) => (
                <div key={item.cartItemId} className="flex gap-4 border-b border-neutral-100 pb-4">
                  <div className="w-16 h-16 relative rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                    <Image src={item.product.imagePath} alt={item.product.name} fill className="object-cover" />
                  </div>
                  <div className="flex flex-col justify-center flex-grow">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-black text-sm line-clamp-1">{item.product.name}</h3>
                      <button type="button" onClick={() => removeFromCart(item.cartItemId)} className="text-neutral-300 hover:text-red-500 ml-2 flex-shrink-0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-0.5">{item.shape} • {item.size} • {item.length} • Qty: {item.quantity}</p>
                    <p className="text-pink-500 font-bold mt-1 text-sm">{item.product.priceOnAsk ? "POA" : `€${(item.product.basePrice * item.quantity).toFixed(2)}`}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-neutral-100 pt-6 space-y-3 mb-8">
              <div className="flex justify-between text-sm text-neutral-500 font-medium">
                <span>Subtotal</span>
                <span>€{cartTotal.toFixed(2)} {hasPOA && "(+ POA)"}</span>
              </div>
              <div className="flex justify-between text-sm text-neutral-500 font-medium">
                <span>Shipping</span>
                <span>Calculated via DM</span>
              </div>
            </div>

            <button 
              form="checkout-form" 
              type="submit" 
              disabled={submitting}
              className="w-full bg-[#FF5C9D] text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-pink-600 transition-colors shadow-lg shadow-pink-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Processing..." : "Submit Order Request"}
            </button>
            <p className="text-[10px] text-neutral-400 text-center mt-4 uppercase tracking-widest leading-relaxed">
              No payment is taken today.<br/>I will DM or email you to confirm details & payment.
            </p>
          </div>
        </div>

      </div>

      {/* Guest Prompt Modal */}
      {showGuestPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowGuestPrompt(false)} />
          <div className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-fade-in text-center border-2 border-pink-100">
            <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#FF5C9D" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
            </div>
            <h3 className="text-2xl font-black text-black mb-3">Save your details?</h3>
            <p className="text-neutral-500 text-sm mb-8 leading-relaxed">
              Create a free UnHolly profile to save your custom sizes, track order history, and breeze through checkout next time!
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={handleCreateRealProfile} className="w-full bg-black text-white py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-neutral-800 transition shadow-md">
                Yes, Create Profile
              </button>
              <button onClick={handleCreateGhostProfile} className="w-full bg-white text-neutral-500 py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs border border-neutral-200 hover:bg-neutral-50 transition">
                No, Continue as Guest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
