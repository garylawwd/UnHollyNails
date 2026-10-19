"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useAdmin } from "@/context/AdminContext";
import { doc, setDoc, deleteDoc, collection, getDocs, query, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { VENDOR_UID, isAdminUid } from "@/lib/constants";
import { useNailOptions } from "@/hooks/useNailOptions";

export default function GlobalProductEditor() {
  const { editingProduct, setEditingProduct } = useAdmin();
  const { shapes: SHAPE_OPTIONS, lengths: LENGTH_OPTIONS, addShape, addLength } = useNailOptions();
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const [newMainFile, setNewMainFile] = useState<File | null>(null);
  const [mainPreviewUrl, setMainPreviewUrl] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [customNewShape, setCustomNewShape] = useState("");
  const [customNewLength, setCustomNewLength] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setAdminUser(u && isAdminUid(u.uid) ? u : null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setNewMainFile(null);
    setMainPreviewUrl(null);
    setCustomNewShape("");
    setCustomNewLength("");
  }, [editingProduct?.id]);

  useEffect(() => {
    if (editingProduct && adminUser) {
      // Fetch all unique tags for datalist just once when editor opens
      const fetchTags = async () => {
        const q = query(collection(db, "users", VENDOR_UID, "nail_sets"));
        const snap = await getDocs(q);
        const tags = new Set<string>();
        snap.forEach(docSnap => {
          const t = docSnap.data().tags || [];
          t.forEach((tag: string) => tags.add(tag));
        });
        setExistingTags(Array.from(tags));
      };
      fetchTags();
    }
  }, [editingProduct, adminUser]);

  useEffect(() => {
    if (editingProduct) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [editingProduct]);

  if (!editingProduct) return null;

  const handleMainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewMainFile(file);
      setMainPreviewUrl(URL.createObjectURL(file));
    }
  };

  const makePhotoMain = (idx: number) => {
    if (!editingProduct) return;
    const currentMain = mainPreviewUrl || editingProduct.imagePath;
    const selectedExtra = (editingProduct.additionalImages || [])[idx];
    if (!selectedExtra) return;

    const updatedExtras = [...(editingProduct.additionalImages || [])];
    updatedExtras.splice(idx, 1);
    if (currentMain && !currentMain.includes("unsplash")) {
      updatedExtras.unshift(currentMain);
    }

    setEditingProduct({
      ...editingProduct,
      imagePath: selectedExtra,
      additionalImages: updatedExtras
    });
    setNewMainFile(null);
    setMainPreviewUrl(null);
  };

  const moveExtraPhoto = (fromIdx: number, toIdx: number) => {
    if (!editingProduct) return;
    const list = [...(editingProduct.additionalImages || [])];
    if (toIdx < 0 || toIdx >= list.length) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setEditingProduct({ ...editingProduct, additionalImages: list });
  };

  const removeExtraPhoto = (idx: number) => {
    if (!editingProduct) return;
    const updated = (editingProduct.additionalImages || []).filter((_, i) => i !== idx);
    setEditingProduct({ ...editingProduct, additionalImages: updated });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (newTag && !editingProduct.tags.includes(newTag)) {
        setEditingProduct({ ...editingProduct, tags: [...(editingProduct.tags || []), newTag] });
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setEditingProduct({
      ...editingProduct,
      tags: editingProduct.tags.filter(t => t !== tagToRemove)
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser) return;
    setSaving(true);
    try {
      const targetSetSyncId = editingProduct.syncId || editingProduct.id;
      const pRef = doc(db, editingProduct.docPath || `users/${VENDOR_UID}/nail_sets/${targetSetSyncId}`);
      let newImagePath = editingProduct.imagePath;
      let newAdditionalImages = [...(editingProduct.additionalImages || [])];
      
      // Upload new main photo if one was selected
      if (newMainFile) {
        const storageReference = ref(storage, `users/${VENDOR_UID}/images/storefront_${Date.now()}_main_${newMainFile.name}`);
        await uploadBytes(storageReference, newMainFile);
        newImagePath = await getDownloadURL(storageReference);
      }

      if (fileInputRef.current?.files && fileInputRef.current.files.length > 0) {
        const files = Array.from(fileInputRef.current.files);
        for (const file of files) {
          const storageReference = ref(storage, `users/${VENDOR_UID}/images/storefront_${Date.now()}_${file.name}`);
          await uploadBytes(storageReference, file);
          const url = await getDownloadURL(storageReference);
          
          if (!newImagePath || newImagePath.includes("unsplash")) {
             newImagePath = url;
          } else {
             newAdditionalImages.push(url);
          }
        }
      }

      // Deduplicate extra images and ensure main image isn't duplicated
      newAdditionalImages = Array.from(new Set(newAdditionalImages)).filter(
        url => Boolean(url) && url !== newImagePath
      );

      const now = Date.now();

      await setDoc(pRef, {
        id: 0,
        syncId: targetSetSyncId,
        name: editingProduct.name,
        basePrice: Number(editingProduct.basePrice) || 0,
        priceOnAsk: Boolean(editingProduct.priceOnAsk),
        description: editingProduct.description || "",
        defaultShape: editingProduct.defaultShape || "Almond",
        defaultLength: editingProduct.defaultLength || "M",
        hiddenShapes: editingProduct.hiddenShapes || [],
        hiddenLengths: editingProduct.hiddenLengths || [],
        isPromo: Boolean(editingProduct.isPromo),
        tags: editingProduct.tags || [],
        type: editingProduct.type || "Sets",
        imagePath: newImagePath,
        additionalImages: newAdditionalImages,
        updatedAt: now
      }, { merge: true });

      // Two-way sync with PressOnPro's set_images subcollection
      try {
        const setImagesCol = collection(db, "users", VENDOR_UID, "set_images");
        const existingSnap = await getDocs(
          query(setImagesCol, where("setSyncId", "==", targetSetSyncId))
        );
        const existingDocs = existingSnap.docs.map(d => ({
          docId: d.id,
          ...(d.data() as { uri?: string; syncId?: string; position?: number })
        }));

        const validUris = new Set<string>(newAdditionalImages);
        if (newImagePath && !newImagePath.includes("unsplash")) {
          validUris.add(newImagePath);
        }

        // Remove any set_images docs that were deleted in the editor
        for (const oldDoc of existingDocs) {
          if (!oldDoc.uri || !validUris.has(oldDoc.uri)) {
            await deleteDoc(doc(db, "users", VENDOR_UID, "set_images", oldDoc.docId));
          }
        }

        // Upsert all current extra images with their ordered position
        for (let idx = 0; idx < newAdditionalImages.length; idx++) {
          const url = newAdditionalImages[idx];
          const match = existingDocs.find(d => d.uri === url);
          const imgSyncId = match?.syncId || match?.docId || crypto.randomUUID();
          await setDoc(doc(db, "users", VENDOR_UID, "set_images", imgSyncId), {
            syncId: imgSyncId,
            setSyncId: targetSetSyncId,
            setId: 0,
            uri: url,
            position: idx,
            updatedAt: now
          }, { merge: true });
        }
      } catch (syncErr) {
        console.warn("Could not sync set_images subcollection:", syncErr);
      }

      setEditingProduct(null);
      window.location.reload(); // Quickest way to refresh all stale views
    } catch (error) {
      console.error("Error updating:", error);
      alert("Failed to save. Make sure you have write permissions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 text-black">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setEditingProduct(null)} />
      <div className="relative bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="bg-neutral-100 px-6 py-4 border-b flex justify-between items-center shrink-0">
          <h2 className="font-black text-lg">Edit Product</h2>
          <button onClick={() => setEditingProduct(null)} className="text-neutral-500 hover:text-black font-bold">Close X</button>
        </div>
        
        <div className="overflow-y-auto p-6 space-y-5">
          <form id="editForm" onSubmit={handleSaveEdit} className="space-y-5">
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Name</label>
                <input type="text" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full border rounded-lg px-3 py-2" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1 flex justify-between">
                  Price (€)
                  <label className="flex items-center gap-1 cursor-pointer text-[10px] text-pink-600">
                    <input type="checkbox" checked={editingProduct.priceOnAsk} onChange={e => setEditingProduct({...editingProduct, priceOnAsk: e.target.checked})} className="accent-pink-500" />
                    Price on Ask (POA)
                  </label>
                </label>
                <input type="number" step="0.01" disabled={editingProduct.priceOnAsk} value={editingProduct.priceOnAsk ? "" : editingProduct.basePrice} onChange={e => setEditingProduct({...editingProduct, basePrice: parseFloat(e.target.value)})} className="w-full border rounded-lg px-3 py-2 disabled:bg-neutral-100 disabled:text-neutral-400" required={!editingProduct.priceOnAsk} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Tags / Pins</label>
                <div className="border rounded-xl p-3 bg-white min-h-[3rem] flex flex-wrap gap-2 items-center focus-within:border-black focus-within:ring-1 focus-within:ring-black">
                  {editingProduct.tags?.map(tag => (
                    <span key={tag} className="flex items-center gap-1 bg-pink-100 text-pink-800 px-3 py-1 rounded-full text-sm font-semibold">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="w-4 h-4 rounded-full hover:bg-pink-200 flex items-center justify-center text-xs ml-1">×</button>
                    </span>
                  ))}
                  <input type="text" list="existing-tags" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} placeholder="Type or select a tag..." className="flex-1 min-w-[150px] outline-none text-sm bg-transparent" />
                  <datalist id="existing-tags">
                    {existingTags.map(tag => (
                      <option key={tag} value={tag} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Product Type</label>
                <select value={editingProduct.type || "Sets"} onChange={e => setEditingProduct({...editingProduct, type: e.target.value})} className="w-full border rounded-xl px-3 py-3 bg-white">
                  <option value="Sets">Sets</option>
                  <option value="Minis">Minis</option>
                  <option value="Keychains">Keychains</option>
                  <option value="Earrings">Earrings</option>
                  <option value="Accessories">Accessories</option>
                </select>
                <p className="text-[10px] text-neutral-400 mt-2 uppercase tracking-wide">Select the category this product belongs to in the app's Design Catalogue.</p>
              </div>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer font-bold">
                <input type="checkbox" checked={editingProduct.isPromo} onChange={e => setEditingProduct({...editingProduct, isPromo: e.target.checked})} className="w-5 h-5 accent-pink-500" />
                Show in Special Offers (Promo)
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Default Shape</label>
                <select value={editingProduct.defaultShape || ''} onChange={e => setEditingProduct({...editingProduct, defaultShape: e.target.value})} className="w-full border rounded-lg px-3 py-2 bg-white">
                  {SHAPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  <option value="Other">+ Other (Add New Shape...)</option>
                </select>
                {editingProduct.defaultShape === "Other" && (
                  <div className="flex gap-1.5 mt-2">
                    <input
                      type="text"
                      value={customNewShape}
                      onChange={e => setCustomNewShape(e.target.value)}
                      placeholder="New shape (e.g. Ballerina)..."
                      className="flex-1 border rounded-lg px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const val = customNewShape.trim();
                        if (!val) return;
                        await addShape(val);
                        setEditingProduct({ ...editingProduct, defaultShape: val });
                        setCustomNewShape("");
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Default Length</label>
                <select value={editingProduct.defaultLength || ''} onChange={e => setEditingProduct({...editingProduct, defaultLength: e.target.value})} className="w-full border rounded-lg px-3 py-2 bg-white">
                  {LENGTH_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  <option value="Other">+ Other (Add New Length...)</option>
                </select>
                {editingProduct.defaultLength === "Other" && (
                  <div className="flex gap-1.5 mt-2">
                    <input
                      type="text"
                      value={customNewLength}
                      onChange={e => setCustomNewLength(e.target.value)}
                      placeholder="New length (e.g. XXL)..."
                      className="flex-1 border rounded-lg px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const val = customNewLength.trim();
                        if (!val) return;
                        await addLength(val);
                        setEditingProduct({ ...editingProduct, defaultLength: val });
                        setCustomNewLength("");
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* HIDE / SHOW SHAPES & LENGTHS PER PRODUCT */}
            <div className="p-4 border rounded-xl bg-neutral-50/90 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wide">
                    Shape Availability (Click to Hide / Show)
                  </label>
                  <span className="text-[11px] font-semibold text-neutral-500">
                    {(editingProduct.hiddenShapes || []).length > 0
                      ? `${(editingProduct.hiddenShapes || []).length} hidden`
                      : "All visible"}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mb-2">
                  Some nail sets cannot be crafted in certain shapes. Tap any shape to hide it from the options list on the website for this item.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SHAPE_OPTIONS.map((shape) => {
                    const isHidden = (editingProduct.hiddenShapes || []).includes(shape);
                    return (
                      <button
                        key={shape}
                        type="button"
                        onClick={() => {
                          const current = editingProduct.hiddenShapes || [];
                          const updated = isHidden
                            ? current.filter((s) => s !== shape)
                            : [...current, shape];
                          setEditingProduct({
                            ...editingProduct,
                            hiddenShapes: updated,
                          });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                          isHidden
                            ? "bg-neutral-200 text-neutral-400 line-through border border-neutral-300"
                            : "bg-white text-neutral-800 border border-neutral-300 hover:border-pink-500 hover:text-pink-600"
                        }`}
                        title={isHidden ? `Click to show ${shape}` : `Click to hide ${shape}`}
                      >
                        <span className={isHidden ? "text-red-500 font-black text-xs" : "text-emerald-500 font-black text-xs"}>
                          {isHidden ? "✕" : "✓"}
                        </span>
                        <span>{shape}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-200">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wide">
                    Length Availability (Click to Hide / Show)
                  </label>
                  <span className="text-[11px] font-semibold text-neutral-500">
                    {(editingProduct.hiddenLengths || []).length > 0
                      ? `${(editingProduct.hiddenLengths || []).length} hidden`
                      : "All visible"}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mb-2">
                  Tap any length to hide it from the options list on the website for this item.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {LENGTH_OPTIONS.map((length) => {
                    const isHidden = (editingProduct.hiddenLengths || []).includes(length);
                    return (
                      <button
                        key={length}
                        type="button"
                        onClick={() => {
                          const current = editingProduct.hiddenLengths || [];
                          const updated = isHidden
                            ? current.filter((l) => l !== length)
                            : [...current, length];
                          setEditingProduct({
                            ...editingProduct,
                            hiddenLengths: updated,
                          });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                          isHidden
                            ? "bg-neutral-200 text-neutral-400 line-through border border-neutral-300"
                            : "bg-white text-neutral-800 border border-neutral-300 hover:border-pink-500 hover:text-pink-600"
                        }`}
                        title={isHidden ? `Click to show ${length}` : `Click to hide ${length}`}
                      >
                        <span className={isHidden ? "text-red-500 font-black text-xs" : "text-emerald-500 font-black text-xs"}>
                          {isHidden ? "✕" : "✓"}
                        </span>
                        <span>{length}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Description</label>
              <textarea value={editingProduct.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} className="w-full border rounded-lg px-3 py-2 h-24" />
            </div>

            <div className="p-4 border rounded-xl bg-neutral-50 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <label className="block text-xs font-bold text-neutral-800 uppercase">Product Photos</label>
                  <p className="text-[11px] text-neutral-500">The first photo is the primary storefront display image. Tap &quot;Set as Main&quot; on any photo to switch.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => mainFileInputRef.current?.click()}
                    className="bg-white border border-neutral-300 hover:border-pink-500 text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>📷</span>
                    <span>Replace Main</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-black hover:bg-neutral-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>➕</span>
                    <span>Add Photos</span>
                  </button>
                </div>
              </div>

              {/* Hidden file inputs */}
              <input
                type="file"
                ref={mainFileInputRef}
                accept="image/*"
                onChange={handleMainFileChange}
                className="hidden"
              />
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple
                className="hidden"
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. Primary Main Photo Card */}
                <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-pink-500 ring-2 ring-pink-500/20 bg-pink-50 group shadow-sm flex flex-col justify-between">
                  <Image
                    src={mainPreviewUrl || editingProduct.imagePath || "https://images.unsplash.com/photo-1596205731518-e37c897f7405?w=500"}
                    alt="Main display photo"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute top-2 left-2 z-10 bg-pink-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow flex items-center gap-1 uppercase tracking-wider">
                    <span>★</span>
                    <span>{newMainFile ? "New Main" : "Main"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => mainFileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
                  >
                    <span className="text-base">📷</span>
                    <span>Change Photo</span>
                  </button>
                </div>

                {/* 2. Additional Photos Cards */}
                {editingProduct.additionalImages?.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 group shadow-sm flex flex-col justify-between">
                    <Image
                      src={url}
                      alt={`Extra photo ${idx + 1}`}
                      fill
                      className="object-cover"
                    />
                    {/* Top action bar: Move & Delete */}
                    <div className="absolute top-1.5 right-1.5 z-10 flex gap-1">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => moveExtraPhoto(idx, idx - 1)}
                          className="w-5 h-5 rounded-full bg-black/60 hover:bg-black text-white text-[10px] flex items-center justify-center font-bold transition shadow cursor-pointer"
                          title="Move left"
                        >
                          &larr;
                        </button>
                      )}
                      {idx < (editingProduct.additionalImages?.length || 0) - 1 && (
                        <button
                          type="button"
                          onClick={() => moveExtraPhoto(idx, idx + 1)}
                          className="w-5 h-5 rounded-full bg-black/60 hover:bg-black text-white text-[10px] flex items-center justify-center font-bold transition shadow cursor-pointer"
                          title="Move right"
                        >
                          &rarr;
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeExtraPhoto(idx)}
                        className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs flex items-center justify-center font-bold transition shadow cursor-pointer"
                        title="Remove photo"
                      >
                        &times;
                      </button>
                    </div>

                    {/* Bottom: Set as Main button */}
                    <button
                      type="button"
                      onClick={() => makePhotoMain(idx)}
                      className="absolute bottom-0 inset-x-0 bg-black/75 hover:bg-pink-600 text-white text-[10px] font-bold py-1.5 transition flex items-center justify-center gap-1 z-10 cursor-pointer shadow-md"
                    >
                      <span>★</span>
                      <span>Set as Main</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </form>
        </div>
        
        <div className="bg-neutral-50 p-4 border-t flex justify-end gap-3 shrink-0">
          <button onClick={() => setEditingProduct(null)} className="px-5 py-2 font-bold text-neutral-600 hover:text-black">Cancel</button>
          <button form="editForm" type="submit" disabled={saving} className="bg-pink-500 hover:bg-pink-600 text-white px-8 py-2 rounded-xl font-bold flex items-center gap-2">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
