export default function HandMeasureDiagram({ size = 100, showLine = true }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Palm */}
      <path d="M30 60 L30 100 Q30 112 42 112 L58 112 Q70 112 70 100 L70 60 Z" fill="var(--teal)" stroke="var(--muted)" strokeWidth="1.5"/>
      {/* Thumb */}
      <path d="M30 68 C18 66 12 74 14 82 C16 88 24 88 30 82 Z" fill="var(--teal)" stroke="var(--muted)" strokeWidth="1.5"/>
      {/* Fingers */}
      <rect x="32" y="20" width="9" height="42" rx="4.5" fill="var(--teal)" stroke="var(--muted)" strokeWidth="1.5"/>
      <rect x="43" y="10" width="9" height="52" rx="4.5" fill="var(--teal)" stroke="var(--muted)" strokeWidth="1.5"/>
      <rect x="54" y="14" width="9" height="48" rx="4.5" fill="var(--teal)" stroke="var(--muted)" strokeWidth="1.5"/>
      <rect x="65" y="24" width="8" height="40" rx="4" fill="var(--teal)" stroke="var(--muted)" strokeWidth="1.5"/>
      {/* Measurement line straight across the palm, dotted, with end ticks */}
      {showLine && (
        <>
          <line x1="26" y1="78" x2="74" y2="78" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.5 6"/>
          <line x1="26" y1="73" x2="26" y2="83" stroke="var(--accent)" strokeWidth="2.5"/>
          <line x1="74" y1="73" x2="74" y2="83" stroke="var(--accent)" strokeWidth="2.5"/>
        </>
      )}
    </svg>
  );
}
