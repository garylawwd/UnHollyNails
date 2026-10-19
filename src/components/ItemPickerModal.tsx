"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "@/lib/firebase";
import { VENDOR_UID, formatStorageImageUrl } from "@/lib/constants";

const db = getFirestore(app);

export type CollectionMode = 'core' | 'promo' | 'custom';

export default function ItemPickerModal({ 
  isOpen, 
  onClose, 
  tag,
  collectionMode,
  currentItems,
  onSave
}: { 
  isOpen: boolean;
  onClose: () => void;
  tag: string;
  collectionMode: CollectionMode;
  currentItems: any[];
  onSave: (selectedIds: string[]) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    if (!isOpen) return;
    
    const fetchAll = async () => {
      setLoading(true);
      try {
        const vendorUid = VENDOR_UID;
        const snap = await getDocs(collection(db, "users", vendorUid, "nail_sets"));
        
        let items = snap.docs.map(d => {
          const data = d.data();
          const primaryImage = formatStorageImageUrl(
            data.imagePath || 'https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?auto=format&fit=crop&q=80&w=800',
            vendorUid
          );
          return {
            id: d.id,
            name: data.name || 'Unnamed',
            type: data.type || 'Sets',
            isForSale: data.isForSale === true,
            isPromo: data.isPromo === true,
            imagePath: primaryImage,
            tags: data.tags || []
          };
        });
        
        setAllItems(items);

        // Initialize selected ids based on mode
        if (collectionMode === 'promo') {
          setSelectedIds(new Set(items.filter(i => i.isPromo).map(i => i.id)));
        } else if (collectionMode === 'custom') {
          setSelectedIds(new Set(currentItems.map(p => p.id)));
        } else {
          // core mode: we are picking items to publish, so nothing is pre-selected initially
          setSelectedIds(new Set());
        }

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [isOpen, currentItems, collectionMode]);

  if (!isOpen) return null;

  const getMappedType = (t: string) => {
    const map: Record<string, string> = {
      "sets": "Sets", "minis": "Minis", "keychains": "Keychains", "keyrings": "Keychains",
      "earrings": "Earrings", "accessories": "Accessories", "basics": "Basics"
    };
    return map[t.toLowerCase()];
  };

  const currentMappedType = getMappedType(tag);

  const displayItems = allItems.filter(item => {
    if (collectionMode === 'core' && currentMappedType) {
      // Core tag modal: Show only matching type that are NOT for sale
      const matchesType = item.type?.toLowerCase() === currentMappedType.toLowerCase() || item.tags.map((t: string)=>t.toLowerCase()).includes(currentMappedType.toLowerCase());
      return matchesType && !item.isForSale;
    } else {
      // Custom/Promo modal: Show all items, use filter chips
      if (filter !== "All") {
        return item.type?.toLowerCase() === filter.toLowerCase() || item.tags.map((t: string)=>t.toLowerCase()).includes(filter.toLowerCase());
      }
      return true;
    }
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSave = () => {
    if (collectionMode === 'core') {
      // Return newly selected unlisted items to publish
      const toPublish = Array.from(selectedIds).filter(id => displayItems.some(di => di.id === id));
      onSave(toPublish);
    } else {
      // Promo/Custom: return exactly what is selected
      onSave(Array.from(selectedIds));
    }
  };

  const getTitle = () => {
    if (collectionMode === 'core') return `Publish Unlisted ${currentMappedType}`;
    if (collectionMode === 'promo') return `Manage Special Offers`;
    return `Manage Collection Items`;
  };

  const getSubtitle = () => {
    if (collectionMode === 'core') return `Select items to make them live on the store.`;
    if (collectionMode === 'promo') return `Select products to feature as Special Offers.`;
    return `Select any products to feature in this collection.`;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col relative shadow-2xl overflow-hidden animate-slide-up">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-100 flex justify-between items-center bg-white z-10">
          <div>
            <h2 className="font-black text-xl uppercase tracking-widest text-black">
              {getTitle()}
            </h2>
            <p className="text-neutral-500 text-sm font-medium mt-1">
              {getSubtitle()}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-black w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors">
            ✕
          </button>
        </div>

        {/* Filter Chips (Custom & Promo Collections) */}
        {collectionMode !== 'core' && (
          <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50 flex gap-2 overflow-x-auto hide-scrollbar">
            {["All", "Sets", "Minis", "Keychains", "Earrings", "Accessories", "Basics"].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${filter === f ? 'bg-black text-white shadow-md' : 'bg-white text-neutral-600 border border-neutral-200 hover:border-black'}`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-neutral-50">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
            </div>
          ) : displayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400">
              <div className="text-4xl mb-2">🔍</div>
              <p className="font-medium">No items found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {displayItems.map(item => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <div 
                    key={item.id} 
                    onClick={() => toggleSelect(item.id)}
                    className={`cursor-pointer relative group rounded-2xl overflow-hidden border-2 transition-all duration-200 ${isSelected ? 'border-pink-500 shadow-lg shadow-pink-500/20 scale-[0.98]' : 'border-transparent bg-white shadow-sm hover:border-pink-200 hover:shadow-md'}`}
                  >
                    <div className="aspect-square relative bg-neutral-100">
                      <Image src={item.imagePath} alt={item.name} fill className="object-cover" />
                      <div className={`absolute inset-0 transition-opacity duration-200 ${isSelected ? 'bg-pink-500/20' : 'bg-black/0 group-hover:bg-black/5'}`} />
                      
                      {/* Checkbox */}
                      <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-pink-500 border-pink-500 text-white' : 'bg-white/80 border-neutral-300 text-transparent backdrop-blur-sm'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className={`p-3 text-center transition-colors ${isSelected ? 'bg-pink-50' : ''}`}>
                      <p className="text-xs font-bold text-neutral-900 truncate">{item.name}</p>
                      {!item.isForSale && <p className="text-[10px] font-black text-pink-500 uppercase mt-0.5">Unlisted</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-neutral-100 bg-white flex justify-between items-center z-10">
          <p className="text-sm font-bold text-neutral-500">
            {collectionMode === 'core'
              ? `${Array.from(selectedIds).filter(id => displayItems.some(di => di.id === id)).length} items selected to publish`
              : `${selectedIds.size} items selected`}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-neutral-600 hover:bg-neutral-100 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} className="px-8 py-3 rounded-xl font-bold text-white bg-black hover:bg-pink-500 transition-colors shadow-lg">
              Save Changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
