"use client";

import type { FighterAction } from "@/lib/stores/arena-store";
import type { HeroDefinition } from "@/lib/arena/hero-data";

interface AnimeHeroFighterProps {
  hero: HeroDefinition;
  isVillain: boolean;
  action: FighterAction;
  health: number;
  onClick?: () => void;
}

const isHurt = (a: FighterAction) => a === "hit" || a === "ko" || a === "stagger";
const isPunching = (a: FighterAction) => a === "jab" || a === "hook" || a === "uppercut" || a === "body-blow";

const BODY_ANIMS: Record<FighterAction, string> = {
  idle: "boxer-idle 1.2s ease-in-out infinite",
  jab: "boxer-jab 0.45s cubic-bezier(.4,0,.2,1) forwards",
  hook: "boxer-hook 0.5s cubic-bezier(.4,0,.2,1) forwards",
  uppercut: "boxer-uppercut 0.55s cubic-bezier(.25,.8,.25,1) forwards",
  "body-blow": "boxer-body-blow 0.5s cubic-bezier(.4,0,.2,1) forwards",
  block: "boxer-block 0.5s ease forwards",
  hit: "boxer-hit 0.5s cubic-bezier(.4,0,.2,1) forwards",
  stagger: "boxer-stagger 0.7s cubic-bezier(.4,0,.2,1) forwards",
  dodge: "boxer-dodge 0.4s cubic-bezier(.4,0,.2,1) forwards",
  ko: "boxer-ko 1s ease forwards",
};

const ARM_ANIMS: Record<string, string> = {
  jab: "boxer-arm-jab 0.45s cubic-bezier(.4,0,.2,1) forwards",
  hook: "boxer-arm-hook 0.5s cubic-bezier(.4,0,.2,1) forwards",
  uppercut: "boxer-arm-uppercut 0.55s cubic-bezier(.25,.8,.25,1) forwards",
  "body-blow": "boxer-arm-body-blow 0.5s cubic-bezier(.4,0,.2,1) forwards",
  block: "boxer-arm-block 0.5s ease forwards",
};

export function AnimeHeroFighter({ hero, isVillain, action, health, onClick }: AnimeHeroFighterProps) {
  const color = isVillain ? hero.villainColor : hero.color;
  const accent = isVillain ? hero.villainAccent : hero.accentColor;
  const mainColor = isVillain ? hero.villainAccent : hero.color;
  const isLowHealth = health < 25;
  const wobble = isLowHealth && action === "idle";
  const bodyAnim = BODY_ANIMS[action];
  const armAnim = ARM_ANIMS[action] ?? "";

  return (
    <div
      className="relative cursor-pointer group"
      style={{
        transform: isVillain ? "scaleX(-1)" : undefined,
        width: 100,
        height: 150,
      }}
      onClick={onClick}
    >
      {/* Element aura */}
      <div
        className="absolute inset-0 rounded-full opacity-20 blur-xl pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, ${mainColor}40, transparent 70%)`,
          animation: action === "idle" ? "boxer-idle 2s ease-in-out infinite" : undefined,
        }}
      />

      <div
        style={{
          animation: wobble ? "boxer-wobble 0.6s ease-in-out infinite" : bodyAnim,
          position: "relative",
          width: "100%",
          height: "100%",
        }}
      >
        {/* Hair / helmet */}
        <div
          style={{
            position: "absolute",
            top: -6,
            left: 30,
            width: 60,
            height: 24,
            borderRadius: "50% 50% 0 0",
            background: `linear-gradient(180deg, ${mainColor}, ${mainColor}90)`,
            zIndex: 1,
          }}
        />

        {/* Head */}
        <div
          style={{
            position: "absolute",
            top: 4,
            left: 33,
            width: 54,
            height: 48,
            borderRadius: "12px 12px 8px 8px",
            background: isVillain
              ? `linear-gradient(180deg, #3a2540, #2a1830)`
              : `linear-gradient(180deg, #ffe0cc, #f5c4a0)`,
            boxShadow: `0 0 12px ${mainColor}40`,
            opacity: action === "ko" ? 0.5 : 1,
            transition: "opacity 0.3s",
            zIndex: 2,
          }}
        >
          {/* Eyes */}
          <div style={{
            position: "absolute", top: 14, left: 8,
            width: isHurt(action) ? 14 : 12, height: isHurt(action) ? 3 : 10,
            borderRadius: isHurt(action) ? "50%" : "50%",
            background: isHurt(action)
              ? "#EF4444"
              : isVillain ? `${hero.villainAccent}` : mainColor,
            boxShadow: isPunching(action) ? `0 0 8px ${mainColor}` : "none",
            transition: "all 0.15s",
          }} />
          <div style={{
            position: "absolute", top: 14, right: 8,
            width: isHurt(action) ? 14 : 12, height: isHurt(action) ? 3 : 10,
            borderRadius: "50%",
            background: isHurt(action)
              ? "#EF4444"
              : isVillain ? `${hero.villainAccent}` : mainColor,
            boxShadow: isPunching(action) ? `0 0 8px ${mainColor}` : "none",
            transition: "all 0.15s",
          }} />
          {/* Eye shine */}
          {!isHurt(action) && (
            <>
              <div style={{ position: "absolute", top: 15, left: 13, width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.8)" }} />
              <div style={{ position: "absolute", top: 15, right: 13, width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.8)" }} />
            </>
          )}
          {/* Mouth */}
          {isHurt(action) ? (
            <div style={{ position: "absolute", bottom: 8, left: 17, width: 20, height: 6, borderRadius: "0 0 50% 50%", background: "rgba(0,0,0,0.4)" }} />
          ) : isPunching(action) ? (
            <div style={{ position: "absolute", bottom: 8, left: 20, width: 14, height: 3, borderRadius: 2, background: "rgba(0,0,0,0.3)" }} />
          ) : (
            <div style={{ position: "absolute", bottom: 10, left: 22, width: 10, height: 2, borderRadius: 1, background: "rgba(0,0,0,0.2)" }} />
          )}
          {/* Villain markings */}
          {isVillain && (
            <>
              <div style={{ position: "absolute", top: 6, left: 12, width: 12, height: 2, borderRadius: 1, background: `${hero.villainAccent}60`, transform: "rotate(-15deg)" }} />
              <div style={{ position: "absolute", top: 6, right: 12, width: 12, height: 2, borderRadius: 1, background: `${hero.villainAccent}60`, transform: "rotate(15deg)" }} />
            </>
          )}
        </div>

        {/* Shoulder armor / pads */}
        <div style={{
          position: "absolute", top: 46, left: 14, width: 24, height: 14,
          borderRadius: "8px 0 0 8px",
          background: `linear-gradient(135deg, ${mainColor}CC, ${mainColor}80)`,
          boxShadow: `0 2px 6px ${mainColor}30`,
          zIndex: 3,
        }} />
        <div style={{
          position: "absolute", top: 46, right: 14, width: 24, height: 14,
          borderRadius: "0 8px 8px 0",
          background: `linear-gradient(225deg, ${mainColor}CC, ${mainColor}80)`,
          boxShadow: `0 2px 6px ${mainColor}30`,
          zIndex: 3,
        }} />

        {/* Torso / armor */}
        <div
          style={{
            position: "absolute",
            top: 52,
            left: 22,
            width: 76,
            height: 58,
            borderRadius: 8,
            background: isVillain
              ? `linear-gradient(180deg, ${color}DD, ${color})`
              : `linear-gradient(180deg, ${mainColor}25, ${mainColor}15)`,
            border: `2px solid ${mainColor}50`,
            boxShadow: `inset 0 -8px 16px rgba(0,0,0,0.35), 0 0 12px ${mainColor}15`,
          }}
        >
          {/* Chest emblem */}
          <div style={{
            position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
            width: 18, height: 18, borderRadius: "50%",
            background: `radial-gradient(circle, ${accent}, ${mainColor}60)`,
            boxShadow: `0 0 8px ${mainColor}40`,
            border: `1px solid ${mainColor}40`,
          }} />
          {/* Belt detail */}
          <div style={{
            position: "absolute", bottom: 6, left: 4, right: 4, height: 4,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${mainColor}40, ${accent}, ${mainColor}40)`,
          }} />
        </div>

        {/* Lead arm + weapon/fist */}
        <div
          style={{
            position: "absolute",
            top: 58,
            right: -10,
            width: 34,
            height: 16,
            borderRadius: 8,
            background: isVillain ? `${color}CC` : "#ffe0ccCC",
            transformOrigin: "left center",
            animation: armAnim,
            zIndex: 4,
          }}
        >
          {/* Fist / weapon glow */}
          <div style={{
            position: "absolute",
            top: -6,
            right: -14,
            width: 28,
            height: 28,
            borderRadius: 8,
            background: isPunching(action)
              ? `linear-gradient(135deg, ${mainColor}, ${accent})`
              : isVillain ? `${hero.villainAccent}CC` : `${mainColor}90`,
            boxShadow: isPunching(action) ? `0 0 20px ${mainColor}80, 0 0 40px ${mainColor}30` : "none",
            transition: "box-shadow 0.15s",
          }} />
        </div>

        {/* Rear arm */}
        <div
          style={{
            position: "absolute",
            top: 68,
            left: -6,
            width: 28,
            height: 14,
            borderRadius: 8,
            background: isVillain ? `${color}AA` : "#ffe0ccAA",
            animation: action === "block" ? "boxer-arm-block 0.5s ease forwards" : "",
            transformOrigin: "right center",
            zIndex: 0,
          }}
        >
          <div style={{
            position: "absolute", top: -4, left: -12,
            width: 24, height: 24, borderRadius: 8,
            background: action === "block" ? `${mainColor}` : isVillain ? `${hero.villainAccent}AA` : `${mainColor}70`,
          }} />
        </div>

        {/* Pants / leg armor */}
        <div style={{
          position: "absolute", top: 108, left: 26, width: 68, height: 24,
          borderRadius: "0 0 8px 8px",
          background: isVillain
            ? `linear-gradient(180deg, ${hero.villainAccent}50, ${hero.villainAccent}30)`
            : `linear-gradient(180deg, ${mainColor}30, ${mainColor}18)`,
          border: `1px solid ${mainColor}20`,
        }} />

        {/* Left leg */}
        <div style={{
          position: "absolute", top: 130, left: 28,
          width: 20, height: 40, borderRadius: 6,
          background: isVillain ? `${color}80` : "#ffe0cc70",
        }}>
          {/* Boot */}
          <div style={{
            position: "absolute", bottom: 0, left: -2, width: 24, height: 10,
            borderRadius: "0 0 6px 6px",
            background: `${mainColor}60`,
          }} />
        </div>

        {/* Right leg */}
        <div style={{
          position: "absolute", top: 130, left: 72,
          width: 20, height: 40, borderRadius: 6,
          background: isVillain ? `${color}80` : "#ffe0cc70",
        }}>
          <div style={{
            position: "absolute", bottom: 0, left: -2, width: 24, height: 10,
            borderRadius: "0 0 6px 6px",
            background: `${mainColor}60`,
          }} />
        </div>

        {/* KO stars */}
        {action === "ko" && (
          <div style={{
            position: "absolute", top: -16, left: 10,
            width: 100, height: 30,
            animation: "ko-stars 2s linear infinite",
            fontSize: 18, textAlign: "center", pointerEvents: "none",
          }}>
            <span style={{ color: mainColor }}>&#10038;</span>
            <span style={{ color: accent, marginLeft: 8 }}>&#10038;</span>
            <span style={{ color: mainColor, marginLeft: 8 }}>&#10038;</span>
          </div>
        )}

        {/* Hit / stagger impact */}
        {(action === "hit" || action === "stagger") && (
          <div style={{
            position: "absolute", top: 12, right: -20,
            width: 44, height: 44, borderRadius: "50%",
            background: `radial-gradient(circle, ${mainColor}, ${accent}80, transparent)`,
            opacity: 0.9, pointerEvents: "none",
            animation: "hit-impact 0.4s ease forwards",
          }} />
        )}

        {/* Uppercut energy */}
        {action === "uppercut" && (
          <div style={{
            position: "absolute", top: -10, right: 8,
            width: 40, height: 40, pointerEvents: "none",
            animation: "impact-burst 0.5s ease forwards",
          }}>
            <div style={{
              width: "100%", height: "100%", borderRadius: "50%",
              background: `radial-gradient(circle, ${accent}, ${mainColor}80, transparent)`,
              boxShadow: `0 0 24px ${mainColor}, 0 0 48px ${accent}40`,
            }} />
          </div>
        )}

        {/* Body blow impact */}
        {action === "body-blow" && (
          <div style={{
            position: "absolute", top: 65, right: -18,
            width: 34, height: 34, borderRadius: "50%",
            background: `radial-gradient(circle, ${mainColor}, transparent)`,
            opacity: 0.8, pointerEvents: "none",
            animation: "hit-impact 0.4s ease forwards",
          }} />
        )}

        {/* Stagger sweat */}
        {action === "stagger" && (
          <>
            <div style={{
              position: "absolute", top: 4, left: 20,
              width: 4, height: 8, borderRadius: "0 0 50% 50%",
              background: `${accent}80`,
              animation: "sweat-drop 0.6s ease-in forwards",
              pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", top: 8, right: 20,
              width: 3, height: 6, borderRadius: "0 0 50% 50%",
              background: `${accent}60`,
              animation: "sweat-drop 0.6s ease-in 0.15s forwards",
              pointerEvents: "none",
            }} />
          </>
        )}

        {/* Element particles on idle */}
        {action === "idle" && !isLowHealth && (
          <div
            className="absolute -inset-2 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 70% 30%, ${mainColor}08, transparent 50%)`,
            }}
          />
        )}
      </div>

      {/* Name plate (flips back for villains) */}
      <div
        className="absolute -bottom-5 left-1/2 text-center whitespace-nowrap"
        style={{
          transform: isVillain ? "translateX(-50%) scaleX(-1)" : "translateX(-50%)",
          fontSize: 8,
          fontWeight: 800,
          color: mainColor,
          textShadow: `0 0 8px ${mainColor}60`,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {isVillain ? hero.villainName : hero.name}
      </div>
    </div>
  );
}
