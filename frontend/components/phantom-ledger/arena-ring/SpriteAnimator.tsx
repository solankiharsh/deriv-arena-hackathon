"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { FighterAction } from "@/lib/stores/arena-store";
import type { SpriteCharacter, SpriteAnimation } from "@/lib/arena/sprite-data";

interface SpriteAnimatorProps {
  character: SpriteCharacter;
  action: FighterAction;
  isVillain: boolean;
  health: number;
  width?: number;
  height?: number;
  onClick?: () => void;
}

function actionToSpriteKey(action: FighterAction): keyof SpriteCharacter["animations"] {
  switch (action) {
    case "jab":
    case "hook":
    case "uppercut":
      return "attack1";
    case "body-blow":
      return "attack2";
    case "hit":
    case "stagger":
      return "takeHit";
    case "ko":
      return "death";
    case "block":
    case "dodge":
      return "idle";
    default:
      return action as keyof SpriteCharacter["animations"];
  }
}

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached?.complete) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

export function SpriteAnimator({
  character,
  action,
  isVillain,
  health,
  width = 200,
  height = 200,
  onClick,
}: SpriteAnimatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastFrameTimeRef = useRef(0);
  const currentAnimRef = useRef<SpriteAnimation | null>(null);
  const currentImgRef = useRef<HTMLImageElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const spriteKey = actionToSpriteKey(action);
  const anim = character.animations[spriteKey];

  const isOneShot = ["attack1", "attack2", "takeHit", "death"].includes(spriteKey);
  const fps = spriteKey === "death" ? 8 : spriteKey === "idle" ? 10 : 12;
  const frameInterval = 1000 / fps;

  const drawFrame = useCallback((ctx: CanvasRenderingContext2D, img: HTMLImageElement, animation: SpriteAnimation, frame: number) => {
    ctx.clearRect(0, 0, width, height);
    ctx.save();

    // Flip when: villain with right-facing sprite, OR hero with left-facing sprite
    const shouldFlip = character.facesLeft ? !isVillain : isVillain;
    if (shouldFlip) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    const sx = frame * animation.frameWidth;
    ctx.drawImage(
      img,
      sx, 0,
      animation.frameWidth, animation.frameHeight,
      0, 0,
      width, height
    );

    ctx.restore();

    if (health < 25) {
      ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
      ctx.fillRect(0, 0, width, height);
    }
  }, [width, height, isVillain, health, character]);

  useEffect(() => {
    let cancelled = false;

    const startAnimation = async () => {
      try {
        const img = await loadImage(anim.src);
        if (cancelled) return;

        setLoadFailed(false);
        currentImgRef.current = img;
        currentAnimRef.current = anim;
        frameRef.current = 0;
        lastFrameTimeRef.current = 0;
        setIsLoaded(true);

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.imageSmoothingEnabled = false;
        drawFrame(ctx, img, anim, 0);

        const animate = (timestamp: number) => {
          if (cancelled) return;

          if (timestamp - lastFrameTimeRef.current >= frameInterval) {
            lastFrameTimeRef.current = timestamp;

            const currentAnim = currentAnimRef.current;
            const currentImg = currentImgRef.current;
            if (!currentAnim || !currentImg) return;

            if (isOneShot && frameRef.current >= currentAnim.frames - 1) {
              drawFrame(ctx, currentImg, currentAnim, currentAnim.frames - 1);
              return;
            } else {
              frameRef.current = (frameRef.current + 1) % currentAnim.frames;
              drawFrame(ctx, currentImg, currentAnim, frameRef.current);
            }
          }

          rafRef.current = requestAnimationFrame(animate);
        };

        rafRef.current = requestAnimationFrame(animate);
      } catch {
        setLoadFailed(true);
      }
    };

    startAnimation();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [anim, drawFrame, frameInterval, isOneShot]);

  const mainColor = isVillain ? character.villainColor : character.color;

  return (
    <div
      className="relative cursor-pointer group"
      onClick={onClick}
      style={{ width, height }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width,
          height,
          imageRendering: "pixelated",
          filter: isVillain ? `hue-rotate(180deg) saturate(1.2)` : undefined,
        }}
      />

      {loadFailed && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl border border-white/10 bg-black/30 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: mainColor }}
        >
          Sprite Unavailable
        </div>
      )}

      {/* Name plate intentionally omitted — shown above fighters in BoxingRing */}

      {/* Glow aura */}
      {!isLoaded ? null : (
        <div
          className="absolute inset-0 pointer-events-none rounded-full opacity-15 blur-xl"
          style={{
            background: `radial-gradient(ellipse at center, ${mainColor}50, transparent 70%)`,
          }}
        />
      )}

      {/* Impact flash */}
      {(action === "hit" || action === "stagger") && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 60% 40%, ${mainColor}40, transparent 60%)`,
            animation: "hit-impact 0.4s ease forwards",
          }}
        />
      )}

      {/* Uppercut energy burst */}
      {action === "uppercut" && (
        <div
          className="absolute top-0 right-0 pointer-events-none"
          style={{
            width: 50,
            height: 50,
            borderRadius: "50%",
            background: `radial-gradient(circle, #FBBF24, ${mainColor}60, transparent)`,
            animation: "impact-burst 0.5s ease forwards",
          }}
        />
      )}

      {/* KO stars */}
      {action === "ko" && (
        <div
          className="absolute -top-4 left-0 right-0 text-center pointer-events-none"
          style={{ animation: "ko-stars 2s linear infinite", fontSize: 16 }}
        >
          <span style={{ color: "#FBBF24" }}>&#10038;</span>
          <span style={{ color: "#EF4444", marginLeft: 6 }}>&#10038;</span>
          <span style={{ color: "#FBBF24", marginLeft: 6 }}>&#10038;</span>
        </div>
      )}
    </div>
  );
}
