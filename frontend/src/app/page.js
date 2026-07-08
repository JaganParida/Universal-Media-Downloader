"use client";
import { useState, useRef, useEffect } from "react";

const API_BASE = "https://universal-media-downloader-re6r.onrender.com";

// --- Custom SVGs for platforms & tabs (No Emojis) ---
const YouTubeIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.52 3.5 12 3.5 12 3.5s-7.52 0-9.388.555A3.002 3.002 0 0 0 .502 6.163C0 8.07 0 12 0 12s0 3.93.502 5.837a3.002 3.002 0 0 0 2.11 2.108C4.48 20.5 12 20.5 12 20.5s7.52 0 9.388-.555a3.003 3.003 0 0 0 2.11-2.108C24 15.93 24 12 24 12s0-3.93-.502-5.837z" />
  </svg>
);

const InstagramIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const FacebookIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const TikTokIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.86-.74-3.99-1.72-.08-.07-.17-.17-.24-.25v5.13c-.02 3.42-1.9 6.78-5.23 7.85-3.32 1.07-7.23-.27-8.86-3.35-1.63-3.08-1-7.22 1.54-9.59 2.54-2.37 6.75-2.29 9.17-.07.02.02.04.04.06.06V.02zm0 0" />
  </svg>
);

const TwitterIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const GlobeIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const VideoIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const AudioIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
  </svg>
);

const BugIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const IdeaIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const HelpIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const FeedbackIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
  </svg>
);

const InfoIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AlertTriangleIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const CheckIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const DownloadIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const ChevronDownIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const HistoryIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CloseIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function Home() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const [error, setError] = useState("");

  const [selectedFormatObj, setSelectedFormatObj] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownDirection, setDropdownDirection] = useState("down");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [imgError, setImgError] = useState(false);

  // Download mode: "video" (default) or "audio" (mp3)
  const [downloadMode, setDownloadMode] = useState("video");

  // Prevent duplicate fetches
  const [fetchedUrl, setFetchedUrl] = useState("");

  // Search Extraction Timer State
  const [searchTimer, setSearchTimer] = useState(0);

  // Modal State
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Feedback Form State
  const [feedbackType, setFeedbackType] = useState("Bug Report");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  // Local storage history state
  const [history, setHistory] = useState([]);

  const dropdownContainerRef = useRef(null);
  const dropdownButtonRef = useRef(null);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("download_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load search history", e);
    }
  }, []);

  // Live Timer Logic for Search/Extraction Phase
  useEffect(() => {
    let interval;
    if (isLoading) {
      interval = setInterval(() => {
        setSearchTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setSearchTimer(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Click outside dropdown handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(event.target)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isFeedbackOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isFeedbackOpen]);

  const toggleDropdown = () => {
    if (!isDropdownOpen && dropdownButtonRef.current) {
      const rect = dropdownButtonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropdownDirection(spaceBelow < 280 ? "up" : "down");
    }
    setIsDropdownOpen(!isDropdownOpen);
  };

  const getPlatformInfo = (urlStr) => {
    const lUrl = urlStr.toLowerCase();
    if (lUrl.includes("instagram.com")) return { name: "Instagram", icon: InstagramIcon };
    if (lUrl.includes("facebook.com") || lUrl.includes("fb.watch") || lUrl.includes("fb.com")) return { name: "Facebook", icon: FacebookIcon };
    if (lUrl.includes("youtube.com") || lUrl.includes("youtu.be")) return { name: "YouTube", icon: YouTubeIcon };
    if (lUrl.includes("tiktok.com")) return { name: "TikTok", icon: TikTokIcon };
    if (lUrl.includes("twitter.com") || lUrl.includes("x.com")) return { name: "Twitter/X", icon: TwitterIcon };
    return { name: "Web Video", icon: GlobeIcon };
  };

  const normalizeFormats = (rawFormats) => {
    const standardMap = new Map();
    rawFormats.forEach((f) => {
      let stdRes = "Audio Only";
      let sortVal = 0;
      if (f.hasVideo) {
        const num = parseInt((f.resolution || "").replace(/\D/g, ""));
        if (!isNaN(num)) {
          if (num >= 2000) {
            stdRes = "4K";
            sortVal = 2160;
          } else if (num >= 1400) {
            stdRes = "1440p";
            sortVal = 1440;
          } else if (num >= 1000) {
            stdRes = "1080p";
            sortVal = 1080;
          } else if (num >= 700) {
            stdRes = "720p";
            sortVal = 720;
          } else if (num >= 480) {
            stdRes = "480p";
            sortVal = 480;
          } else if (num >= 360) {
            stdRes = "360p";
            sortVal = 360;
          } else if (num >= 240) {
            stdRes = "240p";
            sortVal = 240;
          } else {
            stdRes = "144p";
            sortVal = 144;
          }
        } else {
          stdRes = "Video";
          sortVal = 100;
        }
      }
      if (!standardMap.has(stdRes)) {
        standardMap.set(stdRes, { ...f, stdRes, sortVal });
      } else {
        const existing = standardMap.get(stdRes);
        const existingSize = existing.filesize
          ? parseFloat(existing.filesize.replace(/[^\d.]/g, ""))
          : 0;
        const newSize = f.filesize
          ? parseFloat(f.filesize.replace(/[^\d.]/g, ""))
          : 0;
        if (newSize > existingSize || (!existing.filesize && f.filesize)) {
          standardMap.set(stdRes, { ...f, stdRes, sortVal });
        }
      }
    });
    return Array.from(standardMap.values()).sort(
      (a, b) => b.sortVal - a.sortVal,
    );
  };

  const fetchMetadata = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setVideoData(null);
    setDownloadProgress(0);
    setIsDownloading(false);
    setImgError(false);
    setIsDropdownOpen(false);

    try {
      const response = await fetch(`${API_BASE}/api/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not analyze the link.");

      const perfectFormats = normalizeFormats(data.formats || []);
      setVideoData({ ...data, formats: perfectFormats });

      if (perfectFormats.length > 0) setSelectedFormatObj(perfectFormats[0]);

      setFetchedUrl(url);
    } catch (err) {
      setError(err.message);
      setFetchedUrl("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!videoData) return;

    const isAudioType = downloadMode === "audio";
    if (!isAudioType && !selectedFormatObj) return;

    setIsDownloading(true);
    setDownloadProgress(0);
    setIsDropdownOpen(false);

    let downloadUrl = `${API_BASE}/api/download?url=${encodeURIComponent(url)}&title=${encodeURIComponent(videoData.title)}`;
    if (isAudioType) {
      downloadUrl += "&type=audio";
    } else {
      downloadUrl += `&format_id=${selectedFormatObj.format_id}`;
    }

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Download failed at server.");
      }

      const contentLength = response.headers.get("Content-Length");
      const total = parseInt(contentLength, 10);
      let loaded = 0;
      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (total) {
          setDownloadProgress(Math.round((loaded / total) * 100));
        } else {
          setDownloadProgress((prev) => Math.min(prev + 5, 95));
        }
      }

      const fileExtension = isAudioType ? "mp3" : (selectedFormatObj?.ext || "mp4");
      const blobMime = isAudioType ? "audio/mpeg" : "video/mp4";

      const blob = new Blob(chunks, { type: blobMime });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${videoData.title.replace(/[^\w\s-]/gi, "")}.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      setDownloadProgress(100);

      // Save to download history
      const newHistoryItem = {
        id: Date.now().toString(),
        title: videoData.title,
        thumbnail: videoData.thumbnail,
        platform: videoData.platform || detectPlatformName(url),
        url: url,
        date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        downloadMode: downloadMode,
        resolution: isAudioType ? "MP3 Audio" : selectedFormatObj?.resolution,
      };

      setHistory((prev) => {
        const filtered = prev.filter((item) => item.url !== url);
        const updated = [newHistoryItem, ...filtered].slice(0, 10);
        localStorage.setItem("download_history", JSON.stringify(updated));
        return updated;
      });

      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
      }, 3005);
    } catch (err) {
      console.error("Download Error:", err);
      setError(err.message || "Download failed");
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const detectPlatformName = (urlStr) => {
    const lUrl = urlStr.toLowerCase();
    if (lUrl.includes("instagram.com")) return "instagram";
    if (lUrl.includes("facebook.com") || lUrl.includes("fb.watch")) return "facebook";
    if (lUrl.includes("youtube.com") || lUrl.includes("youtu.be")) return "youtube";
    if (lUrl.includes("tiktok.com")) return "tiktok";
    if (lUrl.includes("twitter.com") || lUrl.includes("x.com")) return "twitter";
    return "generic";
  };

  const handleHistoryItemClick = (item) => {
    setUrl(item.url);
    setTimeout(() => {
      const button = document.getElementById("search-btn");
      if (button) button.click();
    }, 100);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("download_history");
  };

  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) return;

    const userAgent = navigator.userAgent;
    const bodyText = `${feedbackMessage}\n\n------------------------\nDiagnostics:\nSystem: ${userAgent}\nTime: ${new Date().toLocaleString()}`;
    const subject = encodeURIComponent(`[Media Pro] ${feedbackType}`);
    const body = encodeURIComponent(bodyText);

    window.location.href = `mailto:jaganparida39064@gmail.com?subject=${subject}&body=${body}`;
    setIsFeedbackOpen(false);
    setFeedbackMessage("");
  };

  const renderQualityLabel = (format) => {
    if (format.stdRes === "Audio Only") {
      return (
        <span className="flex items-center gap-2 text-[#f1f1f1]">
          <svg className="w-4 h-4 text-[#aaaaaa]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          Audio Only
        </span>
      );
    }
    const isHD = ["1080p", "720p", "1440p", "4K"].includes(format.stdRes);
    return (
      <span className="flex items-center gap-2 text-[#f1f1f1]">
        {format.stdRes}
        {isHD && (
          <span className="text-[10px] font-bold bg-[#333333] text-[#f1f1f1] px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
            HD
          </span>
        )}
      </span>
    );
  };

  const isFacebook = url.toLowerCase().includes("facebook.com") || url.toLowerCase().includes("fb.watch");
  const isInstagram = url.toLowerCase().includes("instagram.com");
  const isYouTube = url.toLowerCase().includes("youtube.com") || url.toLowerCase().includes("youtu.be");

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#f1f1f1] font-sans flex flex-col selection:bg-[#9333ea] selection:text-white relative">
      
      {/* ─── YOUTUBE STYLE STICKY HEADER ─── */}
      <header className="sticky top-0 z-40 w-full bg-[#0f0f0f]/95 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-sm border-b border-[#272727]">
        <div className="flex items-center cursor-pointer" onClick={() => { setUrl(""); setVideoData(null); setFetchedUrl(""); }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-2.5">
            <img src="/icon.svg" alt="Media Pro Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            Media<span className="font-light text-[#aaaaaa]">Pro</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsFeedbackOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-[#aaaaaa] hover:text-[#f1f1f1] transition-colors"
          >
            <FeedbackIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Help & Feedback</span>
          </button>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-grow flex flex-col items-center p-4 sm:p-6 mt-4 sm:mt-12">
        <div className="w-full max-w-3xl space-y-10">
          {/* Hero Section */}
          <div className="text-center space-y-3 px-2">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              Download Media <br className="sm:hidden" /> Anywhere
            </h2>
            <p className="text-[#aaaaaa] text-sm sm:text-base max-w-md mx-auto">
              Paste a public URL from YouTube, Instagram, or Facebook to download pristine, high-definition media directly to your device.
            </p>
          </div>

          {/* YouTube Premium Style Input Area */}
          <div className="space-y-3">
            <form onSubmit={fetchMetadata} className="relative flex flex-col sm:flex-row shadow-lg">
              <div className="relative flex-1 flex">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-[#717171]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  className="w-full pl-12 pr-4 py-3.5 bg-[#121212] border border-[#303030] sm:rounded-l-full sm:rounded-r-none rounded-full focus:outline-none focus:border-[#3ea6ff] focus:bg-[#0f0f0f] transition-all text-base placeholder-[#717171]"
                  placeholder="Paste video or shorts URL..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <button
                id="search-btn"
                type="submit"
                disabled={isLoading || !url || url === fetchedUrl}
                className="mt-3 sm:mt-0 px-8 py-3.5 bg-[#222222] border border-[#303030] sm:border-l-0 hover:bg-[#303030] text-[#f1f1f1] font-medium sm:rounded-r-full sm:rounded-l-none rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5 text-[#f1f1f1]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : url === fetchedUrl && videoData ? (
                  <>
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Ready
                  </>
                ) : (
                  "Search"
                )}
              </button>
            </form>

            {/* Dynamic Warnings OR Extraction Timer */}
            <div className="px-3 min-h-[48px] flex items-start">
              {isLoading ? (
                <div className="text-xs text-[#aaaaaa] flex items-start gap-2">
                  <svg className="animate-spin h-5 w-5 text-[#9333ea] flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>
                    <strong className="text-[#f1f1f1] text-sm">
                      Extracting media details...{" "}
                      <span className="text-[#9333ea]">({searchTimer}s)</span>
                    </strong>
                    <br />
                    <span className="opacity-80">This process usually takes 5-15 seconds depending on the platform. Please be patient.</span>
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 w-full">
                  {isInstagram && (
                    <p className="text-xs text-[#aaaaaa] flex items-center gap-1.5">
                      <InfoIcon className="w-4 h-4 text-[#9333ea]" />
                      <span>Instagram Reels audio track is extracted and merged automatically.</span>
                    </p>
                  )}
                  {isFacebook && (
                    <p className="text-xs text-[#aaaaaa] flex items-center gap-1.5">
                      <InfoIcon className="w-4 h-4 text-[#9333ea]" />
                      <span>Facebook audio stream is detected and merged with the chosen resolution.</span>
                    </p>
                  )}
                  {isYouTube && (
                    <p className="text-xs text-[#aaaaaa] flex items-center gap-1.5">
                      <AlertTriangleIcon className="w-4 h-4 text-red-500" />
                      <span>Only public YouTube videos are supported. Private files will error.</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-[#ff0000]/10 border border-[#ff0000]/30 text-[#ff4e4e] rounded-xl flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Video Data Display */}
          {videoData && (
            <div className="bg-[#181818] border border-[#272727] rounded-2xl overflow-hidden shadow-2xl transition-all">
              
              {/* INLINE MEDIA PREVIEW PLAYER */}
              <div className="relative aspect-video bg-black group overflow-hidden border-b border-[#272727]">
                {videoData.previewUrl ? (
                  isYouTube ? (
                    <iframe
                      src={videoData.previewUrl}
                      className="w-full h-full absolute inset-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={videoData.previewUrl}
                      poster={videoData.thumbnail || ""}
                      controls
                      className="w-full h-full object-contain absolute inset-0"
                    />
                  )
                ) : videoData.thumbnail && !imgError ? (
                  <img
                    src={videoData.thumbnail}
                    alt={videoData.title}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 absolute inset-0"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center w-full h-full text-[#555555] bg-[#121212] absolute inset-0">
                    <VideoIcon className="w-16 h-16 mb-3 opacity-40" />
                    <span className="text-sm font-medium tracking-wide">Media preview unavailable</span>
                  </div>
                )}
              </div>

              <div className="p-5 sm:p-7 space-y-6">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold line-clamp-2 text-[#f1f1f1] leading-snug">
                    {videoData.title}
                  </h2>
                  {videoData.description && (
                    <p className="text-sm text-[#aaaaaa] mt-2 line-clamp-2">
                      {videoData.description}
                    </p>
                  )}
                </div>

                {/* TABS SELECTOR: VIDEO vs AUDIO MODE */}
                <div className="flex border-b border-[#272727]">
                  <button
                    onClick={() => setDownloadMode("video")}
                    className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold transition-all border-b-2 ${
                      downloadMode === "video"
                        ? "border-[#f1f1f1] text-white"
                        : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <VideoIcon className="w-3.5 h-3.5" />
                    <span>Download Video</span>
                  </button>
                  
                  <button
                    onClick={() => setDownloadMode("audio")}
                    className={`flex items-center gap-2 pb-3 px-4 text-xs font-bold transition-all border-b-2 ${
                      downloadMode === "audio"
                        ? "border-[#f1f1f1] text-white"
                        : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <AudioIcon className="w-3.5 h-3.5" />
                    <span>Extract MP3 Audio</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  {downloadMode === "video" ? (
                    <div className="relative w-full sm:w-1/2" ref={dropdownContainerRef}>
                      <button
                        ref={dropdownButtonRef}
                        onClick={toggleDropdown}
                        className="w-full flex items-center justify-between px-5 py-3.5 bg-[#222222] hover:bg-[#303030] border border-[#303030] rounded-xl transition-colors focus:outline-none"
                      >
                        {selectedFormatObj ? (
                          renderQualityLabel(selectedFormatObj)
                        ) : (
                          <span className="text-[#f1f1f1]">Select Quality</span>
                        )}
                        <ChevronDownIcon className="w-4 h-4 text-[#aaaaaa] transition-transform" />
                      </button>

                      {isDropdownOpen && (
                        <div
                          className={`absolute z-10 w-full bg-[#222222] border border-[#303030] shadow-2xl rounded-xl overflow-hidden py-2 ${
                            dropdownDirection === "up" ? "bottom-full mb-2" : "top-full mt-2"
                          }`}
                        >
                          <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            {videoData.formats
                              .filter((f) => f.hasVideo)
                              .map((format, idx) => {
                                const isSelected = selectedFormatObj?.format_id === format.format_id;
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      setSelectedFormatObj(format);
                                      setIsDropdownOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-5 py-3 text-left transition-colors ${
                                      isSelected ? "bg-[#333333] border-l-2 border-[#f1f1f1]" : "hover:bg-[#303030] border-l-2 border-transparent"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      {isSelected && <CheckIcon className="w-4 h-4 text-white" />}
                                      {renderQualityLabel(format)}
                                    </div>
                                    {format.filesize && (
                                      <span className="text-xs font-medium text-[#aaaaaa]">
                                        {format.filesize}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full sm:w-1/2 flex items-center gap-3 px-5 py-3.5 bg-[#121212] border border-[#303030] rounded-xl">
                      <AudioIcon className="w-4 h-4 text-[#aaaaaa]" />
                      <div>
                        <h4 className="text-xs font-bold text-zinc-300">Format Selection</h4>
                        <p className="text-[10px] text-zinc-500 leading-tight">Extracting best audio track as high-quality MP3.</p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleDownload}
                    disabled={isDownloading || (downloadMode === "video" && !selectedFormatObj)}
                    className="relative overflow-hidden w-full sm:w-1/2 px-5 py-3.5 bg-[#f1f1f1] hover:bg-[#d9d9d9] text-[#0f0f0f] font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isDownloading && downloadProgress < 105 && (
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-black/10 transition-all duration-300 z-0"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {isDownloading ? (
                        downloadProgress === 100 ? (
                          <>
                            <CheckIcon className="w-5 h-5 text-green-600" />
                            <span>Complete!</span>
                          </>
                        ) : (
                          `Processing... ${downloadProgress}%`
                        )
                      ) : (
                        <>
                          <DownloadIcon className="w-5 h-5" />
                          <span>Download File</span>
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- DOWNLOAD HISTORY --- */}
        {history.length > 0 && (
          <div className="w-full max-w-3xl mt-10 bg-[#181818] border border-[#272727] rounded-2xl p-5 sm:p-7 space-y-4">
            <div className="flex items-center justify-between border-b border-[#272727] pb-3">
              <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                <HistoryIcon className="w-4 h-4 text-zinc-400" />
                <span>Download History</span>
              </h3>
              <button
                onClick={clearHistory}
                className="text-[10px] font-semibold text-[#aaaaaa] hover:text-red-400 transition-colors px-2 py-1 rounded border border-[#272727] hover:border-red-900/30 hover:bg-red-950/10"
              >
                Clear History
              </button>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
              {history.map((item) => {
                const ItemPlatform = getPlatformInfo(item.url);
                const ItemIcon = ItemPlatform.icon;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-3 bg-black/20 hover:bg-black/40 border border-[#272727] rounded-xl transition-all group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {item.thumbnail ? (
                        <div className="w-14 aspect-video rounded overflow-hidden border border-zinc-800 bg-black flex-shrink-0 relative">
                          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-14 aspect-video rounded bg-zinc-900 border border-zinc-950 flex items-center justify-center flex-shrink-0 text-zinc-700">
                          <VideoIcon className="w-4 h-4" />
                        </div>
                      )}
                      
                      <div className="min-w-0 space-y-0.5">
                        <h4 className="text-xs font-bold text-zinc-300 truncate group-hover:text-white transition-colors">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-medium">
                          <span className="flex items-center gap-1">
                            <ItemIcon className="w-3.5 h-3.5" />
                            <span className="capitalize">{item.platform}</span>
                          </span>
                          <span>•</span>
                          <span className="text-zinc-400 font-semibold">{item.resolution}</span>
                          <span>•</span>
                          <span>{item.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleHistoryItemClick(item)}
                        className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded border border-zinc-800 transition-colors"
                        title="Analyze again"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.url);
                          alert("Link copied!");
                        }}
                        className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded border border-zinc-800 transition-colors"
                        title="Copy URL"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full bg-[#0f0f0f] border-t border-[#272727] py-6 sm:py-8 mt-auto">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#717171]">
          <p>© {new Date().getFullYear()} Media Pro. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-[#aaaaaa] transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[#aaaaaa] transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>

      {/* ─── FEEDBACK / BUG REPORT MODAL (MNC STYLE) ─── */}
      {isFeedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsFeedbackOpen(false)}></div>

          <div className="relative w-full max-w-lg bg-[#181818] border border-[#272727] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            <div className="px-6 py-5 border-b border-[#272727] flex items-center justify-between bg-[#1e1e1e]">
              <h3 className="text-lg font-bold text-[#f1f1f1] flex items-center gap-2">
                <FeedbackIcon className="w-5 h-5 text-[#aaaaaa]" />
                Help & Feedback
              </h3>
              <button
                onClick={() => setIsFeedbackOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#303030] text-[#aaaaaa] hover:text-white transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#aaaaaa] mb-2">
                  What is this regarding?
                </label>
                <div className="relative">
                  <select
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value)}
                    className="w-full appearance-none bg-[#121212] border border-[#303030] text-[#f1f1f1] py-3 px-4 rounded-xl focus:outline-none focus:border-[#3ea6ff] focus:ring-1 focus:ring-[#3ea6ff] transition-all"
                  >
                    <option value="Bug Report">Report a Bug</option>
                    <option value="Feature Idea">Feature Idea / Suggestion</option>
                    <option value="General Help">General Help</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#aaaaaa]">
                    <ChevronDownIcon className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#aaaaaa] mb-2">
                  Description
                </label>
                <textarea
                  required
                  rows="4"
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder="Please describe the issue or share your ideas..."
                  className="w-full bg-[#121212] border border-[#303030] text-[#f1f1f1] py-3 px-4 rounded-xl focus:outline-none focus:border-[#3ea6ff] focus:ring-1 focus:ring-[#3ea6ff] transition-all resize-none placeholder-[#555555]"
                ></textarea>
                <p className="text-xs text-[#717171] mt-2 flex items-start gap-1">
                  <InfoIcon className="w-4 h-4 flex-shrink-0" />
                  <span>Submitting will draft an email to the developer. Basic system diagnostics (Browser/OS) will be included.</span>
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFeedbackOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-medium text-[#aaaaaa] hover:text-[#f1f1f1] hover:bg-[#303030] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#f1f1f1] text-[#0f0f0f] rounded-xl font-bold hover:bg-[#d9d9d9] transition-colors flex items-center gap-2"
                >
                  Draft Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global CSS for custom scrollbar */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f3f; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #717171; }
      `,
        }}
      />
    </div>
  );
}
