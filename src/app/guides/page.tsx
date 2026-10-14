import { Metadata } from "next";
import GuidesClient from "./GuidesClient";

export const metadata: Metadata = {
  title: "Sizing & Application Guides | UnHolly Nails",
  description: "Find your perfect press-on size with our 3 easy methods. Step-by-step application, removal, and reuse care instructions.",
};

export default function GuidesPage() {
  return <GuidesClient />;
}
