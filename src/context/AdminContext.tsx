"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Product } from "@/lib/types";

interface AdminContextType {
  editMode: boolean;
  setEditMode: (val: boolean) => void;
  editingProduct: Product | null;
  setEditingProduct: (p: Product | null) => void;
  
  // Page editing actions & status for the unified top admin bar
  pageTitle?: string;
  setPageTitle: (title: string | undefined) => void;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  lastSaved: Date | null;
  setLastSaved: (date: Date | null) => void;
  saveHandler?: () => Promise<void> | void;
  setSaveHandler: (fn: (() => Promise<void> | void) | undefined) => void;
  resetHandler?: () => Promise<void> | void;
  setResetHandler: (fn: (() => Promise<void> | void) | undefined) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [editMode, setEditMode] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pageTitle, setPageTitle] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  const [saveHandler, _setSaveHandler] = useState<(() => Promise<void> | void) | undefined>(undefined);
  const [resetHandler, _setResetHandler] = useState<(() => Promise<void> | void) | undefined>(undefined);

  const setSaveHandler = useCallback((fn: (() => Promise<void> | void) | undefined) => {
    _setSaveHandler(() => fn);
  }, []);

  const setResetHandler = useCallback((fn: (() => Promise<void> | void) | undefined) => {
    _setResetHandler(() => fn);
  }, []);

  return (
    <AdminContext.Provider
      value={{
        editMode,
        setEditMode,
        editingProduct,
        setEditingProduct,
        pageTitle,
        setPageTitle,
        isSaving,
        setIsSaving,
        lastSaved,
        setLastSaved,
        saveHandler,
        setSaveHandler,
        resetHandler,
        setResetHandler
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}
