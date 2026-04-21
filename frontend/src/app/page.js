"use client";
import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const [error, setError] = useState("");

  // Advanced Dropdown & Progress States
  const [selectedFormatObj, setSelectedFormatObj] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [imgError, setImgError] = useState(false);

  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchMetadata = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setVideoData(null);
    setDownloadProgress(0);
    setIsDownloading(false);
    setImgError(false);

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

      if (!response.ok) {
        throw new Error(data.error || "Could not analyze the link.");
      }

      setVideoData(data);

      if (data.formats && data.formats.length > 0) {
        setSelectedFormatObj(data.formats[0]);
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
      console.error("Stream Download Error:", err);
      window.location.href = downloadUrl;
      setIsDownloading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans selection:bg-indigo-200">
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-20">
        {/* Premium Header */}
        <div className="text-center mb-16 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center justify-center p-3.5 mb-2 bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-zinc-100">
            <svg
              className="w-8 h-8 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              ></path>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-zinc-900">
            Media{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
              Pro
            </span>
          </h1>
          <p className="text-lg text-zinc-500 max-w-xl mx-auto font-medium">
            Paste a public URL from Instagram or Facebook. Download pristine,
            high-definition media directly to your device.
          </p>
        </div>

        {/* Search Bar Container */}
        <div className="relative z-20 max-w-2xl mx-auto">
          <div className="bg-white p-2.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-zinc-100 transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)]">
            <form
              onSubmit={fetchMetadata}
              className="flex flex-col md:flex-row gap-2"
            >
              <input
                type="url"
                required
                placeholder="https://www.instagram.com/reel/..."
                className="flex-1 px-6 py-4 bg-transparent focus:outline-none text-lg placeholder-zinc-400 font-medium"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button
                type="submit"
                disabled={isLoading || isDownloading}
                className="px-8 py-4 bg-zinc-900 text-white font-semibold rounded-xl hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-all duration-200 shadow-md active:scale-[0.98] flex items-center justify-center min-w-[160px]"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
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
                    Analyzing
                  </span>
                ) : (
                  "Fetch Media"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mt-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300 p-5 bg-red-50/50 border border-red-100 rounded-2xl flex items-start gap-4">
            <div className="p-2 bg-red-100/50 rounded-lg shrink-0">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                ></path>
              </svg>
            </div>
            <div>
              <h3 className="text-red-800 font-bold text-lg">
                Unable to Fetch
              </h3>
              <p className="text-red-600/80 font-medium text-sm mt-1">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Result Card */}
        {videoData && (
          <div className="mt-12 animate-in fade-in slide-in-from-bottom-6 duration-700 bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-zinc-100 overflow-hidden flex flex-col md:flex-row relative z-10">
            {/* Left side: Premium Image Display */}
            <div className="md:w-5/12 relative group overflow-hidden bg-zinc-50 flex items-center justify-center min-h-[300px]">
              {videoData.thumbnail &&
              videoData.thumbnail !== "null" &&
              !imgError ? (
                <>
                  <div className="absolute inset-0 bg-black/10 z-10 group-hover:bg-black/0 transition-colors duration-500"></div>
                  <img
                    src={videoData.thumbnail}
                    alt={videoData.title}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                </>
              ) : (
                <div className="w-full h-full absolute inset-0 bg-gradient-to-br from-indigo-50 to-zinc-50 flex items-center justify-center border-r border-zinc-100">
                  <div className="w-24 h-24 bg-white/60 backdrop-blur-xl rounded-2xl shadow-sm flex items-center justify-center border border-white">
                    <svg
                      className="w-10 h-10 text-indigo-400"
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
            <div className="md:w-7/12 p-8 md:p-10 flex flex-col justify-center bg-white">
              <div className="mb-8">
                <span className="inline-block px-3 py-1 bg-zinc-100 text-zinc-600 text-xs font-bold rounded-full mb-4 tracking-wider uppercase">
                  Ready to Download
                </span>
                <h2
                  className="text-2xl font-bold text-zinc-900 leading-tight mb-3 line-clamp-2"
                  title={videoData.title}
                >
                  {videoData.title}
                </h2>
                <p className="text-sm text-zinc-500 font-medium">
                  Select your desired resolution. Files are securely processed
                  and merged before saving.
                </p>
              </div>

              <div className="space-y-5">
                {/* Custom Premium Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    disabled={isDownloading}
                    className="w-full flex items-center justify-between bg-white border border-zinc-200 text-zinc-900 text-base font-medium rounded-xl p-4 shadow-sm hover:border-indigo-300 hover:ring-2 hover:ring-indigo-100 transition-all focus:outline-none"
                  >
                    {selectedFormatObj ? (
                      <span className="flex items-center gap-3">
                        <span
                          className={`p-1.5 rounded-md ${selectedFormatObj.hasVideo ? "bg-indigo-50 text-indigo-600" : "bg-purple-50 text-purple-600"}`}
                        >
                          {selectedFormatObj.hasVideo ? (
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
                                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                              ></path>
                            </svg>
                          ) : (
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
                                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                              ></path>
                            </svg>
                          )}
                        </span>
                        <span>
                          {selectedFormatObj.resolution} •{" "}
                          {selectedFormatObj.ext.toUpperCase()}{" "}
                          {selectedFormatObj.filesize
                            ? `(${selectedFormatObj.filesize})`
                            : ""}
                        </span>
                      </span>
                    ) : (
                      "Select Quality"
                    )}
                    <svg
                      className={`w-5 h-5 text-zinc-400 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`}
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

                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-zinc-100 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      {videoData.formats.map((format, idx) => (
                        <button
                          key={format.format_id + idx}
                          onClick={() => {
                            setSelectedFormatObj(format);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-zinc-50 transition-colors ${selectedFormatObj?.format_id === format.format_id ? "bg-indigo-50/50 text-indigo-700 font-semibold" : "text-zinc-700 font-medium"}`}
                        >
                          <span
                            className={`p-1.5 rounded-md ${format.hasVideo ? "bg-indigo-50 text-indigo-500" : "bg-purple-50 text-purple-500"}`}
                          >
                            {format.hasVideo ? (
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
                                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                ></path>
                              </svg>
                            ) : (
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
                                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                                ></path>
                              </svg>
                            )}
                          </span>
                          <span className="flex-1">
                            {format.resolution}{" "}
                            <span className="text-zinc-400 font-normal ml-1">
                              • {format.ext.toUpperCase()}
                            </span>
                          </span>
                          {format.filesize && (
                            <span className="text-sm text-zinc-500">
                              {format.filesize}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Animated Download Button */}
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className={`relative w-full px-6 py-4 font-bold rounded-xl transition-all shadow-lg overflow-hidden flex justify-center items-center gap-2 active:scale-[0.98] ${
                    isDownloading
                      ? downloadProgress === 100
                        ? "bg-green-500 text-white shadow-green-500/25 ring-2 ring-green-500 ring-offset-2"
                        : "bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-none"
                      : "bg-zinc-900 text-white hover:bg-zinc-800 shadow-zinc-900/20"
                  }`}
                >
                  {/* Progress Bar Background fill */}
                  {isDownloading && downloadProgress < 100 && (
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-indigo-100 transition-all duration-300 ease-out"
                      style={{ width: `${downloadProgress}%` }}
                    ></div>
                  )}

                  {/* Button Content */}
                  <div className="relative z-10 flex items-center gap-2">
                    {isDownloading ? (
                      downloadProgress === 100 ? (
                        <>
                          <svg
                            className="w-5 h-5 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="3"
                              d="M5 13l4 4L19 7"
                            ></path>
                          </svg>
                          Download Complete!
                        </>
                      ) : (
                        <>
                          <svg
                            className="animate-spin h-5 w-5 text-indigo-600"
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
                          Processing... {downloadProgress}%
                        </>
                      )
                    ) : (
                      <>
                        <svg
                          className="w-5 h-5"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download File
                      </>
                    )}
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
