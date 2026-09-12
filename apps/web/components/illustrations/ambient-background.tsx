export function AmbientBackground() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1400px] w-full"
      viewBox="0 0 1440 1400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="1180" cy="120" r="360" fill="#4F46E5" fillOpacity="0.06" />
      <circle cx="120" cy="520" r="280" fill="#4F46E5" fillOpacity="0.05" />
      <circle cx="1300" cy="900" r="320" fill="#4F46E5" fillOpacity="0.05" />

      {/* Dot grid accents */}
      <g fill="#4F46E5" fillOpacity="0.18">
        {Array.from({ length: 6 }).map((_, row) =>
          Array.from({ length: 6 }).map((_, col) => (
            <circle key={`${row}-${col}`} cx={1080 + col * 18} cy={40 + row * 18} r="1.5" />
          ))
        )}
      </g>
      <g fill="#4F46E5" fillOpacity="0.15">
        {Array.from({ length: 5 }).map((_, row) =>
          Array.from({ length: 5 }).map((_, col) => (
            <circle key={`b-${row}-${col}`} cx={80 + col * 18} cy={1080 + row * 18} r="1.5" />
          ))
        )}
      </g>

      {/* Flowing connector line through the page */}
      <path
        d="M -100 300 C 300 250, 500 450, 720 420 S 1200 350, 1540 500"
        stroke="#4F46E5"
        strokeOpacity="0.08"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M -100 950 C 300 900, 500 1100, 720 1050 S 1200 980, 1540 1120"
        stroke="#4F46E5"
        strokeOpacity="0.08"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  )
}
