import Link from "next/link";
import Image from "next/image";

export default function GlobalFooter() {
  return (
    <footer className="bg-white border-t border-pink-100 mt-auto relative z-20">
      <div className="max-w-7xl mx-auto px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12">
          
          {/* Brand Col */}
          <div className="flex flex-col items-center text-center">
            <Link href="/" className="inline-block mb-4">
              <Image src="/logo_cropped.png" alt="UnHolly Nails" width={130} height={50} className="w-28 sm:w-32 h-auto object-contain mx-auto" />
            </Link>
            <p className="font-brand text-xs sm:text-sm text-neutral-500 leading-relaxed mb-3 max-w-xs mx-auto">
              Luxury custom press-on artistry. Handmade with love, salon-grade products, and meticulous attention to detail.
            </p>
            <div className="inline-block bg-pink-50 text-[#FF5C9D] border border-pink-100 px-3 py-1 rounded-full text-[10px] font-brand font-bold uppercase tracking-wider mx-auto">
              Turnaround: 5–10 Business Days
            </div>
          </div>

          {/* Shop & Offerings */}
          <div className="flex flex-col items-center text-center">
            <h3 className="font-brand font-bold text-neutral-900 uppercase tracking-wider mb-4 text-xs text-center w-full">
              Shop & Offerings
            </h3>
            <ul className="space-y-3 font-brand text-xs sm:text-sm text-center w-full">
              <li><Link href="/collections/all" className="text-neutral-500 hover:text-[#FF5C9D] transition-colors">All Press-On Designs</Link></li>
              <li><Link href="/menu" className="text-neutral-500 hover:text-[#FF5C9D] transition-colors">Price Menu & Services</Link></li>
              <li><Link href="/bundles" className="text-neutral-500 hover:text-[#FF5C9D] transition-colors">UnHollyNails Bundles</Link></li>
              <li><Link href="/mystery-boxes" className="text-neutral-500 hover:text-[#FF5C9D] transition-colors">Mystery Boxes</Link></li>
              <li><Link href="/club" className="text-neutral-500 hover:text-[#FF5C9D] transition-colors">UnHollyNails Club</Link></li>
            </ul>
          </div>

          {/* Guides & Policies */}
          <div className="flex flex-col items-center text-center">
            <h3 className="font-brand font-bold text-neutral-900 uppercase tracking-wider mb-4 text-xs text-center w-full">
              Guides & Policies
            </h3>
            <ul className="space-y-3 font-brand text-xs sm:text-sm text-center w-full">
              <li><Link href="/guides" className="text-neutral-500 hover:text-[#FF5C9D] transition-colors">Sizing & Application Guide</Link></li>
              <li><Link href="/policies" className="text-neutral-500 hover:text-[#FF5C9D] transition-colors">Store Policies (Shipping & Returns)</Link></li>
              <li><Link href="/about" className="text-neutral-500 hover:text-[#FF5C9D] transition-colors">About The Studio</Link></li>
              <li><Link href="/contact" className="text-neutral-500 hover:text-[#FF5C9D] transition-colors">Order via DM / Contact</Link></li>
            </ul>
          </div>

          {/* Connect */}
          <div className="flex flex-col items-center text-center">
            <h3 className="font-brand font-bold text-neutral-900 uppercase tracking-wider mb-4 text-xs text-center w-full">
              Connect
            </h3>
            <ul className="space-y-3 w-full font-brand text-xs sm:text-sm text-center flex flex-col items-center">
              <li className="w-full flex justify-center">
                <a href="https://instagram.com/unhollynails" target="_blank" rel="noopener noreferrer" className="inline-flex justify-center items-center gap-2.5 text-neutral-500 hover:text-[#FF5C9D] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                  <span>Instagram</span>
                </a>
              </li>
              <li className="w-full flex justify-center">
                <a
                  href="https://www.facebook.com/profile.php?id=61575660355121"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex justify-center items-center gap-2.5 text-neutral-500 hover:text-[#1877F2] transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span>Facebook Page</span>
                </a>
              </li>
              <li className="w-full flex justify-center">
                <a href="https://tiktok.com/@unhollynails" target="_blank" rel="noopener noreferrer" className="inline-flex justify-center items-center gap-2.5 text-neutral-500 hover:text-black transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>
                  <span>TikTok</span>
                </a>
              </li>
            </ul>
          </div>
          
        </div>

        <div className="border-t border-pink-100 mt-12 pt-6 flex flex-col justify-center items-center gap-2 text-center">
          <p className="font-brand text-xs text-neutral-400">© {new Date().getFullYear()} UnHolly Nails. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
