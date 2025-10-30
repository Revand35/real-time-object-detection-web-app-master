import Head from "next/head";
import Yolo from "../components/models/Yolo";

export default function Home() {
  return (
    <>
      <Head>
        <title>AI Vision Pro - Real-Time Object Detection</title>
        <meta name="description" content="Advanced AI-powered real-time object detection with precision analytics" />
      </Head>
      
      {/* Modern gradient background with animated elements */}
      <div className="modern-bg"></div>
      
      <main className="font-sans w-screen min-h-screen relative z-10 overflow-hidden">
        {/* Top Navigation Bar - New Minimalist Design */}
        <nav className="absolute top-0 left-0 right-0 z-50 px-6 py-4">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between">
            {/* Logo & Brand */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-400/30">
                <div className="w-6 h-6 rounded-md bg-black"></div>
              </div>
              <div>
                <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 tracking-tight">
                  AI Vision Pro
                </h1>
                <p className="text-xs text-gray-500 tracking-wider uppercase">Object Detection</p>
              </div>
            </div>
            
            {/* Status Indicator */}
            <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-black/40 backdrop-blur-xl border border-yellow-400/20">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
              <span className="text-xs text-gray-400 font-medium">System Active</span>
            </div>
          </div>
        </nav>

        {/* Main Content Area - New Layout */}
        <div className="pt-24 pb-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1600px] mx-auto">
            {/* YOLO Component - Now takes full width with new design */}
            <Yolo />
          </div>
        </div>

        {/* Bottom Footer - Modern & Minimal */}
        <footer className="absolute bottom-0 left-0 right-0 z-50 px-6 py-4">
          <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400/60"></div>
              <span className="text-gray-500">
                Developed by{" "}
                <a
                  href="https://juanjaho.github.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400 hover:text-yellow-500 transition-colors font-semibold"
                >
                  juanjaho
                </a>
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>Powered by</span>
              <span className="px-3 py-1 rounded-lg bg-gradient-to-r from-yellow-400/20 to-yellow-500/20 border border-yellow-400/30 text-yellow-400 font-bold tracking-wide">
                YOLO AI
              </span>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
