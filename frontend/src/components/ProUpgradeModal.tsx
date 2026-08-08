import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Lock, Zap, Sparkles, Shield, Camera, FileText, ArrowRight } from 'lucide-react';

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export default function ProUpgradeModal({
  isOpen,
  onClose,
  title = "Unlock Full Potential with Pro Package",
  subtitle = "Upgrade to Pro (₹299/mo) or contact Pankaj for a 30-Day Free Trial"
}: ProUpgradeModalProps) {
  if (!isOpen) return null;

  const featureList = [
    { name: 'Daily Bill Creation Limit', free: '5 Bills / Day', pro: 'Unlimited Bills', icon: FileText, highlight: true },
    { name: 'Tally ERP Sync Engine', free: 'Included', pro: 'Included', icon: Zap },
    { name: 'Govt E-Way Bill Direct Portal', free: 'Included', pro: 'Included', icon: Shield },
    { name: 'AI Product Camera Scanner', free: '🔒 Locked', pro: '⚡ Unlocked', icon: Camera, isLocked: true },
    { name: 'AI PDF Invoice & Bill Parser', free: '🔒 Locked', pro: '⚡ Unlocked', icon: Sparkles, isLocked: true },
    { name: 'AI Bank Statement PDF Parser', free: '🔒 Locked', pro: '⚡ Unlocked', icon: FileText, isLocked: true },
    { name: 'Multi-device & Priority Support', free: 'Standard', pro: '⚡ Priority Support', icon: Shield }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-8"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-8 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex justify-between items-start relative z-10">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black uppercase rounded-full tracking-wider mb-2">
                  <Zap className="w-3 h-3 text-emerald-400" /> Pro Feature Access
                </span>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight">{title}</h3>
                <p className="text-indigo-200/90 text-xs font-semibold mt-1 max-w-md">{subtitle}</p>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Price Badge */}
            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-4xl font-black font-mono text-emerald-400">₹299</span>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">/ month</span>
              <span className="ml-auto text-[10px] font-black uppercase tracking-wider bg-amber-400/20 border border-amber-400/30 text-amber-300 px-3 py-1 rounded-xl">
                🎁 30-Day Free Trial Available
              </span>
            </div>
          </div>

          {/* Feature Comparison Table */}
          <div className="p-6 sm:p-8 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">Feature Comparison Matrix</h4>

            <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200/80 p-3.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <div className="col-span-6">Feature</div>
                <div className="col-span-3 text-center">Free Tier</div>
                <div className="col-span-3 text-center text-indigo-700 font-extrabold">Pro Package</div>
              </div>

              <div className="divide-y divide-slate-100 bg-white">
                {featureList.map((item, idx) => (
                  <div key={idx} className={`grid grid-cols-12 p-3.5 text-xs items-center ${item.highlight ? 'bg-indigo-50/30' : ''}`}>
                    <div className="col-span-6 font-bold text-slate-800 flex items-center gap-2">
                      <item.icon className={`w-4 h-4 shrink-0 ${item.isLocked ? 'text-rose-500' : 'text-indigo-600'}`} />
                      <span>{item.name}</span>
                    </div>
                    <div className="col-span-3 text-center font-semibold text-slate-500 text-[11px]">
                      {item.free}
                    </div>
                    <div className="col-span-3 text-center font-black text-emerald-600 text-[11px]">
                      {item.pro}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 space-y-3">
              <a
                href="mailto:pankaj@photoBill.com?subject=30-Day%20Free%20Trial%20/%20Pro%20Upgrade%20Request"
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                Contact Pankaj (Super Admin) for 30-Day Trial <ArrowRight className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Continue on Free Tier
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
