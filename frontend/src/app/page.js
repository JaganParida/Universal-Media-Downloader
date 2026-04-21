"use client";
import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const [error, setError] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("");

  // Progress States
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const fetchMetadata = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setVideoData(null);
    setDownloadProgress(0);
    setIsDownloading(false);

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
        throw new Error(
          data.error || "Could not analyze the link. Make sure it is public.",
        );
      }

      setVideoData(data);

      if (data.formats && data.formats.length > 0) {
        setSelectedFormat(data.formats[0].format_id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Advanced Fetch with Progress Tracking
  const handleDownload = async () => {
    if (!selectedFormat || !videoData) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    const downloadUrl = `https://universal-media-downloader-re6r.onrender.com/api/download?url=${encodeURIComponent(
      url,
    )}&format_id=${selectedFormat}&title=${encodeURIComponent(videoData.title)}`;

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Download failed at server.");

      // Get content length to calculate percentage
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
          // Actual exact percentage calculation
          setDownloadProgress(Math.round((loaded / total) * 100));
        } else {
          // Fallback fake progress if size is unknown
          setDownloadProgress((prev) => Math.min(prev + 5, 95));
        }
      }

      // Combine chunks into a single video Blob
      const blob = new Blob(chunks, { type: "video/mp4" });
      const blobUrl = URL.createObjectURL(blob);

      // Native trigger to save file
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${videoData.title.replace(/[^\w\s-]/gi, "")}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      setDownloadProgress(100);

      // Reset UI after 3 seconds
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
      }, 3000);
    } catch (err) {
      console.error("Stream Download Error:", err);
      // Fallback: If blob fails (e.g. mobile RAM limit), use normal download
      window.location.href = downloadUrl;
      setIsDownloading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-indigo-200">
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        {/* Premium Header */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center justify-center p-3 mb-4 bg-indigo-50 rounded-2xl">
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
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-neutral-900">
            Media{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
              Downloader
            </span>
          </h1>
          <p className="text-lg text-neutral-500 max-w-xl mx-auto font-medium">
            Paste a public video link from Instagram or Facebook. Get your media
            in high definition.
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-white p-2 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-100 mb-8 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <form
            onSubmit={fetchMetadata}
            className="flex flex-col md:flex-row gap-2"
          >
            <input
              type="url"
              required
              placeholder="https://www.instagram.com/reel/..."
              className="flex-1 px-6 py-4 bg-transparent focus:outline-none text-lg placeholder-neutral-400"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button
              type="submit"
              disabled={isLoading || isDownloading}
              className="px-8 py-4 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-all duration-200 shadow-md active:scale-[0.98] flex items-center justify-center min-w-[160px]"
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
                  Processing
                </span>
              ) : (
                "Fetch Media"
              )}
            </button>
          </form>
        </div>

        {/* Premium Error Warning */}
        {error && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 p-5 mb-8 bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 rounded-2xl shadow-sm flex items-start gap-4">
            <div className="p-2 bg-red-100 rounded-lg shrink-0">
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
            <div className="flex-1">
              <h3 className="text-red-800 font-bold text-lg">
                Analysis Failed
              </h3>
              <p className="text-red-600 font-medium text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* The Result Card */}
        {videoData && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-neutral-100 overflow-hidden flex flex-col md:flex-row">
            {/* Left side: Thumbnail or Glassmorphism Fallback */}
            <div className="md:w-5/12 relative group overflow-hidden bg-neutral-100 flex items-center justify-center min-h-[240px]">
              {videoData.thumbnail && videoData.thumbnail !== "null" ? (
                <img
                  src={videoData.thumbnail}
                  alt={videoData.title}
                  className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-700 ease-out"
                />
              ) : (
                <div className="w-full h-full absolute inset-0 bg-gradient-to-br from-indigo-50 to-neutral-100 flex items-center justify-center border-r border-neutral-100">
                  <div className="w-24 h-24 bg-white/60 backdrop-blur-xl rounded-2xl shadow-sm flex items-center justify-center border border-white">
                    <svg
                      className="w-10 h-10 text-indigo-300"
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
              <div className="absolute bottom-3 right-3 bg-black/75 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg">
                {videoData.duration}
              </div>
            </div>

            {/* Right side: Controls */}
            <div className="md:w-7/12 p-8 flex flex-col justify-between bg-white z-10 relative">
              <div>
                <h2
                  className="text-xl font-bold text-neutral-900 leading-snug mb-2 line-clamp-2"
                  title={videoData.title}
                >
                  {videoData.title}
                </h2>
                <p className="text-sm text-neutral-500 mb-8 font-medium">
                  Select your preferred quality below. High-res files will be
                  processed before downloading.
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <select
                    className="w-full appearance-none bg-neutral-50 border border-neutral-200 text-neutral-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-4 pr-10 cursor-pointer transition-all shadow-sm hover:bg-neutral-100"
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    disabled={isDownloading}
                  >
                    {videoData.formats.map((format) => (
                      <option key={format.format_id} value={format.format_id}>
                        {format.hasVideo ? "[Video]" : "[Audio]"}{" "}
                        {format.resolution} • {format.ext.toUpperCase()} (
                        {format.filesize})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-neutral-500">
                    <svg
                      className="fill-current h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>

                {/* Animated Download Button */}
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className={`relative w-full px-6 py-4 font-bold rounded-xl transition-all shadow-lg overflow-hidden flex justify-center items-center gap-2 active:scale-[0.98] ${
                    isDownloading
                      ? downloadProgress === 100
                        ? "bg-green-500 text-white shadow-green-500/25"
                        : "bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-none"
                      : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90 shadow-indigo-500/25"
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
                          Completed!
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
                          Downloading... {downloadProgress}%
                        </>
                      )
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
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
