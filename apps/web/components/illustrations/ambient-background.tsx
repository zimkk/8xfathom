function WaveformIcon({ className }: { className?: string }) {
  const bars = [4, 9, 14, 8, 16, 6, 11, 5]
  return (
    <svg viewBox="0 0 64 20" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {bars.map((h, i) => (
        <rect key={i} x={i * 8} y={10 - h / 2} width="4" height={h} rx="2" fill="#4F46E5" />
      ))}
    </svg>
  )
}

/**
 * Contained hero decoration: scattered raw audio (waveform fragments) converging
 * into a single point, then resolving into clean, structured note-lines below.
 * Meant to sit behind the hero section only — not stretched across the full page.
 */
export function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <WaveformIcon className="absolute left-[6%] top-[8%] h-5 w-16 opacity-[0.2] -rotate-6" />
      <WaveformIcon className="absolute right-[8%] top-[5%] h-4 w-14 opacity-[0.16] rotate-3" />
      <WaveformIcon className="absolute left-[30%] top-[3%] h-4 w-12 opacity-[0.14] rotate-2" />
      <WaveformIcon className="absolute right-[24%] top-[10%] h-4 w-14 opacity-[0.18] -rotate-3" />

      <svg
        className="absolute left-1/2 top-[16%] h-[220px] w-[380px] -translate-x-1/2"
        viewBox="0 0 380 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M 18 18 C 90 60, 140 95, 190 120" stroke="#4F46E5" strokeOpacity="0.15" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <path d="M 362 14 C 290 56, 235 92, 190 120" stroke="#4F46E5" strokeOpacity="0.15" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <path d="M 55 52 C 100 78, 145 100, 190 120" stroke="#4F46E5" strokeOpacity="0.12" strokeWidth="1.1" strokeLinecap="round" fill="none" />
        <path d="M 325 48 C 280 76, 235 100, 190 120" stroke="#4F46E5" strokeOpacity="0.12" strokeWidth="1.1" strokeLinecap="round" fill="none" />

        <circle cx="190" cy="120" r="3" fill="#4F46E5" fillOpacity="0.35" />

        <path d="M 190 120 C 172 142, 145 154, 108 160" stroke="#4F46E5" strokeOpacity="0.16" strokeWidth="1.1" strokeLinecap="round" fill="none" />
        <path d="M 190 120 C 193 142, 193 156, 190 175" stroke="#4F46E5" strokeOpacity="0.14" strokeWidth="1.1" strokeLinecap="round" fill="none" />
        <path d="M 190 120 C 208 142, 235 154, 272 160" stroke="#4F46E5" strokeOpacity="0.16" strokeWidth="1.1" strokeLinecap="round" fill="none" />

        <g stroke="#4F46E5" strokeWidth="1" strokeLinecap="round" opacity="0.16">
          <line x1="90" y1="172" x2="126" y2="172" />
          <line x1="94" y1="182" x2="118" y2="182" />
          <line x1="172" y1="188" x2="208" y2="188" />
          <line x1="254" y1="172" x2="290" y2="172" />
          <line x1="258" y1="182" x2="282" y2="182" />
        </g>
      </svg>

      <div className="absolute left-1/2 top-[20%] h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl" />
    </div>
  )
}
