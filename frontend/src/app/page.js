"use client";
import { useState, useRef, useEffect } from "react";

const API_BASE = "https://universal-media-downloader-re6r.onrender.com";

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

  // Modals State
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Feedback Form State
  const [feedbackType, setFeedbackType] = useState("Bug Report");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const dropdownContainerRef = useRef(null);
  const dropdownButtonRef = useRef(null);

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

  // Prevent background scrolling when any modal is open
  useEffect(() => {
    if (isProfileOpen || isFeedbackOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isProfileOpen, isFeedbackOpen]);

  const toggleDropdown = () => {
    if (!isDropdownOpen && dropdownButtonRef.current) {
      const rect = dropdownButtonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropdownDirection(spaceBelow < 280 ? "up" : "down");
    }
    setIsDropdownOpen(!isDropdownOpen);
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
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedFormatObj || !videoData) return;

    setIsDownloading(true);
    setDownloadProgress(0);
    setIsDropdownOpen(false);

    const downloadUrl = `${API_BASE}/api/download?url=${encodeURIComponent(url)}&format_id=${selectedFormatObj.format_id}&title=${encodeURIComponent(videoData.title)}`;

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

      const blob = new Blob(chunks, { type: "video/mp4" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${videoData.title.replace(/[^\w\s-]/gi, "")}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      setDownloadProgress(100);
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
      }, 3000);
    } catch (err) {
      console.error("Download Error:", err);
      setError(err.message || "Download failed");
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  // Feedback Submission Handler via mailto
  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) return;

    const userAgent = navigator.userAgent;
    const bodyText = `${feedbackMessage}\n\n------------------------\nUser Diagnostics (Do Not Edit):\nSystem: ${userAgent}\nTime: ${new Date().toLocaleString()}`;

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
          <svg
            className="w-4 h-4 text-[#aaaaaa]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          Audio Only
        </span>
      );
    }
    const isHD =
      format.stdRes === "1080p" ||
      format.stdRes === "720p" ||
      format.stdRes === "1440p" ||
      format.stdRes === "4K";
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

  const isFacebook =
    url.toLowerCase().includes("facebook.com") ||
    url.toLowerCase().includes("fb.watch");
  const isYouTube =
    url.toLowerCase().includes("youtube.com") ||
    url.toLowerCase().includes("youtu.be");

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#f1f1f1] font-sans flex flex-col selection:bg-[#9333ea] selection:text-white relative">
      {/* ─── YOUTUBE STYLE STICKY HEADER ─── */}
      <header className="sticky top-0 z-40 w-full bg-[#0f0f0f]/95 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-sm border-b border-[#272727]">
        <div className="flex items-center cursor-pointer">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-2.5">
            <img
              src="/icon.svg"
              alt="Media Pro Logo"
              className="w-full h-full object-contain"
            />
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
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <span className="hidden sm:inline">Help & Feedback</span>
          </button>
          <button
            onClick={() => setIsProfileOpen(true)}
            className="w-8 h-8 rounded-full overflow-hidden border border-[#3f3f3f] hover:border-[#717171] transition-colors bg-[#1e1e1e] flex items-center justify-center"
          >
            <svg
              className="w-6 h-6 text-[#717171]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"
                clipRule="evenodd"
              />
            </svg>
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
              Paste a public URL from YouTube, Instagram, or Facebook to
              download pristine, high-definition media directly to your device.
            </p>
          </div>

          {/* YouTube Premium Style Input Area */}
          <div className="space-y-3">
            <form
              onSubmit={fetchMetadata}
              className="relative flex flex-col sm:flex-row shadow-lg"
            >
              <div className="relative flex-1 flex">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-[#717171]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
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
                type="submit"
                disabled={isLoading || !url}
                className="mt-3 sm:mt-0 px-8 py-3.5 bg-[#222222] border border-[#303030] sm:border-l-0 hover:bg-[#303030] text-[#f1f1f1] font-medium sm:rounded-r-full sm:rounded-l-none rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <svg
                    className="animate-spin h-5 w-5 text-[#f1f1f1]"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  "Search"
                )}
              </button>
            </form>

            {/* Dynamic Warnings */}
            <div className="px-3 h-5">
              {isFacebook && (
                <p className="text-xs text-[#aaaaaa] flex items-center gap-1.5 animate-in fade-in duration-300">
                  <svg
                    className="w-4 h-4 text-[#a855f7]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>
                    <strong>Note:</strong> Facebook videos will only contain
                    audio if the underlying music is strictly public.
                  </span>
                </p>
              )}
              {isYouTube && (
                <p className="text-xs text-[#aaaaaa] flex items-center gap-1.5 animate-in fade-in duration-300">
                  <svg
                    className="w-4 h-4 text-[#ff4e4e]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span>
                    <strong>Requirement:</strong> Ensure the YouTube video is
                    fully public. Private or unlisted videos cannot be fetched.
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-[#ff0000]/10 border border-[#ff0000]/30 text-[#ff4e4e] rounded-xl flex items-start gap-3">
              <svg
                className="w-5 h-5 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Video Data Display */}
          {videoData && (
            <div className="bg-[#181818] border border-[#272727] rounded-2xl overflow-hidden shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="relative aspect-video bg-black group overflow-hidden border-b border-[#272727]">
                {videoData.thumbnail && !imgError ? (
                  <img
                    src={videoData.thumbnail}
                    alt={videoData.title}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 absolute inset-0"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center w-full h-full text-[#555555] bg-[#121212] absolute inset-0">
                    <svg
                      className="w-16 h-16 mb-3 opacity-40"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M21 3H3C2.44772 3 2 3.44772 2 4V20C2 20.5523 2.44772 21 3 21H21C21.5523 21 22 20.5523 22 20V4C22 3.44772 21.5523 3 21 3ZM20 19H4V5H20V19ZM15.5 10.5C15.5 11.3284 14.8284 12 14 12C13.1716 12 12.5 11.3284 12.5 10.5C12.5 9.67157 13.1716 9 14 9C14.8284 9 15.5 9.67157 15.5 10.5ZM8.5 15.5L11.5 11.5L14 14.5L17 10L19 15.5H5L8.5 15.5Z" />
                    </svg>
                    <span className="text-sm font-medium tracking-wide">
                      Media preview unavailable
                    </span>
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

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#272727]">
                  <div
                    className="relative w-full sm:w-1/2"
                    ref={dropdownContainerRef}
                  >
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
                      <svg
                        className={`w-4 h-4 text-[#aaaaaa] transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {isDropdownOpen && (
                      <div
                        className={`absolute z-10 w-full bg-[#222222] border border-[#303030] shadow-2xl rounded-xl overflow-hidden py-2 ${dropdownDirection === "up" ? "bottom-full mb-2" : "top-full mt-2"}`}
                      >
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                          {videoData.formats.map((format, idx) => {
                            const isSelected =
                              selectedFormatObj?.format_id === format.format_id;
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  setSelectedFormatObj(format);
                                  setIsDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-5 py-3 text-left transition-colors ${isSelected ? "bg-[#333333] border-l-2 border-[#f1f1f1]" : "hover:bg-[#303030] border-l-2 border-transparent"}`}
                              >
                                <div className="flex items-center gap-3">
                                  {isSelected && (
                                    <svg
                                      className="w-4 h-4 text-[#f1f1f1]"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="3"
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  )}
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

                  <button
                    onClick={handleDownload}
                    disabled={isDownloading || !selectedFormatObj}
                    className="relative overflow-hidden w-full sm:w-1/2 px-5 py-3.5 bg-[#f1f1f1] hover:bg-[#d9d9d9] text-[#0f0f0f] font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isDownloading && downloadProgress < 100 && (
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-black/10 transition-all duration-300 z-0"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {isDownloading ? (
                        downloadProgress === 100 ? (
                          <>
                            <svg
                              className="w-5 h-5 text-green-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M5 13l4 4L19 7"
                              ></path>
                            </svg>{" "}
                            Complete!
                          </>
                        ) : (
                          `Processing... ${downloadProgress}%`
                        )
                      ) : (
                        <>
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            ></path>
                          </svg>{" "}
                          Download File
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── SLEEK MINI-PROFILE CARD (Trigger for Modal) ─── */}
        <div className="w-full max-w-3xl mt-16 sm:mt-24 mb-4">
          <button
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-4 px-5 py-3.5 bg-[#181818] hover:bg-[#202020] border border-[#272727] hover:border-[#3a3a3a] rounded-2xl transition-all shadow-lg group mx-auto w-fit"
          >
            {/* Using the exact dark SVG from your screenshot */}
            <div className="w-12 h-12 rounded-full overflow-hidden border border-[#3f3f3f] bg-[#1e1e1e] flex items-center justify-center text-[#aaaaaa]">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-10 h-10"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="text-left pr-2">
              <h4 className="text-[#f1f1f1] font-semibold text-sm group-hover:text-white transition-colors">
                Developed by Jagan Parida
              </h4>
              <p className="text-[#aaaaaa] text-xs">
                Full Stack Developer | View Profile
              </p>
            </div>
            <svg
              className="w-5 h-5 text-[#717171] group-hover:text-white transition-colors ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-[#0f0f0f] border-t border-[#272727] py-6 sm:py-8 mt-auto">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#717171]">
          <p>© {new Date().getFullYear()} Media Pro. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-[#aaaaaa] transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-[#aaaaaa] transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </footer>

      {/* ─── PREMIUM GLASSMORPHISM PROFILE MODAL ─── */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="absolute inset-0"
            onClick={() => setIsProfileOpen(false)}
          ></div>

          <div className="relative w-full max-w-xl bg-[#181818] border border-[#272727] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-end px-4 py-3 border-b border-[#272727]">
              <button
                onClick={() => setIsProfileOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-[#272727] hover:bg-[#3f3f3f] text-[#aaaaaa] hover:text-white transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                {/* Fallback to exactly the grey user icon from your screenshot if image is missing */}
                <div className="w-24 h-24 rounded-full overflow-hidden border border-[#3f3f3f] flex-shrink-0 bg-[#1e1e1e] flex items-center justify-center">
                  <img
                    src="/jagan-profile.jpg"
                    alt="Jagan Parida"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = "none"; // hide broken image tag
                      e.target.nextSibling.style.display = "block"; // show inline SVG fallback
                    }}
                  />
                  {/* Default Dark SVG inside popup */}
                  <svg
                    style={{ display: "none" }}
                    viewBox="0 0 24 24"
                    fill="#303030"
                    className="w-20 h-20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="text-center sm:text-left space-y-2">
                  <h3 className="text-2xl font-bold text-[#f1f1f1]">
                    Jagan Parida
                  </h3>
                  <p className="text-sm font-medium text-[#a855f7]">
                    Full Stack Developer (MERN) | React.js, Next.js, GSAP &
                    Agentic AI | Java DSA Enthusiast
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4 text-sm text-[#aaaaaa] leading-relaxed">
                <p>
                  I am a 3rd-year Computer Science & Engineering student at
                  Centurion University (Class of '27), dedicated to bridging the
                  gap between robust engineering logic and immersive user
                  experiences.
                </p>
              </div>

              <div className="mt-8 flex gap-4 justify-center sm:justify-start">
                <a
                  href="https://github.com/JaganParida"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#222222] hover:bg-[#303030] text-[#f1f1f1] rounded-xl transition-colors text-sm font-medium border border-[#303030]"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  GitHub
                </a>
                {/* Specifically requested Official LinkedIn Blue */}
                <a
                  href="https://www.linkedin.com/in/jagan-parida04/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#222222] hover:bg-[#0A66C2]/10 text-[#f1f1f1] hover:text-[#0A66C2] rounded-xl transition-all text-sm font-medium border border-[#303030] hover:border-[#0A66C2]/30"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                  LinkedIn
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── FEEDBACK / BUG REPORT MODAL (MNC STYLE) ─── */}
      {isFeedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="absolute inset-0"
            onClick={() => setIsFeedbackOpen(false)}
          ></div>

          <div className="relative w-full max-w-lg bg-[#181818] border border-[#272727] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            <div className="px-6 py-5 border-b border-[#272727] flex items-center justify-between bg-[#1e1e1e]">
              <h3 className="text-lg font-bold text-[#f1f1f1] flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-[#aaaaaa]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
                Help & Feedback
              </h3>
              <button
                onClick={() => setIsFeedbackOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#303030] text-[#aaaaaa] hover:text-white transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
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
                    <option value="Bug Report">🐛 Report a Bug</option>
                    <option value="Feature Idea">
                      💡 Feature Idea / Suggestion
                    </option>
                    <option value="General Help">❓ General Help</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#aaaaaa]">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
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
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Submitting will draft an email to the developer. Basic system
                  diagnostics (Browser/OS) will be included to help resolve bugs
                  faster.
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
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  Send Feedback
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
