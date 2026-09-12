export function MeetingFlowIllustration() {
  return (
    <svg
      viewBox="0 0 480 520"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full max-w-md"
      role="img"
      aria-label="Illustration of a Google Meet call being recorded and summarized by AI"
    >
      {/* Meet call window */}
      <rect x="40" y="40" width="300" height="200" rx="16" fill="white" fillOpacity="0.08" />
      <rect x="40" y="40" width="300" height="200" rx="16" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" />
      <rect x="40" y="40" width="300" height="36" rx="16" fill="white" fillOpacity="0.06" />
      <circle cx="58" cy="58" r="4" fill="white" fillOpacity="0.35" />
      <circle cx="72" cy="58" r="4" fill="white" fillOpacity="0.35" />
      <circle cx="86" cy="58" r="4" fill="white" fillOpacity="0.35" />

      {/* Recording indicator */}
      <circle cx="300" cy="58" r="5" fill="#F87171" />
      <text x="311" y="62" fill="white" fillOpacity="0.7" fontSize="11" fontFamily="ui-monospace, monospace">
        REC
      </text>

      {/* Participant tiles */}
      <rect x="56" y="92" width="128" height="128" rx="10" fill="white" fillOpacity="0.1" />
      <circle cx="120" cy="140" r="24" fill="white" fillOpacity="0.3" />
      <rect x="56" y="196" width="128" height="16" rx="4" fill="white" fillOpacity="0.15" />

      <rect x="196" y="92" width="128" height="128" rx="10" fill="white" fillOpacity="0.1" />
      <circle cx="260" cy="140" r="24" fill="white" fillOpacity="0.22" />
      <rect x="196" y="196" width="128" height="16" rx="4" fill="white" fillOpacity="0.15" />

      {/* Flow connector */}
      <path
        d="M190 250 C 190 300, 300 280, 300 330"
        stroke="white"
        strokeOpacity="0.3"
        strokeWidth="1.5"
        strokeDasharray="4 6"
        fill="none"
      />

      {/* Transcript card */}
      <rect x="220" y="330" width="220" height="90" rx="12" fill="white" fillOpacity="0.1" />
      <rect x="220" y="330" width="220" height="90" rx="12" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" />
      <rect x="238" y="350" width="120" height="8" rx="4" fill="white" fillOpacity="0.35" />
      <rect x="238" y="368" width="184" height="8" rx="4" fill="white" fillOpacity="0.2" />
      <rect x="238" y="386" width="150" height="8" rx="4" fill="white" fillOpacity="0.2" />

      {/* Summary card */}
      <rect x="40" y="360" width="160" height="120" rx="12" fill="white" fillOpacity="0.14" />
      <rect x="40" y="360" width="160" height="120" rx="12" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" />
      <rect x="58" y="380" width="70" height="8" rx="4" fill="white" fillOpacity="0.4" />

      <circle cx="62" cy="406" r="5" fill="#34D399" />
      <rect x="76" y="402" width="104" height="7" rx="3.5" fill="white" fillOpacity="0.3" />

      <circle cx="62" cy="428" r="5" fill="#34D399" />
      <rect x="76" y="424" width="88" height="7" rx="3.5" fill="white" fillOpacity="0.3" />

      <circle cx="62" cy="450" r="5" fill="#34D399" />
      <rect x="76" y="446" width="96" height="7" rx="3.5" fill="white" fillOpacity="0.3" />
    </svg>
  )
}
