import { Metadata } from "next";
import ContactClient from "./ContactClient";

export const metadata: Metadata = {
  title: "Contact & Custom Orders | UnHolly Nails",
  description: "Get in touch with Holly for custom press-on orders, sizing help, or inquiries via Instagram or Facebook.",
};

export default function ContactPage() {
  return <ContactClient />;
}
