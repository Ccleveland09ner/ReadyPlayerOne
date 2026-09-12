"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BackgroundPixelStars } from "@/components/ui/background-pixel-stars";
import { Logo } from "@/components/ui/Brand";

const HEADLINE = "READY PLAYER 1";

/** Scene colours come from the globals.css palette so the 3D matches the UI. */
const PALETTE = {
  body: 0x3a7bff, // neon-blue
  wing: 0x5b3fd6, // grape-deep
  cockpit: 0x46c8ff, // neon-cyan
  trailA: 0xff3fa4, // magenta
  trailB: 0xff4fa3, // pink
  rim: 0xff3fa4,
};

/**
 * The landing hero: a pixel rocket flying through a starfield, with the
 * wordmark and the entry point to log in.
 *
 * The scene is decorative. If WebGL is unavailable or the visitor asked for
 * reduced motion, the text and the button still render and still work.
 */
export function PixelRocketHero() {
  return (
    <div className="text-pixel relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#100c26]">
      <PixelVoyagerCanvas />

      <motion.nav
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.9 }}
        className="absolute top-0 right-0 left-0 z-20 p-6"
      >
        <div className="mx-auto max-w-7xl">
          <Logo compact />
        </div>
      </motion.nav>

      <div className="relative z-10 px-4 text-center">
        <PixelHeadline
          text={HEADLINE}
          className="text-3xl leading-relaxed sm:text-5xl md:text-6xl"
          delay={0.9}
        />

        {/* Press Start 2P is monospaced and chunky, so this sits small with
            wide leading — at body size the same sentence runs to twice the
            lines and reads worse. */}
        <motion.p
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.7, duration: 1 }}
          className="text-pixel mx-auto mt-8 max-w-2xl text-[11px] leading-[2.1] tracking-wide text-[#cfc8ff] sm:text-xs"
        >
          Point it at any public GitHub repository and it turns that codebase
          into a five-question quiz. Every answer is tied to a verified citation
          in the actual source, so what you are told is checkable.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.3, duration: 0.9 }}
          className="mt-12"
        >
          <Link href="/login" className="btn-pixel btn-8bit btn-gold animate-blink">
            PRESS START
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * A heading that reveals one character at a time, with the offset magenta
 * shadow the pixel look is built on. Shared by the landing page and the two
 * auth screens so the treatment is defined once.
 *
 * `delay` is short on the auth screens: nobody arriving at a log-in form
 * should wait on an animation before the heading above it is legible.
 */
export function PixelHeadline({
  text,
  className = "",
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  // The reveal is decoration and carries no information, so drop it entirely
  // rather than animating a shorter version of it.
  if (reduceMotion) {
    return (
      <h1 className={`text-pixel pixel-shadow text-white ${className}`}>
        {text}
      </h1>
    );
  }

  return (
    <h1 className={`text-pixel pixel-shadow text-white ${className}`}>
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: i * 0.05 + delay,
            duration: 0.9,
            ease: [0.2, 0.65, 0.3, 0.9],
          }}
          style={{ display: "inline-block" }}
        >
          {/* A plain space collapses next to inline-block siblings */}
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </h1>
  );
}

/**
 * The animated backdrop on its own, so the auth screens can sit on the same
 * scene as the landing page.
 *
 * `interactive` steers the rocket with the pointer. Leave it off over a form —
 * a rocket chasing the cursor across the fields you are trying to fill in is a
 * distraction, so it drifts on a slow path of its own instead.
 */
export function PixelVoyagerCanvas({
  interactive = true,
}: {
  interactive?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // No WebGL context. The hero copy carries the screen on its own.
      return;
    }

    const width = () => window.innerWidth;
    const height = () => window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width() / height(), 0.1, 1000);
    camera.position.z = 25;

    renderer.setSize(width(), height());
    // Uncapped devicePixelRatio is 3 on many phones, which is 9x the fragments
    // for the bloom pass to chew through.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // MeshStandardMaterial is unlit without these, so the rocket would render
    // as a black silhouette.
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(5, 8, 10);
    const rim = new THREE.PointLight(PALETTE.rim, 2.4, 60);
    rim.position.set(-8, -4, 6);
    scene.add(ambient, key, rim);

    const composer = new EffectComposer(renderer);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width(), height()),
      1.5,
      0.4,
      0.85,
    );
    bloomPass.threshold = 0;
    bloomPass.strength = 1.1;
    bloomPass.radius = 0;
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bloomPass);
    // Required as the final pass since three r152, or the composer output lands
    // in the wrong colour space and the whole scene washes out.
    composer.addPass(new OutputPass());

    // The starfield lives in BackgroundPixelStars behind this canvas now, so
    // the scene holds only the rocket and its trail.

    // --- Pixel rocket ---
    const rocket = new THREE.Group();
    const pixelSize = 0.2;
    const pixelGeo = new THREE.BoxGeometry(pixelSize, pixelSize, pixelSize);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: PALETTE.body,
      flatShading: true,
    });
    const wingMat = new THREE.MeshStandardMaterial({
      color: PALETTE.wing,
      flatShading: true,
    });
    const cockpitMat = new THREE.MeshStandardMaterial({
      color: PALETTE.cockpit,
      emissive: PALETTE.cockpit,
      emissiveIntensity: 0.6,
    });

    for (let y = -4; y < 5; y++) {
      for (let x = -2; x < 3; x++) {
        if (Math.abs(x) === 2 && y > 1) continue;
        const pixel = new THREE.Mesh(pixelGeo, bodyMat);
        pixel.position.set(x * pixelSize, y * pixelSize, 0);
        rocket.add(pixel);
      }
    }
    for (let y = -3; y < -1; y++) {
      for (let x = -4; x < -2; x++) {
        const left = new THREE.Mesh(pixelGeo, wingMat);
        left.position.set(x * pixelSize, y * pixelSize, 0);
        rocket.add(left);
        const right = new THREE.Mesh(pixelGeo, wingMat);
        right.position.set(-x * pixelSize, y * pixelSize, 0);
        rocket.add(right);
      }
    }
    const cockpit = new THREE.Mesh(pixelGeo, cockpitMat);
    cockpit.position.set(0, 3 * pixelSize, pixelSize);
    rocket.add(cockpit);
    scene.add(rocket);

    // --- Exhaust trail, pooled so the loop never allocates ---
    const TRAIL_SIZE = 200;
    const trailGeo = new THREE.BoxGeometry(
      pixelSize * 1.5,
      pixelSize * 1.5,
      pixelSize * 1.5,
    );
    const trailMats: THREE.MeshBasicMaterial[] = [];
    const trailPool: THREE.Mesh[] = [];
    // Life runs alongside the pool rather than being stapled onto the mesh,
    // which keeps the meshes properly typed.
    const trailLife = new Float32Array(TRAIL_SIZE);
    let trailIndex = 0;
    for (let i = 0; i < TRAIL_SIZE; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? PALETTE.trailA : PALETTE.trailB,
      });
      trailMats.push(material);
      const particle = new THREE.Mesh(trailGeo, material);
      particle.visible = false;
      scene.add(particle);
      trailPool.push(particle);
    }

    const mouse = new THREE.Vector2(0, 0);
    // Timer, not Clock — Clock is deprecated as of three 0.186.
    const timer = new THREE.Timer();
    const target = new THREE.Vector3();
    let frame = 0;

    const handleMouseMove = (event: MouseEvent) => {
      mouse.x = (event.clientX / width()) * 2 - 1;
      mouse.y = -(event.clientY / height()) * 2 + 1;
    };

    const handleResize = () => {
      camera.aspect = width() / height();
      camera.updateProjectionMatrix();
      renderer.setSize(width(), height());
      composer.setSize(width(), height());
      if (reduceMotion) composer.render();
    };

    const animate = () => {
      frame = requestAnimationFrame(animate);
      timer.update();
      const delta = timer.getDelta();

      if (interactive) {
        target.set(mouse.x * 15, mouse.y * 10, 0);
      } else {
        // A slow figure-of-eight, so the rocket stays alive without hijacking
        // the pointer over a form.
        const elapsed = timer.getElapsed();
        target.set(Math.sin(elapsed * 0.24) * 9, Math.cos(elapsed * 0.19) * 5, 0);
      }
      rocket.position.lerp(target, 0.05);
      rocket.rotation.y = (target.x - rocket.position.x) * 0.1;
      rocket.rotation.x = -(target.y - rocket.position.y) * 0.1;

      if (Math.random() > 0.3) {
        const particle = trailPool[trailIndex];
        particle.position.copy(rocket.position);
        particle.position.y -= 0.7;
        particle.scale.setScalar(1);
        particle.visible = true;
        trailLife[trailIndex] = 1;
        trailIndex = (trailIndex + 1) % TRAIL_SIZE;
      }

      for (let i = 0; i < TRAIL_SIZE; i++) {
        if (!trailPool[i].visible) continue;
        trailLife[i] -= delta * 1.5;
        if (trailLife[i] <= 0) {
          trailPool[i].visible = false;
        } else {
          trailPool[i].scale.setScalar(trailLife[i]);
        }
      }

      composer.render();
    };

    window.addEventListener("resize", handleResize);

    if (reduceMotion) {
      // One static frame: the scene is still there to look at, nothing moves.
      composer.render();
    } else {
      if (interactive) window.addEventListener("mousemove", handleMouseMove);
      animate();
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      pixelGeo.dispose();
      trailGeo.dispose();
      bodyMat.dispose();
      wingMat.dispose();
      cockpitMat.dispose();
      for (const material of trailMats) material.dispose();
      bloomPass.dispose();
      composer.dispose();
      renderer.dispose();
    };
  }, [reduceMotion, interactive]);

  // Fixed, not absolute: the canvas is sized to the viewport, and the sign-up
  // form is tall enough to scroll on a short window. Absolute would leave bare
  // background below the fold.
  //
  // The pixel stars sit at z-0 and the rocket at z-1. Both must stay
  // non-negative: this sits inside a `relative` wrapper that paints its own
  // background, and a negative z-index would drop behind that background.
  return (
    <>
      <BackgroundPixelStars />
      <div ref={mountRef} className="fixed inset-0 z-[1]" aria-hidden />
    </>
  );
}
