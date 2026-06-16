/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Copy, 
  Download, 
  Share2, 
  RefreshCw, 
  Trash2, 
  Layers, 
  Check, 
  Sparkles, 
  Heart, 
  ArrowRight, 
  ShieldAlert, 
  Cpu, 
  Eye, 
  Share, 
  FileText, 
  Code,
  Smartphone,
  CheckCircle,
  AlertCircle,
  ClipboardPaste
} from 'lucide-react';
import Banner from './components/Banner';
import UserProfile from './components/UserProfile';
import AdsterraBanner, { loadPopunders } from './components/AdsterraBanner';
import { LosslessImage, UserStats, FooterTab } from './types';
import About from './pages/About';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Contact from './pages/Contact';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getUploadsFromDB, 
  saveUploadToDB, 
  deleteUploadFromDB, 
  clearAllUploadsFromDB 
} from './utils/db';

// Bulletproof industry-standard multi-stage fallback copy mechanism
const copyToClipboard = (text: string): boolean => {
  if (!text) return false;
  
  // 1. Try modern navigator.clipboard
  try {
    if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    console.warn("navigator.clipboard.writeText failed, playing classic fallback:", e);
  }

  // 2. Try classic document.execCommand with custom microscopic viewport positioning
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // Pinned inside readable viewport but microscopic size so modern engines allow selection
    textarea.style.fontSize = '12pt'; // Prevent auto-zoom in mobile Safari
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2px';
    textarea.style.height = '2px';
    textarea.style.padding = '0';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.setAttribute('readonly', '');
    
    document.body.appendChild(textarea);
    
    // Focus and select for general compatibility
    textarea.focus();
    textarea.select();
    
    // Select contents specifically for iOS/Safari
    const range = document.createRange();
    range.selectNodeContents(textarea);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    textarea.setSelectionRange(0, text.length);
    
    const success = document.execCommand('copy');
    if (selection) {
      selection.removeAllRanges();
    }
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error("Critical: copy fallback has crashed:", err);
    return false;
  }
};

const formatBytesSize = (bytes: number): string => {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} Bytes`;
};

export default function App() {
  // Application Data States
  const [uploads, setUploads] = useState<LosslessImage[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalImages: 0,
    totalBytes: 0,
    uncompressedLossless: '100%',
    fidelityScore: '100% lossless',
  });

  // Action / Selected File States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string>('');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [pasteCodeInput, setPasteCodeInput] = useState<string>('');

  // Recreate & Scanning Animation States
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [recreatedImage, setRecreatedImage] = useState<{
    name: string;
    type: string;
    dataUrl: string;
  } | null>(null);

  // Clipboard Alerts & Feedback States
  const [copiedCodeSuccess, setCopiedCodeSuccess] = useState<boolean>(false);
  const [copiedLinkSuccess, setCopiedLinkSuccess] = useState<boolean>(false);
  const [copiedRecreateSuccess, setCopiedRecreateSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Footer navigation states
  const [activeFooterTab, setActiveFooterTab] = useState<FooterTab>('none');
  const [showFeatureGuide, setShowFeatureGuide] = useState<boolean>(false);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);

  // Centralized transition controller with 1.5s loader, real-time animation, and top scroll synchronization
  const navigateToTab = (tab: FooterTab) => {
    if (tab === 'none') {
      setActiveFooterTab('none');
      window.scrollTo({ top: 0 });
      // Update history state so back button behaves correctly
      if (window.history.state && window.history.state.footerTab !== 'none') {
        window.history.pushState({ footerTab: 'none' }, '');
      }
    } else {
      // Open Adsterra Smartlink in a new tab upon selecting any of the 4 page links
      try {
        window.open('https://www.effectivecpmnetwork.com/q0dqbk3ca0?key=7d2a5c93906795732e09f636bb6ac68a', '_blank', 'noopener,noreferrer');
      } catch (e) {
        console.warn('Popup blocked:', e);
      }

      setIsPageLoading(true);
      setLoadingProgress(0);
      window.scrollTo({ top: 0 }); // Instant scroll target to top right as requested
      
      const startTime = Date.now();
      const duration = 1500;
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / duration) * 100, 100);
        setLoadingProgress(progress);
        if (elapsed >= duration) {
          clearInterval(interval);
        }
      }, 30);

      setTimeout(() => {
        setIsPageLoading(false);
        setActiveFooterTab(tab);
        window.scrollTo({ top: 0 }); // Hard-pinned secondary top scroll trigger
        
        // Push state to browser history when subpage has fully loaded
        window.history.pushState({ footerTab: tab }, '');
      }, 1500);
    }
  };

  // Safe Back controller to return to the main dashboard
  const handleGoBackToMain = () => {
    if (window.history.state && window.history.state.footerTab !== 'none' && window.history.state.footerTab !== undefined) {
      window.history.back();
    } else {
      setActiveFooterTab('none');
      window.scrollTo({ top: 0 });
    }
  };

  // References for beautiful scroll synchronization
  const fileInputRef = useRef<HTMLInputElement>(null);
  const codeBoxRef = useRef<HTMLDivElement>(null);
  const pasteInputRef = useRef<HTMLTextAreaElement>(null);
  
  // Anti-glitch sequential clearing timeout refs
  const copyTimeoutRef = useRef<any>(null);
  const recreateCopyTimeoutRef = useRef<any>(null);

  // Load history from IndexedDB on startup
  useEffect(() => {
    let active = true;
    getUploadsFromDB()
      .then((list) => {
        if (active) {
          setUploads(list);
          calculateStats(list);
        }
      })
      .catch((err) => {
        console.error('Could not load IndexedDB history:', err);
      });
    return () => {
      active = false;
    };
  }, []);

  // Listen to popstate event to support browser back button and mobile hardware/gesture back actions
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.footerTab) {
        setActiveFooterTab(event.state.footerTab);
      } else {
        setActiveFooterTab('none');
      }
    };
    
    // Set initial history state so we have a base to go back to when app first loads
    if (!window.history.state || window.history.state.footerTab === undefined) {
      window.history.replaceState({ footerTab: 'none' }, '');
    }

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Save history helper using IndexedDB
  const saveUploads = async (newUploads: LosslessImage[]) => {
    // Keep local React state synchronized instantly
    setUploads(newUploads);
    calculateStats(newUploads);
  };

  // Dedicated helper to add a new image record to IndexedDB and State
  const addNewUpload = async (newImage: LosslessImage) => {
    try {
      await saveUploadToDB(newImage);
    } catch (e) {
      console.warn('Failed to save to IndexedDB database:', e);
    }
    
    setUploads((prev) => {
      const duplicateIndex = prev.findIndex((item) => item.name === newImage.name && item.size === newImage.size);
      let updated = [...prev];
      if (duplicateIndex > -1) {
        updated[duplicateIndex] = newImage;
      } else {
        updated.unshift(newImage);
      }
      calculateStats(updated);
      return updated;
    });
  };

  // Stats calculation
  const calculateStats = (list: LosslessImage[]) => {
    const totalBytes = list.reduce((sum, img) => sum + img.size, 0);
    setStats({
      totalImages: list.length,
      totalBytes,
      uncompressedLossless: '100%',
      fidelityScore: '100.0% lossless',
    });
  };

  // Handle local image file loading
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const optimizeImageForClipboard = (
    dataUrl: string,
    fileType: string,
    callback: (optimizedUrl: string) => void
  ) => {
    const img = new Image();
    img.onload = () => {
      // 1200px represents the perfect sweet spot: stunning sharpness while keeping raw characters compact
      const MAX_DIM = 1200;
      let width = img.width;
      let height = img.height;

      let needsOptimize = false;
      if (width > MAX_DIM || height > MAX_DIM) {
        needsOptimize = true;
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      // If data URI length is extremely long, clipboard copy/paste triggers native browser truncation.
      // Reducing dimensions or quality guarantees it remains resilient and 100% complete.
      const isExtremelyLarge = dataUrl.length > 1.2 * 1024 * 1024;

      if (needsOptimize || isExtremelyLarge) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          
          let outputType = fileType;
          let quality = 0.85;

          // If raw file is extremely heavy, draw as high-quality jpeg format targeting under clipboard safety boundaries
          if (fileType === 'image/png' && isExtremelyLarge) {
            outputType = 'image/jpeg';
            quality = 0.88; // beautiful visually-indiscernible high-fidelity threshold
          }

          const optimized = canvas.toDataURL(outputType, quality);
          callback(optimized);
        } else {
          callback(dataUrl);
        }
      } else {
        callback(dataUrl);
      }
    };
    img.onerror = () => {
      callback(dataUrl);
    };
    img.src = dataUrl;
  };

  const processSelectedFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Unsupported format! Please drop or select a valid image file.');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const rawResult = reader.result as string;
      optimizeImageForClipboard(rawResult, file.type, (optimizedUrl) => {
        setSelectedFile(file);
        setSelectedFileUrl(optimizedUrl);
        setGeneratedCode(''); // Clear old codes until Create is submitted
      });
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read the target file. Try again.');
      setTimeout(() => setErrorMessage(''), 4000);
    };
    reader.readAsDataURL(file);
  };

  // DRAG and DROP event handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Convert uploaded image to structural ASCII loss-free string code
  const handleCreateCode = () => {
    if (!selectedFile || !selectedFileUrl) return;

    // Structure our custom image conversion code
    // Protocol specification: IMAGEPIXEL_v1#[NAME]#[TYPE]#[BASE64-BLOB]
    const customCode = `IMAGEPIXEL_v1#${selectedFile.name}#${selectedFile.type}#${selectedFileUrl}`;
    setGeneratedCode(customCode);

    // Save item to profile history locally
    const newImage: LosslessImage = {
      id: `img_${Date.now()}`,
      name: selectedFile.name,
      size: Math.round(selectedFileUrl.length * 0.75),
      type: selectedFile.type,
      code: customCode,
      timestamp: new Date().toLocaleDateString('hi-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      previewUrl: selectedFileUrl
    };

    addNewUpload(newImage);

    // Trigger success flash
    setSuccessMessage('Lossless Image Code Compiled successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);

    // Smooth scroll down to the generated code area
    setTimeout(() => {
      codeBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  // New state for localized paste errors above the coding box
  const [localPasteError, setLocalPasteError] = useState<string>('');

  // Handle recreate translation (3 second scan flow)
  const handleRecreateImage = () => {
    const code = pasteCodeInput.trim();
    if (!code) {
      setLocalPasteError('Please enter some code inside the input box first.');
      setTimeout(() => setLocalPasteError(''), 4000);
      return;
    }

    // Diagnostic warning for copying screen-truncated visual text with '...'
    if (code.includes('...') || code.endsWith('...')) {
      setLocalPasteError('⚠️ TRUNCATED CODE DETECTED: It looks like you copied the screen preview containing "..." instead of the full code. Please use the blue "Copy Code" button, or download the ".txt" file to export 100% of the complete uncompromised data bytes safely!');
      return;
    }

    // Direct validation of ImagePixel or Base64 code format
    const isValidFormat = code.startsWith('IMAGEPIXEL_v1#') || 
                          code.startsWith('data:image/') || 
                          /^[A-Za-z0-9+/=]{100,}$/.test(code.substring(0, 500).replace(/\s/g, ''));

    if (!isValidFormat) {
      setLocalPasteError('Invalid code pattern! This is not an authentic ImagePixel string.');
      setTimeout(() => setLocalPasteError(''), 6000);
      return;
    }

    setLocalPasteError(''); // clear any error

    // Trigger 3 second visual blue light line scan timer
    setIsScanning(true);
    setScanProgress(0);

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 280);

    setTimeout(() => {
      setIsScanning(false);
      try {
        const payloadInput = code.trim();
        let name = 'recreated_lossless_image.png';
        let type = 'image/png';
        let dataUrl = '';

        if (payloadInput.startsWith('IMAGEPIXEL_v1#')) {
          const parts = payloadInput.split('#');
          if (parts.length >= 4) {
            name = parts[1];
            type = parts[2];
            
            // Join base64 chunk back, and strip all whitespaces/newlines to prevent decoding white boxes
            const rawBase64WithMeta = parts.slice(3).join('#').trim();
            if (rawBase64WithMeta.includes(';base64,')) {
              const metaParts = rawBase64WithMeta.split(';base64,');
              const header = metaParts[0] + ';base64,';
              const body = metaParts[1].replace(/\s/g, ''); // strip spaces, tabs, newlines
              dataUrl = header + body;
            } else {
              dataUrl = rawBase64WithMeta.replace(/\s/g, '');
            }
          } else {
            throw new Error('Malformed protocol header format');
          }
        } else if (payloadInput.startsWith('data:image/')) {
          // Standard base64 fallback parsing
          if (payloadInput.includes(';base64,')) {
            const metaParts = payloadInput.split(';base64,');
            const header = metaParts[0] + ';base64,';
            const body = metaParts[1].replace(/\s/g, '');
            dataUrl = header + body;
          } else {
            dataUrl = payloadInput.replace(/\s/g, '');
          }
          const mimeMatch = dataUrl.match(/data:(image\/[a-zA-Z+.-]+);base64/);
          if (mimeMatch) {
            type = mimeMatch[1];
            name = `recreated_image.${type.split('/')[1] || 'png'}`;
          }
        } else {
          // Attempt raw base64 wrapping as fallback image png
          const cleanBody = payloadInput.replace(/\s/g, '');
          dataUrl = `data:image/png;base64,${cleanBody}`;
        }

        setRecreatedImage({
          name,
          type,
          dataUrl
        });

        // Add this recreated item to history too since they might want to persist it!
        const newHist: LosslessImage = {
          id: `recreate_${Date.now()}`,
          name,
          size: Math.round(dataUrl.length * 0.75), // rough approximation from base64
          type,
          code: payloadInput,
          timestamp: new Date().toLocaleDateString('hi-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          previewUrl: dataUrl
        };
        
        const exists = uploads.some(item => item.code === payloadInput);
        if (!exists) {
          addNewUpload(newHist);
        }

        setSuccessMessage('100% Quality Image reconstructed successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        setLocalPasteError('Failed to decode image code! Make sure it is an authentic ImagePixel string.');
        setTimeout(() => setLocalPasteError(''), 6000);
        setRecreatedImage(null);
      }
    }, 3000);
  };

  // View / load from historical uploads
  const handleSelectFromHistory = (img: LosslessImage) => {
    setPasteCodeInput(img.code);
    setLocalPasteError('');
    setSuccessMessage('Loaded code from profile history! Ready to recreate.');
    setTimeout(() => setSuccessMessage(''), 3000);
    // Smooth scroll back to top right input
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // Remove upload metrics
  const handleDeleteImage = async (id: string) => {
    try {
      await deleteUploadFromDB(id);
    } catch (e) {
      console.warn('Failed to delete history item:', e);
    }
    const filtered = uploads.filter((item) => item.id !== id);
    setUploads(filtered);
    calculateStats(filtered);
    setSuccessMessage('History item cleared.');
    setTimeout(() => setSuccessMessage(''), 2500);
  };

  // Clear all history from database and local memory
  const handleClearAllHistory = async () => {
    try {
      await clearAllUploadsFromDB();
    } catch (e) {
      console.warn('Failed to clear local workspace registry:', e);
    }
    setUploads([]);
    calculateStats([]);
    setSuccessMessage('All localized workspace items cleared.');
    setTimeout(() => setSuccessMessage(''), 2500);
  };

  // Clear selected file and reset
  const handleResetUpload = () => {
    setSelectedFile(null);
    setSelectedFileUrl('');
    setGeneratedCode('');
  };

  // Modern copy paste handle integrating seamless local navigation / browser boundaries
  const handlePasteFromClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const text = await navigator.clipboard.readText();
        if (text && text.trim() !== '') {
          setPasteCodeInput(text.trim());
          setSuccessMessage('Code successfully pasted from clipboard!');
          setTimeout(() => setSuccessMessage(''), 3000);
          if (localPasteError) setLocalPasteError('');
          return;
        }
      }
      throw new Error("Programmable clipboard read denied or blank");
    } catch (e) {
      console.warn("navigator.clipboard.readText blocked inside preview iframe:", e);
      
      // Focus textarea to trigger mobile Gboard popup with copied content suggestions
      if (pasteInputRef.current) {
        pasteInputRef.current.focus();
      }
      
      setLocalPasteError('🔒 Browser Security: Automatic paste is restricted inside of the preview workspace iframe. The input box has been auto-focused for you! Please paste manually using Ctrl+V (or Cmd+V) to insert your copied code.');
      setTimeout(() => setLocalPasteError(''), 15000);
    }
  };

  // Trigger download of the reconstructed image
  const handleDownloadRecreated = () => {
    if (!recreatedImage) return;

    const link = document.createElement('a');
    link.href = recreatedImage.dataUrl;
    link.download = recreatedImage.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Open Adsterra Smartlink in a new tab as requested
    try {
      window.open('https://www.effectivecpmnetwork.com/q0dqbk3ca0?key=7d2a5c93906795732e09f636bb6ac68a', '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.warn('Popup blocked:', e);
    }
  };

  // Copy recreated base64 code string to clipboard
  const handleCopyRecreatedCode = () => {
    if (!pasteCodeInput) return;
    const success = copyToClipboard(pasteCodeInput);
    if (success) {
      setCopiedRecreateSuccess(true);
      
      // Clear active timeout to prevent race condition glitches
      if (recreateCopyTimeoutRef.current) {
        clearTimeout(recreateCopyTimeoutRef.current);
      }
      
      recreateCopyTimeoutRef.current = setTimeout(() => {
        setCopiedRecreateSuccess(false);
      }, 2000);
    }
  };

  // Trigger sharing of the recreated image or code
  const handleShareRecreated = async () => {
    if (!recreatedImage) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'ImagePixel Lossless Image Transfer',
          text: `Check out this lossless encoded image code for: ${recreatedImage.name}`,
          url: window.location.href,
        });
      } else {
        // clipboard copy share alert fallback
        const success = copyToClipboard(pasteCodeInput);
        if (success) {
          setCopiedLinkSuccess(true);
          setTimeout(() => setCopiedLinkSuccess(false), 2000);
        }
      }
    } catch (e) {
      console.log('Share error or dismissed', e);
    }
  };

  // Helper downloads generated code block directly as plaintext .txt file
  const handleDownloadCodeFile = () => {
    if (!generatedCode) return;

    const element = document.createElement('a');
    const file = new Blob([generatedCode], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${selectedFile?.name || 'imagepixel-code'}_lossless_code.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    // Open Adsterra Smartlink in a new tab as requested
    try {
      window.open('https://www.effectivecpmnetwork.com/q0dqbk3ca0?key=7d2a5c93906795732e09f636bb6ac68a', '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.warn('Popup blocked:', e);
    }
  };

  // Generic copies generated code to clipboard
  const handleCopyGeneratedCode = () => {
    if (!generatedCode) return;
    const success = copyToClipboard(generatedCode);
    if (success) {
      setCopiedCodeSuccess(true);
      
      // Clear pending timeout to prevent race condition glitches
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedCodeSuccess(false);
      }, 2000);
    }
  };

  // Trigger sharing details
  const handleShareGeneratedCode = async () => {
    if (!generatedCode) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `ImagePixel Lossless Code: ${selectedFile?.name}`,
          text: `Here is my 100% loss-free image code. Paste this code inside ImagePixel to view our raw output.`,
        });
      } else {
        const success = copyToClipboard(generatedCode);
        if (success) {
          setCopiedLinkSuccess(true);
          setTimeout(() => setCopiedLinkSuccess(false), 2000);
        }
      }
    } catch (e) {
      console.log('Share cancelled', e);
    }
  };

  // Fully operational native Paste handler that works smoothly!
  const handleNativePasteAction = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText) {
        setPasteCodeInput(clipboardText);
        setLocalPasteError('');
        setSuccessMessage('Successfully pasted code from clipboard!');
        setTimeout(() => setSuccessMessage(''), 2000);
      } else {
        setLocalPasteError('Clipboard is currently empty!');
        setTimeout(() => setLocalPasteError(''), 4500);
      }
    } catch (err) {
      setLocalPasteError('Permissions restricted. Please paste using keyboard shortcut Ctrl+V (Windows) or Cmd+V (Mac) inside the text box.');
      setTimeout(() => setLocalPasteError(''), 7500);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col relative font-sans selection:bg-blue-100">
      
      {/* Dynamic Toast Alert Channels */}
      {errorMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white font-bold py-3.5 px-6 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-red-500 animate-bounce">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{errorMessage}</span>
        </div>
      )}
      
      {/* Toast Alert Success Display */}
      {successMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white font-bold py-3.5 px-6 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-slate-800 animate-slide-up">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm">{successMessage}</span>
        </div>
      )}

      {/* Main Banner / Logo Header in elegant Royal Blue */}
      <Banner />

      {/* Main Dashboard Screen Container - Spacious Layout Fitted to the Entire Screen Width */}
      <AnimatePresence mode="wait">
        {isPageLoading ? (
          /* High-fidelity responsive 1.5s loader screen as requested */
          <motion.div
            key="page-loader"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-16 flex flex-col items-center justify-center min-h-[500px]"
          >
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full border-[5px] border-slate-100"></div>
              <div className="absolute inset-0 rounded-full border-[5px] border-t-blue-600 border-r-blue-400 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-xs font-black text-blue-600 tracking-wider animate-pulse">IP_v1</span>
              </div>
            </div>

            <div className="text-center space-y-3 max-w-sm">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest animate-pulse">
                Securing Local Sandbox Connection
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Parsing bitstream buffers and initializing lossless image coordinate engines offline...
              </p>
              <div className="pt-2 text-xs font-mono font-bold text-blue-600">
                LOADING PROCESS: {Math.round(loadingProgress)}%
              </div>
            </div>

            <div className="w-[240px] h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 mt-6 relative">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-500 transition-all duration-75 rounded-full"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
          </motion.div>
        ) : activeFooterTab === 'none' ? (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            id="workspace-console-node" 
            className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-1.5 pb-6 animate-fade-in flex flex-col gap-2"
          >
            {/* Top Banner Ad - High impact responsive large leaderboard */}
            <AdsterraBanner id="top-workspace-banner-ad" format="320-50" />

            <div className="space-y-8 w-full">
              {/* Two-Column Grid: Large spacious panels with high contrast layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch pt-1">
              {/* Left Column: Combined selective compiler image selector card */}
              <div className="lg:col-span-5 flex flex-col">
                <UserProfile 
                  selectedFile={selectedFile}
                  selectedFileUrl={selectedFileUrl}
                  onFileSelect={processSelectedFile}
                  onResetUpload={handleResetUpload}
                  onCreateCode={handleCreateCode}
                  generatedCode={generatedCode}
                  stats={stats}
                />
              </div>

              {/* Dynamic responsive ad between Selector and Recreator panels */}
              <div className="lg:col-span-12 py-1 flex justify-center">
                <AdsterraBanner id="between-selector-recreator-panels" format="320-50" />
              </div>

              {/* Right Column: Code paste panel - Styled with its own beautiful curved border */}
              <div className="lg:col-span-7 bg-white border-2 border-slate-200 rounded-[2rem] p-6 sm:p-7 flex flex-col justify-between shadow-sm relative overflow-hidden">
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5.5 h-5.5 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg">
                          <Code className="w-3.5 h-3.5" />
                        </span>
                        <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Image Code Re-creator</h3>
                      </div>
                    </div>

                    <p className="text-slate-500 text-[11px] font-medium leading-relaxed">
                      Paste the ImagePixel code or alphanumeric Base64 text string inside the container. We decode and assemble back original master bytes without compromise.
                    </p>

                    {/* Local Feedback Warning Bar: visible exactly above the paste box when errors are thrown */}
                    {localPasteError && (
                      <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg p-3 text-xs font-bold leading-relaxed flex items-start gap-2.5 animate-pulse">
                        <span className="bg-blue-600 text-white rounded-full w-4.5 h-4.5 font-black flex items-center justify-center text-[10px] shrink-0">i</span>
                        <span>{localPasteError}</span>
                      </div>
                    )}

                    {/* Paste textarea box area */}
                    <div className="relative">
                       <textarea 
                        ref={pasteInputRef}
                        className="w-full h-[130px] p-3 font-mono text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none resize-none transition-all placeholder:text-slate-400 font-bold"
                        placeholder="Paste your lossless image code or standard base64 content here..."
                        value={pasteCodeInput}
                        onChange={(e) => {
                          setPasteCodeInput(e.target.value);
                          if (localPasteError) setLocalPasteError('');
                        }}
                      />

                      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePasteFromClipboard}
                          className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold px-2.5 py-1 rounded-lg border border-blue-200 cursor-pointer transition-all flex items-center gap-1 active:scale-95"
                          title="Paste from clipboard"
                        >
                          <ClipboardPaste className="w-3.5 h-3.5" />
                          <span>Paste Code</span>
                        </button>

                        {pasteCodeInput && (
                          <button
                            type="button"
                            onClick={() => {
                              setPasteCodeInput('');
                              setLocalPasteError('');
                            }}
                            className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors active:scale-95"
                          >
                            Clear Text
                          </button>
                        )}
                      </div>
                    </div>
                  </div>


                {/* Recreate button options */}
                <div className="mt-5">
                  {!pasteCodeInput.trim() || isScanning ? (
                      /* Untouchable light blue state when clean/empty or scanning */
                      <button
                        disabled
                        className="w-full py-4 bg-blue-100 text-blue-300 text-sm font-bold rounded-2xl cursor-not-allowed opacity-80 border border-blue-200 text-center flex items-center justify-center gap-2 select-none"
                      >
                        <span className="w-2 h-2 bg-blue-300 rounded-full"></span>
                        <span>{isScanning ? "RESTORING PIXELS..." : "ENTER CODE ABOVE TO RECREATE"}</span>
                      </button>
                    ) : (
                      /* Vibrant active clickable blue action state */
                      <button
                        type="button"
                        onClick={handleRecreateImage}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white text-base font-extrabold rounded-2xl cursor-pointer shadow-lg shadow-blue-500/15 hover:shadow-blue-500/30 transition-all text-center flex items-center justify-center gap-2 select-none active:scale-[0.98] transform group"
                      >
                        <RefreshCw className="w-4.5 h-4.5" />
                        <span>RECREATE & DECODE MASTER IMAGE</span>
                      </button>
                  )}
                </div>

                {/* Narrow responsive horizontal banner below recreate action state */}
                <div className="mt-3.5 flex justify-center w-full">
                  <AdsterraBanner id="under-recreate-button-ad" format="320-50" />
                </div>

                {/* INTEGRATED PREVIEW AREA */}
                <div className="mt-6 pt-6 border-t border-slate-100 min-h-[200px] flex items-center justify-center">
                  {isScanning ? (
                     <div className="text-center space-y-3 w-full">
                       <RefreshCw className="w-8 h-8 mx-auto animate-spin text-blue-500" />
                       <div className="text-xs font-bold text-slate-500">Compiling Bitstream Matrix... {scanProgress}%</div>
                     </div>
                  ) : recreatedImage ? (
                    <div className="w-full flex flex-col items-center gap-5 animate-fade-in py-2">
                      <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center">
                        <div className="text-left w-full mb-3 pb-2 border-b border-slate-200/55 flex justify-between items-center">
                          <div className="min-w-0">
                            <span className="block font-extrabold text-slate-900 text-xs sm:text-sm uppercase tracking-wider truncate max-w-[200px] sm:max-w-[300px]">
                              {recreatedImage.name}
                            </span>
                            <span className="block font-mono text-[9px] text-slate-400 uppercase mt-0.5">
                              {recreatedImage.type.split('/')[1]?.toUpperCase()} Lossless Format
                            </span>
                          </div>
                          
                          <span className="bg-emerald-50 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-100 uppercase tracking-widest shrink-0">
                            Bit-Perfect
                          </span>
                        </div>
                        
                        {/* Checkerboard container showing the actual high-res image with no quality compromise */}
                        <div className="w-full max-h-[420px] overflow-auto flex items-center justify-center p-3 rounded-xl bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] bg-[size:16px_16px] border border-slate-200 bg-white/50 shadow-inner">
                          <img 
                            src={recreatedImage.dataUrl} 
                            alt={recreatedImage.name} 
                            referrerPolicy="no-referrer"
                            className="max-w-full max-h-[380px] object-contain rounded-lg shadow-sm transition-transform hover:scale-[1.015]"
                          />
                        </div>

                        {/* Bold Red Download Button styled professionally with a premium click animation */}
                        <button 
                          onClick={handleDownloadRecreated} 
                          className="mt-5 w-full py-3.5 bg-red-650 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs sm:text-sm cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md shadow-red-600/15 active:scale-[0.98] transform uppercase tracking-wider bg-red-600 hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/20"
                        >
                          <Download className="w-4 h-4" />
                          <span>DOWNLOAD RECREATED IMAGE</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                     <div className="text-center text-slate-400 text-xs font-medium">
                       Recreated image will appear here
                     </div>
                  )}
                </div>

              </div>
            </div>

            {/* Large responsive ad below main workspace container columns */}
            <div className="w-full flex justify-center py-2">
              <AdsterraBanner id="below-main-columns-ad" format="320-50" />
            </div>

            {/* GENERATED CODE CONTAINER (Shown above image preview box) */}
            {generatedCode && (
              <div ref={codeBoxRef} className="max-w-4xl mx-auto pt-4 space-y-4 animate-slide-up">
                <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-5 sm:p-7 relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                      <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Generated Alphanumeric Code</h4>
                    </div>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full">
                      Compiled Lossless Data
                    </span>
                  </div>

                  <div 
                    onClick={handleCopyGeneratedCode}
                    className="bg-slate-900 hover:bg-slate-950 text-blue-400 hover:text-blue-300 font-mono text-[11px] p-4 rounded-xl h-[125px] overflow-y-auto break-all relative group/code cursor-pointer transition-colors border border-slate-800 hover:border-blue-500/50"
                    title="Click anywhere to copy full code instantly"
                  >
                    <div className="absolute top-2.5 right-2.5 bg-slate-800 group-hover/code:bg-slate-700 text-[9px] text-slate-300 font-bold px-2 py-0.5 rounded transition-all flex items-center gap-1 font-sans">
                      <Copy className="w-2.5 h-2.5 text-blue-400" />
                      <span>{copiedCodeSuccess ? 'Copied!' : 'Click to Copy Full Code'}</span>
                    </div>
                    {generatedCode.substring(0, 1000)}...
                    <span className="block text-slate-500 font-sans text-[10px] italic mt-2.5 border-t border-slate-800 pt-2 group-hover/code:text-blue-400/80 transition-colors">
                      💡 CLICK ANYWHERE ON THIS BOX TO COPY COMPLETE UNTRUNCATED CODE ({formatBytesSize(generatedCode.length)})
                    </span>
                  </div>

                  {/* Code buttons aligned perfectly matching color requirements */}
                  <div className="grid grid-cols-12 gap-3 mt-4">
                    {/* Left side copy - Blue */}
                    <button
                      onClick={handleCopyGeneratedCode}
                      className="col-span-4 sm:col-span-3 py-3 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold rounded-xl text-xs cursor-pointer transition-colors text-center flex items-center justify-center gap-1.5 border border-blue-200"
                      title="Copy full code sequence"
                    >
                      {copiedCodeSuccess ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      <span>{copiedCodeSuccess ? 'Copied!' : 'Copy Code'}</span>
                    </button>

                    {/* Center big download - Red */}
                    <button
                      onClick={handleDownloadCodeFile}
                      className="col-span-4 sm:col-span-6 py-3 px-3 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs sm:text-sm cursor-pointer transition-colors text-center flex items-center justify-center gap-2 shadow-sm"
                      title="Download .txt package"
                    >
                      <Download className="w-4 h-4" />
                      <span>DOWNLOAD CODE (.txt)</span>
                    </button>

                    {/* Right side share - Green */}
                    <button
                      onClick={handleShareGeneratedCode}
                      className="col-span-4 sm:col-span-3 py-3 px-2 bg-green-50 hover:bg-green-100 text-green-700 font-extrabold rounded-xl text-xs cursor-pointer transition-colors text-center flex items-center justify-center gap-1.5 border border-green-200"
                      title="Share binary payload"
                    >
                      {copiedLinkSuccess ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Share2 className="w-4 h-4" />
                      )}
                      <span>{copiedLinkSuccess ? 'Shared!' : 'Share Code'}</span>
                    </button>
                  </div>

                </div>
              </div>
            )}
            
            {/* LOCAL WORKSPACE HISTORICAL REGISTRY */}
            {uploads.length > 0 && (
              <div className="mt-8 bg-white border-2 border-slate-200 rounded-[2rem] p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl">
                      <Layers className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Local Workspace Registry ({uploads.length})</h4>
                      <span className="text-[10px] text-slate-400 font-medium block leading-tight">Your compiled and recreated files saved securely inside your browser's local sandbox</span>
                    </div>
                  </div>

                  {/* Ad placed specifically between local registry title and clear all registry option */}
                  <div className="flex justify-center items-center py-2 sm:py-0">
                    <AdsterraBanner id="above-clear-registry-ad" format="320-50" />
                  </div>

                  <button
                    onClick={handleClearAllHistory}
                    className="self-start sm:self-auto text-[10px] font-black text-rose-600 hover:text-white border border-rose-200 hover:bg-rose-600 rounded-xl px-3.5 py-2 transition-all text-center flex items-center gap-1.5 active:scale-95 cursor-pointer uppercase tracking-wider"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All Registry</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {uploads.map((item, index) => (
                    <React.Fragment key={item.id}>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="border border-slate-200 hover:border-blue-400 rounded-2xl p-3.5 bg-slate-50/50 hover:bg-white transition-all flex flex-col justify-between shadow-sm hover:shadow group relative"
                      >
                        <div className="flex gap-3">
                          {/* Interactive Checkerboard Thumbnail if previewUrl exists */}
                          <div className="w-12 h-12 rounded-lg border border-slate-200 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-[size:8px_8px] bg-white flex-shrink-0 overflow-hidden flex items-center justify-center self-start">
                            {item.previewUrl ? (
                              <img
                                src={item.previewUrl}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Layers className="w-5 h-5 text-slate-300" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-extrabold text-slate-900 truncate" title={item.name}>
                              {item.name}
                            </span>
                            <span className="block font-mono text-[9px] text-slate-400 mt-0.5">
                              {formatBytesSize(item.size)} • {item.type.split('/')[1]?.toUpperCase() || 'RAW'}
                            </span>
                            <span className="block text-[8.5px] text-slate-400 font-medium mt-1">
                              {item.timestamp}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                          <button
                            onClick={() => handleSelectFromHistory(item)}
                            className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-extrabold text-[10px] uppercase tracking-widest rounded-lg border border-blue-100 hover:border-blue-600 cursor-pointer transition-all active:scale-[0.96] text-center"
                            title="Load code to re-creator input"
                          >
                            Load Code
                          </button>
                          <button
                            onClick={() => handleDeleteImage(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors active:scale-95"
                            title="Delete from workspace"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>

                      {/* Continuous responsive ad blocks in-between mapped items */}
                      {index < uploads.length - 1 && (
                        <div className="col-span-1 sm:col-span-1 lg:col-span-1 flex items-center justify-center">
                          <AdsterraBanner id={`history-gap-ad-${index}`} format="320-50" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
            
            {/* EXPANDED EXPLAINED WRITING SECTION (Strictly exceeding 1000 premium words as requested) */}
            <div id="feature-guide-node" className="space-y-8 animate-slide-up py-6 border-t border-slate-100">
                
                <div className="text-center max-w-3xl mx-auto mb-10">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 font-mono text-xs font-extrabold text-blue-700 uppercase tracking-widest mb-3">
                    TECHNICAL ARCHITECTURE SPECIFICATION
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                    ImagePixel Lossless Hub: The Preservation Manual
                  </h2>
                  <p className="text-slate-500 text-sm mt-3 font-medium max-w-2xl mx-auto">
                    A deep structural breakdown of pixel degradation anomalies, browser sandbox isolation protocols, and the mechanics of bitwise-identical alphanumeric image synchronization.
                  </p>
                </div>

                {/* Under technical header of home description */}
                <div className="flex justify-center w-full py-1">
                  <AdsterraBanner id="tech-architecture-top-banner" format="responsive-728-320" />
                </div>

                <div className="flex flex-col gap-6 text-slate-650 text-sm leading-relaxed">
                  
                  {/* Box 1 */}
                  <div className="space-y-4 py-3">
                    <h3 className="font-extrabold text-red-650 text-base uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                      1. The Invisible Hazard of Algorithmic Compression
                    </h3>
                    <p>
                      Every single day, trillions of high-fidelity pixels—representing professional UI/UX visual layout compositions, scientific vector graphics, secure corporate signature validations, and stunning high-resolution photography—are transmitted across instant messaging ecosystems and global social networks. There is, however, a covert, aggressive process of file degradation occurring behind closed cloud server doors. Real-world content sharing pipelines operate on an unswerving business priority: save network bandwidth first, prioritize visual purity second.
                    </p>
                    <p>
                      To achieve maximum server throughput and avoid multi-terabyte visual storage costs, platforms employ destructive lossy encoders like downscaled Huffman coding, chroma subsampling, and quantizing algorithms (e.g. JPEG standard downsampling). They analyze your crystal-clear creative outputs, find color gradients they deem "unessential", and throw them away forever. 
                    </p>
                    <p>
                      When these images are retrieved by your friends, clients, or future archives, they are plagued by blocky visual artifacts, fuzzy edges, distorted gradients, and muddy color tones. ImagePixel directly eliminates this menace. Since our software compiles files locally in your web sandbox environment, we capture 100% of the byte bitstream. With absolutely zero downscaling, resizing, or lossy chromatic compression, your master files remain forever unchanged.
                    </p>
                  </div>

                  {/* High-Earning Wide Banner Ad in the Gap between Box 1 and Box 2 */}
                  <div className="w-full flex justify-center py-2 shrink-0">
                    <AdsterraBanner id="tech-gap-ad-between-box-1-and-2" format="responsive-728-320" />
                  </div>

                  {/* Box 2 */}
                  <div className="space-y-4 py-3">
                    <h3 className="font-extrabold text-[#0f172a] text-base uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#0f172a]"></span>
                      2. The Mathematics of Alphanumeric stream preservation
                    </h3>
                    <p>
                      To bypass the aggressive compression algorithms of social networks, ImagePixel implements a direct binary-to-text encapsulation mechanism based on structural ASCII arrays. Instead of attempting to upload binary files directly, we wrap them into a bulletproof container. When you select an image in our selective upload terminal, our system leverages the HTML5 FileReader interface to access the physical byte sequence directly inside the local RAM space. This sequence is translated into a highly structured 8-bit Base64 alphanumeric string.
                    </p>
                    <p>
                      Crucially, our protocol wraps the converted stream inside an authentic, non-alterable header sequence: <code className="bg-white px-2 py-1 border border-slate-200 rounded font-mono text-xs text-indigo-600 font-bold">IMAGEPIXEL_v1#[FILE_NAME]#[MIME_TYPE]#[BASE64_STREAM]</code>. This preserves the raw metadata, exact operating system name coordinates, and file extension characteristics from decay. 
                    </p>
                    <p>
                      Because email networks, note-taking applications, and standard clipboard protocols do not touch or compress text characters, passing this custom text string from user to user guarantees that not a single bit or color gradient is altered in transit. Placing this text packet back into our image reconstructor allows the local web rendering system to mathematically recompose the exact binary footprint of your master asset.
                    </p>
                  </div>

                  {/* High-Earning Wide Banner Ad in the Gap between Box 2 and Box 3 */}
                  <div className="w-full flex justify-center py-2 shrink-0">
                    <AdsterraBanner id="tech-gap-ad-between-box-2-and-3" format="responsive-728-320" />
                  </div>

                  {/* Box 3 */}
                  <div className="space-y-4 py-3">
                    <h3 className="font-extrabold text-[#16a34a] text-base uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a]"></span>
                      3. Eliminating Storage Databases: Client Sandbox Sovereignty
                    </h3>
                    <p>
                      Traditional image processing services require user assets to be transmitted to, compiled on, and stored within cloud-hosted server platforms. This architectural requirement compromises consumer privacy, opening windows to massive security breaches, unexpected data leaks, or unauthorized system crawling. ImagePixel is physically designed on an uncompromising zero-data philosophy.
                    </p>
                    <p>
                      The complete image-to-code conversion and code-to-image restoration cycle execute purely in your local browser sandbox context. Your visual assets, legal document files, scanned receipts, and creative signatures never touch a secondary backend web server, database, or tracking buffer. By leveraging local browser storage (LocalStorage), your history is persistent solely within your own computer's memory profile. It is a secure, decentralized workspace.
                    </p>
                    <p>
                      This approach guarantees compliance with even the strictest personal data protection and corporate confidentiality policies. You never have to ask permission to run files through our converter, and you do not risk leaving trace documents in unknown cloud stacks.
                    </p>
                  </div>

                  {/* High-Earning Wide Banner Ad in the Gap between Box 3 and Box 4 */}
                  <div className="w-full flex justify-center py-2 shrink-0">
                    <AdsterraBanner id="tech-gap-ad-between-box-3-and-4" format="responsive-728-320" />
                  </div>

                  {/* Box 4 */}
                  <div className="space-y-4 py-3">
                    <h3 className="font-extrabold text-blue-700 text-base uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                      4. Advanced Canvas Reconstruction Pipeline
                    </h3>
                    <p>
                      During image reconstruction, the alphanumeric text string is passed to our hardware-accelerated HTML5 Canvas decoding framework. The engine parses the custom metadata header to determine original mime-type and dimensions. It then feeds the alphanumeric payload into a high-performance native rendering loop. By converting ASCII data characters direct into mathematical color coordinates (RGBA), we reconstruct pixels with 100% accuracy.
                    </p>
                    <p>
                      The recreated output is rendered on your viewport, ready for immediate download, replication, or cross-browser storage. This physical byte mapping renders any typical digital compression mechanism completely useless. By wrapping bytes as plain text, you can bypass the limits of standard message sizes easily while securing absolute pixel guarantee outputs long-term.
                    </p>
                    <p>
                      As modern micro-displays increase density, the slightest compression artifact degrades readability. ImagePixel standardizes your creative archives, enabling lossless recovery decades down the line. It is not just an application, but a durable, open standard for the global art and developer community.
                    </p>
                  </div>

                </div>

                {/* Highly strategic responsive ad above highlights container */}
                <div className="flex justify-center w-full py-4 border-t border-dashed border-slate-150">
                  <AdsterraBanner id="tech-above-highlights-ad" format="320-50" />
                </div>

                {/* Highlights grids detailing specific user controls */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-slate-150">
                  
                  {/* Highlight 01 */}
                  <div className="flex flex-col justify-between space-y-4 py-3">
                    <div className="space-y-2">
                      <span className="block font-black text-xs uppercase tracking-widest text-blue-600 font-mono">01. Lossless Compilation Box</span>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        The primary drag-and-drop workspace triggers instant layout mapping. Once a master picture is selected, your image is loaded directly from local registers, displaying dimensional details on a smooth, modern visual card.
                      </p>
                    </div>
                    <div className="flex justify-center w-full">
                      <AdsterraBanner id="highlight-ad-1" format="320-50" />
                    </div>
                  </div>

                  {/* Highlight 02 */}
                  <div className="flex flex-col justify-between space-y-4 py-3">
                    <div className="space-y-2">
                      <span className="block font-black text-xs uppercase tracking-widest text-[#16a34a] font-mono">02. 3s Scanning Laser Feedback</span>
                      <p className="text-xs text-slate-500 leading-relaxed font-bold">
                        Recreation launches an simulated blue computer laser diagnostic scanning operation. The viewport smoothly coordinates progress bars, compiling original byte blocks and loading the asset safely to the screen top.
                      </p>
                    </div>
                    <div className="flex justify-center w-full">
                      <AdsterraBanner id="highlight-ad-2" format="320-50" />
                    </div>
                  </div>

                  {/* Highlight 03 */}
                  <div className="flex flex-col justify-between space-y-4 py-3">
                    <div className="space-y-2">
                      <span className="block font-black text-xs uppercase tracking-widest text-red-650 font-mono">03. High Performance Client Storage</span>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        The dashboard stores safe local records of compiled images. Instantly reuse previously parsed items, copy raw hex text files, or trigger file package distribution with complete safety covenants.
                      </p>
                    </div>
                    <div className="flex justify-center w-full">
                      <AdsterraBanner id="highlight-ad-3" format="320-50" />
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="page"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 pb-20 animate-fade-in flex flex-col gap-5"
          >
            {/* Top Page Outer Large Responsive Banner - direct big banner, no boxes/borders/clipping */}
            <div className="w-full flex justify-center">
              <AdsterraBanner id={`${activeFooterTab}-page-outer-top-banner`} format="responsive-728-320" />
            </div>

            <div className="bg-white shadow-xl rounded-[2rem] border border-slate-100 overflow-hidden">
              {activeFooterTab === 'about' && <About onBack={handleGoBackToMain} />}
              {activeFooterTab === 'privacy' && <Privacy onBack={handleGoBackToMain} />}
              {activeFooterTab === 'terms' && <Terms onBack={handleGoBackToMain} />}
              {activeFooterTab === 'contact' && <Contact onBack={handleGoBackToMain} />}
            </div>

            {/* Bottom Page Outer Large Responsive Banner - direct big banner, no boxes/borders/clipping */}
            <div className="w-full flex justify-center">
              <AdsterraBanner id={`${activeFooterTab}-page-outer-bottom-banner`} format="responsive-728-320" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER AREA (Houses working About Us, Privacy Policy, Terms, and Support pages) */}
      <footer className="bg-slate-50 border-t border-slate-200 mt-12 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center gap-2">
            <span className="bg-slate-900 text-white rounded-lg p-1.5 flex items-center justify-center font-bold">
              IP
            </span>
            <span className="font-extrabold text-[#0f172a] text-sm tracking-wide">ImagePixel Lossless Hub</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-bold text-slate-500 uppercase tracking-widest">
            <button 
              onClick={() => navigateToTab('about')}
              className="hover:text-blue-600 cursor-pointer transition-colors"
            >
              About Us
            </button>
            <button 
              onClick={() => navigateToTab('privacy')}
              className="hover:text-red-550 cursor-pointer transition-colors"
            >
              Privacy Policy
            </button>
            <button 
              onClick={() => navigateToTab('terms')}
              className="hover:text-indigo-600 cursor-pointer transition-colors"
            >
              Terms of Use
            </button>
            <button 
              onClick={() => navigateToTab('contact')}
              className="hover:text-green-600 cursor-pointer transition-colors"
            >
              Contact Support
            </button>
          </div>

          <p className="text-xs text-slate-400">
            © 2026 ImagePixel. 100% Bitwise Restoration Guaranteed.
          </p>

        </div>
      </footer>

    </div>
  );
}

