import { Metadata } from "next";
import AboutClient from "./AboutClient";

export const metadata: Metadata = {
  title: "About | UnHolly Nails",
  description: "About Holly and the UnHollyNails bespoke press-on studio.",
};

export default function AboutPage() {
  return <AboutClient />;
}
