import { Metadata } from "next";
import MenuClient from "./MenuClient";

export const metadata: Metadata = {
  title: "Price Menu | UnHolly Nails",
  description: "Official price list for custom luxury press-on nails, keychains, bundles, and gifts.",
};

export default function MenuPage() {
  return <MenuClient />;
}
