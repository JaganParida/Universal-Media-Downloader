"use client";
import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const [error, setError] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("");

  // 1. Fetch the video details
  const fetchMetadata = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setVideoData(null);

    try {
      const response = await fetch("http://localhost:5000/api/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok)
        throw new Error("Could not analyze the link. Make sure it is public.");

      const data = await response.json();
      setVideoData(data);

      // Auto-select the first available format
      if (data.formats && data.formats.length > 0) {
        setSelectedFormat(data.formats[0].format_id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Trigger the native browser download
  const handleDownload = () => {
    if (!selectedFormat || !videoData) return;

    // We build a URL that hits our backend GET route, passing the data as query parameters
    const downloadUrl = `http://localhost:5000/api/download?url=${encodeURIComponent(url)}&format_id=${selectedFormat}&title=${encodeURIComponent(videoData.title)}`;

    // Using window.location forces the browser to handle the file download natively
    window.location.href = downloadUrl;
  };

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-indigo-200">
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        {/* Header section with premium typography */}
        <div className="text-center mb-12 space-y-4">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-neutral-900">
            Media{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">
              Downloader
            </span>
          </h1>
          <p className="text-lg text-neutral-500 max-w-xl mx-auto font-medium">
            Paste a public link from YouTube, Facebook, or Instagram. We'll
            handle the rest.
          </p>
        </div>

        {/* Search Input Container */}
        <div className="bg-white p-2 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-100 mb-8 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <form
            onSubmit={fetchMetadata}
            className="flex flex-col md:flex-row gap-2"
          >
            <input
              type="url"
              required
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 px-6 py-4 bg-transparent focus:outline-none text-lg placeholder-neutral-400"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-8 py-4 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-all duration-200 shadow-md active:scale-[0.98]"
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
                  Processing...
                </span>
              ) : (
                "Fetch Media"
              )}
            </button>
          </form>
        </div>

        {/* Error Handling UI */}
        {error && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 p-4 mb-8 bg-red-50 border border-red-100 text-red-600 rounded-xl text-center font-medium shadow-sm">
            {error}
          </div>
        )}

        {/* The Result Card */}
        {videoData && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-neutral-100 overflow-hidden flex flex-col md:flex-row">
            {/* Left side: Thumbnail */}
            <div className="md:w-5/12 bg-neutral-100 relative group overflow-hidden">
              <img
                src={videoData.thumbnail}
                alt={videoData.title}
                className="w-full h-full object-cover min-h-[240px] group-hover:scale-105 transition-transform duration-700 ease-out"
              />
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
                  Select your preferred quality to begin downloading.
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <select
                    className="w-full appearance-none bg-neutral-50 border border-neutral-200 text-neutral-900 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-4 pr-10 cursor-pointer transition-all shadow-sm hover:bg-neutral-100"
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                  >
                    {videoData.formats.map((format) => (
                      <option key={format.format_id} value={format.format_id}>
                        {format.hasVideo ? "🎥" : "🎵"} {format.resolution} •{" "}
                        {format.ext.toUpperCase()} ({format.filesize})
                      </option>
                    ))}
                  </select>
                  {/* Custom Arrow Icon */}
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

                <button
                  onClick={handleDownload}
                  className="w-full px-6 py-4 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-bold rounded-xl hover:from-indigo-600 hover:to-cyan-600 transition-all shadow-lg shadow-indigo-500/25 flex justify-center items-center gap-2 active:scale-[0.98]"
                >
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
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
    </main>
  );
}
