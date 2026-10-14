import { Metadata } from "next";
import BundlesClient from "./BundlesClient";

export const metadata: Metadata = {
  title: "Bundles & Gift Packs | UnHolly Nails",
  description: "Explore the Mini Me Bundle, the UnHollyNails Ultimate Luxury Bundle, and matching accessories.",
};

export default function BundlesPage() {
  return <BundlesClient />;
}
