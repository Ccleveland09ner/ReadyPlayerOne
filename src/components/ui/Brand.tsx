// The "READY PLAYER 1" wordmark and a tiny pixel-art player sprite, both drawn
// in code so they stay crisp and themeable.

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="select-none leading-none">
      <div className="logo-ready" style={{ fontSize: compact ? 20 : 26, lineHeight: 1.15 }}>
        READY
      </div>
      <div className="logo-ready" style={{ fontSize: compact ? 20 : 26, lineHeight: 1.15 }}>
        PLAYER 1
      </div>
      <div
        className="text-pixel mt-2 text-[8px] tracking-[2px]"
        style={{ color: "var(--color-lilac)" }}
      >
        CODE. LEARN. LEVEL UP.
      </div>
    </div>
  );
}

// Neon-triangle framed wordmark used on the auth screens.
export function AuthWordmark() {
  return (
    <div className="relative mx-auto mb-8 w-fit">
      <div
        className="absolute -inset-x-6 -top-4 bottom-2 -z-0"
        style={{
          clipPath: "polygon(50% 0, 100% 100%, 0 100%)",
          border: "3px solid var(--color-magenta)",
          filter: "drop-shadow(0 0 10px rgba(255,63,164,0.6))",
        }}
        aria-hidden
      />
      <div className="relative z-10 text-center">
        <div
          className="text-pixel italic"
          style={{
            fontSize: 56,
            color: "var(--color-magenta)",
            textShadow: "0 0 14px rgba(255,63,164,0.7), 3px 3px 0 #6a0f3f",
          }}
        >
          READY
        </div>
        <div
          className="text-pixel"
          style={{
            fontSize: 28,
            background: "linear-gradient(180deg,#bfe6ff,#6aa8ff 55%,#a15bff)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 3px 0 rgba(0,0,0,0.4)",
          }}
        >
          PLAYER 1
        </div>
      </div>
    </div>
  );
}

// Simple 8x8-ish pixel sprite of the player intern.
export function PlayerSprite({ size = 44 }: { size?: number }) {
  const px = size / 8;
  const cells: [number, number, string][] = [
    // hair
    [2, 0, "#3a2b1f"], [3, 0, "#3a2b1f"], [4, 0, "#3a2b1f"], [5, 0, "#3a2b1f"],
    [1, 1, "#3a2b1f"], [2, 1, "#5a4130"], [5, 1, "#5a4130"], [6, 1, "#3a2b1f"],
    // face
    [2, 2, "#c98d5e"], [3, 2, "#e0a877"], [4, 2, "#e0a877"], [5, 2, "#c98d5e"],
    [2, 3, "#e0a877"], [3, 3, "#1c1b3a"], [4, 3, "#1c1b3a"], [5, 3, "#e0a877"],
    [3, 4, "#c98d5e"], [4, 4, "#c98d5e"],
    // shirt
    [2, 5, "#37c0e6"], [3, 5, "#4fd1ee"], [4, 5, "#4fd1ee"], [5, 5, "#37c0e6"],
    [1, 6, "#37c0e6"], [2, 6, "#4fd1ee"], [3, 6, "#e0a877"], [4, 6, "#e0a877"], [5, 6, "#4fd1ee"], [6, 6, "#37c0e6"],
    [2, 7, "#2a8fb0"], [3, 7, "#37c0e6"], [4, 7, "#37c0e6"], [5, 7, "#2a8fb0"],
  ];
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ imageRendering: "pixelated" }}
      aria-label="Player avatar"
    >
      <rect x="0" y="0" width={size} height={size} rx="4" fill="#1a1540" />
      {cells.map(([x, y, c], i) => (
        <rect key={i} x={x * px} y={y * px} width={px} height={px} fill={c} />
      ))}
    </svg>
  );
}
