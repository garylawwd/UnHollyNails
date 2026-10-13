export default function ContactPage() {
  return (
    <div className="min-h-[80vh] bg-[#FFF5F8] text-black">
      <div className="max-w-3xl mx-auto px-4 py-20">
        <h1 className="text-4xl font-black uppercase tracking-widest mb-8 text-center">Contact & Inquiries</h1>
        
        <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-xl border border-pink-100 text-center">
          <p className="text-neutral-600 mb-8 leading-relaxed max-w-xl mx-auto text-sm sm:text-base">
            Have a question about a custom order, sizing, or an existing request? Because I handcraft every single set myself, the fastest way to chat with me is through direct message on Instagram or Facebook!
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10 max-w-lg mx-auto">
            {/* Instagram Button */}
            <a 
              href="https://instagram.com/unhollynails" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-3 bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 text-white px-8 py-4 rounded-full font-bold uppercase tracking-wider text-xs sm:text-sm hover:opacity-90 hover:scale-105 transition-all shadow-lg shadow-pink-500/25"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              DM on Instagram
            </a>

            {/* Facebook Button */}
            <a 
              href="https://www.facebook.com/profile.php?id=61575660355121" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-3 bg-gradient-to-tr from-[#1877F2] via-blue-600 to-[#00C6FF] text-white px-8 py-4 rounded-full font-bold uppercase tracking-wider text-xs sm:text-sm hover:opacity-90 hover:scale-105 transition-all shadow-lg shadow-blue-500/25"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Message on Facebook
            </a>
          </div>
          
          <div className="border-t border-neutral-100 pt-8 mt-4">
            <h3 className="font-bold mb-1 text-sm text-neutral-800">Business & Custom Inquiries</h3>
            <p className="text-neutral-500 text-xs sm:text-sm">
              Prefer email? You can reach me directly at:<br/>
              <a href="mailto:unhollynails@gmail.com" className="text-pink-500 font-bold hover:underline inline-block mt-1">unhollynails@gmail.com</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
