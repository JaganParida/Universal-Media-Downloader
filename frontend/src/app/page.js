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
      setDropdownDirection(spaceBelow < 280 ? "up" : "down");
    }
    setIsDropdownOpen(!isDropdownOpen);
  };

  // Normalize formats: merge duplicates into single-quality entries
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

    const downloadUrl = `${API_BASE}/api/download?url=${encodeURIComponent(
      url,
    )}&format_id=${selectedFormatObj.format_id}&title=${encodeURIComponent(videoData.title)}`;

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

  const renderQualityLabel = (format) => {
    if (format.stdRes === "Audio Only") {
      return <span>Audio Only</span>;
    }
    const isHD =
      format.stdRes === "1080p" ||
      format.stdRes === "720p" ||
      format.stdRes === "1440p" ||
      format.stdRes === "4K";
    return (
      <span className="flex items-center gap-2">
        {format.stdRes}
        {isHD && (
          <span className="text-xs font-bold bg-blue-500/20 text-blue-400 px-1 rounded">
            HD
          </span>
        )}
      </span>
    );
  };

  return (
    <main className="min-h-screen bg-[#121212] text-white p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Media Pro</h1>
          <p className="text-gray-400">
            Paste a public URL from YouTube, Instagram, or Facebook. Download
            pristine, high-definition media directly.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={fetchMetadata} className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-4 py-3 bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg focus:outline-none focus:border-[#3ea6ff]"
            placeholder="Paste media URL here..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="submit"
            disabled={isLoading || !url}
            className="px-6 py-3 bg-[#3ea6ff] hover:bg-[#2b88d8] text-white font-semibold rounded-lg disabled:opacity-50 transition-colors"
          >
            {isLoading ? "Analyzing..." : "Fetch Media"}
          </button>
        </form>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500 text-red-500 rounded-lg">
            {error}
          </div>
        )}

        {/* Video Data Display */}
        {videoData && (
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl overflow-hidden shadow-lg">
            {/* Thumbnail */}
            <div className="relative aspect-video bg-black group overflow-hidden">
              {videoData.thumbnail && !imgError ? (
                <img
                  src={videoData.thumbnail}
                  alt={videoData.title}
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300 absolute inset-0"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-gray-500">
                  No Thumbnail Available
                </div>
              )}
            </div>

            {/* Content & Controls */}
            <div className="p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold line-clamp-2">
                  {videoData.title}
                </h2>
                {videoData.description && (
                  <p className="text-sm text-gray-400 mt-2 line-clamp-3">
                    {videoData.description}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                {/* Custom Dropdown */}
                <div
                  className="relative w-full sm:w-1/2"
                  ref={dropdownContainerRef}
                >
                  <button
                    ref={dropdownButtonRef}
                    onClick={toggleDropdown}
                    className="w-full flex items-center justify-between px-4 py-3 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#3d3d3d] rounded-lg transition-colors"
                  >
                    {selectedFormatObj ? (
                      renderQualityLabel(selectedFormatObj)
                    ) : (
                      <span>Select Quality</span>
                    )}
                    <span className="text-xs">▼</span>
                  </button>

                  {isDropdownOpen && (
                    <div
                      className={`absolute z-10 w-full bg-[#1e1e1e] border border-[#3d3d3d] shadow-xl rounded-lg overflow-hidden py-1 ${
                        dropdownDirection === "up"
                          ? "bottom-full mb-2"
                          : "top-full mt-2"
                      }`}
                    >
                      <div className="max-h-60 overflow-y-auto">
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
                              className={`w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors ${
                                isSelected
                                  ? "bg-[#3d3d3d]"
                                  : "hover:bg-[#3ea6ff]/10"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isSelected && (
                                  <span className="text-[#3ea6ff]">✓</span>
                                )}
                                {renderQualityLabel(format)}
                              </div>
                              {format.filesize && (
                                <span className="text-xs text-gray-400">
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

                {/* Download Button */}
                <button
                  onClick={handleDownload}
                  disabled={isDownloading || !selectedFormatObj}
                  className="relative overflow-hidden w-full sm:w-1/2 px-6 py-3 bg-[#3ea6ff] hover:bg-[#2b88d8] text-white font-semibold rounded-lg disabled:opacity-50 transition-colors"
                >
                  {/* Progress Bar Background */}
                  {isDownloading && downloadProgress < 100 && (
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-blue-600 transition-all duration-300 z-0"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  )}

                  {/* Button Text */}
                  <span className="relative z-10">
                    {isDownloading
                      ? downloadProgress === 100
                        ? "Download Complete!"
                        : `Processing... ${downloadProgress}%`
                      : "Download File"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
