export const VENDOR_UID =
  process.env.NEXT_PUBLIC_VENDOR_UID || "CMzpkonBxKeLboaVTUYwDWgiwNG3";

export const VALID_ADMINS = [
  "0TMvGP1VIja7VzVM87MPQaacoY03", // Gary
  "CMzpkonBxKeLboaVTUYwDWgiwNG3", // Holly
];

export const isAdminUid = (uid?: string | null): boolean =>
  Boolean(uid && VALID_ADMINS.includes(uid));

export const DEFAULT_SHAPES = [
  "Almond",
  "Stiletto",
  "Coffin",
  "Square",
  "Oval",
  "Round",
];

export const DEFAULT_LENGTHS = ["XS", "S", "M", "L", "XL"];

export const DEFAULT_SIZES = ["XS", "S", "M", "L"];

/**
 * Reconstructs public Firebase Storage URLs when a document from the Android app
 * holds a local device file path instead of a full https:// download URL.
 */
export const formatStorageImageUrl = (
  url?: string | null,
  uid: string = VENDOR_UID
): string => {
  if (!url) return "";
  if (!url.startsWith("http")) {
    const filename = url.split("/").pop();
    return filename
      ? `https://firebasestorage.googleapis.com/v0/b/presson-pro.firebasestorage.app/o/users%2F${uid}%2Fimages%2F${filename}?alt=media`
      : url;
  }
  return url;
};
