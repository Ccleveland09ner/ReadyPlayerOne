import type { ReactNode } from "react";

// Pixel-art icon set. Every glyph is a 12x12 string map rather than stroke
// geometry, so the icons are built from the same square blocks as the panels
// and buttons instead of the round-capped vectors the rest of the web uses.
// "." is a hole; every other character is a drawn cell. Holes are transparent
// rather than a second fill, so a cut-out (the clock hands, the envelope flap)
// reads correctly on whatever surface the icon sits on.
type P = { className?: string };

const base = "inline-block align-middle";

/** Per-character fills. Anything unmapped takes the inherited text colour. */
type Palette = Record<string, string>;

function PixelIcon({
  art,
  colors,
  className,
  label,
}: P & { art: string[]; colors?: Palette; label?: string }) {
  const height = art.length;
  const width = art.reduce((widest, row) => Math.max(widest, row.length), 0);

  // Horizontal runs of the same character collapse into one <rect>, which keeps
  // a glyph at a dozen nodes instead of ~90 single-pixel squares.
  const cells: ReactNode[] = [];
  art.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") {
        x += 1;
        continue;
      }
      let run = 1;
      while (row[x + run] === ch) run += 1;
      cells.push(
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={run}
          height={1}
          fill={colors?.[ch] ?? "currentColor"}
        />,
      );
      x += run;
    }
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`${base} ${className ?? ""}`}
      width="1em"
      height="1em"
      shapeRendering="crispEdges"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {cells}
    </svg>
  );
}

const HOME = [
  "............",
  ".....##.....",
  "....####....",
  "...######...",
  "..########..",
  ".##########.",
  ".##########.",
  ".###....###.",
  ".###....###.",
  ".###....###.",
  ".###....###.",
  "............",
];
export const HomeIcon = ({ className }: P) => <PixelIcon art={HOME} className={className} />;

const CLOCK = [
  "............",
  "...######...",
  "..########..",
  ".##########.",
  ".##########.",
  ".####.#####.",
  ".####.#####.",
  ".####...###.",
  ".##########.",
  "..########..",
  "...######...",
  "............",
];
export const ClockIcon = ({ className }: P) => <PixelIcon art={CLOCK} className={className} />;

const GAMEPAD = [
  "............",
  "............",
  "............",
  "..########..",
  ".##########.",
  "###.#####.##",
  "##...#######",
  "###.####.###",
  ".##########.",
  "..##....##..",
  "............",
  "............",
];
export const GamepadIcon = ({ className }: P) => <PixelIcon art={GAMEPAD} className={className} />;

const CHART = [
  "............",
  "............",
  ".....##.....",
  ".....##.....",
  ".....##..##.",
  ".....##..##.",
  ".##..##..##.",
  ".##..##..##.",
  ".##..##..##.",
  ".##..##..##.",
  "############",
  "............",
];
export const ChartIcon = ({ className }: P) => <PixelIcon art={CHART} className={className} />;

const GEAR = [
  "...##..##...",
  "...##..##...",
  ".##########.",
  ".##########.",
  "####....####",
  "####....####",
  "####....####",
  "####....####",
  ".##########.",
  ".##########.",
  "...##..##...",
  "...##..##...",
];
export const GearIcon = ({ className }: P) => <PixelIcon art={GEAR} className={className} />;

const BRANCH = [
  "............",
  ".###....###.",
  ".###....###.",
  ".###....###.",
  "..##....##..",
  "..##....##..",
  "..##...###..",
  "..##..###...",
  "..#####.....",
  ".###........",
  ".###........",
  ".###........",
];
export const BranchIcon = ({ className }: P) => <PixelIcon art={BRANCH} className={className} />;

const CODE = [
  "............",
  "............",
  "............",
  "....##..##..",
  "...##....##.",
  "..##......##",
  "..##......##",
  "...##....##.",
  "....##..##..",
  "............",
  "............",
  "............",
];
export const CodeIcon = ({ className }: P) => <PixelIcon art={CODE} className={className} />;

const DOC = [
  "............",
  "..######....",
  "..#######...",
  "..########..",
  "..########..",
  "..##....##..",
  "..########..",
  "..##....##..",
  "..########..",
  "..##....##..",
  "..########..",
  "............",
];
export const DocIcon = ({ className }: P) => <PixelIcon art={DOC} className={className} />;

const CHEVRON = [
  "............",
  "............",
  "............",
  ".##......##.",
  "..##....##..",
  "...##..##...",
  "....####....",
  ".....##.....",
  "............",
  "............",
  "............",
  "............",
];
export const ChevronDown = ({ className }: P) => <PixelIcon art={CHEVRON} className={className} />;

const CHECK = [
  "............",
  "............",
  "..........##",
  ".........##.",
  "........##..",
  ".##....##...",
  ".###..##....",
  "..#####.....",
  "...####.....",
  "....##......",
  "............",
  "............",
];
export const Check = ({ className }: P) => <PixelIcon art={CHECK} className={className} />;

const CROSS = [
  "............",
  "............",
  ".##......##.",
  ".###....###.",
  "..###..###..",
  "...######...",
  "....####....",
  "...######...",
  "..###..###..",
  ".###....###.",
  ".##......##.",
  "............",
];
export const Cross = ({ className }: P) => <PixelIcon art={CROSS} className={className} />;

const MAIL = [
  "............",
  "............",
  "............",
  "############",
  "#.########.#",
  "##.######.##",
  "###.####.###",
  "####.##.####",
  "#####..#####",
  "############",
  "############",
  "............",
];
export const MailIcon = ({ className }: P) => <PixelIcon art={MAIL} className={className} />;

const LOCK = [
  "...######...",
  "..###..###..",
  "..##....##..",
  "..##....##..",
  "..##....##..",
  ".##########.",
  ".##########.",
  ".####..####.",
  ".####..####.",
  ".##########.",
  ".##########.",
  "............",
];
export const LockIcon = ({ className }: P) => <PixelIcon art={LOCK} className={className} />;

const USER = [
  "............",
  "....####....",
  "...######...",
  "...######...",
  "....####....",
  "............",
  "..########..",
  ".##########.",
  "############",
  "############",
  "############",
  "............",
];
export const UserIcon = ({ className }: P) => <PixelIcon art={USER} className={className} />;

const TARGET = [
  "............",
  "...######...",
  ".##......##.",
  ".#..####..#.",
  "##.##..##.##",
  "#..#.##.#..#",
  "#..#.##.#..#",
  "##.##..##.##",
  ".#..####..#.",
  ".##......##.",
  "...######...",
  "............",
];
export const TargetIcon = ({ className }: P) => <PixelIcon art={TARGET} className={className} />;

const ARROW = [
  "............",
  "............",
  "............",
  "......##....",
  ".......##...",
  ".#########..",
  ".#########..",
  ".......##...",
  "......##....",
  "............",
  "............",
  "............",
];
export const Arrow = ({ className }: P) => <PixelIcon art={ARROW} className={className} />;

const LOGOUT = [
  "............",
  ".#####......",
  ".##.........",
  ".##.........",
  ".##....##...",
  ".##.....##..",
  ".#########..",
  ".#########..",
  ".##.....##..",
  ".##....##...",
  ".##.........",
  ".#####......",
];
export const LogoutIcon = ({ className }: P) => <PixelIcon art={LOGOUT} className={className} />;

const PLAY = [
  "............",
  ".##.........",
  ".####.......",
  ".######.....",
  ".########...",
  ".##########.",
  ".##########.",
  ".########...",
  ".######.....",
  ".####.......",
  ".##.........",
  "............",
];
export const Play = ({ className }: P) => <PixelIcon art={PLAY} className={className} />;

const ARCHIVE = [
  "............",
  ".##########.",
  ".###....###.",
  ".##########.",
  "............",
  ".##########.",
  ".###....###.",
  ".##########.",
  "............",
  ".##########.",
  ".###....###.",
  ".##########.",
];
export const ArchiveIcon = ({ className }: P) => <PixelIcon art={ARCHIVE} className={className} />;

const KEY = [
  "............",
  "...######...",
  "...##..##...",
  "...##..##...",
  "...######...",
  ".....##.....",
  ".....##.....",
  ".....####...",
  ".....##.....",
  ".....####...",
  ".....##.....",
  "............",
];
export const KeyIcon = ({ className }: P) => <PixelIcon art={KEY} className={className} />;

const INFO = [
  "............",
  "...######...",
  "..########..",
  ".####..####.",
  ".####..####.",
  ".##########.",
  ".####..####.",
  ".####..####.",
  ".####..####.",
  "..########..",
  "...######...",
  "............",
];
export const InfoIcon = ({ className }: P) => <PixelIcon art={INFO} className={className} />;

// The four glyphs that used to be emoji. Emoji ship their own vendor artwork --
// glossy, anti-aliased, and different on every OS -- so they were the one thing
// on these screens that could not be made to match. Drawn here instead, with a
// fixed palette rather than currentColor: a heart that inherits the body text
// colour is no longer a heart.
const TROPHY = [
  "............",
  ".##########.",
  ".##########.",
  "############",
  "#.########.#",
  "#.########.#",
  "..########..",
  "...######...",
  "....####....",
  ".....##.....",
  "...dddddd...",
  "..dddddddd..",
];
export const Trophy = ({ className }: P) => (
  <PixelIcon
    art={TROPHY}
    colors={{ "#": "#ffc23c", d: "#d98a24" }}
    className={className}
    label="trophy"
  />
);

const FLAME = [
  "............",
  ".....##.....",
  "....####....",
  "....####....",
  "...######...",
  "..###cc###..",
  ".###cccc###.",
  ".##cccccc##.",
  ".##cccccc##.",
  ".###cccc###.",
  "..########..",
  "............",
];
export const Flame = ({ className }: P) => (
  <PixelIcon
    art={FLAME}
    colors={{ "#": "#ff7a1a", c: "#ffd23c" }}
    className={className}
    label="streak"
  />
);

const BULB = [
  "............",
  "....####....",
  "...######...",
  "..hh######..",
  "..########..",
  "..########..",
  "...######...",
  "....####....",
  "...dddddd...",
  "....dddd....",
  "....dddd....",
  "............",
];
export const Bulb = ({ className }: P) => (
  <PixelIcon
    art={BULB}
    colors={{ "#": "#ffd23c", h: "#fff3b0", d: "#a8791d" }}
    className={className}
    label="hint"
  />
);

// The one sprite drawn with its own outline ("o"): hearts are the HUD, and a
// heart has to stay legible both as a solid and as the empty slot it leaves
// behind. Spending one keeps the outline and drops the fill, which is how an
// arcade life counter reads -- rather than greying the whole silhouette, where
// "dim red" and "you have lost this one" look like the same thing.
const HEART = [
  "..oo....oo..",
  ".o##o..o##o.",
  "ohh##oo####o",
  "ohh########o",
  "o##########o",
  "o##########o",
  ".o########o.",
  "..o######o..",
  "...o####o...",
  "....o##o....",
  ".....oo.....",
  "............",
];
const HEART_FULL = { "#": "#ff3b5c", h: "#ff8fa3", o: "#7a1027" };
const HEART_SPENT = { "#": "transparent", h: "transparent", o: "#aeb2cf" };
export const Heart = ({ filled = true, className }: P & { filled?: boolean }) => (
  <PixelIcon
    art={HEART}
    colors={filled ? HEART_FULL : HEART_SPENT}
    className={className}
    label={filled ? "heart remaining" : "heart lost"}
  />
);
