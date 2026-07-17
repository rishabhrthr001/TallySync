import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { Camera, X, Upload, AlertCircle, Sparkles, Check, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProductMatch {
  _id: string;
  name: string;
  sku: string;
  rate: number;
  gst: number;
  category: string;
  confidence: number;
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

  const startCamera = async () => {
    try {
      stopCamera();
      const constraints = {
        video: { facingMode: { ideal: facingMode }, width: { ideal: 640 }, height: { ideal: 480 } }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video.play().catch(err => console.error("Error playing video:", err));
        };
      }
      setHasCameraAccess(true);
      setErrorMsg(null);
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
  };

  const resetState = () => {
    setCapturedImage(null);
    setSuggestions([]);
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
  const isConfidenceLow = topMatch && (topMatch.confidence / 100) < threshold;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">AI Product Scanner</h3>
              <p className="text-slate-400 text-xs font-semibold mt-0.5">Scan product package using camera or file upload</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Visual Frame (Camera or Captured Preview) */}
          <div className="relative h-[380px] sm:h-[450px] md:h-[500px] w-full bg-slate-950 rounded-2xl overflow-hidden shadow-inner border border-slate-800 flex items-center justify-center group">
            {capturedImage ? (
              // Captured image preview
              <img src={capturedImage} alt="Captured product" className="w-full h-full object-contain" />
            ) : hasCameraAccess ? (
              // Live camera stream
              <>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {/* Scanner Glowing HUD Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-60 h-40 border-2 border-indigo-400/80 rounded-2xl relative animate-pulse shadow-[0_0_20px_rgba(99,102,241,0.25)]">
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
                    className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
                  >
                    <Camera className="w-4 h-4" /> Capture Photo
                  </button>
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="p-3 rounded-xl bg-slate-800/85 hover:bg-slate-800 text-slate-200 shadow-md cursor-pointer transition-colors"
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
                  className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" /> Retake Photo
                </button>
              )}

              <label className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" /> Upload Image
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>

          {/* Search Loader */}
          {isSearching && (
            <div className="flex flex-col items-center justify-center p-8 space-y-3 bg-slate-50 rounded-2xl border border-slate-100">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Analyzing Image & Extracting Text...</span>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-semibold">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Recognition Results Suggestions */}
          {!isSearching && suggestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">AI Matching Suggestions</h4>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-bold">Threshold {Math.round(threshold * 100)}%</span>
              </div>

              {/* Low Confidence Warning Alert */}
              {isConfidenceLow && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs font-bold shadow-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-500" />
                  <div>
                    <div>No confident match found. Please search manually.</div>
                    <div className="font-normal text-amber-600/90 mt-0.5">Top match confidence ({topMatch?.confidence}%) is below the configured validation requirement ({Math.round(threshold * 100)}%).</div>
                  </div>
                </div>
              )}

              <div className="divide-y divide-slate-150 border border-slate-150 rounded-2xl overflow-hidden shadow-sm bg-white">
                {suggestions.map((match) => (
                  <button
                    key={match._id}
                    onClick={() => {
                      onSelectProduct({ name: match.name, rate: match.rate, gst: match.gst });
                      onClose();
                    }}
                    className="w-full text-left px-5 py-4 hover:bg-indigo-50/50 transition-colors flex justify-between items-center group cursor-pointer"
                  >
                    <div className="flex flex-col min-w-0 pr-4">
                      <span className="font-bold text-slate-800 group-hover:text-indigo-700 truncate text-sm">{match.name}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded tracking-wider">{match.category || 'General'}</span>
                        {match.sku && <span className="text-[10px] text-slate-400 font-mono">SKU: {match.sku}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-700 block font-mono">INR {match.rate}</span>
                        <span className="text-[10px] text-slate-400 block font-semibold">GST {match.gst}%</span>
                      </div>
                      
                      {/* Confidence Score Badge */}
                      <div className="flex items-center gap-2.5">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden hidden sm:block border border-slate-200/50">
                          <div 
                            className={`h-full rounded-full ${match.confidence >= threshold * 100 ? 'bg-emerald-500' : 'bg-amber-400'}`} 
                            style={{ width: `${match.confidence}%` }}
                          />
                        </div>
                        <span className={`text-xs font-black px-2.5 py-1.5 rounded-xl font-mono flex items-center gap-1 ${
                          match.confidence >= threshold * 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {match.confidence}%
                          {match.confidence >= threshold * 100 && <Check className="w-3.5 h-3.5" />}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
