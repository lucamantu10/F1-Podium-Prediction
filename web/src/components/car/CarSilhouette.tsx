import { useId } from "react";

/**
 * Side profile of a modern single-seater, lit from above like a studio shot at
 * night: dark bodywork, a rim light along the top, the red rain light glowing,
 * and a wet-floor reflection. Stands in until the real 3D model is added.
 */
export function CarSilhouette({ accent = "#d9d9de", className }: { accent?: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const body = (
    <>
      {/* floor and plank */}
      <path d="M120 206 L900 200 L905 212 L118 216 Z" fill="#0c0c0e" />
      {/* main body */}
      <path
        d="M24 194 C70 187 150 179 255 171 L382 158 C412 140 442 129 472 125 L560 113 C602 97 644 92 694 100 L802 128 C842 139 872 152 892 167 L898 202 L118 207 Z"
        fill={`url(#${id}-paint)`}
      />
      {/* sidepod and its undercut */}
      <path d="M470 150 C520 140 640 138 720 150 L760 196 L470 200 Z" fill="#1c1c20" />
      <path d="M480 160 C540 152 640 151 705 160" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" fill="none" />
      {/* engine cover fin */}
      <path d="M640 99 L820 128 L812 134 L636 106 Z" fill="#18181b" />
      {/* cockpit opening and halo */}
      <path d="M430 128 C450 120 500 116 540 118 L548 128 L436 134 Z" fill="#050506" />
      <path d="M432 132 C446 96 512 92 536 120" stroke="#2a2a2e" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M432 132 C446 96 512 92 536 120" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" fill="none" />
      {/* front wing */}
      <path d="M8 206 L156 199 L166 211 L12 217 Z" fill="#1a1a1d" />
      <path d="M14 200 L150 194 L154 199 L16 205 Z" fill="#232327" />
      <rect x="6" y="186" width="9" height="32" rx="2" fill="#1f1f23" />
      {/* rear wing, endplate, beam wing */}
      <rect x="866" y="56" width="98" height="13" rx="3" fill="#1d1d21" />
      <rect x="872" y="74" width="88" height="8" rx="2" fill="#18181b" />
      <rect x="950" y="56" width="12" height="122" rx="3" fill="#161619" />
      <rect x="878" y="150" width="70" height="7" rx="2" fill="#1a1a1d" />
      <path d="M884 82 L896 168" stroke="#141417" strokeWidth="6" />
      {/* rim light along the top of the car */}
      <path
        d="M30 192 C80 185 160 177 258 169 L384 156 C414 139 444 128 474 124 L562 112 C604 96 646 91 696 99 L804 127 C842 138 870 150 890 164"
        stroke={accent}
        strokeOpacity="1"
        strokeWidth="1.8"
        fill="none"
      />
      <rect x="866" y="56" width="98" height="1.5" fill={accent} opacity="0.6" />
      {/* wheels */}
      {[
        { x: 212, r: 56 },
        { x: 762, r: 60 },
      ].map(({ x, r }) => (
        <g key={x}>
          <circle cx={x} cy={214 - r + r} r={r} fill="#0b0b0d" />
          <circle cx={x} cy={214} r={r * 0.7} fill="none" stroke="#2c2c31" strokeWidth={r * 0.18} />
          <circle cx={x} cy={214} r={r * 0.38} fill="#131316" stroke="rgba(255,255,255,0.12)" />
          <path d={`M${x - r * 0.92} ${214 - r * 0.38} A ${r} ${r} 0 0 1 ${x + r * 0.5} ${214 - r * 0.86}`} stroke={accent} strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
        </g>
      ))}
      {/* rain light */}
      <rect x="900" y="172" width="14" height="7" rx="2" fill="var(--signal)" filter={`url(#${id}-glow)`} />
    </>
  );
  return (
    <svg viewBox="0 0 1000 400" className={className} role="img" aria-label="A Formula 1 car in profile, lit on a wet track at night">
      <defs>
        <linearGradient id={`${id}-paint`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#74747c" />
          <stop offset="0.45" stopColor="#2a2a2f" />
          <stop offset="1" stopColor="#0a0a0c" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-200%" y="-300%" width="500%" height="700%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity="0.28" />
          <stop offset="0.6" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-mask`}>
          <rect x="0" y="270" width="1000" height="130" fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      {/* contact shadow */}
      <ellipse cx="500" cy="272" rx="470" ry="10" fill="black" opacity="0.8" />
      <g transform="translate(0 2)">{body}</g>
      {/* wet-track reflection */}
      <g mask={`url(#${id}-mask)`}>
        <g transform="translate(0 544) scale(1 -1)">{body}</g>
      </g>
    </svg>
  );
}
