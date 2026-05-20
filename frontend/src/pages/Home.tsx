import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  FileText, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  Shield, 
  BarChart3,
  ChevronRight
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-neutral-100 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <FileText className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">PhotoBill</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-indigo-600 transition-colors">How it Works</a>
            <a href="#requirements" className="hover:text-indigo-600 transition-colors">Requirements</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition-colors">
              Sign In
            </Link>
            <Link to="/signup" className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-full hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-widest rounded-full mb-6">
              Automated Accounting for Tally ERP & Prime
            </span>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-neutral-900 mb-8 leading-[1.1]">
              Submit your Tally entries <br />
              <span className="text-indigo-600">from anywhere, instantly.</span>
            </h1>
            <p className="text-xl text-neutral-500 max-w-2xl mx-auto mb-10 leading-relaxed">
              No more manual data entry. PhotoBill allows your team to submit sales and purchase vouchers 
              directly into your Tally system with full GST compliance.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup" className="w-full sm:w-auto px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 group shadow-xl shadow-indigo-500/20">
                Start Syncing
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/login" className="w-full sm:w-auto px-8 py-4 bg-white text-neutral-900 font-bold rounded-2xl border border-neutral-200 hover:bg-neutral-50 transition-all">
                View Demo
              </Link>
            </div>
          </motion.div>

          {/* Hero Image / Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="mt-20 relative"
          >
            <div className="absolute inset-0 bg-indigo-500/10 blur-[120px] -z-10 rounded-full max-w-4xl mx-auto" />
            <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden max-w-5xl mx-auto">
              <div className="bg-neutral-50 border-b border-neutral-200 px-6 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 text-center">
                  <div className="bg-white border border-neutral-200 rounded-md py-1 px-4 text-[10px] text-neutral-400 inline-block w-64">
                    app.photobill.com/dashboard
                  </div>
                </div>
              </div>
              <img 
                src="https://picsum.photos/seed/accounting-data/1200/800" 
                alt="Accounting Dashboard" 
                className="w-full opacity-90"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tally Entry Requirements Section */}
      <section id="requirements" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-neutral-900 mb-6">What do you need for a <span className="text-indigo-600">Proper Tally Entry?</span></h2>
              <p className="text-neutral-500 text-lg mb-8 leading-relaxed">
                To ensure your entries are perfectly synced and GST compliant, we collect all essential data points required by Tally ERP 9 and Tally Prime.
              </p>
              <ul className="space-y-4">
                {[
                  "Voucher Type (Sales, Purchase, Payment, Receipt)",
                  "Party Ledger Name (Customer or Supplier)",
                  "GSTIN Number for B2B Transactions",
                  "Item Details or Service Description",
                  "Taxable Amount & GST Rates (CGST, SGST, IGST)",
                  "Narration for Audit Trail"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-neutral-700 font-medium">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-neutral-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
              <div className="flex items-center gap-2 mb-8">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="ml-2 text-xs font-mono text-neutral-500 uppercase tracking-widest">Tally XML Preview</span>
              </div>
              <pre className="font-mono text-[10px] md:text-xs text-indigo-300 leading-relaxed overflow-x-auto">
{`<!-- PhotoBill Generated Voucher -->
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE>
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>20260322</DATE>
            <PARTYLEDGERNAME>ABC Enterprises</PARTYLEDGERNAME>
            <GSTIN>27AAABC1234A1Z5</GSTIN>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <AMOUNT>-5000.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-4">Built for Modern Businesses</h2>
            <p className="text-neutral-500">Everything you need to manage your accounting workflow.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Zap} 
              title="Real-time Sync" 
              description="Entries are queued and synced to Tally automatically as soon as they are approved."
            />
            <FeatureCard 
              icon={Shield} 
              title="Secure & Reliable" 
              description="Bank-grade encryption for all your financial data and secure JWT authentication."
            />
            <FeatureCard 
              icon={BarChart3} 
              title="Advanced Analytics" 
              description="Get insights into your sales and purchases with our intuitive dashboard."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-indigo-600 rounded-[2rem] p-12 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[80px] -mr-32 -mt-32 rounded-full" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to automate your Tally?</h2>
              <p className="text-indigo-100 text-lg mb-10 max-w-xl mx-auto">
                Join hundreds of businesses saving hours every week on manual data entry.
              </p>
              <Link to="/signup" className="inline-flex items-center gap-2 px-10 py-4 bg-white text-indigo-600 font-bold rounded-2xl hover:bg-indigo-50 transition-all shadow-xl shadow-black/10">
                Get Started Now
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-neutral-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
              <FileText className="text-white w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight">PhotoBill</span>
          </div>
          <p className="text-neutral-400 text-sm">© 2026 PhotoBill Automation. All rights reserved.</p>
          <div className="flex gap-6 text-sm font-medium text-neutral-500">
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
    <div className="bg-white p-8 rounded-3xl border border-neutral-200 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group">
      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-xl font-bold text-neutral-900 mb-3">{title}</h3>
      <p className="text-neutral-500 leading-relaxed">{description}</p>
    </div>
  );
}
