// A single continuous silhouette rather than a palm box with separate finger
// bars — fingers rise out of the knuckle line and dip into valleys between
// each other, which is what makes it read as a hand at small sizes.
export default function HandMeasureDiagram({ size = 100, showLine = true }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M36 92
           C26 90 16 82 14 73
           C11 64 20 59 26 65
           C30 69 33 68 33 62
           L33 31 A5 5 0 0 1 43 31 L43 58
           Q44 61 45 58
           L45 21 A5 5 0 0 1 55 21 L55 58
           Q56 61 57 58
           L57 27 A5 5 0 0 1 67 27 L67 58
           Q68 61 69 58
           L69 41 A4 4 0 0 1 77 41 L77 62
           C77 78 75 92 73 102
           C71 110 66 114 58 114
           L48 114
           C40 114 36 109 36 101
           Z"
        fill="var(--teal)" stroke="var(--muted)" strokeWidth="1.5" strokeLinejoin="round"
      />

      {/* Knuckle creases — a few short strokes are enough to sell the palm. */}
      <path d="M40 68 Q44 66 47 68" stroke="var(--muted)" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <path d="M52 66 Q56 64 59 66" stroke="var(--muted)" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <path d="M63 68 Q67 66 70 68" stroke="var(--muted)" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>

      {/* Measurement line straight across the palm, dotted, with end ticks */}
      {showLine && (
        <>
          <line x1="32" y1="88" x2="77" y2="88" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.5 6"/>
          <line x1="32" y1="83" x2="32" y2="93" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="77" y1="83" x2="77" y2="93" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"/>
        </>
      )}
    </svg>
  );
}
