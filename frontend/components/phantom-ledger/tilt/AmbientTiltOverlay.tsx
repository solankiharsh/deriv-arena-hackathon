"use client";

import { useEffect } from "react";
import { useTiltStore } from "@/lib/stores/tilt-store";
import { TILT_AMBIENT_CLASSES } from "@/lib/engines/tilt-detection";

export function AmbientTiltOverlay() {
  const { zone } = useTiltStore();

  useEffect(() => {
    const body = document.body;
    // Remove all tilt ambient classes
    Object.values(TILT_AMBIENT_CLASSES).forEach((cls) => body.classList.remove(cls));
    // Add current zone class
    body.classList.add(TILT_AMBIENT_CLASSES[zone]);
  }, [zone]);

  return null;
}
