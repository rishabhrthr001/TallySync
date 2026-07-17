import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  FileText, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  Shield, 
  BarChart3,
  ChevronRight,
  Sparkles,
  Server,
  CloudLightning
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans overflow-x-hidden selection:bg-indigo-500 selection:text-white grid-bg">
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-[800px] left-0 w-[400px] h-[400px] bg-violet-500/5 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/70 backdrop-blur-md border-b border-slate-200/50 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/20">
              <FileText className="text-white w-5 h-5" />
            </div>
            <span className="font-black text-xl tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">PhotoBill</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-500">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-indigo-600 transition-colors">How it Works</a>
            <a href="#requirements" className="hover:text-indigo-600 transition-colors">Requirements</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">
              Sign In
            </Link>
            <Link to="/signup" className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-slate-900 hover:shadow-lg hover:shadow-indigo-500/10 transition-all active:scale-95">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-36 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-50/80 border border-indigo-100/50 text-indigo-600 text-xs font-black uppercase tracking-widest rounded-full mb-6 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              AI-Powered Invoicing & Product Recognition
            </span>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 mb-8 leading-[1.08]">
              Create Invoice Bills <br />
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 bg-clip-text text-transparent">instantly with AI.</span>
            </h1>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
              Eliminate manual typing. PhotoBill enables your billing and inventory entries 
              to be generated instantly with full GST validation and zero manual hassle.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup" className="w-full sm:w-auto px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-slate-900 hover:shadow-xl hover:shadow-indigo-500/10 transition-all flex items-center justify-center gap-2 group active:scale-95">
                Get Started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/login" className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95">
                View Demo
              </Link>
            </div>
          </motion.div>

          {/* Premium UI Mockup Widget */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="mt-20 relative max-w-5xl mx-auto"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-violet-500/5 blur-[100px] -z-10 rounded-full" />
            <div className="bg-slate-900 rounded-[2rem] border border-slate-800 shadow-[0_30px_100px_rgba(15,23,42,0.3)] overflow-hidden">
              {/* Mockup Title bar */}
              <div className="bg-slate-950/80 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-800" />
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-800" />
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-800" />
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg py-1 px-4 text-[10px] text-slate-500 font-mono inline-block w-80 truncate">
                  https://app.photobill.com/dashboard
                </div>
                <div className="w-8" />
              </div>
              {/* Inner content grid simulating the dashboard */}
              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-left bg-gradient-to-b from-slate-900 to-slate-950">
                {/* Panel 1 */}
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800/60 space-y-4">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Live Billing Stream</span>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-slate-800/50">
                      <div>
                        <p className="text-xs font-bold text-slate-200">ABC Enterprises</p>
                        <p className="text-[10px] text-slate-500">Sales Invoice #INV-9241</p>
                      </div>
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">Success</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-slate-800/50">
                      <div>
                        <p className="text-xs font-bold text-slate-200">Kamal Distributors</p>
                        <p className="text-[10px] text-slate-500">Purchase Invoice #KB-762</p>
                      </div>
                      <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">Pending</span>
                    </div>
                  </div>
                </div>

                {/* Panel 2 */}
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800/60 space-y-4 md:col-span-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Monthly Billing Metrics</span>
                    <span className="text-xs text-indigo-400 font-bold">Live Status</span>
                  </div>
                  <div className="h-32 flex items-end gap-3.5 pt-4">
                    {[30, 45, 35, 60, 50, 75, 90, 85, 95].map((val, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <div 
                          className="w-full rounded-t-md bg-gradient-to-t from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/20"
                          style={{ height: `${val}%` }}
                        />
                        <span className="text-[9px] text-slate-500 font-mono">M{idx+1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* AI Recognition Scanner Requirements Section */}
      <section id="requirements" className="py-28 bg-white border-y border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-5">
              <h2 className="text-4xl font-black text-slate-900 mb-6 leading-tight">
                Scan. Recognize. <br />
                <span className="text-indigo-600">Populate Instantly.</span>
              </h2>
              <p className="text-slate-500 text-lg mb-8 leading-relaxed font-medium">
                To guarantee zero errors, we map your physical inventory to digital catalog items using state-of-the-art vision models.
              </p>
              <ul className="space-y-4">
                {[
                  "Take photo or upload item image",
                  "Auto-match with inventory via CLIP embeddings",
                  "Confidence scoring with manual override",
                  "Extract product codes/details via OCR",
                  "Tax Split Calculations (CGST, SGST, IGST)",
                  "Audit Narration Logs"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-700 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-7 bg-slate-950 rounded-[2.5rem] p-8 text-white shadow-2xl border border-slate-800">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-800/60">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="ml-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">AI Scanner Recognition Output</span>
              </div>
              <pre className="font-mono text-[11px] text-slate-400 leading-relaxed overflow-x-auto p-4 bg-slate-900/30 rounded-2xl max-h-96">
{`{
  "detected_text": "iPhone 12 Red 128GB",
  "ocr_match": "IPHONE-12-RED",
  "embeddings_similarity": 0.962,
  "confidence_rating": "96%",
  "matched_product": {
    "name": "iPhone 12 (Red)",
    "sku": "IPHONE-12-RED",
    "price": "INR 54,000",
    "gst_treatment": "18% CGST/SGST"
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-28 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">System Architecture</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-4 mb-3">Engineered for Accuracy</h2>
            <p className="text-slate-500 font-semibold text-sm">Automate details without losing control of your books.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={CloudLightning} 
              title="Instant Invoicing" 
              description="Entries are processed immediately, creating beautiful print-ready invoice profiles."
            />
            <FeatureCard 
              icon={Shield} 
              title="GST Auto-Treatment" 
              description="Our system reads party state codes to apply CGST/SGST or IGST treatments automatically."
            />
            <FeatureCard 
              icon={Server} 
              title="AI Image Matchmaker" 
              description="Automatically match captured pictures with inventory using local OpenCLIP embeddings."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-[2.5rem] p-12 text-center text-white relative overflow-hidden shadow-2xl shadow-indigo-500/20 border border-indigo-500/30">
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 blur-[90px] -mr-32 -mt-32 rounded-full" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-black mb-6">Ready to automate your billing?</h2>
              <p className="text-indigo-100 text-lg mb-10 max-w-xl mx-auto font-medium">
                Connect your business profile, provision clients, and start compiling entries.
              </p>
              <Link to="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-indigo-600 font-bold rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-lg active:scale-95">
                Get Started Now
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200/50 bg-white/40">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <FileText className="text-white w-4 h-4" />
            </div>
            <span className="font-black text-lg tracking-tight">PhotoBill</span>
          </div>
          <p className="text-slate-400 text-xs font-semibold">© {new Date().getFullYear()} PhotoBill. All rights reserved.</p>
          <div className="flex gap-6 text-xs font-bold text-slate-400">
            <a href="#" className="hover:text-indigo-600">Privacy</a>
            <a href="#" className="hover:text-indigo-600">Terms</a>
            <a href="#" className="hover:text-indigo-600">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: any) {
  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200/60 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group">
      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-3 group-hover:text-indigo-600 transition-colors">{title}</h3>
      <p className="text-slate-500 leading-relaxed text-sm font-medium">{description}</p>
    </div>
  );
}

