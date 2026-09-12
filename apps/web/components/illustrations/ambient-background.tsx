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
 * Contained hero decoration: scattered waveform fragments, evoking raw meeting
 * audio. Sits behind the hero section only — not stretched across the page.
 */
export function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <WaveformIcon className="absolute left-[6%] top-[8%] h-5 w-16 opacity-[0.2] -rotate-6" />
      <WaveformIcon className="absolute right-[8%] top-[5%] h-4 w-14 opacity-[0.16] rotate-3" />
      <WaveformIcon className="absolute left-[30%] top-[3%] h-4 w-12 opacity-[0.14] rotate-2" />
      <WaveformIcon className="absolute right-[24%] top-[10%] h-4 w-14 opacity-[0.18] -rotate-3" />
    </div>
  )
}
