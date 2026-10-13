import Link from "next/link";
import Image from "next/image";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FFF5F8] text-black">
      <div className="max-w-4xl mx-auto px-4 py-20">
        <h1 className="text-4xl font-black uppercase tracking-widest mb-8 text-center">About UnHolly Nails</h1>
        
        <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-xl border border-pink-100 mb-12">
          <div className="w-32 h-32 mx-auto mb-8 relative rounded-full overflow-hidden bg-pink-50 border-4 border-white shadow-lg">
            <Image src="/logo_cropped.png" alt="UnHolly Nails" fill className="object-cover p-2" />
          </div>
          
          <div className="space-y-6 text-neutral-600 leading-relaxed text-lg text-center max-w-2xl mx-auto">
            <p>
              Welcome to the dark, glamorous world of <span className="font-bold text-black">UnHolly Nails</span>.
            </p>
            <p>
              Born from my personal passion for intricate nail artistry and love for the bold and unconventional, UnHolly Nails is an independent studio dedicated to handcrafted, luxury press-on nails that look and feel like you just spent three hours in a high-end salon.
            </p>
            <p>
              Every single set is meticulously designed, shaped, and hand-painted by me using premium salon-grade professional gels. I don&apos;t do factory mass-production; I create wearable bespoke art. Whether you&apos;re looking for everyday elegance, gothic edge, or dazzling 3D crystals, I craft each set to fit your exact aesthetic.
            </p>
            <p className="font-medium text-pink-500 italic mt-8">
              Stay UnHolly,
              <br/>
              Holly ✨
            </p>
          </div>
        </div>
        
        <div className="text-center">
          <Link href="/collections/all" className="inline-block bg-black text-white px-8 py-4 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-[#FF5C9D] transition-colors shadow-lg">
            Shop My Designs
          </Link>
        </div>
      </div>
    </div>
  );
}
