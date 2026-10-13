export default function PoliciesPage() {
  return (
    <div className="min-h-screen bg-[#FFF5F8] text-black pb-20">
      <div className="bg-white py-16 mb-12 border-b border-pink-100">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-black uppercase tracking-widest mb-4">Store Policies</h1>
          <p className="text-neutral-500 font-medium">Please read carefully before placing an order.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 space-y-10">
        <section>
          <h2 className="text-xl font-bold uppercase tracking-wider mb-4 border-b-2 border-pink-500 inline-block pb-1">Processing Time</h2>
          <div className="text-neutral-600 space-y-3 leading-relaxed">
            <p>Every set of UnHolly Nails is meticulously crafted by hand, made to order just for you. Because of this, my standard processing time (the time it takes to hand-paint your set) is currently <strong>7-14 business days</strong>.</p>
            <p>This does not include shipping time. Processing times are estimates and may be extended during high-volume periods (holidays, sales, or viral moments). If you need a set by a specific date, please contact me via DM before placing your order to inquire about rush processing (additional fees may apply).</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold uppercase tracking-wider mb-4 border-b-2 border-pink-500 inline-block pb-1">Shipping Policy</h2>
          <div className="text-neutral-600 space-y-3 leading-relaxed">
            <p>Once your order has finished processing and has been shipped, you will receive a confirmation DM/Email (if requested). Shipping costs are calculated via DM based on your location and preferred shipping method.</p>
            <p><strong>UnHolly Nails is not responsible for:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Packages lost, stolen, or damaged in transit.</li>
              <li>Delays caused by the postal service or customs.</li>
              <li>Packages returned due to an incorrect or incomplete address provided at checkout. (If a package is returned, the buyer is responsible for the re-shipping fee).</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold uppercase tracking-wider mb-4 border-b-2 border-pink-500 inline-block pb-1">Returns, Refunds & Cancellations</h2>
          <div className="text-neutral-600 space-y-3 leading-relaxed">
            <p>Due to the custom, handmade nature of our products and strict hygiene standards, <strong>all sales are final</strong>. I do not accept returns, exchanges, or offer refunds.</p>
            <p><strong>Sizing Issues:</strong> I cannot be held responsible if you order the wrong size. It is the buyer's responsibility to measure accurately or purchase a Sizing Kit prior to ordering. No refunds or replacements will be issued for incorrect sizing.</p>
            <p><strong>Cancellations:</strong> If you need to cancel an order, you must do so within <strong>24 hours</strong> of placing it. After 24 hours, the creation process may have already begun, and cancellations will no longer be accepted.</p>
            <p><strong>Defects/Errors:</strong> If there is a mistake on my end (e.g., wrong design or length sent), please contact me within 48 hours of delivery with photos of the issue, and I will gladly resolve it!</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold uppercase tracking-wider mb-4 border-b-2 border-pink-500 inline-block pb-1">Privacy Policy</h2>
          <div className="text-neutral-600 space-y-3 leading-relaxed">
            <p>Your privacy is deeply valued. Your personal information (name, address, email, phone number) collected during checkout or account creation is used strictly for processing your orders, providing customer support, and, with your consent, sending updates or promotional offers.</p>
            <p>I will never sell, trade, or distribute your personal data to third parties. Secure authentication methods (Google Sign-In) are used to protect your account data.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
