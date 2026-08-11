import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { Camera, X, Upload, AlertCircle, Sparkles, Check, RefreshCw, Box, Tag, Layers, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProductMatch {
  _id: string;
  name: string;
  sku: string;
  rate: number;
  gst: number;
  category: string;
  stock?: number;
  confidence: number;
  isStrongMatch?: boolean;
}

interface DetectedProduct {
  productName: string;
  brand?: string;
  category?: string;
  sku?: string;
  distinctiveFeatures?: string;
}

interface ProductRecognitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: { name: string; rate: number; gst: number }) => void;
}

export default function ProductRecognitionModal({ isOpen, onClose, onSelectProduct }: ProductRecognitionModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCameraAccess, setHasCameraAccess] = useState<boolean | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ProductMatch[]>([]);
  const [detectedProduct, setDetectedProduct] = useState<DetectedProduct | null>(null);
  const [totalInventoryCount, setTotalInventoryCount] = useState<number | null>(null);
  const [threshold, setThreshold] = useState(0.70);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      resetState();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const attachStream = (videoEl: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (videoEl && stream) {
      videoEl.srcObject = stream;
      videoEl.onloadedmetadata = () => {
        videoEl.play().catch(err => console.error("Error playing video:", err));
      };
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('Camera API unavailable (requires HTTPS or supported browser)');
      setHasCameraAccess(false);
      return;
    }

    try {
      stopCamera();
      let stream: MediaStream;
      try {
        const constraints = {
          video: { facingMode: { ideal: facingMode }, width: { ideal: 640 }, height: { ideal: 480 } }
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (fallbackErr) {
        console.warn('Preferred camera constraints failed, attempting fallback constraints:', fallbackErr);
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;
      setHasCameraAccess(true);
      setErrorMsg(null);

      if (videoRef.current) {
        attachStream(videoRef.current, stream);
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable. Falling back to file upload:', err);
      setHasCameraAccess(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const resetState = () => {
    setCapturedImage(null);
    setSuggestions([]);
    setDetectedProduct(null);
    setTotalInventoryCount(null);
    setIsSearching(false);
    setErrorMsg(null);
  };

  const toggleCameraFacing = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedImage(dataUrl);
      searchProduct(dataUrl);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setCapturedImage(reader.result);
        searchProduct(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const searchProduct = async (base64Image: string) => {
    setIsSearching(true);
    setErrorMsg(null);
    setSuggestions([]);
    setDetectedProduct(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        '/api/product-recognition/search',
        { image: base64Image },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data.success) {
        setSuggestions(res.data.matches || []);
        setThreshold(res.data.threshold || 0.70);
        setDetectedProduct(res.data.detectedProduct || null);
        setTotalInventoryCount(res.data.totalInventoryCount ?? null);
      } else {
        setErrorMsg('Failed to process image recognition');
      }
    } catch (err: any) {
      console.error('AI Recognition API Error:', err);
      setErrorMsg(err.response?.data?.error || 'Recognition failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  if (!isOpen) return null;

  const topMatch = suggestions.length > 0 ? suggestions[0] : null;
  const isStrongMatchFound = topMatch && topMatch.confidence >= Math.round(threshold * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">AI Product Camera & Inventory Matcher</h3>
              <p className="text-slate-400 text-xs font-semibold mt-0.5">Capture product photo to identify item and match with your stock inventory</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Visual Frame (Camera or Captured Preview) */}
          <div className="relative h-[320px] sm:h-[380px] w-full bg-slate-950 rounded-3xl overflow-hidden shadow-inner border border-slate-800 flex items-center justify-center group">
            {capturedImage ? (
              // Captured image preview
              <img src={capturedImage} alt="Captured product" className="w-full h-full object-contain" />
            ) : hasCameraAccess ? (
              // Live camera stream
              <>
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && streamRef.current) {
                      attachStream(el, streamRef.current);
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Scanner Glowing HUD Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-64 h-44 border-2 border-indigo-400/80 rounded-2xl relative animate-pulse shadow-[0_0_20px_rgba(99,102,241,0.25)]">
                    {/* Corner decorators */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-indigo-500"></div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-indigo-500"></div>
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-indigo-500"></div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-indigo-500"></div>
                  </div>
                </div>
              </>
            ) : (
              // fallback / access denied
              <div className="text-center p-6 space-y-3">
                <AlertCircle className="w-12 h-12 text-slate-500 mx-auto" />
                <div className="text-sm font-bold text-slate-400">Camera stream unavailable</div>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">Please upload a picture of the product to initiate AI recognition.</p>
              </div>
            )}

            {/* Floating controls in frame */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
              {!capturedImage && hasCameraAccess && (
                <>
                  <button
                    type="button"
                    onClick={handleCapture}
                    className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-xl flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
                  >
                    <Camera className="w-4 h-4" /> Click Photo to Scan
                  </button>
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="p-3 rounded-2xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 shadow-md cursor-pointer transition-colors"
                    title="Switch Camera"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </>
              )}

              {capturedImage && (
                <button
                  type="button"
                  onClick={resetState}
                  className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" /> Retake Photo
                </button>
              )}

              <label className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 cursor-pointer transition-transform active:scale-95">
                <Upload className="w-4 h-4" /> Upload Image
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>

          {/* Search Loader */}
          {isSearching && (
            <div className="flex flex-col items-center justify-center p-8 space-y-3 bg-indigo-50/50 rounded-3xl border border-indigo-100">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              <span className="text-xs font-black text-indigo-900 uppercase tracking-widest">Scanning Image with Gemini AI & Comparing with Inventory...</span>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm font-semibold">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* AI Detected Product Summary Card */}
          {!isSearching && detectedProduct && (
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl shadow-lg border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-black uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  AI Visual Recognition Result
                </div>
                <span className="text-[10px] font-bold bg-white/10 px-3 py-1 rounded-full text-slate-300">
                  Scanned across {totalInventoryCount ?? 0} inventory items
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                  <h4 className="text-xl font-black text-white tracking-tight">{detectedProduct.productName}</h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-300">
                    {detectedProduct.brand && (
                      <span className="bg-white/10 px-2.5 py-0.5 rounded-lg font-bold">Brand: {detectedProduct.brand}</span>
                    )}
                    {detectedProduct.category && (
                      <span className="bg-white/10 px-2.5 py-0.5 rounded-lg font-bold">Category: {detectedProduct.category}</span>
                    )}
                    {detectedProduct.sku && (
                      <span className="bg-white/10 px-2.5 py-0.5 rounded-lg font-mono">SKU: {detectedProduct.sku}</span>
                    )}
                  </div>
                </div>

                {/* Instant 1-click Quick Add to Bill button */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectProduct({
                      name: detectedProduct.productName,
                      rate: topMatch ? topMatch.rate : 0,
                      gst: topMatch ? topMatch.gst : 18
                    });
                    onClose();
                  }}
                  className="px-5 py-3 bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 shrink-0 cursor-pointer transition-all active:scale-95"
                >
                  <ArrowRight className="w-4 h-4" /> Use in Bill
                </button>
              </div>
            </div>
          )}

          {/* Inventory Match Suggestions */}
          {!isSearching && detectedProduct && (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                  <Box className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Inventory Match Results</h4>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold">
                  {suggestions.length > 0 ? `${suggestions.length} item(s) matched` : 'No exact match in stock'}
                </span>
              </div>

              {/* Suggestions List */}
              {suggestions.length > 0 ? (
                <div className="divide-y divide-slate-150 border border-slate-200 rounded-3xl overflow-hidden shadow-sm bg-white">
                  {suggestions.map((match, idx) => {
                    const isHigh = match.confidence >= Math.round(threshold * 100);
                    return (
                      <div
                        key={match._id}
                        className={`p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          idx === 0 && isHigh ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-indigo-50/30'
                        }`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 text-base">{match.name}</span>
                            {idx === 0 && isHigh && (
                              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-full tracking-wider border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Best Inventory Match
                              </span>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-semibold">
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase">{match.category || 'General'}</span>
                            {match.sku && <span className="font-mono">SKU: {match.sku}</span>}
                            <span>Stock: <strong className="text-slate-800">{match.stock ?? 0} pcs</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                          <div className="text-right">
                            <span className="text-sm font-black text-slate-900 font-mono block">₹{match.rate}</span>
                            <span className="text-[10px] text-slate-400 font-bold block">GST {match.gst}%</span>
                          </div>

                          {/* Match Score Badge */}
                          <div className="flex flex-col items-center">
                            <span className={`text-xs font-black px-3 py-1.5 rounded-xl font-mono flex items-center gap-1 border shadow-xs ${
                              isHigh
                                ? 'bg-emerald-500 text-white border-emerald-600'
                                : match.confidence >= 50
                                ? 'bg-amber-500 text-white border-amber-600'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {match.confidence}% Match
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              onSelectProduct({ name: match.name, rate: match.rate, gst: match.gst });
                              onClose();
                            }}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md cursor-pointer transition-all active:scale-95"
                          >
                            Select
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 bg-amber-50/60 border border-amber-200 rounded-3xl text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                  <h5 className="text-sm font-black text-amber-900">Item is not currently in your Inventory</h5>
                  <p className="text-xs text-amber-700 max-w-md mx-auto">
                    AI identified this product as <strong className="text-slate-900">{detectedProduct.productName}</strong>. You can click <strong>"Use in Bill"</strong> above to insert it into your invoice directly.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

