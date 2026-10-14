import { Metadata } from "next";
import ClubClient from "./ClubClient";

export const metadata: Metadata = {
  title: "UnHollyNails Club | Digital Loyalty Card & Member Perks",
  description: "Join the UnHollyNails Club! Create an account to get your digital loyalty card, earn stamps on every order, and celebrate with birthday treats.",
};

export default function ClubPage() {
  return <ClubClient />;
}
