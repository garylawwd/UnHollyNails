'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  onSnapshot,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import ProductLightbox from '@/components/ProductLightbox';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import Link from 'next/link';
import Image from 'next/image';
import { Dancing_Script } from 'next/font/google';
import { VENDOR_UID, isAdminUid } from '@/lib/constants';
import InteractiveHandSizer, { FINGER_MAP } from '@/components/InteractiveHandSizer';
import { useNailOptions } from '@/hooks/useNailOptions';

const dancingScript = Dancing_Script({ subsets: ['latin'] });

const ORDER_TRACKER_STEPS = [
  { key: 'received', label: 'Order Received', shortLabel: 'Received' },
  { key: 'confirmed', label: 'Confirmed & In Queue', shortLabel: 'In Queue' },
  { key: 'ready', label: 'Hand-Painted & Ready', shortLabel: 'Painted & Ready' },
  { key: 'dispatched', label: 'Dispatched', shortLabel: 'Dispatched' },
  { key: 'delivered', label: 'Delivered', shortLabel: 'Delivered' },
];

function getOrderStepIndex(status?: string): number {
  const s = (status || 'Pending').trim().toLowerCase();
  if (s === 'delivered') {
    return 4;
  }
  if (s === 'sent' || s === 'shipped' || s === 'dispatched') {
    return 3;
  }
  if (s === 'completed' || s === 'complete' || s === 'ready') {
    return 2;
  }
  if (s === 'paid' || s === 'confirmed' || s === 'in progress' || s === 'accepted') {
    return 1;
  }
  return 0; // Pending / Order Received
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function isOrderLoyaltyEligible(o: any): boolean {
  if (typeof o.isLoyaltyEligible === 'boolean') return o.isLoyaltyEligible;
  if (typeof o.loyaltyEligible === 'boolean') return o.loyaltyEligible;
  if (typeof o.earnsStamp === 'boolean') return o.earnsStamp;
  const t = o.orderType || o.type || 'Standard';
  return t === 'Standard' || t === 'Legacy';
}

function ProfilePageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [user, setUser] = useState<any>(null);
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [sizes, setSizes] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sizing' | 'orders' | 'details'>(
    tabParam === 'orders' || tabParam === 'details' ? tabParam : 'sizing'
  );

  const { shapes: dynamicShapes, lengths: dynamicLengths } = useNailOptions();
  const [defaultMilestoneReward, setDefaultMilestoneReward] = useState<string>('Free Delivery');
  const [secondaryMilestoneReward, setSecondaryMilestoneReward] = useState<string>('Free Gift');
  const [quickFillPresets, setQuickFillPresets] = useState<string[]>([
    'Free Delivery',
    'Free Gift',
    'Free Application Pack',
    'Free Sizing Kit for a Friend',
    'Free Nail Book',
    '€10 Off Next Set',
  ]);

  // Admin inline milestone edit modal on /profile
  const [isEditingMilestones, setIsEditingMilestones] = useState(false);
  const [milestonesEditForm, setMilestonesEditForm] = useState<Record<string, string>>({});
  const [editDefaultReward, setEditDefaultReward] = useState('');
  const [editSecondaryReward, setEditSecondaryReward] = useState('');
  const [savingMilestones, setSavingMilestones] = useState(false);
  const [activeInlineTarget, setActiveInlineTarget] = useState<string>('5');

  useEffect(() => {
    if (tabParam === 'orders' || tabParam === 'details' || tabParam === 'sizing') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [clientImages, setClientImages] = useState<any[]>([]);
  const [gallerySubTab, setGallerySubTab] = useState<'inspo' | 'wishlist' | 'completed'>('inspo');
  const [uploadingInspo, setUploadingInspo] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const toggleOrderExpand = (key: string) => {
    setExpandedOrders((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Setup Flow States
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupInsta, setSetupInsta] = useState('');
  const [setupError, setSetupError] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);

  const vendorUid = VENDOR_UID;
  const isAdmin = isAdminUid(user?.uid);

  // Admin Client Directory & Profile Management States
  const [adminClients, setAdminClients] = useState<any[]>([]);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminFilterTab, setAdminFilterTab] = useState<'all' | 'has_orders' | 'has_sizes' | 'unlinked'>('all');
  const [adminSelectedClientSyncId, setAdminSelectedClientSyncId] = useState<string | null>(() => {
    return searchParams.get('clientId') || searchParams.get('clientSyncId') || null;
  });
  const [viewingOwnProfile, setViewingOwnProfile] = useState<boolean>(() => {
    return searchParams.get('view') === 'me';
  });
  const [adminEditMode, setAdminEditMode] = useState(false);
  const [isEditingClientModal, setIsEditingClientModal] = useState(false);
  const [isCreatingClientModal, setIsCreatingClientModal] = useState(false);
  const [adminClientOrdersMap, setAdminClientOrdersMap] = useState<Record<string, any[]>>({});
  const [adminClientSizeMap, setAdminClientSizeMap] = useState<Record<string, number>>({});
  const [adminSavingClient, setAdminSavingClient] = useState(false);
  const [clientEditFormState, setClientEditFormState] = useState<any>({});
  const [newClientFormState, setNewClientFormState] = useState<any>({
    name: '',
    instagram: '',
    email: '',
    phone: '',
    address: '',
    defaultShape: 'Almond',
    defaultLength: 'M',
    designNotes: '',
    additionalComments: '',
  });

  // Listen to global default loyalty milestone rewards
  useEffect(() => {
    const refDoc = doc(db, 'users', vendorUid, 'store_settings', 'loyalty_config');
    const unsub = onSnapshot(
      refDoc,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.defaultReward === 'string' && data.defaultReward.trim()) {
            setDefaultMilestoneReward(data.defaultReward.trim());
          }
          if (typeof data.secondaryReward === 'string' && data.secondaryReward.trim()) {
            setSecondaryMilestoneReward(data.secondaryReward.trim());
          }
          if (Array.isArray(data.quickPresets) && data.quickPresets.length > 0) {
            setQuickFillPresets(data.quickPresets);
          }
        }
      },
      () => {
        // Fallback to Free Delivery & Free Gift
      }
    );
    return () => unsub();
  }, [vendorUid]);

  // Auth & Admin Directory fetch
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setClientProfile(null);
        setOrders([]);
        setSizes({});
        setClientImages([]);
        setLoading(false);
        return;
      }

      if (isAdminUid(u.uid)) {
        try {
          // 1. Load all client docs for directory
          const clientsSnap = await getDocs(collection(db, 'users', vendorUid, 'clients'));
          const loadedClients = clientsSnap.docs
            .map((d) => ({ docId: d.id, ...d.data() } as any))
            .filter((c) => !c.isDeleted)
            .sort((a, b) => (a.name || a.instagram || '').localeCompare(b.name || b.instagram || ''));
          setAdminClients(loadedClients);

          // 2. Load all orders to compute client stats
          const allOrdersSnap = await getDocs(collection(db, 'users', vendorUid, 'orders'));
          const orderMap: Record<string, any[]> = {};
          allOrdersSnap.forEach((docSnap) => {
            const o = { docId: docSnap.id, ...docSnap.data() } as any;
            const cid = o.clientSyncId;
            if (cid) {
              if (!orderMap[cid]) orderMap[cid] = [];
              orderMap[cid].push(o);
            }
          });
          setAdminClientOrdersMap(orderMap);

          // 3. Load all nail sizes count
          const allSizesSnap = await getDocs(collection(db, 'users', vendorUid, 'nail_sizes'));
          const sizeCountMap: Record<string, number> = {};
          allSizesSnap.forEach((docSnap) => {
            const data = docSnap.data();
            const cid = data.clientSyncId;
            if (cid && typeof data.sizeMm === 'number') {
              sizeCountMap[cid] = (sizeCountMap[cid] || 0) + 1;
            }
          });
          setAdminClientSizeMap(sizeCountMap);
        } catch (e) {
          console.error('Failed to load admin directory data:', e);
        }

        const paramId = searchParams.get('clientId') || searchParams.get('clientSyncId');
        if (paramId) {
          setAdminSelectedClientSyncId(paramId);
        } else if (searchParams.get('view') === 'me') {
          setViewingOwnProfile(true);
        } else {
          setLoading(false);
        }
      } else {
        // Customer profile lookup by email
        try {
          const q = query(
            collection(db, 'users', vendorUid, 'clients'),
            where('email', '==', u.email)
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const docSnap = snapshot.docs[0];
            const rawData = docSnap.data();
            let needsHeal = false;
            const healData: any = { ...rawData };
            if (typeof healData.id === 'string') {
              healData.id = 0;
              needsHeal = true;
            }
            if (typeof healData.birthday === 'string' || healData.birthday === 0) {
              healData.birthday = null;
              needsHeal = true;
            }
            if (needsHeal) {
              await setDoc(docSnap.ref, healData);
            }
            const syncId = healData.syncId || docSnap.id;
            setAdminSelectedClientSyncId(syncId);
          } else {
            setNeedsSetup(true);
            setLoading(false);
          }
        } catch (e) {
          console.error('Error fetching client profile:', e);
          setLoading(false);
        }
      }
    });

    return () => unsubAuth();
  }, [vendorUid, searchParams]);

  // Active target sync ID
  const activeTargetSyncId = useMemo(() => {
    if (!user) return null;
    if (isAdminUid(user.uid)) {
      if (viewingOwnProfile) {
        const myDoc = adminClients.find(
          (c) => c.email && c.email.toLowerCase() === user.email?.toLowerCase()
        );
        return myDoc?.syncId || null;
      }
      return adminSelectedClientSyncId;
    }
    return adminSelectedClientSyncId;
  }, [user, viewingOwnProfile, adminSelectedClientSyncId, adminClients]);

  // Subscriptions for the currently active client profile
  useEffect(() => {
    if (!activeTargetSyncId) {
      if (isAdminUid(user?.uid) && !viewingOwnProfile) {
        setClientProfile(null);
        setOrders([]);
        setSizes({});
        setClientImages([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    let unsubClientDoc: (() => void) | undefined;
    let unsubOrders: (() => void) | undefined;
    let unsubImages: (() => void) | undefined;

    // 1. Client doc listener
    const clientDocRef = doc(db, 'users', vendorUid, 'clients', activeTargetSyncId);
    unsubClientDoc = onSnapshot(
      clientDocRef,
      (snap) => {
        if (snap.exists()) {
          const raw = snap.data();
          const normalized = {
            ...raw,
            id: 0,
            syncId: raw.syncId || snap.id,
          };
          setClientProfile(normalized);
          setEditForm(normalized);
          setNeedsSetup(false);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to client doc:', err);
        setLoading(false);
      }
    );

    // 2. Client Nail Sizes
    const sizeQ = query(
      collection(db, 'users', vendorUid, 'nail_sizes'),
      where('clientSyncId', '==', activeTargetSyncId)
    );
    getDocs(sizeQ)
      .then((sizeSnap) => {
        const loadedSizes: any = {};
        sizeSnap.forEach((sDoc) => {
          const data = sDoc.data();
          if (
            data.fingerName !== undefined ||
            typeof data.size === 'string' ||
            typeof data.fingerIndex !== 'number'
          ) {
            deleteDoc(doc(db, 'users', vendorUid, 'nail_sizes', data.syncId || sDoc.id)).catch(
              () => {}
            );
            return;
          }

          const key = Object.keys(FINGER_MAP).find((k) => FINGER_MAP[k] === data.fingerIndex);
          if (key) {
            loadedSizes[key] = { syncId: data.syncId, sizeMm: data.sizeMm };
          }
        });
        setSizes(loadedSizes);
      })
      .catch(console.error);

    // 3. Client Orders listener
    const ordersQ = query(
      collection(db, 'users', vendorUid, 'orders'),
      where('clientSyncId', '==', activeTargetSyncId)
    );
    unsubOrders = onSnapshot(ordersQ, (ordersSnap) => {
      const loadedOrders: any[] = [];
      ordersSnap.forEach((oDoc) => {
        loadedOrders.push({ docId: oDoc.id, ...oDoc.data() });
      });
      loadedOrders.sort(
        (a, b) => (b.orderDate || b.updatedAt || 0) - (a.orderDate || a.updatedAt || 0)
      );
      setOrders(loadedOrders);
    });

    // 4. Client Images listener
    const imgQ = query(
      collection(db, 'users', vendorUid, 'client_images'),
      where('clientSyncId', '==', activeTargetSyncId)
    );
    unsubImages = onSnapshot(imgQ, (snap) => {
      const loaded = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
      setClientImages(loaded);
    });

    return () => {
      if (unsubClientDoc) unsubClientDoc();
      if (unsubOrders) unsubOrders();
      if (unsubImages) unsubImages();
    };
  }, [activeTargetSyncId, vendorUid, user, viewingOwnProfile]);

  // Clean Instagram handle helper
  const cleanInstagram = (handle?: string): string => {
    if (!handle) return '';
    let cleaned = handle.trim().toLowerCase();
    cleaned = cleaned.replace(/^@/, '');
    cleaned = cleaned.replace(/^https?:\/\/(www\.)?instagram\.com\//, '');
    return cleaned.split('/')[0].split('?')[0].trim();
  };

  // Admin order status update
  const handleUpdateOrderStatus = async (group: any, newStatus: string) => {
    try {
      for (const item of group.items) {
        const orderDocRef = doc(db, 'users', vendorUid, 'orders', item.docId || item.syncId);
        await setDoc(orderDocRef, { status: newStatus, updatedAt: Date.now() }, { merge: true });
      }
    } catch (e) {
      console.error('Failed to update order status:', e);
      alert('Failed to update order status.');
    }
  };

  // Admin loyalty stamp toggle
  const handleToggleOrderLoyalty = async (group: any) => {
    try {
      const nextVal = !group.earnsStamps;
      for (const item of group.items) {
        const orderDocRef = doc(db, 'users', vendorUid, 'orders', item.docId || item.syncId);
        await setDoc(orderDocRef, { isLoyaltyEligible: nextVal, updatedAt: Date.now() }, { merge: true });
      }
    } catch (e) {
      console.error('Failed to toggle order loyalty eligibility:', e);
    }
  };

  // Admin finished photo upload
  const handleUploadCompletedPhoto = async (
    e: React.ChangeEvent<HTMLInputElement>,
    orderDate?: number
  ) => {
    if (!e.target.files || e.target.files.length === 0 || !clientProfile?.syncId) return;
    const file = e.target.files[0];
    try {
      const storageRef = ref(
        storage,
        `users/${vendorUid}/client_images/completed_${Date.now()}_${file.name}`
      );
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      const syncId = crypto.randomUUID();
      await setDoc(doc(db, 'users', vendorUid, 'client_images', syncId), {
        syncId,
        clientId: 0,
        clientSyncId: clientProfile.syncId,
        linkedClientSyncIds: [],
        uri: downloadUrl,
        imageType: 'completed',
        notes: `Completed set for ${clientProfile.name || clientProfile.instagram || 'client'}`,
        tags: [],
        isPublic: true,
        messages: [],
        orderDate: orderDate || Date.now(),
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.error('Failed to upload completed photo:', err);
      alert('Could not upload photo. Please try again.');
    }
  };

  // Open Edit Client Modal
  const openEditClientModal = (targetClient?: any) => {
    const c = targetClient || clientProfile;
    if (!c) return;
    setClientEditFormState({
      syncId: c.syncId,
      name: c.name || '',
      instagram: c.instagram || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      defaultShape: c.defaultShape || 'Almond',
      defaultLength: c.defaultLength || 'M',
      designNotes: c.designNotes || '',
      additionalComments: c.additionalComments || '',
    });
    setIsEditingClientModal(true);
  };

  // Save Client Details & Account Linking
  const handleSaveClientDetails = async () => {
    const targetSyncId = clientEditFormState.syncId || clientProfile?.syncId;
    if (!targetSyncId) return;
    setAdminSavingClient(true);
    try {
      const cleanedInsta = cleanInstagram(clientEditFormState.instagram);
      const cleanedEmail = (clientEditFormState.email || '').trim().toLowerCase();

      // Check for email collision
      if (cleanedEmail) {
        const conflict = adminClients.find(
          (c) =>
            c.syncId !== targetSyncId &&
            c.email &&
            c.email.toLowerCase() === cleanedEmail
        );
        if (conflict) {
          if (
            !confirm(
              `Warning: The Google email "${cleanedEmail}" is already linked to client "${conflict.name || conflict.instagram}". Do you still want to reassign it to ${clientEditFormState.name || cleanedInsta}?`
            )
          ) {
            setAdminSavingClient(false);
            return;
          }
        }
      }

      const existing = adminClients.find((c) => c.syncId === targetSyncId) || clientProfile || {};
      const updatedData: any = {
        ...existing,
        name: clientEditFormState.name.trim(),
        instagram: cleanedInsta,
        email: cleanedEmail,
        phone: (clientEditFormState.phone || '').trim(),
        address: (clientEditFormState.address || '').trim(),
        defaultShape: clientEditFormState.defaultShape || 'Almond',
        defaultLength: clientEditFormState.defaultLength || 'M',
        designNotes: (clientEditFormState.designNotes || '').trim(),
        additionalComments: (clientEditFormState.additionalComments || '').trim(),
        id: 0,
        birthday: typeof existing.birthday === 'number' ? existing.birthday : null,
        updatedAt: Date.now(),
      };

      await setDoc(doc(db, 'users', vendorUid, 'clients', targetSyncId), updatedData, {
        merge: true,
      });

      if (clientProfile && clientProfile.syncId === targetSyncId) {
        setClientProfile(updatedData);
        setEditForm(updatedData);
      }
      setAdminClients((prev) =>
        prev.map((c) => (c.syncId === targetSyncId ? { ...c, ...updatedData } : c))
      );
      setIsEditingClientModal(false);
    } catch (e) {
      console.error('Failed to save client details:', e);
      alert('Failed to save client details.');
    } finally {
      setAdminSavingClient(false);
    }
  };

  // Create New Client Profile
  const handleCreateNewClient = async () => {
    if (!newClientFormState.instagram.trim() && !newClientFormState.name.trim()) {
      alert('Please enter at least a name or Instagram handle for the client.');
      return;
    }
    setAdminSavingClient(true);
    try {
      const syncId = crypto.randomUUID();
      const cleanedInsta = cleanInstagram(newClientFormState.instagram);
      const cleanedEmail = (newClientFormState.email || '').trim().toLowerCase();

      const newDoc: any = {
        syncId,
        id: 0,
        name: newClientFormState.name.trim(),
        instagram: cleanedInsta,
        email: cleanedEmail,
        phone: (newClientFormState.phone || '').trim(),
        address: (newClientFormState.address || '').trim(),
        defaultShape: newClientFormState.defaultShape || 'Almond',
        defaultLength: newClientFormState.defaultLength || 'M',
        designNotes: (newClientFormState.designNotes || '').trim(),
        additionalComments: (newClientFormState.additionalComments || '').trim(),
        birthday: null,
        adminUid: vendorUid,
        loyaltyMilestones: {},
        updatedAt: Date.now(),
      };

      await setDoc(doc(db, 'users', vendorUid, 'clients', syncId), newDoc);
      setAdminClients((prev) =>
        [...prev, newDoc].sort((a, b) =>
          (a.name || a.instagram || '').localeCompare(b.name || b.instagram || '')
        )
      );
      setAdminSelectedClientSyncId(syncId);
      window.history.replaceState(null, '', `/profile?clientId=${syncId}`);
      setIsCreatingClientModal(false);
      setNewClientFormState({
        name: '',
        instagram: '',
        email: '',
        phone: '',
        address: '',
        defaultShape: 'Almond',
        defaultLength: 'M',
        designNotes: '',
        additionalComments: '',
      });
    } catch (e) {
      console.error('Failed to create new client:', e);
      alert('Failed to create client.');
    } finally {
      setAdminSavingClient(false);
    }
  };

  // Filtered clients for Directory View
  const filteredAdminClients = useMemo(() => {
    let list = [...adminClients];
    const q = adminSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const name = (c.name || '').toLowerCase();
        const insta = (c.instagram || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        return name.includes(q) || insta.includes(q) || email.includes(q) || phone.includes(q);
      });
    }

    if (adminFilterTab === 'has_orders') {
      list = list.filter((c) => (adminClientOrdersMap[c.syncId]?.length || 0) > 0);
    } else if (adminFilterTab === 'has_sizes') {
      list = list.filter((c) => (adminClientSizeMap[c.syncId] || 0) > 0);
    } else if (adminFilterTab === 'unlinked') {
      list = list.filter((c) => !c.email || !c.email.trim());
    }

    return list;
  }, [adminClients, adminSearchQuery, adminFilterTab, adminClientOrdersMap, adminClientSizeMap]);

  // Group orders into Transactions by `orderDate` (matching PressOnPro's `orders.groupBy { it.orderDate }`)
  const transactionGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    orders.forEach((o) => {
      const key = String(o.orderDate || o.syncId || o.docId);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(o);
    });

    return Array.from(map.values())
      .map((items) => {
        const main = items[0];
        const orderDate = main.orderDate || main.updatedAt || Date.now();
        const orderNumber =
          items.find((i) => typeof i.orderNumber === 'string' && i.orderNumber.trim())
            ?.orderNumber ||
          (typeof main.orderId === 'string' && main.orderId.startsWith('UHN-')
            ? main.orderId
            : '');
        const totalPrice = items.reduce((sum, i) => sum + Number(i.price || 0), 0);
        const totalSets = items.reduce(
          (sum, i) => sum + (Number(i.setCount) > 0 ? Number(i.setCount) : 1),
          0
        );
        const status = main.status || 'Pending';
        const earnsStamps = items.some((i) => isOrderLoyaltyEligible(i));

        return {
          key: String(orderDate),
          orderDate,
          orderNumber,
          status,
          totalPrice,
          totalSets,
          earnsStamps,
          items,
        };
      })
      .sort((a, b) => b.orderDate - a.orderDate);
  }, [orders]);

  // Loyalty Stamp calculation (1 stamp per confirmed order transaction, matching PressOnPro)
  const loyaltyStats = useMemo(() => {
    const eligibleConfirmedGroups = transactionGroups.filter((g) => {
      const s = (g.status || '').trim();
      return (
        s !== 'Pending' &&
        s !== 'Cancelled' &&
        s !== 'Returned/Lost' &&
        g.earnsStamps
      );
    });

    const totalStamps = eligibleConfirmedGroups.length;
    const currentStamps = totalStamps % 5;
    const nextMilestoneNumber = (Math.floor(totalStamps / 5) + 1) * 5; // 5, 10, 15, 20...

    const clientMilestones: Record<string, string> =
      clientProfile?.loyaltyMilestones && typeof clientProfile.loyaltyMilestones === 'object'
        ? clientProfile.loyaltyMilestones
        : {};

    const getDefaultRewardForMilestone = (mNum: number) => {
      // (5/5 = 1 => odd = Free Delivery), (10/5 = 2 => even = Free Gift), (15/5 = 3 => odd = Free Delivery)
      const milestoneIndex = Math.round(mNum / 5);
      return milestoneIndex % 2 === 0
        ? secondaryMilestoneReward || 'Free Gift'
        : defaultMilestoneReward || 'Free Delivery';
    };

    const currentMilestoneReward =
      clientMilestones[String(nextMilestoneNumber)]?.trim() ||
      getDefaultRewardForMilestone(nextMilestoneNumber);

    // Gather upcoming milestones (e.g. 5th, 10th, 15th, 20th) to display if customized or next up
    const upcomingSchedule = [
      nextMilestoneNumber,
      nextMilestoneNumber + 5,
      nextMilestoneNumber + 10,
    ].map((mNum) => ({
      milestone: mNum,
      label: `${getOrdinalSuffix(mNum)} Order`,
      reward:
        clientMilestones[String(mNum)]?.trim() ||
        getDefaultRewardForMilestone(mNum),
      isCustom: Boolean(clientMilestones[String(mNum)]?.trim()),
    }));

    return {
      totalStamps,
      currentStamps,
      nextMilestoneNumber,
      currentMilestoneReward,
      upcomingSchedule,
    };
  }, [
    transactionGroups,
    clientProfile?.loyaltyMilestones,
    defaultMilestoneReward,
    secondaryMilestoneReward,
  ]);

  const handleUploadInspo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !clientProfile?.syncId) return;
    const file = e.target.files[0];
    setUploadingInspo(true);
    try {
      const storageRef = ref(
        storage,
        `users/${vendorUid}/client_images/inspo_${Date.now()}_${file.name}`
      );
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      const syncId = crypto.randomUUID();
      await setDoc(doc(db, 'users', vendorUid, 'client_images', syncId), {
        syncId,
        clientId: 0,
        clientSyncId: clientProfile.syncId,
        linkedClientSyncIds: [],
        uri: downloadUrl,
        imageType: 'inspo',
        notes: file.name.replace(/\.[^/.]+$/, ''),
        tags: [],
        isPublic: false,
        messages: [],
        orderDate: null,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.error('Failed to upload inspiration photo', err);
      alert('Could not upload photo. Please try again.');
    } finally {
      setUploadingInspo(false);
    }
  };

  const handleDeleteClientImage = async (docId: string) => {
    try {
      await deleteDoc(doc(db, 'users', vendorUid, 'client_images', docId));
    } catch (err) {
      console.error('Failed to delete client image', err);
    }
  };

  const openPhotoLightbox = (imgs: string[], idx: number) => {
    setLightboxImages(imgs);
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  const handleSetupProfile = async (isSkip = false) => {
    if (!user) return;
    setSetupError('');
    setIsSettingUp(true);

    try {
      if (isSkip) {
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
          loyaltyMilestones: {},
          updatedAt: Date.now(),
        };
        await setDoc(doc(db, 'users', vendorUid, 'clients', syncId), newClient);
        setClientProfile(newClient);
        setEditForm(newClient);
        setNeedsSetup(false);
        setIsSettingUp(false);
        return;
      }

      if (!setupInsta.trim()) {
        setSetupError('Please enter your Instagram handle');
        setIsSettingUp(false);
        return;
      }

      let cleaned = setupInsta.trim().toLowerCase();
      cleaned = cleaned.replace(/^@/, '');
      cleaned = cleaned.replace(/^https?:\/\/(www\.)?instagram\.com\//, '');
      cleaned = cleaned.split('/')[0].split('?')[0];

      const q = query(
        collection(db, 'users', vendorUid, 'clients'),
        where('instagram', '==', cleaned)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const existingDoc = snapshot.docs[0];
        const existingData = existingDoc.data();

        if (existingData.email && existingData.email !== user.email) {
          setSetupError(
            'This Instagram account is already securely linked to another profile. If this is an error, please contact support.'
          );

          await setDoc(doc(collection(db, 'users', vendorUid, 'admin_notifications')), {
            type: 'LINK_ATTEMPT_DENIED',
            message: `User ${user.email} attempted to claim @${cleaned}, but it is already securely linked to ${existingData.email}.`,
            timestamp: Date.now(),
            read: false,
          });
          setIsSettingUp(false);
          return;
        }

        const updateData = {
          ...existingData,
          email: user.email,
          syncId: existingData.syncId || existingDoc.id,
          name: user.displayName || existingData.name || '',
          id: 0,
          birthday: typeof existingData.birthday === 'number' ? existingData.birthday : null,
          updatedAt: Date.now(),
        };
        await setDoc(existingDoc.ref, updateData);
        window.location.reload();
      } else {
        const syncId = crypto.randomUUID();
        const newClient = {
          syncId,
          id: 0,
          name: user.displayName || '',
          email: user.email || '',
          instagram: cleaned,
          phone: '',
          address: '',
          birthday: null,
          defaultShape: 'Almond',
          defaultLength: 'M',
          additionalComments: '',
          designNotes: '',
          adminUid: vendorUid,
          loyaltyMilestones: {},
          updatedAt: Date.now(),
        };
        await setDoc(doc(db, 'users', vendorUid, 'clients', syncId), newClient);
        setClientProfile(newClient);
        setEditForm(newClient);
        setNeedsSetup(false);
      }
    } catch (e: any) {
      console.error('Setup error:', e);
      setSetupError('Failed to link profile. Please try again.');
    }
    setIsSettingUp(false);
  };

  const handleSizeChange = (hand: string, fingerName: string, value: string) => {
    setSizes((prev: any) => {
      const current = prev[`${hand}-${fingerName}`] || {};
      return { ...prev, [`${hand}-${fingerName}`]: { ...current, sizeMm: value } };
    });
  };

  const handleSizeSave = async (hand: string, fingerName: string) => {
    if (!clientProfile?.syncId) return;
    const currentData = sizes[`${hand}-${fingerName}`] || {};
    const val = currentData.sizeMm;

    if (val === '' || val === undefined || val === null) return;
    const finalSizeMm = parseFloat(val);
    if (isNaN(finalSizeMm)) return;

    const sizeSyncId = currentData.syncId || crypto.randomUUID();

    setSizes((prev: any) => ({
      ...prev,
      [`${hand}-${fingerName}`]: { syncId: sizeSyncId, sizeMm: finalSizeMm },
    }));

    const sizeDoc = {
      syncId: sizeSyncId,
      clientId: 0,
      clientSyncId: clientProfile.syncId,
      fingerIndex: FINGER_MAP[`${hand}-${fingerName}`],
      sizeMm: finalSizeMm,
      updatedAt: Date.now(),
    };
    try {
      await setDoc(doc(db, 'users', vendorUid, 'nail_sizes', sizeSyncId), sizeDoc);
    } catch (e) {
      console.error('Failed to save size', e);
    }
  };

  const saveDetails = async () => {
    if (!clientProfile?.syncId) return;
    try {
      const updatedProfile = {
        ...clientProfile,
        ...editForm,
        id: 0,
        birthday: typeof editForm.birthday === 'number' ? editForm.birthday : null,
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, 'users', vendorUid, 'clients', clientProfile.syncId), updatedProfile);
      setClientProfile(updatedProfile);
      setIsEditingDetails(false);
    } catch (e) {
      console.error('Failed to save details', e);
    }
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
      });
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  if (loading) {
    return (
      <div className="flex-grow bg-[#FFF5F8] flex items-center justify-center pt-20 pb-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-grow bg-[#FFF5F8] flex flex-col items-center justify-start p-4 pt-12 sm:pt-16 text-black pb-20">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md text-center border border-pink-100">
          <Image
            src="/logo_cropped.png"
            alt="UnHolly Nails Logo"
            width={200}
            height={200}
            className="mx-auto mb-6 drop-shadow-sm"
          />
          <p className="text-neutral-500 mb-8 font-medium">
            Sign in to view your custom sizes, track your orders live, and collect digital loyalty stamps.
          </p>
          <button
            onClick={handleLogin}
            className="w-full bg-pink-500 text-white py-4 rounded-xl font-bold hover:bg-pink-600 transition flex items-center justify-center gap-3 shadow-md cursor-pointer"
          >
            Sign in with Google
          </button>
          <Link href="/" className="block mt-6 text-sm text-neutral-400 hover:text-black">
            ← Back to Store
          </Link>
        </div>
      </div>
    );
  }

  if (needsSetup && (!isAdmin || viewingOwnProfile)) {
    return (
      <div className="flex-grow bg-[#FFF5F8] flex flex-col items-center justify-start p-4 pt-12 sm:pt-16 text-black pb-20">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className={`${dancingScript.className} text-4xl text-pink-500 font-bold mb-2`}>
              {isAdmin ? 'Admin Profile Setup' : 'Welcome to the Club!'}
            </h1>
            <p className="text-neutral-500 text-sm">
              {isAdmin
                ? 'You are signed in as an administrator. You can enter your Instagram handle to create a personal profile for yourself, or return to the Client Directory.'
                : 'Already a member? Enter your Instagram handle below to instantly link your past orders, custom sizes, and delivery details! If you are new, this will create your profile.'}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">
                Instagram Handle
              </label>
              <div className="flex relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">
                  @
                </span>
                <input
                  type="text"
                  value={setupInsta}
                  onChange={(e) => setSetupInsta(e.target.value)}
                  placeholder="your_handle"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-pink-500 focus:bg-white transition"
                  onKeyDown={(e) => e.key === 'Enter' && handleSetupProfile()}
                />
              </div>
            </div>

            {setupError && (
              <p className="text-red-500 text-xs font-bold bg-red-50 p-3 rounded-lg border border-red-100">
                {setupError}
              </p>
            )}

            <button
              onClick={() => handleSetupProfile(false)}
              disabled={isSettingUp}
              className="w-full bg-pink-500 text-white py-4 rounded-xl font-bold hover:bg-pink-600 transition flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
            >
              {isSettingUp ? 'Linking Profile...' : 'Link Profile'}
            </button>
            <div className="flex justify-between items-center mt-2">
              <button
                onClick={() => handleSetupProfile(true)}
                className="text-neutral-500 text-xs font-bold hover:text-black py-2 cursor-pointer"
              >
                Skip for now
              </button>
              {isAdmin && viewingOwnProfile ? (
                <button
                  type="button"
                  onClick={() => {
                    setViewingOwnProfile(false);
                    setAdminSelectedClientSyncId(null);
                    window.history.replaceState(null, '', '/profile');
                  }}
                  className="text-pink-600 text-xs font-bold hover:underline py-2 cursor-pointer"
                >
                  ← Client Directory
                </button>
              ) : (
                <button
                  onClick={handleLogout}
                  className="text-red-400 text-xs font-bold hover:text-red-600 py-2 cursor-pointer"
                >
                  Sign Out
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const shapeSelectList = Array.from(new Set(['Mini', ...dynamicShapes]));
  const lengthSelectList = Array.from(new Set([...dynamicLengths]));

  return (
    <div className="min-h-[calc(100vh-120px)] bg-[#FFF5F8] text-black pb-20">
      {/* View 1: Admin Client Directory (when admin has no client selected and is not viewing own profile) */}
      {isAdmin && !adminSelectedClientSyncId && !viewingOwnProfile ? (
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black text-neutral-900">Client Directory</h1>
                <span className="bg-pink-100 text-pink-600 text-xs font-black px-2.5 py-1 rounded-full">
                  {adminClients.length} Clients
                </span>
              </div>
              <p className="text-sm text-neutral-500 mt-1 max-w-2xl">
                Select any client to view their custom finger sizes, adjust milestone loyalty rewards, update order statuses, or link Google sign-in accounts.
              </p>
            </div>

            <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
              <button
                type="button"
                onClick={() => setIsCreatingClientModal(true)}
                className="flex-1 sm:flex-none bg-black hover:bg-neutral-800 text-white font-bold px-4 py-2.5 rounded-full text-xs transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <span>+</span>
                <span>New Client</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewingOwnProfile(true);
                  setAdminSelectedClientSyncId(null);
                  window.history.replaceState(null, '', '/profile?view=me');
                }}
                className="flex-1 sm:flex-none bg-white hover:bg-pink-50 text-neutral-700 font-bold px-4 py-2.5 rounded-full text-xs transition border border-neutral-200 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>👤</span>
                <span>My Own Profile</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-pink-100/80 mb-6 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  value={adminSearchQuery}
                  onChange={(e) => setAdminSearchQuery(e.target.value)}
                  placeholder="Search by name, @instagram, email, or phone..."
                  className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs sm:text-sm font-medium focus:outline-none focus:border-pink-500 focus:bg-white transition"
                />
                {adminSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setAdminSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: 'all', label: 'All', count: adminClients.length },
                  {
                    id: 'has_orders',
                    label: 'With Orders',
                    count: adminClients.filter(
                      (c) => (adminClientOrdersMap[c.syncId]?.length || 0) > 0
                    ).length,
                  },
                  {
                    id: 'has_sizes',
                    label: 'Sizes on File',
                    count: adminClients.filter((c) => (adminClientSizeMap[c.syncId] || 0) > 0)
                      .length,
                  },
                  {
                    id: 'unlinked',
                    label: 'Unlinked Google',
                    count: adminClients.filter((c) => !c.email || !c.email.trim()).length,
                  },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setAdminFilterTab(filter.id as any)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      adminFilterTab === filter.id
                        ? 'bg-black text-white shadow-sm'
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                    }`}
                  >
                    {filter.label} <span className="opacity-70 ml-1">({filter.count})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Client Cards Grid */}
          {filteredAdminClients.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white rounded-3xl border border-pink-100 shadow-sm">
              <span className="text-4xl block mb-2">🔍</span>
              <h3 className="font-bold text-neutral-800 text-base mb-1">No clients found</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-4">
                No client records matched your search query or filter. Try clearing the search or adding a new client profile.
              </p>
              <button
                type="button"
                onClick={() => {
                  setAdminSearchQuery('');
                  setAdminFilterTab('all');
                }}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-full transition"
              >
                Clear Search & Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAdminClients.map((c) => {
                const clientOrders = adminClientOrdersMap[c.syncId] || [];
                const orderCount = clientOrders.length;
                const totalSpend = clientOrders.reduce(
                  (sum, o) => sum + Number(o.price || 0),
                  0
                );
                const sizeCount = adminClientSizeMap[c.syncId] || 0;
                const initials = c.name
                  ? c.name
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  : c.instagram
                  ? c.instagram.slice(0, 2).toUpperCase()
                  : 'CL';

                return (
                  <div
                    key={c.syncId || c.docId}
                    className="bg-white rounded-3xl p-5 shadow-sm hover:shadow-md border border-pink-100 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Card Header: Avatar, Name, Instagram */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-400 to-pink-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-base font-black text-neutral-900 truncate">
                              {c.name || (c.instagram ? `@${c.instagram}` : 'Client Profile')}
                            </h2>
                            {c.instagram && (
                              <span className="text-xs font-bold text-pink-600 block truncate">
                                @{c.instagram.replace(/^@/, '')}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditClientModal(c);
                          }}
                          className="text-neutral-400 hover:text-pink-600 p-1.5 rounded-full hover:bg-pink-50 transition cursor-pointer shrink-0"
                          title="Edit details & account linking"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-4 h-4"
                          >
                            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                          </svg>
                        </button>
                      </div>

                      {/* Google Account Linking Status */}
                      <div className="mb-3.5">
                        {c.email ? (
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-xl">
                            <span className="text-emerald-500 font-black">✓</span>
                            <span className="truncate">{c.email}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEditClientModal(c)}
                            className="w-full flex items-center justify-between text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-xl transition cursor-pointer text-left"
                            title="Click to connect client's Google email"
                          >
                            <span className="flex items-center gap-1 truncate">
                              <span>⚠️</span>
                              <span>No Google Account Linked</span>
                            </span>
                            <span className="text-amber-900 underline shrink-0 font-black">
                              Link
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Stats Pills */}
                      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                        <div className="bg-neutral-50 rounded-xl p-2 border border-neutral-100">
                          <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                            Orders
                          </span>
                          <span className="font-bold text-neutral-800">
                            {orderCount > 0 ? `${orderCount} (€${totalSpend.toFixed(0)})` : 'None yet'}
                          </span>
                        </div>
                        <div className="bg-neutral-50 rounded-xl p-2 border border-neutral-100">
                          <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                            Finger Sizes
                          </span>
                          <span
                            className={`font-bold ${
                              sizeCount >= 10
                                ? 'text-pink-600'
                                : sizeCount > 0
                                ? 'text-amber-600'
                                : 'text-neutral-400'
                            }`}
                          >
                            {sizeCount >= 10
                              ? '✅ 10 Sizes'
                              : sizeCount > 0
                              ? `${sizeCount}/10 Sizes`
                              : 'None on file'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setAdminSelectedClientSyncId(c.syncId);
                        window.history.replaceState(null, '', `/profile?clientId=${c.syncId}`);
                      }}
                      className="w-full bg-neutral-900 hover:bg-[#FF5C9D] text-white py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer group-hover:bg-[#FF5C9D]"
                    >
                      <span>View & Manage Profile</span>
                      <span>→</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* View 2: Client Profile (with sticky admin header if admin) */
        <>
          {/* Admin Sticky Control Bar */}
          {isAdmin && (
            <div className="bg-neutral-950 text-white sticky top-0 z-40 px-4 py-2.5 shadow-md border-b border-neutral-800">
              <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
                {/* Left: Back button + Client switcher dropdown */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminSelectedClientSyncId(null);
                      setViewingOwnProfile(false);
                      window.history.replaceState(null, '', '/profile');
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full transition cursor-pointer"
                  >
                    <span>←</span>
                    <span>Client Directory</span>
                  </button>

                  {!viewingOwnProfile && clientProfile && (
                    <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1">
                      <span className="text-[11px] text-neutral-400 font-medium hidden sm:inline">
                        Client:
                      </span>
                      <select
                        value={clientProfile.syncId}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            setAdminSelectedClientSyncId(val);
                            window.history.replaceState(null, '', `/profile?clientId=${val}`);
                          }
                        }}
                        className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer max-w-[160px] sm:max-w-[220px] truncate"
                      >
                        {adminClients.map((c) => (
                          <option key={c.syncId} value={c.syncId} className="bg-neutral-900 text-white">
                            {c.name || `@${c.instagram}` || 'Client'}{' '}
                            {c.instagram ? `(@${c.instagram})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {!viewingOwnProfile && clientProfile && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditClientModal(clientProfile)}
                        className="bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1"
                      >
                        <span>✏️</span>
                        <span className="hidden sm:inline">Edit Details & Linking</span>
                        <span className="sm:hidden">Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAdminEditMode((prev) => !prev)}
                        className={`text-xs font-black px-3.5 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
                          adminEditMode
                            ? 'bg-pink-500 text-white shadow-lg ring-2 ring-pink-400 animate-pulse'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-pink-300 border border-pink-500/30'
                        }`}
                      >
                        <span>{adminEditMode ? '✓ Edit Mode Active' : 'Enable Edit Mode'}</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (viewingOwnProfile) {
                        setViewingOwnProfile(false);
                        setAdminSelectedClientSyncId(null);
                        window.history.replaceState(null, '', '/profile');
                      } else {
                        setViewingOwnProfile(true);
                        setAdminSelectedClientSyncId(null);
                        window.history.replaceState(null, '', '/profile?view=me');
                      }
                    }}
                    className="text-xs text-neutral-400 hover:text-white px-2 py-1 transition cursor-pointer"
                    title={viewingOwnProfile ? 'Return to Directory' : 'View your own profile'}
                  >
                    {viewingOwnProfile ? '← Client Directory' : '👤 My Profile'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Unlinked Google Account Banner for Admin */}
          {isAdmin && !viewingOwnProfile && clientProfile && !clientProfile.email && (
            <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-center text-amber-900 text-xs font-bold flex items-center justify-center gap-2 flex-wrap">
              <span>⚠️ This client does not have a linked Google Account yet. They cannot sign into the website.</span>
              <button
                type="button"
                onClick={() => openEditClientModal(clientProfile)}
                className="underline font-black hover:text-amber-950 cursor-pointer"
              >
                Link Google Email Now →
              </button>
            </div>
          )}

          <div className="pt-12 pb-2 px-4 text-center">
            <h1 className="text-2xl font-black text-black">{clientProfile?.name || 'My Profile'}</h1>
            {clientProfile?.instagram && (
              <p className="text-xs text-neutral-500 font-bold mt-0.5">
                @{clientProfile.instagram.replace(/^@/, '')}
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="bg-white shadow-sm border-b border-pink-100 flex justify-center gap-8 px-4 py-3 sticky top-[60px] z-30">
        <button
          onClick={() => setActiveTab('sizing')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'sizing' ? 'text-pink-500' : 'text-neutral-400 hover:text-neutral-600'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"
            />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">Sizing</span>
          {activeTab === 'sizing' && <div className="w-full h-0.5 bg-pink-500 rounded-full mt-1" />}
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'orders' ? 'text-pink-500' : 'text-neutral-400 hover:text-neutral-600'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">Orders & Loyalty</span>
          {activeTab === 'orders' && <div className="w-full h-0.5 bg-pink-500 rounded-full mt-1" />}
        </button>
        <button
          onClick={() => setActiveTab('details')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'details' ? 'text-pink-500' : 'text-neutral-400 hover:text-neutral-600'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"
            />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">Details</span>
          {activeTab === 'details' && <div className="w-full h-0.5 bg-pink-500 rounded-full mt-1" />}
        </button>
      </div>

      <main className="max-w-4xl mx-auto p-4 mt-6">
        {activeTab === 'sizing' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-pink-100 flex flex-col items-center">
            {/* Visual Hands */}
            <InteractiveHandSizer
              sizes={sizes}
              onChange={handleSizeChange}
              onBlurFinger={handleSizeSave}
            />

            {/* Default Shape & Length Pill */}
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className="bg-pink-100 text-pink-900 font-bold px-8 py-3 rounded-full flex items-center gap-2 hover:bg-pink-200 transition shadow-sm border border-pink-200 cursor-pointer mb-8"
            >
              ✨ {clientProfile?.defaultLength || 'M'} {clientProfile?.defaultShape || 'Round'}
            </button>

            {/* Client Visual Galleries: Inspiration, Wishlist, Completed Work */}
            <div className="w-full border-t border-pink-100 pt-8 mt-2">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-black text-neutral-900">My Nail Vault</h3>
                  <p className="text-xs text-neutral-500">
                    Your design inspirations, saved wishlist sets, and completed manicures.
                  </p>
                </div>

                {gallerySubTab === 'inspo' && (
                  <label className="cursor-pointer bg-black text-white hover:bg-neutral-800 px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
                    {uploadingInspo ? (
                      <span className="animate-pulse">Uploading...</span>
                    ) : (
                      <>
                        <span>+ Add Inspiration</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleUploadInspo}
                          disabled={uploadingInspo}
                        />
                      </>
                    )}
                  </label>
                )}
              </div>

              {/* Sub-tab pills */}
              <div className="flex gap-2 p-1 bg-pink-50/70 rounded-2xl mb-6 max-w-md">
                <button
                  type="button"
                  onClick={() => setGallerySubTab('inspo')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    gallerySubTab === 'inspo'
                      ? 'bg-white text-pink-600 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  Inspiration (
                  {
                    clientImages.filter(
                      (img) =>
                        img.imageType === 'inspo' ||
                        (!img.imageType && !img.uri?.includes('completed'))
                    ).length
                  }
                  )
                </button>
                <button
                  type="button"
                  onClick={() => setGallerySubTab('wishlist')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    gallerySubTab === 'wishlist'
                      ? 'bg-white text-pink-600 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  ❤️ Wishlist ({clientImages.filter((img) => img.imageType === 'wishlist').length})
                </button>
                <button
                  type="button"
                  onClick={() => setGallerySubTab('completed')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    gallerySubTab === 'completed'
                      ? 'bg-white text-pink-600 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  Completed (
                  {
                    clientImages.filter(
                      (img) =>
                        img.imageType === 'completed' || (img.uri && img.uri.includes('completed'))
                    ).length
                  }
                  )
                </button>
              </div>

              {/* Inspiration Ideas Tab */}
              {gallerySubTab === 'inspo' && (
                <div>
                  {clientImages.filter(
                    (img) =>
                      img.imageType === 'inspo' ||
                      (!img.imageType && !img.uri?.includes('completed'))
                  ).length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-3xl border-2 border-dashed border-pink-200 bg-[#FFF5F8]/40">
                      <span className="text-3xl mb-2 block">💡</span>
                      <p className="font-bold text-neutral-800 text-sm">
                        No inspiration photos yet
                      </p>
                      <p className="text-xs text-neutral-500 mt-1 mb-4">
                        Found nail art you love on Instagram or Pinterest? Upload it here so I can
                        reference it when hand-crafting your custom sets!
                      </p>
                      <label className="cursor-pointer inline-block bg-pink-500 text-white px-5 py-2.5 rounded-full text-xs font-bold hover:bg-pink-600 transition shadow">
                        Upload Your First Idea
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleUploadInspo}
                          disabled={uploadingInspo}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {clientImages
                        .filter(
                          (img) =>
                            img.imageType === 'inspo' ||
                            (!img.imageType && !img.uri?.includes('completed'))
                        )
                        .map((img, idx, arr) => (
                          <div
                            key={img.docId || img.syncId || idx}
                            className="relative aspect-square rounded-2xl overflow-hidden group shadow-sm bg-pink-50 border border-pink-100"
                          >
                            <Image
                              src={img.uri}
                              alt={img.notes || 'Inspiration'}
                              fill
                              className="object-cover cursor-zoom-in group-hover:scale-105 transition-transform duration-300"
                              onClick={() =>
                                openPhotoLightbox(
                                  arr.map((i) => i.uri),
                                  idx
                                )
                              }
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClientImage(img.docId || img.syncId);
                              }}
                              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-red-500 text-white flex items-center justify-center font-bold text-xs transition shadow z-10 cursor-pointer"
                              title="Delete idea"
                            >
                              &times;
                            </button>
                            {img.notes && (
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 pt-4 pointer-events-none">
                                <p className="text-[10px] text-white font-medium truncate">
                                  {img.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Wishlist Tab */}
              {gallerySubTab === 'wishlist' && (
                <div>
                  {clientImages.filter((img) => img.imageType === 'wishlist').length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-3xl border-2 border-dashed border-pink-200 bg-[#FFF5F8]/40">
                      <span className="text-3xl mb-2 block">❤️</span>
                      <p className="font-bold text-neutral-800 text-sm">Your wishlist is empty</p>
                      <p className="text-xs text-neutral-500 mt-1 mb-4">
                        Tap the heart icon on any design in the shop to save it here!
                      </p>
                      <Link
                        href="/collections/all"
                        className="inline-block bg-black text-white px-5 py-2.5 rounded-full text-xs font-bold hover:bg-neutral-800 transition shadow"
                      >
                        Explore All Designs
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {clientImages
                        .filter((img) => img.imageType === 'wishlist')
                        .map((img, idx, arr) => {
                          const productId =
                            (img.tags && img.tags.length > 0 && img.tags[0]) ||
                            (img.syncId?.startsWith('wish_')
                              ? img.syncId.split('_').slice(2).join('_')
                              : '') ||
                            img.syncId ||
                            '';

                          const qParams = new URLSearchParams();
                          if (productId) qParams.set('product', productId);
                          if (img.notes) qParams.set('name', img.notes);
                          if (img.uri) qParams.set('img', img.uri);

                          const storeUrl = `/collections/all?${qParams.toString()}${
                            productId ? `#product-${encodeURIComponent(productId)}` : ''
                          }`;

                          return (
                            <div
                              key={img.docId || img.syncId || idx}
                              className="rounded-2xl overflow-hidden shadow-sm bg-white border border-pink-100 flex flex-col group transition-all hover:shadow-md"
                            >
                              <div
                                className="relative aspect-square w-full bg-pink-50 overflow-hidden cursor-zoom-in group/cardimg"
                                onClick={() =>
                                  openPhotoLightbox(
                                    arr.map((i) => i.uri),
                                    idx
                                  )
                                }
                              >
                                <Image
                                  src={img.uri}
                                  alt={img.notes || 'Wishlist item'}
                                  fill
                                  className="object-cover group-hover/cardimg:scale-105 transition-transform duration-300"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClientImage(img.docId || img.syncId);
                                  }}
                                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-red-500 text-white flex items-center justify-center font-bold text-xs transition shadow z-10 cursor-pointer"
                                  title="Remove from wishlist"
                                >
                                  &times;
                                </button>
                                <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 opacity-80 pointer-events-none">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                    stroke="currentColor"
                                    className="w-3 h-3"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
                                    />
                                  </svg>
                                  <span>Zoom</span>
                                </div>
                              </div>
                              <div className="p-3 flex flex-col justify-between flex-grow bg-white border-t border-pink-50">
                                <p
                                  className="text-xs sm:text-sm font-bold text-neutral-900 truncate mb-2.5"
                                  title={img.notes || 'Custom Set'}
                                >
                                  {img.notes || 'Custom Set'}
                                </p>
                                <Link
                                  href={storeUrl}
                                  scroll={false}
                                  className="w-full text-center bg-black hover:bg-pink-600 text-white text-xs font-bold py-2 px-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                                >
                                  <span>View in Store</span>
                                  <span>&rarr;</span>
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* Completed Work Tab */}
              {gallerySubTab === 'completed' && (
                <div>
                  {clientImages.filter(
                    (img) =>
                      img.imageType === 'completed' || (img.uri && img.uri.includes('completed'))
                  ).length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-3xl border-2 border-dashed border-pink-200 bg-[#FFF5F8]/40">
                      <span className="text-3xl mb-2 block">✨</span>
                      <p className="font-bold text-neutral-800 text-sm">
                        No completed sets photographed yet
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Once I finish hand-crafting your custom nail sets, studio photos of your
                        finished nails will appear right here!
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {clientImages
                        .filter(
                          (img) =>
                            img.imageType === 'completed' ||
                            (img.uri && img.uri.includes('completed'))
                        )
                        .map((img, idx, arr) => (
                          <div
                            key={img.docId || img.syncId || idx}
                            className="relative aspect-square rounded-2xl overflow-hidden group shadow-sm bg-pink-50 border border-pink-100"
                          >
                            <Image
                              src={img.uri}
                              alt="Completed Manicure"
                              fill
                              className="object-cover cursor-zoom-in group-hover:scale-105 transition-transform duration-300"
                              onClick={() =>
                                openPhotoLightbox(
                                  arr.map((i) => i.uri),
                                  idx
                                )
                              }
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end pointer-events-none">
                              <span className="text-[10px] text-white font-bold bg-pink-500/80 backdrop-blur-sm self-start px-2 py-0.5 rounded-full">
                                Finished Set
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-pink-100 max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg text-neutral-500 font-medium">Contact Details</h2>
              {!isEditingDetails ? (
                <button
                  onClick={() => setIsEditingDetails(true)}
                  className="text-pink-400 hover:text-pink-600 transition p-2 cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5"
                  >
                    <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.158 3.712 3.712 1.158-1.157a2.625 2.625 0 000-3.713zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={saveDetails}
                  className="bg-pink-500 text-white px-4 py-1.5 rounded-full font-bold text-sm hover:bg-pink-600 transition shadow-sm cursor-pointer"
                >
                  Save
                </button>
              )}
            </div>

            <div className="space-y-5">
              <div className="flex justify-between items-center border-b border-neutral-50 pb-3">
                <span className="text-neutral-500 text-sm w-1/3">Instagram</span>
                {isEditingDetails ? (
                  <input
                    type="text"
                    value={editForm.instagram || ''}
                    onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })}
                    className="flex-1 text-right text-sm border-b border-pink-200 focus:outline-none focus:border-pink-500 pb-1"
                    placeholder="@username"
                  />
                ) : (
                  <span
                    className={
                      clientProfile?.instagram
                        ? 'text-pink-500 font-medium text-sm underline'
                        : 'text-neutral-400 font-medium text-sm'
                    }
                  >
                    {clientProfile?.instagram
                      ? `@${clientProfile.instagram.replace('@', '')}`
                      : 'Not set'}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center border-b border-neutral-50 pb-3">
                <span className="text-neutral-500 text-sm w-1/3">Email</span>
                {isEditingDetails ? (
                  <input
                    type="email"
                    value={editForm.email || ''}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="flex-1 text-right text-sm border-b border-pink-200 focus:outline-none focus:border-pink-500 pb-1"
                    placeholder="email@address.com"
                  />
                ) : (
                  <span className="text-neutral-700 font-medium text-sm text-right max-w-[60%] truncate">
                    {clientProfile?.email || 'Not set'}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center border-b border-neutral-50 pb-3">
                <span className="text-neutral-500 text-sm w-1/3">Phone Number</span>
                {isEditingDetails ? (
                  <input
                    type="tel"
                    value={editForm.phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="flex-1 text-right text-sm border-b border-pink-200 focus:outline-none focus:border-pink-500 pb-1"
                    placeholder="Phone Number"
                  />
                ) : (
                  <span className="text-neutral-700 font-medium text-sm text-right max-w-[60%] truncate">
                    {clientProfile?.phone || 'Not set'}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-start border-b border-neutral-50 pb-3">
                <span className="text-neutral-500 text-sm whitespace-nowrap mt-0.5 w-1/3">
                  Address
                </span>
                {isEditingDetails ? (
                  <textarea
                    value={editForm.address || ''}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="flex-1 text-right text-sm border border-pink-200 rounded p-2 focus:outline-none focus:border-pink-500 min-h-[80px]"
                    placeholder="Full Shipping Address"
                  />
                ) : (
                  <span className="text-neutral-700 font-medium text-sm text-right max-w-[60%] leading-relaxed">
                    {clientProfile?.address || 'Not set'}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center border-b border-neutral-50 pb-3">
                <span className="text-neutral-500 text-sm w-1/3">Birthday</span>
                {isEditingDetails ? (
                  <input
                    type="date"
                    value={
                      editForm.birthday
                        ? new Date(editForm.birthday).toISOString().split('T')[0]
                        : ''
                    }
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        birthday: e.target.value ? new Date(e.target.value).getTime() : null,
                      })
                    }
                    className="flex-1 text-right text-sm border-b border-pink-200 focus:outline-none focus:border-pink-500 pb-1"
                  />
                ) : (
                  <span className="text-neutral-700 font-medium text-sm">
                    {clientProfile?.birthday
                      ? new Date(clientProfile.birthday).toLocaleDateString()
                      : 'Not set'}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-start border-b border-neutral-50 pb-3">
                <span className="text-neutral-500 text-sm mt-1 w-1/3">Preferred Shape</span>
                {isEditingDetails ? (
                  <div className="flex-1 flex flex-col items-end gap-2">
                    <select
                      value={
                        shapeSelectList.includes(editForm.defaultShape)
                          ? editForm.defaultShape
                          : editForm.defaultShape
                          ? 'Custom'
                          : ''
                      }
                      onChange={(e) => {
                        if (e.target.value !== 'Custom') {
                          setEditForm({ ...editForm, defaultShape: e.target.value });
                        } else {
                          setEditForm({ ...editForm, defaultShape: 'Custom Shape' });
                        }
                      }}
                      className="text-right text-sm border-b border-pink-200 focus:outline-none focus:border-pink-500 pb-1 font-bold bg-transparent w-full"
                    >
                      <option value="" disabled>
                        Select...
                      </option>
                      {shapeSelectList.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value="Custom">Other (Custom)...</option>
                    </select>
                    {!['', ...shapeSelectList].includes(editForm.defaultShape) && (
                      <input
                        type="text"
                        value={editForm.defaultShape || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, defaultShape: e.target.value })
                        }
                        className="w-full text-right text-sm border-b border-pink-200 focus:outline-none focus:border-pink-500 pb-1 font-bold"
                        placeholder="Type custom shape..."
                        autoFocus
                      />
                    )}
                  </div>
                ) : (
                  <span className="text-black font-bold text-sm mt-1">
                    {clientProfile?.defaultShape || 'Round'}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-start">
                <span className="text-neutral-500 text-sm mt-1 w-1/3">Preferred Length</span>
                {isEditingDetails ? (
                  <div className="flex-1 flex flex-col items-end gap-2">
                    <select
                      value={
                        lengthSelectList.includes(editForm.defaultLength)
                          ? editForm.defaultLength
                          : editForm.defaultLength
                          ? 'Custom'
                          : ''
                      }
                      onChange={(e) => {
                        if (e.target.value !== 'Custom') {
                          setEditForm({ ...editForm, defaultLength: e.target.value });
                        } else {
                          setEditForm({ ...editForm, defaultLength: 'Custom Length' });
                        }
                      }}
                      className="text-right text-sm border-b border-pink-200 focus:outline-none focus:border-pink-500 pb-1 font-bold bg-transparent w-full"
                    >
                      <option value="" disabled>
                        Select...
                      </option>
                      {lengthSelectList.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                      <option value="Custom">Other (Custom)...</option>
                    </select>
                    {!['', ...lengthSelectList].includes(editForm.defaultLength) && (
                      <input
                        type="text"
                        value={editForm.defaultLength || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, defaultLength: e.target.value })
                        }
                        className="w-full text-right text-sm border-b border-pink-200 focus:outline-none focus:border-pink-500 pb-1 font-bold"
                        placeholder="Type custom length..."
                        autoFocus
                      />
                    )}
                  </div>
                ) : (
                  <span className="text-black font-bold text-sm mt-1">
                    {clientProfile?.defaultLength || 'M'}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Loyalty Card - Physical Card Aspect Ratio */}
            <div className="max-w-md mx-auto w-full aspect-[1.586/1] bg-gradient-to-br from-[#FFF0F5] to-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-pink-200/60 p-6 flex flex-col relative overflow-hidden">
              {/* Soft splashback background */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-pink-200/30 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-100/50 rounded-full blur-3xl pointer-events-none translate-y-1/4 -translate-x-1/4" />

              {/* Card Header */}
              <div className="flex flex-col items-center justify-center z-10 w-full mt-1">
                <h3
                  className={`${dancingScript.className} text-pink-500 text-[2.6rem] leading-none drop-shadow-sm`}
                >
                  UnHolly Nails
                </h3>
                <p className="text-[10px] text-pink-500 mt-1.5 uppercase tracking-[0.18em] font-black drop-shadow-sm text-center px-2">
                  {getOrdinalSuffix(loyaltyStats.nextMilestoneNumber)} Order:{' '}
                  {loyaltyStats.currentMilestoneReward}
                </p>
              </div>

              {/* Card Stamps (Middle Row) */}
              <div className="flex justify-center items-center gap-3 mt-auto mb-auto w-full z-10">
                {[1, 2, 3, 4, 5].map((i) => {
                  const hasStamp = i <= loyaltyStats.currentStamps;
                  const isReward = i === 5;

                  return (
                    <div
                      key={i}
                      className={`w-12 h-12 rounded-full border-[1.5px] flex flex-col items-center justify-center relative transition-all duration-300 ${
                        hasStamp
                          ? 'bg-pink-100 border-pink-400 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]'
                          : 'bg-white/60 backdrop-blur-sm border-pink-300 border-dashed'
                      }`}
                    >
                      {isReward && !hasStamp && (
                        <span className="text-xl text-pink-400 select-none animate-pulse">
                          {loyaltyStats.currentMilestoneReward.toLowerCase().includes('delivery')
                            ? '🚚'
                            : '🎁'}
                        </span>
                      )}
                      <Image
                        src="/logo_cropped.png"
                        alt="Stamp"
                        width={32}
                        height={32}
                        className={`object-contain transition-all duration-300 ${
                          hasStamp ? 'opacity-90 scale-100' : 'opacity-0 scale-50 absolute'
                        } ${isReward && hasStamp ? 'scale-110' : ''}`}
                        style={
                          hasStamp
                            ? {
                                filter:
                                  'contrast(1.2) sepia(1) hue-rotate(290deg) saturate(3)',
                              }
                            : {}
                        }
                      />
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-end z-10 w-full mb-0.5 px-1">
                <p className="text-[10px] text-pink-700 font-bold tracking-wide drop-shadow-sm">
                  {clientProfile?.name || 'Client'}
                </p>
                <p className="text-[10px] text-pink-600 font-bold uppercase tracking-wider drop-shadow-sm">
                  {loyaltyStats.totalStamps} Stamp{loyaltyStats.totalStamps === 1 ? '' : 's'} Earned ·{' '}
                  {transactionGroups.length} Order{transactionGroups.length === 1 ? '' : 's'}
                </p>
              </div>

              {/* Decorative background logo */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-15 pointer-events-none scale-[2] mix-blend-multiply">
                <Image src="/logo_cropped.png" alt="Background" width={200} height={200} />
              </div>
            </div>

            {/* Upcoming Milestone Rewards Strip */}
            <div className="max-w-md mx-auto bg-white rounded-2xl p-3.5 border border-pink-100 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-pink-500">
                    🎁 Your Milestone Perks
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditDefaultReward(defaultMilestoneReward);
                        setEditSecondaryReward(secondaryMilestoneReward);
                        setMilestonesEditForm(clientProfile?.loyaltyMilestones || {});
                        setActiveInlineTarget('5');
                        setIsEditingMilestones(true);
                      }}
                      className="text-[10px] font-bold text-pink-600 bg-pink-50 hover:bg-pink-100 border border-pink-200 px-2 py-0.5 rounded-full cursor-pointer transition flex items-center gap-1 shadow-xs"
                    >
                      <span>✏️</span> Edit Rewards
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-neutral-400 font-semibold">
                  {5 - loyaltyStats.currentStamps} more order
                  {5 - loyaltyStats.currentStamps === 1 ? '' : 's'} to next reward
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {loyaltyStats.upcomingSchedule.map((slot, idx) => (
                  <div
                    key={slot.milestone}
                    className={`rounded-xl p-2 text-center border ${
                      idx === 0
                        ? 'bg-pink-50/80 border-pink-200'
                        : 'bg-neutral-50/70 border-neutral-100'
                    }`}
                  >
                    <span
                      className={`block text-[10px] font-black uppercase tracking-wider ${
                        idx === 0 ? 'text-pink-600' : 'text-neutral-500'
                      }`}
                    >
                      {slot.label}
                    </span>
                    <span className="block text-[11px] font-bold text-neutral-800 mt-0.5 line-clamp-2">
                      {slot.reward}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Grouped Order History & 4-Step Visual Progress Tracker */}
            <div className="space-y-4 mt-8">
              <h3 className="font-black text-neutral-900 text-lg px-1">
                Order Tracking & History
              </h3>

              {transactionGroups.length === 0 ? (
                <div className="text-center p-10 bg-white rounded-3xl border border-pink-100 shadow-sm">
                  <p className="text-neutral-400 text-sm font-medium">No orders found yet.</p>
                  <Link
                    href="/collections/all"
                    className="inline-block mt-4 bg-black text-white px-5 py-2.5 rounded-full text-xs font-bold hover:bg-neutral-800 transition"
                  >
                    Browse Custom Sets
                  </Link>
                </div>
              ) : (
                transactionGroups.map((group) => {
                  const statusStr = group.status || 'Pending';
                  const isCancelledOrLost =
                    statusStr === 'Cancelled' || statusStr === 'Returned/Lost';
                  const activeStepIdx = getOrderStepIndex(statusStr);

                  // Find any Inspiration photos linked to this transaction's `orderDate`
                  const attachedInspoPhotos = clientImages.filter(
                    (img) =>
                      img.orderDate &&
                      Number(img.orderDate) === Number(group.orderDate) &&
                      img.imageType !== 'completed'
                  );

                  const isDelivered = statusStr.toLowerCase() === 'delivered';
                  const isExpanded = !!expandedOrders[group.key];
                  const isOngoing = !isCancelledOrLost && !isDelivered;

                  return (
                    <div
                      key={group.key}
                      className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-pink-100 space-y-4 transition hover:shadow-md"
                    >
                      {/* Top Row: Clickable Header (Order Number, Delivered badge, Date, Price, Expand toggle) */}
                      <div
                        onClick={() => toggleOrderExpand(group.key)}
                        className="flex items-start justify-between gap-3 border-b border-pink-50 pb-3 cursor-pointer select-none group/hdr"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-sm sm:text-base text-neutral-900 group-hover/hdr:text-[#FF5C9D] transition-colors">
                              {group.items.map((i: any) => i.setName || 'Custom Order').join(' + ')}
                            </h4>
                            {group.orderNumber && (
                              <span className="text-[10px] font-mono font-bold bg-pink-50 text-pink-600 border border-pink-200 px-2 py-0.5 rounded-full">
                                #{group.orderNumber}
                              </span>
                            )}
                            {isDelivered && (
                              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                <span>✓</span> Complete · Delivered
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-neutral-400 font-medium">
                              Placed on {new Date(group.orderDate).toLocaleDateString('en-IE', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                            <span className="text-neutral-300 text-xs">·</span>
                            <span className="text-[11px] font-bold text-pink-500 hover:text-pink-600 flex items-center gap-0.5">
                              {isExpanded ? 'Hide Details ▴' : 'View Details ▾'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-black text-pink-500 text-base">
                            €{group.totalPrice.toFixed(2)}
                          </span>
                          {group.earnsStamps && !isCancelledOrLost && (
                            <span className="text-[10px] text-pink-400 font-bold flex items-center justify-end gap-1 mt-0.5">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="w-3 h-3"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              {statusStr === 'Pending' ? 'Pending +1 Stamp' : '+1 Loyalty Stamp'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expandable Body: Line items breakdown & Inspo photos */}
                      {isExpanded && (
                        <div className="space-y-3 pt-1 border-b border-pink-50 pb-3">
                          {/* Line Items Breakdown */}
                          <div className="space-y-2">
                            {group.items.map((item: any, idx: number) => {
                              const qty = Number(item.setCount) > 0 ? Number(item.setCount) : 1;
                              const shape = item.shapeOverride || '';
                              const length = item.lengthOverride || '';
                              return (
                                <div
                                  key={item.syncId || idx}
                                  className="text-xs bg-[#FFF5F8]/60 rounded-2xl px-3.5 py-2.5 border border-pink-100/70"
                                >
                                  <div className="flex items-center justify-between font-bold text-neutral-800">
                                    <span>
                                      {qty}x {item.setName || 'Custom Set'}
                                      {(shape || length) && (
                                        <span className="text-pink-600 font-semibold ml-1.5">
                                          ({[length, shape].filter(Boolean).join(' ')})
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-neutral-600">
                                      €{Number(item.price || 0).toFixed(2)}
                                    </span>
                                  </div>
                                  {item.notes && (
                                    <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                                      {item.notes}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Attached Inspiration Photos for this Order */}
                          {attachedInspoPhotos.length > 0 && (
                            <div className="pt-1">
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                                Attached Reference Photos
                              </span>
                              <div className="flex gap-2 overflow-x-auto pb-1">
                                {attachedInspoPhotos.map((img, iIdx) => (
                                  <button
                                    key={img.docId || img.syncId || iIdx}
                                    type="button"
                                    onClick={() =>
                                      openPhotoLightbox(
                                        attachedInspoPhotos.map((p) => p.uri),
                                        iIdx
                                      )
                                    }
                                    className="relative w-14 h-14 rounded-xl overflow-hidden border border-pink-200 shrink-0 cursor-zoom-in group"
                                  >
                                    <Image
                                      src={img.uri}
                                      alt="Order Reference"
                                      fill
                                      className="object-cover group-hover:scale-105 transition"
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Visual Order Progress Tracker */}
                      {isCancelledOrLost ? (
                        <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold text-center">
                          Order Status: {statusStr}
                        </div>
                      ) : (isOngoing || isExpanded) ? (
                        <div className="pt-1">
                          <div className="grid grid-cols-5 gap-1.5">
                            {ORDER_TRACKER_STEPS.map((step, sIdx) => {
                              const isCompleted = sIdx <= activeStepIdx;
                              const isCurrent = sIdx === activeStepIdx;
                              return (
                                <div key={step.key} className="flex flex-col items-center">
                                  <div
                                    className={`w-full h-2 rounded-full transition-all duration-300 ${
                                      isCompleted
                                        ? isDelivered
                                          ? 'bg-emerald-500'
                                          : 'bg-[#FF5C9D]'
                                        : 'bg-pink-100'
                                    }`}
                                  />
                                  <span
                                    className={`mt-1.5 text-[10px] sm:text-[11px] text-center leading-tight ${
                                      isCurrent
                                        ? isDelivered
                                          ? 'font-black text-emerald-700'
                                          : 'font-black text-[#FF5C9D]'
                                        : isCompleted
                                        ? 'font-bold text-neutral-700'
                                        : 'font-medium text-neutral-400'
                                    }`}
                                  >
                                    <span className="hidden sm:inline">{step.label}</span>
                                    <span className="sm:hidden">{step.shortLabel}</span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {/* Admin Order Management Box */}
                      {isAdmin && (
                        <div className="mt-3.5 pt-3.5 border-t border-pink-100 bg-gradient-to-r from-pink-50/70 via-white to-pink-50/70 rounded-2xl p-3 sm:p-4 border border-pink-200/80 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-pink-700 flex items-center gap-1.5">
                              <span>⚙️</span>
                              <span>Admin Order Controls</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleOrderLoyalty(group)}
                                className={`text-[10px] font-bold px-3 py-1 rounded-full border transition cursor-pointer ${
                                  group.earnsStamps
                                    ? 'bg-pink-100 border-pink-300 text-pink-700'
                                    : 'bg-neutral-100 border-neutral-300 text-neutral-600'
                                }`}
                                title="Toggle whether this order awards digital loyalty stamps"
                              >
                                {group.earnsStamps ? '★ Loyalty Stamp: YES' : '☆ Loyalty Stamp: NO'}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                                Update Order Status
                              </label>
                              <select
                                value={
                                  group.status === 'Pending' || !group.status
                                    ? 'Received'
                                    : group.status.toLowerCase().includes('queue') ||
                                      group.status.toLowerCase() === 'confirmed'
                                    ? 'Confirmed'
                                    : group.status.toLowerCase().includes('paint') ||
                                      group.status.toLowerCase() === 'ready' ||
                                      group.status.toLowerCase() === 'completed'
                                    ? 'Ready'
                                    : group.status.toLowerCase().includes('dispatch') ||
                                      group.status.toLowerCase() === 'sent' ||
                                      group.status.toLowerCase() === 'shipped'
                                    ? 'Dispatched'
                                    : group.status.toLowerCase().includes('deliver')
                                    ? 'Delivered'
                                    : group.status
                                }
                                onChange={(e) => handleUpdateOrderStatus(group, e.target.value)}
                                className="w-full bg-white border border-pink-200 text-neutral-900 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 cursor-pointer shadow-sm"
                              >
                                <option value="Received">1. Order Received</option>
                                <option value="Confirmed">2. Confirmed & In Queue</option>
                                <option value="Ready">3. Hand-Painted & Ready</option>
                                <option value="Dispatched">4. Dispatched</option>
                                <option value="Delivered">5. Delivered</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                                Finished Set Photo
                              </label>
                              <label className="w-full bg-white hover:bg-neutral-50 border border-pink-200 text-neutral-800 text-xs font-bold rounded-xl px-3 py-2 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm">
                                <span>📷</span>
                                <span>Upload Studio Photo</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleUploadCompletedPhoto(e, group.orderDate)}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>
    </>
  )}

      {/* Admin Inline Milestone Rewards Editor Modal */}
      {isEditingMilestones && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm"
            onClick={() => setIsEditingMilestones(false)}
          />
          <div className="relative z-10 w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-pink-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-pink-100 bg-gradient-to-r from-pink-50 via-white to-pink-50 flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg text-neutral-900">Customise Milestone Rewards</h3>
                <p className="text-xs text-neutral-500">
                  Editing for {clientProfile?.name || 'Client'} & Global Defaults
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingMilestones(false)}
                className="text-neutral-400 hover:text-neutral-700 w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Studio Defaults */}
              <div className="bg-pink-50/50 rounded-2xl p-4 border border-pink-100 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-pink-600 block">
                  Studio Default Alternating Rewards
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                      5th, 15th, 25th Orders
                    </label>
                    <input
                      type="text"
                      value={editDefaultReward}
                      onFocus={() => setActiveInlineTarget('default')}
                      onChange={(e) => setEditDefaultReward(e.target.value)}
                      placeholder="e.g. Free Delivery"
                      className="w-full bg-white border border-pink-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                      10th, 20th, 30th Orders
                    </label>
                    <input
                      type="text"
                      value={editSecondaryReward}
                      onFocus={() => setActiveInlineTarget('secondary')}
                      onChange={(e) => setEditSecondaryReward(e.target.value)}
                      placeholder="e.g. Free Gift"
                      className="w-full bg-white border border-pink-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Fill Presets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                    Quick-Fill Presets (Filling:{' '}
                    {activeInlineTarget === 'default'
                      ? '5th/15th Default'
                      : activeInlineTarget === 'secondary'
                      ? '10th/20th Default'
                      : `${activeInlineTarget}th Order`}
                    )
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quickFillPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        if (activeInlineTarget === 'default') {
                          setEditDefaultReward(preset);
                        } else if (activeInlineTarget === 'secondary') {
                          setEditSecondaryReward(preset);
                        } else {
                          setMilestonesEditForm((prev) => ({
                            ...prev,
                            [activeInlineTarget]: preset,
                          }));
                        }
                      }}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-neutral-100 hover:bg-pink-100 text-neutral-700 hover:text-pink-600 border border-neutral-200 transition cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Client Milestones */}
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                  Milestones for {clientProfile?.name || 'this client'} (leave blank to use defaults)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[5, 10, 15, 20, 25, 30].map((num) => {
                    const key = String(num);
                    const defaultText =
                      (Math.round(num / 5) % 2 === 0
                        ? editSecondaryReward || 'Free Gift'
                        : editDefaultReward || 'Free Delivery');
                    return (
                      <div key={num}>
                        <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                          {num}th Order Reward
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={milestonesEditForm[key] || ''}
                            onFocus={() => setActiveInlineTarget(key)}
                            onChange={(e) =>
                              setMilestonesEditForm((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            placeholder={`Default: ${defaultText}`}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:outline-none focus:border-pink-500 pr-7"
                          />
                          {milestonesEditForm[key] && (
                            <button
                              type="button"
                              onClick={() =>
                                setMilestonesEditForm((prev) => {
                                  const c = { ...prev };
                                  delete c[key];
                                  return c;
                                })
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs font-bold"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-pink-100 bg-neutral-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingMilestones(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-black rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingMilestones}
                onClick={async () => {
                  setSavingMilestones(true);
                  try {
                    // 1. Save global loyalty config
                    const loyaltyRef = doc(db, 'users', vendorUid, 'store_settings', 'loyalty_config');
                    await setDoc(
                      loyaltyRef,
                      {
                        defaultReward: editDefaultReward.trim() || 'Free Delivery',
                        secondaryReward: editSecondaryReward.trim() || 'Free Gift',
                        quickPresets: quickFillPresets,
                        updatedAt: Date.now(),
                      },
                      { merge: true }
                    );

                    // 2. Save client's custom milestones if logged in
                    if (clientProfile?.syncId) {
                      const cleanMap: Record<string, string> = {};
                      Object.entries(milestonesEditForm).forEach(([k, v]) => {
                        if (v && v.trim()) cleanMap[k] = v.trim();
                      });
                      const clientRef = doc(db, 'users', vendorUid, 'clients', clientProfile.syncId);
                      await setDoc(
                        clientRef,
                        {
                          loyaltyMilestones: cleanMap,
                          updatedAt: Date.now(),
                        },
                        { merge: true }
                      );
                    }

                    setIsEditingMilestones(false);
                  } catch (e) {
                    console.error('Failed to save milestones:', e);
                  } finally {
                    setSavingMilestones(false);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-black hover:bg-[#FF5C9D] text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {savingMilestones ? 'Saving...' : 'Save Milestone Rewards'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Edit Client Details & Account Linking Modal */}
      {isEditingClientModal && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm"
            onClick={() => setIsEditingClientModal(false)}
          />
          <div className="relative z-10 w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-pink-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-pink-100 bg-gradient-to-r from-pink-50 via-white to-pink-50 flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg text-neutral-900">Edit Client & Account Linking</h3>
                <p className="text-xs text-neutral-500">
                  Update contact information, fix sign-in Google email, or edit custom shape/length.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingClientModal(false)}
                className="text-neutral-400 hover:text-neutral-700 w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Linked Google Email (Primary Fix for Account Linking) */}
              <div className="bg-pink-50/60 rounded-2xl p-3.5 border border-pink-200/80 space-y-1.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-pink-700">
                  🔗 Linked Google Account Email
                </label>
                <input
                  type="email"
                  value={clientEditFormState.email || ''}
                  onChange={(e) =>
                    setClientEditFormState((prev: any) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="client_google_email@gmail.com"
                  className="w-full bg-white border border-pink-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:outline-none focus:border-pink-500"
                />
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Enter the Google account email this client uses when clicking &quot;Sign in with Google&quot;. Once saved, they will automatically see their orders and custom sizes upon logging in.
                </p>
              </div>

              {/* Name & Instagram */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Client Full Name
                  </label>
                  <input
                    type="text"
                    value={clientEditFormState.name || ''}
                    onChange={(e) =>
                      setClientEditFormState((prev: any) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Instagram Handle
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-xs">
                      @
                    </span>
                    <input
                      type="text"
                      value={clientEditFormState.instagram || ''}
                      onChange={(e) =>
                        setClientEditFormState((prev: any) => ({
                          ...prev,
                          instagram: e.target.value,
                        }))
                      }
                      placeholder="username"
                      className="w-full bg-white border border-neutral-200 rounded-xl pl-7 pr-3 py-2 text-xs font-medium text-neutral-900 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>
              </div>

              {/* Phone & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={clientEditFormState.phone || ''}
                    onChange={(e) =>
                      setClientEditFormState((prev: any) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="+353 ..."
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Default Shape & Length
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={clientEditFormState.defaultLength || 'M'}
                      onChange={(e) =>
                        setClientEditFormState((prev: any) => ({
                          ...prev,
                          defaultLength: e.target.value,
                        }))
                      }
                      className="bg-white border border-neutral-200 rounded-xl px-2 py-2 text-xs font-bold text-neutral-900 outline-none focus:border-pink-500"
                    >
                      {lengthSelectList.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>

                    <select
                      value={clientEditFormState.defaultShape || 'Almond'}
                      onChange={(e) =>
                        setClientEditFormState((prev: any) => ({
                          ...prev,
                          defaultShape: e.target.value,
                        }))
                      }
                      className="bg-white border border-neutral-200 rounded-xl px-2 py-2 text-xs font-bold text-neutral-900 outline-none focus:border-pink-500"
                    >
                      {shapeSelectList.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Delivery Address */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                  Delivery / Shipping Address
                </label>
                <textarea
                  rows={2}
                  value={clientEditFormState.address || ''}
                  onChange={(e) =>
                    setClientEditFormState((prev: any) => ({ ...prev, address: e.target.value }))
                  }
                  placeholder="Street, City, County, Postal Code..."
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Design Notes */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                  Design & Sizing Notes
                </label>
                <textarea
                  rows={2}
                  value={clientEditFormState.designNotes || ''}
                  onChange={(e) =>
                    setClientEditFormState((prev: any) => ({
                      ...prev,
                      designNotes: e.target.value,
                    }))
                  }
                  placeholder="Special requests, custom nail curvature, preferences..."
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-pink-100 bg-neutral-50 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (
                    confirm(
                      `Are you sure you want to delete client "${
                        clientEditFormState.name || clientEditFormState.instagram
                      }"?`
                    )
                  ) {
                    try {
                      await setDoc(
                        doc(db, 'users', vendorUid, 'clients', clientEditFormState.syncId),
                        { isDeleted: true, updatedAt: Date.now() },
                        { merge: true }
                      );
                      setAdminClients((prev) =>
                        prev.filter((c) => c.syncId !== clientEditFormState.syncId)
                      );
                      setAdminSelectedClientSyncId(null);
                      setIsEditingClientModal(false);
                    } catch (e) {
                      console.error('Failed to delete client:', e);
                    }
                  }
                }}
                className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 transition cursor-pointer"
              >
                Delete Client
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingClientModal(false)}
                  className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-black rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={adminSavingClient}
                  onClick={handleSaveClientDetails}
                  className="px-5 py-2.5 rounded-xl bg-black hover:bg-[#FF5C9D] text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {adminSavingClient ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Create New Client Modal */}
      {isCreatingClientModal && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm"
            onClick={() => setIsCreatingClientModal(false)}
          />
          <div className="relative z-10 w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-pink-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-pink-100 bg-gradient-to-r from-pink-50 via-white to-pink-50 flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg text-neutral-900">Create New Client Profile</h3>
                <p className="text-xs text-neutral-500">
                  Add a client to your studio directory to track orders and custom sizes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingClientModal(false)}
                className="text-neutral-400 hover:text-neutral-700 w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Client Full Name
                  </label>
                  <input
                    type="text"
                    value={newClientFormState.name}
                    onChange={(e) =>
                      setNewClientFormState((prev: any) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g. Jessica Smith"
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Instagram Handle
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-xs">
                      @
                    </span>
                    <input
                      type="text"
                      value={newClientFormState.instagram}
                      onChange={(e) =>
                        setNewClientFormState((prev: any) => ({
                          ...prev,
                          instagram: e.target.value,
                        }))
                      }
                      placeholder="jessica_nails"
                      className="w-full bg-white border border-neutral-200 rounded-xl pl-7 pr-3 py-2 text-xs font-medium text-neutral-900 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                  Google Account Email (Optional)
                </label>
                <input
                  type="email"
                  value={newClientFormState.email}
                  onChange={(e) =>
                    setNewClientFormState((prev: any) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="jessica@gmail.com"
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={newClientFormState.phone}
                    onChange={(e) =>
                      setNewClientFormState((prev: any) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="+353 ..."
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Default Shape & Length
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={newClientFormState.defaultLength}
                      onChange={(e) =>
                        setNewClientFormState((prev: any) => ({
                          ...prev,
                          defaultLength: e.target.value,
                        }))
                      }
                      className="bg-white border border-neutral-200 rounded-xl px-2 py-2 text-xs font-bold text-neutral-900 outline-none focus:border-pink-500"
                    >
                      {lengthSelectList.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>

                    <select
                      value={newClientFormState.defaultShape}
                      onChange={(e) =>
                        setNewClientFormState((prev: any) => ({
                          ...prev,
                          defaultShape: e.target.value,
                        }))
                      }
                      className="bg-white border border-neutral-200 rounded-xl px-2 py-2 text-xs font-bold text-neutral-900 outline-none focus:border-pink-500"
                    >
                      {shapeSelectList.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                  Delivery Address (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newClientFormState.address}
                  onChange={(e) =>
                    setNewClientFormState((prev: any) => ({ ...prev, address: e.target.value }))
                  }
                  placeholder="Delivery address..."
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-medium text-neutral-900 focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-pink-100 bg-neutral-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingClientModal(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-black rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={adminSavingClient}
                onClick={handleCreateNewClient}
                className="px-5 py-2.5 rounded-xl bg-black hover:bg-[#FF5C9D] text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {adminSavingClient ? 'Creating...' : 'Create Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for Client Photos */}
      <ProductLightbox
        isOpen={lightboxOpen}
        images={lightboxImages}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        title="Client Vault Photo"
      />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex-grow bg-[#FFF5F8] flex items-center justify-center pt-20 pb-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
        </div>
      }
    >
      <ProfilePageContent />
    </Suspense>
  );
}
