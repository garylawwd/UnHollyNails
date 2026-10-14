import { Metadata } from "next";
import MysteryBoxesClient from "./MysteryBoxesClient";

export const metadata: Metadata = {
  title: "Mystery Boxes | UnHolly Nails",
  description: "Handcrafted surprise luxury press-on gift packs for adults and kids. Tailored to your personal vibe.",
};

export default function MysteryBoxesPage() {
  return <MysteryBoxesClient />;
}
