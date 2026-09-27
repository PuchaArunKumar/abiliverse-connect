import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type FontSize = "sm" | "md" | "lg" | "xl";
type Toggleable = "highContrast" | "dyslexiaFont" | "reduceMotion" | "underlineLinks";

interface Preferences {
  highContrast: boolean;
  dyslexiaFont: boolean;
  reduceMotion: boolean;
  underlineLinks: boolean;
  fontSize: FontSize;
}

interface A11yState extends Preferences {
  toggle: (k: Toggleable) => void;
  setFontSize: (s: FontSize) => void;
  reset: () => void;
  isDefault: boolean;
}

const Ctx = createContext<A11yState | null>(null);

// The inline script in index.html reads the same key with the same validation,
// so saved preferences apply before the first paint. Change both together.
const KEY = "abilitiverse-a11y";

const FONT_SIZES: readonly FontSize[] = ["sm", "md", "lg", "xl"];

const DEFAULTS: Preferences = {
  highContrast: false,
  dyslexiaFont: false,
  reduceMotion: false,
  underlineLinks: false,
  fontSize: "md",
};

function isFontSize(value: unknown): value is FontSize {
  return FONT_SIZES.includes(value as FontSize);
}

/**
 * Read once, synchronously, as the initial state. Loading in an effect instead
 * rendered one frame at the defaults (a flash of low contrast and a layout jump
 * for anyone on large text) and wrote those defaults back over the saved values
 * before they arrived. Anything unrecognised falls back to the default rather
 * than leaving a font size no stylesheet rule matches.
 */
function readStored(): Preferences {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return DEFAULTS;
    const s = parsed as Record<string, unknown>;
    return {
      highContrast: s.highContrast === true,
      dyslexiaFont: s.dyslexiaFont === true,
      reduceMotion: s.reduceMotion === true,
      underlineLinks: s.underlineLinks === true,
      fontSize: isFontSize(s.fontSize) ? s.fontSize : DEFAULTS.fontSize,
    };
  } catch {
    // Stored preferences unreadable (private mode, blocked or corrupt
    // storage): keep defaults.
    return DEFAULTS;
  }
}

export const AccessibilityProvider = ({ children }: { children: ReactNode }) => {
  const [prefs, setPrefs] = useState<Preferences>(readStored);
  const { highContrast, dyslexiaFont, reduceMotion, underlineLinks, fontSize } = prefs;

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
    setPrefs((p) => ({ ...p, [k]: !p[k] }));
  };

  const setFontSize = (s: FontSize) => {
    if (!isFontSize(s)) return;
    setPrefs((p) => ({ ...p, fontSize: s }));
  };

  const reset = () => {
    setPrefs(DEFAULTS);
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
