"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Product } from "@/lib/types";
import { HandSizesMap } from "@/components/InteractiveHandSizer";

export interface CartItem {
  cartItemId: string; // Unique ID for this specific cart entry
  product: Product;
  shape: string;
  size: string;
  length: string;
  quantity: number;
  customSizes?: HandSizesMap;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (
    product: Product,
    shape: string,
    size: string,
    length: string,
    quantity: number,
    customSizes?: HandSizesMap
  ) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  itemCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem("unholly_cart");
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse cart", e);
      }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("unholly_cart", JSON.stringify(items));
    }
  }, [items, isMounted]);

  const addToCart = (
    product: Product,
    shape: string,
    size: string,
    length: string,
    quantity: number,
    customSizes?: HandSizesMap
  ) => {
    setItems((prev) => {
      const serializedCustom = customSizes ? JSON.stringify(customSizes) : "";
      // Check if exact item exists
      const existingIndex = prev.findIndex(
        (i) =>
          i.product.id === product.id &&
          i.shape === shape &&
          i.size === size &&
          i.length === length &&
          (i.customSizes ? JSON.stringify(i.customSizes) : "") === serializedCustom
      );
      
      if (existingIndex >= 0) {
        const newItems = [...prev];
        newItems[existingIndex].quantity += quantity;
        return newItems;
      }

      return [
        ...prev,
        {
          cartItemId: Math.random().toString(36).substr(2, 9),
          product,
          shape,
          size,
          length,
          quantity,
          ...(customSizes ? { customSizes } : {}),
        },
      ];
    });
    setIsCartOpen(true); // Auto-open cart when item added
  };

  const removeFromCart = (cartItemId: string) => {
    setItems((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setItems((prev) => prev.map((i) => (i.cartItemId === cartItemId ? { ...i, quantity } : i)));
  };

  const clearCart = () => {
    setItems([]);
  };

  const cartTotal = items.reduce((total, item) => total + (item.product.priceOnAsk ? 0 : item.product.basePrice * item.quantity), 0);
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartTotal,
      itemCount,
      isCartOpen,
      setIsCartOpen
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
