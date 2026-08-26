import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type FontSize = "sm" | "md" | "lg" | "xl";

interface A11yState {
  highContrast: boolean;
  dyslexiaFont: boolean;
  reduceMotion: boolean;
  fontSize: FontSize;
  toggle: (k: "highContrast" | "dyslexiaFont" | "reduceMotion") => void;
  setFontSize: (s: FontSize) => void;
}

const Ctx = createContext<A11yState | null>(null);
const KEY = "abilitiverse-a11y";

export const AccessibilityProvider = ({ children }: { children: ReactNode }) => {
  const [highContrast, setHC] = useState(false);
  const [dyslexiaFont, setDF] = useState(false);
  const [reduceMotion, setRM] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("md");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setHC(!!s.highContrast);
        setDF(!!s.dyslexiaFont);
        setRM(!!s.reduceMotion);
        if (s.fontSize) setFontSize(s.fontSize);
      }
    } catch {
      // Stored preferences unreadable (private mode, cleared storage): keep defaults.
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("a11y-contrast", highContrast);
    root.classList.toggle("a11y-dyslexia", dyslexiaFont);
    root.classList.toggle("a11y-reduce-motion", reduceMotion);
    root.dataset.fontSize = fontSize;
    localStorage.setItem(
      KEY,
      JSON.stringify({ highContrast, dyslexiaFont, reduceMotion, fontSize })
    );
  }, [highContrast, dyslexiaFont, reduceMotion, fontSize]);

  const toggle = (k: "highContrast" | "dyslexiaFont" | "reduceMotion") => {
    if (k === "highContrast") setHC((v) => !v);
    if (k === "dyslexiaFont") setDF((v) => !v);
    if (k === "reduceMotion") setRM((v) => !v);
  };

  return (
    <Ctx.Provider value={{ highContrast, dyslexiaFont, reduceMotion, fontSize, toggle, setFontSize }}>
      {children}
    </Ctx.Provider>
  );
};

export const useA11y = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useA11y must be used inside AccessibilityProvider");
  return v;
};