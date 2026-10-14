"use client";

import { useCart } from "@/context/CartContext";
import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";

export default function CartDrawer() {
  const { isCartOpen, setIsCartOpen, items, removeFromCart, updateQuantity, cartTotal } = useCart();

  // Prevent background scrolling when cart is open
  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isCartOpen]);

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />
      
      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-pink-100">
          <h2 className="text-lg font-brand font-bold text-neutral-900 uppercase tracking-wider">Your Bag</h2>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="p-2 text-neutral-400 hover:text-black transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center text-pink-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
              </div>
              <p className="text-neutral-500 font-medium">Your bag is currently empty.</p>
              <button onClick={() => setIsCartOpen(false)} className="text-pink-500 font-bold uppercase tracking-wider text-sm hover:text-pink-600">Start Shopping</button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.cartItemId} className="flex gap-4 border border-pink-50 p-3 rounded-2xl bg-pink-50/30">
                <div className="w-20 h-24 relative rounded-xl overflow-hidden bg-neutral-100 flex-shrink-0">
                  <Image src={item.product.imagePath} alt={item.product.name} fill className="object-cover" />
                </div>
                <div className="flex flex-col justify-between flex-grow">
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-black text-sm">{item.product.name}</h3>
                      <button onClick={() => removeFromCart(item.cartItemId)} className="text-neutral-300 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">{item.shape} • {item.size} • {item.length}</p>
                    <p className="text-pink-500 font-bold mt-1 text-sm">{item.product.priceOnAsk ? "POA" : `€${item.product.basePrice.toFixed(2)}`}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)} className="w-6 h-6 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-500 hover:border-pink-500 hover:text-pink-500">-</button>
                    <span className="text-sm font-bold w-4 text-center text-black">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)} className="w-6 h-6 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-500 hover:border-pink-500 hover:text-pink-500">+</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-6 bg-white border-t border-pink-100 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
            <div className="flex justify-between items-center mb-6">
              <span className="text-neutral-500 font-medium">Subtotal {items.some(i => i.product.priceOnAsk) && "(+ POA)"}</span>
              <span className="text-xl font-brand font-bold text-neutral-900">€{cartTotal.toFixed(2)}</span>
            </div>
            <p className="text-xs text-neutral-400 mb-4 text-center">Shipping & taxes calculated at checkout.</p>
            <Link 
              href="/checkout" 
              onClick={() => setIsCartOpen(false)}
              className="block w-full bg-pink-500 text-white text-center py-4 rounded-full font-bold uppercase tracking-wider hover:bg-pink-600 transition-colors shadow-lg hover:shadow-xl hover:scale-[1.02]"
            >
              Go to Checkout
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
