"use client";

import Link from "next/link";
import { useEffect } from "react";
import confetti from "canvas-confetti";

export default function CheckoutSuccessPage() {
  useEffect(() => {
    // Trigger a soft pink confetti pop!
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#ffb6c1', '#ff69b4', '#ff1493', '#ffffff']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#ffb6c1', '#ff69b4', '#ff1493', '#ffffff']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  return (
    <div className="min-h-[80vh] flex-grow bg-[#FFF5F8] flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-white p-10 sm:p-14 rounded-[3rem] shadow-2xl max-w-lg w-full border border-pink-100 relative overflow-hidden">
        {/* Decorative background circle */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-pink-50 rounded-full blur-3xl -z-10"></div>
        
        <div className="w-24 h-24 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-pink-200">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="white" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-black text-black mb-4 uppercase tracking-wider">Request Received!</h1>
        <p className="text-neutral-500 mb-10 leading-relaxed font-medium">
          Your order request is safely received! I will slide into your DMs (or inbox) shortly to confirm your custom design details and organize payment.
        </p>
        
        <Link 
          href="/" 
          className="inline-block w-full bg-black text-white py-4 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-neutral-800 transition-colors shadow-md"
        >
          Return to Store
        </Link>
      </div>
    </div>
  );
}
