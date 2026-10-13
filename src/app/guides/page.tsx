import Link from "next/link";

const NAIL_SHAPES = [
  {
    name: "Almond",
    desc: "Tapered sides that curve gently to a soft rounded point. Elegant, elongating, and our most popular signature silhouette.",
    icon: (
      <svg viewBox="0 0 40 70" className="w-10 h-16 mx-auto text-pink-500 fill-pink-100 stroke-current stroke-2">
        <path d="M 10 65 L 10 35 C 10 15 20 5 20 5 C 20 5 30 15 30 35 L 30 65 Z" />
      </svg>
    )
  },
  {
    name: "Coffin / Ballerina",
    desc: "Tapered sides ending in a sharp, straight square tip. High-glam, dramatic, and a client favorite for medium & long sets.",
    icon: (
      <svg viewBox="0 0 40 70" className="w-10 h-16 mx-auto text-pink-500 fill-pink-100 stroke-current stroke-2">
        <path d="M 9 65 L 13 25 L 15 8 L 25 8 L 27 25 L 31 65 Z" />
      </svg>
    )
  },
  {
    name: "Square",
    desc: "Straight parallel sidewalls with a crisp, classic 90-degree flat top. Classic, sturdy, and clean.",
    icon: (
      <svg viewBox="0 0 40 70" className="w-10 h-16 mx-auto text-pink-500 fill-pink-100 stroke-current stroke-2">
        <path d="M 10 65 L 10 8 L 30 8 L 30 65 Z" />
      </svg>
    )
  },
  {
    name: "Oval",
    desc: "Softly curved edges that mimic natural egg-shaped contours. Highly durable, soft, and universally flattering.",
    icon: (
      <svg viewBox="0 0 40 70" className="w-10 h-16 mx-auto text-pink-500 fill-pink-100 stroke-current stroke-2">
        <path d="M 10 65 L 10 30 C 10 10 30 10 30 30 L 30 65 Z" />
      </svg>
    )
  },
  {
    name: "Stiletto",
    desc: "Dramatic tapering narrowing down to an ultra-sharp point. Bold, fierce, and unforgettable statement nails.",
    icon: (
      <svg viewBox="0 0 40 70" className="w-10 h-16 mx-auto text-pink-500 fill-pink-100 stroke-current stroke-2">
        <path d="M 9 65 L 13 35 L 20 5 L 27 35 L 31 65 Z" />
      </svg>
    )
  },
  {
    name: "Round",
    desc: "Straight sides following the natural fingertip with a gently curved arc. Practical, low-maintenance, and chic.",
    icon: (
      <svg viewBox="0 0 40 70" className="w-10 h-16 mx-auto text-pink-500 fill-pink-100 stroke-current stroke-2">
        <path d="M 11 65 L 11 25 C 11 12 29 12 29 25 L 29 65 Z" />
      </svg>
    )
  }
];

export default function GuidesPage() {
  return (
    <div className="min-h-screen bg-[#FFF5F8] text-black pb-20">
      <div className="bg-pink-100 py-16 mb-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-black uppercase tracking-widest mb-4">Guides & Sizing</h1>
          <p className="text-pink-800 font-medium">Everything you need to know for a flawless, salon-perfect manicure.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 space-y-12">
        {/* Nail Shapes Guide */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-pink-100">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">💅</span>
            <h2 className="text-2xl font-black uppercase tracking-wider">Nail Shapes Guide</h2>
          </div>
          <p className="text-neutral-500 text-sm mb-8">
            Choose the shape that best compliments your hands, aesthetic, and daily routine. All shapes are available in custom lengths!
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {NAIL_SHAPES.map((shape) => (
              <div 
                key={shape.name} 
                className="p-5 rounded-2xl border border-pink-100 bg-[#FFF5F8]/50 flex flex-col items-center text-center hover:border-pink-300 transition-all hover:shadow-sm"
              >
                <div className="mb-3">
                  {shape.icon}
                </div>
                <h3 className="font-bold text-base text-neutral-900 mb-1.5">{shape.name}</h3>
                <p className="text-xs text-neutral-600 leading-relaxed">{shape.desc}</p>
              </div>
            ))}
          </div>
          <div className="p-4 rounded-2xl bg-pink-50 border border-pink-200 text-xs text-pink-900 flex items-center justify-between flex-wrap gap-3">
            <span>Need advice on what shape suits your nail bed? Message me anytime on Instagram or Facebook!</span>
            <Link href="/collections/all" className="font-bold underline text-pink-700 hover:text-black">Browse All Sets &rarr;</Link>
          </div>
        </section>

        {/* Sizing Guide */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-pink-100">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📏</span>
            <h2 className="text-2xl font-black uppercase tracking-wider">How to Measure Your Nails</h2>
          </div>
          <p className="text-neutral-500 text-sm mb-6">
            For the most accurate fit, we highly recommend purchasing a <span className="font-bold text-pink-600">Sizing Kit</span> in your desired shape and length before ordering.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mb-8">
            <div className="space-y-4 text-neutral-600">
              <h3 className="font-bold text-sm text-black uppercase tracking-wider">Measuring at Home (Tape Method)</h3>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-neutral-700">
                <li>Place a piece of clear transparent tape across the widest part of your natural nail bed.</li>
                <li>Press down firmly into the sidewalls and use a pen to mark the exact outer edges.</li>
                <li>Peel off the tape and lay it flat against a ruler. Measure the distance in millimeters (mm).</li>
                <li>Repeat for all 10 fingers and record your measurements (Thumb to Pinky).</li>
              </ol>
              <div className="pt-2">
                <Link href="/profile" className="inline-block text-xs font-bold text-pink-600 hover:underline">
                  ✨ Tip: Save your exact mm sizes in your Client Profile for 1-tap checkout!
                </Link>
              </div>
            </div>

            <div className="bg-pink-50 rounded-2xl p-6 border border-pink-100 text-center">
              <h3 className="font-bold mb-4 uppercase tracking-widest text-xs text-pink-900">Standard Sizes (Thumb to Pinky)</h3>
              <ul className="space-y-2.5 text-xs text-neutral-800">
                <li className="flex justify-between border-b border-pink-200/60 pb-2"><span className="font-bold">XS</span> <span className="font-mono">14mm | 11mm | 12mm | 10mm | 8mm</span></li>
                <li className="flex justify-between border-b border-pink-200/60 pb-2"><span className="font-bold">S</span> <span className="font-mono">15mm | 12mm | 13mm | 11mm | 8mm</span></li>
                <li className="flex justify-between border-b border-pink-200/60 pb-2"><span className="font-bold">M</span> <span className="font-mono">16mm | 13mm | 14mm | 12mm | 9mm</span></li>
                <li className="flex justify-between border-b border-pink-200/60 pb-2"><span className="font-bold">L</span> <span className="font-mono">18mm | 14mm | 15mm | 13mm | 10mm</span></li>
              </ul>
              <p className="text-[11px] text-neutral-500 mt-4 leading-relaxed">
                *Don&apos;t match standard sizes? Select &ldquo;Profile Sizes&rdquo; or custom sizes and I will hand-craft each nail to your exact millimeters.
              </p>
            </div>
          </div>
          <Link href="/collections/basics" className="inline-block bg-black text-white px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-pink-500 transition-colors">
            Order a Sizing Kit
          </Link>
        </section>

        {/* Prep & Application */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-pink-100">
          <h2 className="text-2xl font-black mb-6 uppercase tracking-wider">Prep & Application</h2>
          <div className="space-y-6 text-neutral-600">
            <div>
              <h3 className="text-lg font-bold text-black mb-2">1. Prep (The most important step!)</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Wash your hands thoroughly with soap to remove natural oils.</li>
                <li>Push back your cuticles gently using the wooden cuticle stick.</li>
                <li>Lightly buff the shine off your natural nail bed with the buffer block.</li>
                <li>Wipe each nail thoroughly with the alcohol wipe. Let dry completely!</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-black mb-2">2. Apply</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>For Nail Glue (1-3 weeks wear):</strong> Apply a drop of glue to your natural nail and a small drop to the back of the press-on. Align with your cuticle line at a 45-degree angle and press down firmly for 15-20 seconds.</li>
                <li><strong>For Adhesive Tabs (1-3 days wear):</strong> Select a tab size matching your nail bed. Apply to the nail, peel off the plastic backing, align the press-on, and press firmly for 10 seconds.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Removal */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-pink-100">
          <h2 className="text-2xl font-black mb-4 uppercase tracking-wider">Safe Removal</h2>
          <p className="text-neutral-600 text-sm mb-4">Never pull or rip off your press-ons! This will damage your natural nails.</p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-neutral-600">
            <li>Soak your nails in a bowl of warm water with a few drops of dish soap and cuticle oil for 15-20 minutes.</li>
            <li>Gently use the wooden stick to nudge under the edges. If they don&apos;t pop off easily, soak for an additional 5 minutes.</li>
            <li>Once removed, lightly buff away any residue from your nails and apply cuticle oil to rehydrate.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
