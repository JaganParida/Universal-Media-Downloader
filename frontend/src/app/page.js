"use client";
import { useState, useRef, useEffect } from "react";

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

  const toggleDropdown = () => {
    if (!isDropdownOpen && dropdownButtonRef.current) {
      const rect = dropdownButtonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;

      if (spaceBelow < 280) {
        setDropdownDirection("up");
      } else {
        setDropdownDirection("down");
      }
    }
    setIsDropdownOpen(!isDropdownOpen);
  };

  // STRICT FRONTEND NORMALIZER FOR YOUTUBE FORMATS ONLY
  const normalizeFormats = (rawFormats) => {
    const standardMap = new Map();

    rawFormats.forEach((f) => {
      let stdRes = "Audio Only";
      let sortVal = 0;

      if (f.hasVideo) {
        const num = parseInt((f.resolution || "").replace(/\D/g, ""));
        if (!isNaN(num)) {
          // Force vertical and horizontal videos into strict YouTube buckets
          if (num >= 1000) {
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
        // Keep the format with the larger file size if duplicates exist
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
      const response = await fetch(
        "https://universal-media-downloader-re6r.onrender.com/api/info",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        },
      );

      const data = await response.json();

      if (!response.ok)
        throw new Error(data.error || "Could not analyze the link.");

      // Normalize the data strictly on the frontend
      const perfectFormats = normalizeFormats(data.formats || []);
      setVideoData({ ...data, formats: perfectFormats });

      if (perfectFormats.length > 0) {
        setSelectedFormatObj(perfectFormats[0]);
      }
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

    const downloadUrl = `https://universal-media-downloader-re6r.onrender.com/api/download?url=${encodeURIComponent(
      url,
    )}&format_id=${selectedFormatObj.format_id}&title=${encodeURIComponent(videoData.title)}`;

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Download failed at server.");

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
      window.location.href = downloadUrl;
      setIsDownloading(false);
    }
  };

  const renderQualityLabel = (format) => {
    if (format.stdRes === "Audio Only") {
      return (
        <span className="font-normal text-[#f1f1f1] text-[15px]">
          Audio Only
        </span>
      );
    }
    const isHD = format.stdRes === "1080p" || format.stdRes === "720p";
    return (
      <span className="font-normal text-[#f1f1f1] text-[15px] flex items-center">
        {format.stdRes}
        {isHD && (
          <span className="ml-1.5 text-[10px] font-bold text-[#aaaaaa] tracking-wide uppercase">
            HD
          </span>
        )}
      </span>
    );
  };

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-[#f1f1f1] font-sans selection:bg-[#3ea6ff]/30">
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-20 relative">
        <div className="text-center mb-16 space-y-4 animate-in fade-in duration-700">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white">
            Media <span className="text-[#3ea6ff]">Pro</span>
          </h1>
          <p className="text-base text-[#aaaaaa] max-w-xl mx-auto font-medium">
            Paste a public URL from Instagram or Facebook. Download pristine,
            high-definition media directly.
          </p>
        </div>

        <div className="relative z-[60] max-w-2xl mx-auto">
          <form
            onSubmit={fetchMetadata}
            className="flex flex-col md:flex-row gap-3"
          >
            <input
              type="url"
              required
              placeholder="Paste video link here..."
              className="flex-1 px-6 py-4 bg-[#121212] border border-[#303030] rounded-xl focus:outline-none focus:border-[#3ea6ff] text-lg placeholder-[#717171] text-white transition-colors shadow-inner"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button
              type="submit"
              disabled={isLoading || isDownloading}
              className="px-8 py-4 bg-[#f1f1f1] text-[#0f0f0f] font-semibold rounded-xl hover:bg-[#d9d9d9] disabled:bg-[#303030] disabled:text-[#717171] disabled:cursor-not-allowed transition-all min-w-[160px]"
            >
              {isLoading ? "Analyzing..." : "Fetch Media"}
            </button>
          </form>
        </div>

        {error && (
          <div className="mt-8 max-w-2xl mx-auto p-5 bg-[#272727] border border-red-500/30 rounded-xl flex items-start gap-4">
            <div className="text-red-400 font-medium">{error}</div>
          </div>
        )}

        {videoData && (
          /* CARD WRAPPER - NO OVERFLOW HIDDEN HERE to allow dropdown to escape */
          <div className="mt-12 animate-in fade-in duration-700 flex flex-col md:flex-row relative z-50 rounded-2xl shadow-2xl">
            {/* Left side: Premium Image Display */}
            <div className="md:w-5/12 relative group bg-[#0a0a0a] flex items-center justify-center min-h-[300px] border border-[#303030] rounded-t-2xl md:rounded-t-none md:rounded-l-2xl overflow-hidden">
              {videoData.thumbnail && !imgError ? (
                <img
                  src={videoData.thumbnail}
                  alt={videoData.title}
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300 absolute inset-0"
                />
              ) : (
                <div className="w-full h-full absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] flex items-center justify-center">
                  <div className="w-24 h-24 bg-[#212121]/80 backdrop-blur-xl rounded-2xl shadow-xl flex items-center justify-center border border-[#303030]">
                    <svg
                      className="w-10 h-10 text-[#3ea6ff] opacity-80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      ></path>
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* Right side: Action Area */}
            <div className="md:w-7/12 p-6 md:p-10 flex flex-col justify-center bg-[#121212] border border-t-0 md:border-t md:border-l-0 border-[#303030] rounded-b-2xl md:rounded-b-none md:rounded-r-2xl">
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white leading-tight mb-2 line-clamp-2">
                  {videoData.title}
                </h2>
                {videoData.description && (
                  <p className="text-[#aaaaaa] text-sm mb-4 line-clamp-3 leading-relaxed">
                    {videoData.description}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {/* DARK YOUTUBE EXACT DROPDOWN */}
                <div className="relative z-[100]" ref={dropdownContainerRef}>
                  <button
                    ref={dropdownButtonRef}
                    type="button"
                    onClick={toggleDropdown}
                    disabled={isDownloading}
                    className="w-full flex items-center justify-between bg-[#212121] border border-[#303030] hover:bg-[#3d3d3d] text-white text-base rounded-xl p-4 transition-colors focus:outline-none"
                  >
                    {selectedFormatObj ? (
                      <div className="flex items-center gap-2">
                        {renderQualityLabel(selectedFormatObj)}
                      </div>
                    ) : (
                      <span className="text-[#aaaaaa]">Select Quality</span>
                    )}
                    <svg
                      className={`w-5 h-5 text-[#aaaaaa] transition-transform ${isDropdownOpen ? (dropdownDirection === "up" ? "" : "rotate-180") : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 9l-7 7-7-7"
                      ></path>
                    </svg>
                  </button>

                  {/* Popup Menu */}
                  {isDropdownOpen && (
                    <div
                      className={`absolute z-[100] w-full bg-[#282828] border border-[#404040] rounded-xl shadow-2xl py-2 max-h-64 overflow-y-auto animate-in fade-in duration-200
                        ${dropdownDirection === "up" ? "bottom-full mb-2 origin-bottom slide-in-from-bottom-2" : "top-full mt-2 origin-top slide-in-from-top-2"}
                      `}
                    >
                      {videoData.formats.map((format, idx) => {
                        const isSelected =
                          selectedFormatObj?.format_id === format.format_id;

                        return (
                          <button
                            key={format.format_id + idx}
                            onClick={() => {
                              setSelectedFormatObj(format);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors ${isSelected ? "bg-[#3d3d3d]" : "hover:bg-[#3ea6ff]/10"}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-5 flex justify-center shrink-0">
                                {isSelected && (
                                  <svg
                                    className="w-5 h-5 text-white"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    strokeWidth="2.5"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    ></path>
                                  </svg>
                                )}
                              </div>
                              {renderQualityLabel(format)}
                            </div>

                            {format.filesize && (
                              <span className="text-[13px] text-[#aaaaaa]">
                                {format.filesize}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className={`relative w-full px-6 py-4 font-bold rounded-xl transition-all overflow-hidden flex justify-center items-center gap-2 ${
                    isDownloading
                      ? downloadProgress === 100
                        ? "bg-green-600 text-white"
                        : "bg-[#212121] border border-[#303030] text-white"
                      : "bg-[#3ea6ff] text-[#0f0f0f] hover:bg-[#65b8ff]"
                  }`}
                >
                  {isDownloading && downloadProgress < 100 && (
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-[#3ea6ff]/20 transition-all duration-300 ease-out"
                      style={{ width: `${downloadProgress}%` }}
                    ></div>
                  )}
                  <div className="relative z-10 flex items-center gap-2">
                    {isDownloading
                      ? downloadProgress === 100
                        ? "Download Complete!"
                        : `Processing... ${downloadProgress}%`
                      : "Download File"}
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
