import { Metadata } from "next";
import ClubClient from "./ClubClient";

export const metadata: Metadata = {
  title: "Unholly Nails Club! | VIP Loyalty & Birthday Perks",
  description: "Join the VIP UnHollyNails Club! Earn digital loyalty stamps for free gifts and celebrate with a bespoke birthday nail set.",
};

export default function ClubPage() {
  return <ClubClient />;
}
