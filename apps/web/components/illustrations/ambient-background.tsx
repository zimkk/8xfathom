export function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Tiling dot-grid that repeats down the full page height */}
      <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="ambient-dots" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill="#4F46E5" fillOpacity="0.26" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ambient-dots)" />
      </svg>

      {/* Soft brand-color blobs distributed down the page */}
      <div className="absolute left-[-8%] top-[2%] h-[420px] w-[420px] rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute right-[-10%] top-[18%] h-[480px] w-[480px] rounded-full bg-primary/[0.16] blur-3xl" />
      <div className="absolute left-[-6%] top-[42%] h-[440px] w-[440px] rounded-full bg-primary/[0.18] blur-3xl" />
      <div className="absolute right-[-8%] top-[64%] h-[460px] w-[460px] rounded-full bg-primary/[0.16] blur-3xl" />
      <div className="absolute left-[-5%] top-[85%] h-[420px] w-[420px] rounded-full bg-primary/20 blur-3xl" />

      {/* Flowing connector path threading through the sections */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <path
          d="M -5 8 C 20 15, 30 5, 50 12 S 90 20, 105 10"
          stroke="#4F46E5"
          strokeOpacity="0.28"
          strokeWidth="0.2"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M -5 45 C 25 38, 35 52, 55 44 S 95 36, 105 48"
          stroke="#4F46E5"
          strokeOpacity="0.28"
          strokeWidth="0.2"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M -5 82 C 20 75, 35 88, 55 80 S 95 74, 105 84"
          stroke="#4F46E5"
          strokeOpacity="0.28"
          strokeWidth="0.2"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}
