"use client";

import { useEffect } from "react";

// Native selects can retain :focus-visible after pointer selection. Track input
// modality without moving focus or changing the control's keyboard behavior.
export function InputModality() {
  useEffect(() => {
    const root = document.documentElement;
    const onPointer = () => { root.dataset.inputModality = "pointer"; };
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.key === "Shift") return;
      root.dataset.inputModality = "keyboard";
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
      delete root.dataset.inputModality;
    };
  }, []);
  return null;
}
