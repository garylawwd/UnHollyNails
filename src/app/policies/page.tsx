import { Metadata } from "next";
import PoliciesClient from "./PoliciesClient";

export const metadata: Metadata = {
  title: "Store Policies | UnHolly Nails",
  description: "Review turnaround times, An Post shipping rates, cancellations, sizing, and care policies.",
};

export default function PoliciesPage() {
  return <PoliciesClient />;
}
