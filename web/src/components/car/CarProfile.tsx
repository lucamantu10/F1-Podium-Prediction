/** Static side profile of the car: fallback when WebGL is off or motion is reduced. */
export function CarProfile({ primary, secondary, number }: { primary: string; secondary: string; number?: number | null }) {
  return (
    <svg viewBox="0 0 400 120" className="h-full w-full" role="img" aria-label={`Side profile of a race car${number ? ` number ${number}` : ""}`}>
      <ellipse cx="200" cy="104" rx="180" ry="6" fill="#000" opacity="0.18" />
      <path d="M20 84 L60 78 L150 70 L190 52 L250 48 L300 56 L340 40 L352 40 L352 80 L20 90 Z" fill={primary} />
      <path d="M60 80 L330 70 L330 76 L60 86 Z" fill={secondary} />
      <path d="M190 52 C210 34 236 34 252 48" stroke="#111" strokeWidth="5" fill="none" />
      <rect x="336" y="22" width="40" height="8" fill={primary} />
      <rect x="370" y="22" width="5" height="58" fill={secondary} />
      <rect x="10" y="88" width="56" height="5" fill={secondary} />
      {number != null && (
        <text x="280" y="66" fontSize="16" fontWeight="600" fill={secondary}>
          {number}
        </text>
      )}
      {[90, 310].map((x) => (
        <g key={x}>
          <circle cx={x} cy="86" r="22" fill="#151515" />
          <circle cx={x} cy="86" r="15" fill="none" stroke={secondary} strokeWidth="2" />
          <circle cx={x} cy="86" r="6" fill="#444" />
        </g>
      ))}
    </svg>
  );
}
