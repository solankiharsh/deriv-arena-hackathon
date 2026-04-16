"use strict";

export type SpriteCharacterId = "samuraiMack" | "kenji";

export interface SpriteAnimation {
  src: string;
  frames: number;
  frameWidth: number;
  frameHeight: number;
}

export interface SpriteCharacter {
  id: SpriteCharacterId;
  name: string;
  villainOf: SpriteCharacterId;
  color: string;
  villainColor: string;
  /** True when the sprite sheet natively faces left (flips for the hero side) */
  facesLeft?: boolean;
  animations: {
    idle: SpriteAnimation;
    attack1: SpriteAnimation;
    attack2: SpriteAnimation;
    takeHit: SpriteAnimation;
    death: SpriteAnimation;
    run: SpriteAnimation;
    jump: SpriteAnimation;
    fall: SpriteAnimation;
  };
}

export const SPRITE_CHARACTERS: Record<SpriteCharacterId, SpriteCharacter> = {
  samuraiMack: {
    id: "samuraiMack",
    name: "Samurai Mack",
    villainOf: "kenji",
    color: "#00D4AA",
    villainColor: "#F97316",
    animations: {
      idle: { src: "/sprites/martial-hero/Idle.png", frames: 8, frameWidth: 200, frameHeight: 200 },
      attack1: { src: "/sprites/martial-hero/Attack1.png", frames: 6, frameWidth: 200, frameHeight: 200 },
      attack2: { src: "/sprites/martial-hero/Attack2.png", frames: 6, frameWidth: 200, frameHeight: 200 },
      takeHit: { src: "/sprites/martial-hero/TakeHit.png", frames: 4, frameWidth: 200, frameHeight: 200 },
      death: { src: "/sprites/martial-hero/Death.png", frames: 6, frameWidth: 200, frameHeight: 200 },
      run: { src: "/sprites/martial-hero/Run.png", frames: 8, frameWidth: 200, frameHeight: 200 },
      jump: { src: "/sprites/martial-hero/Jump.png", frames: 2, frameWidth: 200, frameHeight: 200 },
      fall: { src: "/sprites/martial-hero/Fall.png", frames: 2, frameWidth: 200, frameHeight: 200 },
    },
  },
  kenji: {
    id: "kenji",
    name: "Kenji",
    villainOf: "samuraiMack",
    color: "#EF4444",
    villainColor: "#8B5CF6",
    facesLeft: true,
    animations: {
      idle: { src: "/sprites/kenji/Idle.png", frames: 4, frameWidth: 200, frameHeight: 200 },
      attack1: { src: "/sprites/kenji/Attack1.png", frames: 4, frameWidth: 200, frameHeight: 200 },
      attack2: { src: "/sprites/kenji/Attack2.png", frames: 4, frameWidth: 200, frameHeight: 200 },
      takeHit: { src: "/sprites/kenji/TakeHit.png", frames: 3, frameWidth: 200, frameHeight: 200 },
      death: { src: "/sprites/kenji/Death.png", frames: 7, frameWidth: 200, frameHeight: 200 },
      run: { src: "/sprites/kenji/Run.png", frames: 8, frameWidth: 200, frameHeight: 200 },
      jump: { src: "/sprites/kenji/Jump.png", frames: 2, frameWidth: 200, frameHeight: 200 },
      fall: { src: "/sprites/kenji/Fall.png", frames: 2, frameWidth: 200, frameHeight: 200 },
    },
  },
};

export const SPRITE_CHARACTER_LIST = Object.values(SPRITE_CHARACTERS);
