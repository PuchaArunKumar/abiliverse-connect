import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type FontSize = "sm" | "md" | "lg" | "xl";
type Toggleable = "highContrast" | "dyslexiaFont" | "reduceMotion" | "underlineLinks";

interface A11yState {
  highContrast: boolean;
  dyslexiaFont: boolean;
  reduceMotion: boolean;
  underlineLinks: boolean;
  fontSize: FontSize;
  toggle: (k: Toggleable) => void;
  setFontSize: (s: FontSize) => void;
  reset: () => void;
  isDefault: boolean;
}

const Ctx = createContext<A11yState | null>(null);
const KEY = "abilitiverse-a11y";

const DEFAULTS = {
  highContrast: false,
  dyslexiaFont: false,
  reduceMotion: false,
  underlineLinks: false,
  fontSize: "md" as FontSize,
};

export const AccessibilityProvider = ({ children }: { children: ReactNode }) => {
  const [highContrast, setHC] = useState(DEFAULTS.highContrast);
  const [dyslexiaFont, setDF] = useState(DEFAULTS.dyslexiaFont);
  const [reduceMotion, setRM] = useState(DEFAULTS.reduceMotion);
  const [underlineLinks, setUL] = useState(DEFAULTS.underlineLinks);
  const [fontSize, setFontSize] = useState<FontSize>(DEFAULTS.fontSize);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setHC(!!s.highContrast);
        setDF(!!s.dyslexiaFont);
        setRM(!!s.reduceMotion);
        setUL(!!s.underlineLinks);
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
    root.classList.toggle("a11y-underline-links", underlineLinks);
    root.dataset.fontSize = fontSize;

    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          highContrast,
          dyslexiaFont,
          reduceMotion,
          underlineLinks,
          fontSize,
        }),
      );
    } catch {
      // setItem throws in private mode and when storage is full or blocked.
      // The preference still applies to this session; only persistence is lost,
      // and losing that must not take the settings panel down with it.
    }
  }, [highContrast, dyslexiaFont, reduceMotion, underlineLinks, fontSize]);

  const toggle = (k: Toggleable) => {
    if (k === "highContrast") setHC((v) => !v);
    if (k === "dyslexiaFont") setDF((v) => !v);
    if (k === "reduceMotion") setRM((v) => !v);
    if (k === "underlineLinks") setUL((v) => !v);
  };

  const reset = () => {
    setHC(DEFAULTS.highContrast);
    setDF(DEFAULTS.dyslexiaFont);
    setRM(DEFAULTS.reduceMotion);
    setUL(DEFAULTS.underlineLinks);
    setFontSize(DEFAULTS.fontSize);
  };

  const isDefault =
    highContrast === DEFAULTS.highContrast &&
    dyslexiaFont === DEFAULTS.dyslexiaFont &&
    reduceMotion === DEFAULTS.reduceMotion &&
    underlineLinks === DEFAULTS.underlineLinks &&
    fontSize === DEFAULTS.fontSize;

  return (
    <Ctx.Provider
      value={{
        highContrast,
        dyslexiaFont,
        reduceMotion,
        underlineLinks,
        fontSize,
        toggle,
        setFontSize,
        reset,
        isDefault,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useA11y = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useA11y must be used inside AccessibilityProvider");
  return v;
};
