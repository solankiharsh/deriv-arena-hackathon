"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePhantomStore } from "@/lib/stores/phantom-store";

interface Ghost {
  id: string;
  x: number;
  y: number;
  delay: number;
  size: number;
  opacity: number;
}

function generateGhosts(): Ghost[] {
  const ghosts: Ghost[] = [];
  const count = 8 + Math.floor(Math.random() * 6);
  for (let i = 0; i < count; i++) {
    ghosts.push({
      id: `ghost-${Date.now()}-${i}`,
      x: 85 + Math.random() * 15,
      y: 10 + Math.random() * 80,
      delay: Math.random() * 0.6,
      size: 16 + Math.random() * 20,
      opacity: 0.3 + Math.random() * 0.5,
    });
  }
  return ghosts;
}

export function PhantomGhostEffect() {
  const [isActive, setIsActive] = useState(false);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const phantomCount = usePhantomStore((s) => s.activePhantoms.length + s.resolvedPhantoms.length);

  const triggerEffect = useCallback(() => {
    setGhosts(generateGhosts());
    setIsActive(true);
    setTimeout(() => setIsActive(false), 2800);
  }, []);

  useEffect(() => {
    if (phantomCount > 0) {
      triggerEffect();
    }
  }, [phantomCount, triggerEffect]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 pointer-events-none z-[100]"
        >
          {ghosts.map((ghost) => (
            <motion.div
              key={ghost.id}
              initial={{
                x: `${ghost.x}vw`,
                y: `${ghost.y}vh`,
                opacity: 0,
                scale: 0.3,
              }}
              animate={{
                x: `${ghost.x - 5 - Math.random() * 10}vw`,
                y: `${ghost.y - 15 - Math.random() * 20}vh`,
                opacity: [0, ghost.opacity, ghost.opacity * 0.6, 0],
                scale: [0.3, 1, 0.8, 0.4],
              }}
              transition={{
                duration: 2.0,
                delay: ghost.delay,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="absolute"
              style={{ fontSize: ghost.size }}
            >
              <div
                style={{
                  color: "var(--color-phantom)",
                  textShadow: "0 0 12px var(--color-phantom), 0 0 24px rgba(167,139,250,0.3)",
                  filter: "blur(0.5px)",
                }}
              >
                &#128123;
              </div>
            </motion.div>
          ))}

          {/* Ambient glow on the right edge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0.2, 0] }}
            transition={{ duration: 2.0 }}
            className="absolute top-0 right-0 w-32 h-full"
            style={{
              background: "linear-gradient(270deg, rgba(167,139,250,0.15), transparent)",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
