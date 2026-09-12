"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

// 16-bit palette: a handful of tints rather than a full gradient range.
const STAR_COLORS = [
  "#FFFFFF", // White
  "#FFFFAA", // Light yellow
  "#AAAAFF", // Light blue
  "#FFAAAA", // Light red
  "#AAFFAA", // Light green
  "#FFAAFF", // Light purple
  "#AAFFFF", // Light cyan
] as const;

const starDensity = 0.00004;
const twinkleProbability = 0.7;
const minTwinkleSpeed = 2;
const maxTwinkleSpeed = 4;
const pixelSize = 5;
const starRegenerationInterval = 5000;
const percentToRegenerate = 0.15;

const shootingStarPixelSize = 2;
const targetFps = 16; // Deliberately low, for the retro cadence
const frameInterval = 1000 / targetFps;

type BackgroundStar = {
  x: number;
  y: number;
  color: string;
  baseOpacity: number;
  currentOpacity: number;
  twinkle: boolean;
  twinkleSpeed: number;
  twinkleDirection: number;
  twinkleTimer: number;
};

type TrailPoint = { x: number; y: number; opacity: number };

type ShootingStar = {
  x: number;
  y: number;
  angle: number;
  speed: number;
  distance: number;
  trail: TrailPoint[];
};

/**
 * The pixel starfield behind everything: a grid-snapped field of twinkling
 * stars on a 2D canvas, with the occasional shooting star.
 *
 * Purely decorative, and cheap: it renders at 16fps rather than display rate.
 */
export const BackgroundPixelStars = memo(function BackgroundPixelStars() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const backgroundStarsRef = useRef<BackgroundStar[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const lastRenderTimeRef = useRef<number>(0);
  const reduceMotion = useReducedMotion();

  const makeStar = useCallback((canvas: HTMLCanvasElement): BackgroundStar => {
    const baseOpacity = Math.random() * 0.5 + 0.5;
    return {
      x: Math.floor(Math.random() * (canvas.width / pixelSize)) * pixelSize,
      y: Math.floor(Math.random() * (canvas.height / pixelSize)) * pixelSize,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]!,
      baseOpacity,
      currentOpacity: baseOpacity,
      twinkle: Math.random() < twinkleProbability,
      twinkleSpeed:
        minTwinkleSpeed + Math.random() * (maxTwinkleSpeed - minTwinkleSpeed),
      twinkleDirection: -1,
      twinkleTimer: 0,
    };
  }, []);

  const initBackgroundStars = useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const numStars = Math.floor(canvas.width * canvas.height * starDensity);
    backgroundStarsRef.current = Array.from({ length: numStars }, () =>
      makeStar(canvas),
    );
  }, [makeStar]);

  const regenerateBackgroundStars = useCallback((): void => {
    const canvas = canvasRef.current;
    const stars = backgroundStarsRef.current;
    if (!canvas || stars.length === 0) return;
    const numToRegenerate = Math.max(
      1,
      Math.floor(stars.length * percentToRegenerate),
    );
    for (let i = 0; i < numToRegenerate; i++) {
      stars[Math.floor(Math.random() * stars.length)] = makeStar(canvas);
    }
  }, [makeStar]);

  const drawBackgroundStars = useCallback(
    (ctx: CanvasRenderingContext2D, animate: boolean): void => {
      for (const star of backgroundStarsRef.current) {
        ctx.fillStyle = star.color;
        ctx.globalAlpha = star.currentOpacity;
        ctx.fillRect(star.x, star.y, pixelSize, pixelSize);

        if (!animate || !star.twinkle) continue;

        star.twinkleTimer += 1 / targetFps;
        if (star.twinkleTimer >= star.twinkleSpeed) {
          star.twinkleTimer = 0;
          star.twinkleDirection *= -1;
        }
        const dim = star.baseOpacity * 0.3;
        const firstHalf = star.twinkleTimer / star.twinkleSpeed < 0.5;
        const fadingOut = star.twinkleDirection < 0;
        star.currentOpacity =
          firstHalf === fadingOut ? star.baseOpacity : dim;
      }
      // The loop leaves globalAlpha at the last star's opacity; without this
      // the shooting-star trails get dimmed by whatever it happened to be.
      ctx.globalAlpha = 1;
    },
    [],
  );

  const animateCanvas = useCallback(
    (timestamp: number): void => {
      animationFrameRef.current = requestAnimationFrame(animateCanvas);

      // Drop frames down to the target rate.
      if (timestamp - lastRenderTimeRef.current < frameInterval) return;
      lastRenderTimeRef.current = timestamp;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackgroundStars(ctx, true);

      if (shootingStarsRef.current.length === 0) return;

      shootingStarsRef.current = shootingStarsRef.current
        .map((star) => {
          const radians = (star.angle * Math.PI) / 180;
          const distance = star.distance + star.speed;
          const trail = [...star.trail];
          // Only every few frames, so the trail reads as discrete pixels.
          if (distance % 8 < star.speed) {
            trail.push({ x: star.x, y: star.y, opacity: 1 });
          }
          return {
            ...star,
            x: star.x + star.speed * Math.cos(radians),
            y: star.y + star.speed * Math.sin(radians),
            distance,
            trail: trail
              .map((p) => ({ ...p, opacity: p.opacity - 0.1 }))
              .filter((p) => p.opacity > 0),
          };
        })
        .filter(
          (star) =>
            star.x >= -30 &&
            star.x <= window.innerWidth + 30 &&
            star.y >= -30 &&
            star.y <= window.innerHeight + 30,
        );

      for (const star of shootingStarsRef.current) {
        // No rotation for trail pixels: rotating a 2px square about its own
        // corner is invisible, and it cost a save/restore per point per frame.
        for (const point of star.trail) {
          ctx.fillStyle = `rgba(180, 242, 255, ${point.opacity})`;
          ctx.fillRect(
            point.x,
            point.y,
            shootingStarPixelSize,
            shootingStarPixelSize,
          );
        }

        ctx.save();
        ctx.translate(star.x, star.y);
        ctx.rotate((star.angle * Math.PI) / 180);
        ctx.translate(-star.x, -star.y);
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 1;
        for (let y = 0; y < 2; y++) {
          for (let x = 0; x < 4; x++) {
            if ((x === 0 && y === 1) || (x === 3 && y === 0)) continue;
            ctx.fillRect(
              star.x + x * shootingStarPixelSize,
              star.y + y * shootingStarPixelSize,
              shootingStarPixelSize,
              shootingStarPixelSize,
            );
          }
        }
        ctx.restore();
      }
    },
    [drawBackgroundStars],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    sizeCanvas();
    initBackgroundStars();

    if (reduceMotion) {
      // One static field: still a starry sky, but nothing twinkles or flies.
      const ctx = canvas.getContext("2d");
      if (ctx) drawBackgroundStars(ctx, false);
      const handleStaticResize = () => {
        sizeCanvas();
        initBackgroundStars();
        const c = canvas.getContext("2d");
        if (c) drawBackgroundStars(c, false);
      };
      window.addEventListener("resize", handleStaticResize);
      return () => window.removeEventListener("resize", handleStaticResize);
    }

    animationFrameRef.current = requestAnimationFrame(animateCanvas);

    // Self-rescheduling, so the handle has to be tracked or the chain outlives
    // the component and keeps firing forever.
    let shootingStarTimer: ReturnType<typeof setTimeout>;
    const scheduleShootingStar = (): void => {
      shootingStarsRef.current = [
        ...shootingStarsRef.current,
        {
          x: Math.random() * window.innerWidth,
          y: 0,
          // 90deg is straight down; this spans down-right to down-left.
          angle: 45 + Math.random() * 90,
          speed: Math.random() * 5 + 8,
          distance: 0,
          trail: [],
        },
      ];
      shootingStarTimer = setTimeout(
        scheduleShootingStar,
        Math.random() * 4000 + 2000,
      );
    };
    scheduleShootingStar();

    const regeneration = setInterval(
      regenerateBackgroundStars,
      starRegenerationInterval,
    );

    const handleResize = (): void => {
      sizeCanvas();
      initBackgroundStars();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      clearTimeout(shootingStarTimer);
      clearInterval(regeneration);
      window.removeEventListener("resize", handleResize);
    };
  }, [
    animateCanvas,
    drawBackgroundStars,
    initBackgroundStars,
    regenerateBackgroundStars,
    reduceMotion,
  ]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      // pixelated keeps the 5px blocks hard-edged when the canvas is scaled up
      // on a high-DPI display, instead of smoothing them into blurry dots.
      className="pointer-events-none fixed inset-0 z-0 [image-rendering:pixelated]"
    />
  );
});

export default BackgroundPixelStars;
