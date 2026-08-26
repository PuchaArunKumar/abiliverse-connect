import { useState } from "react";
import { Accessibility, Link2, RotateCcw, Sun, Type, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useA11y } from "@/contexts/AccessibilityContext";

const sizes = [
  { v: "sm", label: "Small" },
  { v: "md", label: "Default" },
  { v: "lg", label: "Large" },
  { v: "xl", label: "Extra large" },
] as const;

const AccessibilityPanel = () => {
  const [open, setOpen] = useState(false);
  const { highContrast, dyslexiaFont, reduceMotion, underlineLinks, fontSize, toggle, setFontSize, reset, isDefault } =
    useA11y();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Open accessibility settings"
          className="min-h-11 min-w-11"
        >
          <Accessibility className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Accessibility settings</SheetTitle>
          <SheetDescription>
            Adjust the interface to suit how you read and navigate. Your choices are saved on this device.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="a11y-contrast" className="flex items-center gap-2 font-medium">
                <Sun className="h-4 w-4" aria-hidden="true" /> High contrast
              </Label>
              <p className="text-sm text-muted-foreground">Stronger colours and borders.</p>
            </div>
            <Switch id="a11y-contrast" checked={highContrast} onCheckedChange={() => toggle("highContrast")} />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="a11y-dys" className="flex items-center gap-2 font-medium">
                <Type className="h-4 w-4" aria-hidden="true" /> Dyslexia-friendly font
              </Label>
              <p className="text-sm text-muted-foreground">Rounder shapes, wider letter spacing.</p>
            </div>
            <Switch id="a11y-dys" checked={dyslexiaFont} onCheckedChange={() => toggle("dyslexiaFont")} />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="a11y-motion" className="flex items-center gap-2 font-medium">
                <Zap className="h-4 w-4" aria-hidden="true" /> Reduce motion
              </Label>
              <p className="text-sm text-muted-foreground">Turn off animations and transitions.</p>
            </div>
            <Switch id="a11y-motion" checked={reduceMotion} onCheckedChange={() => toggle("reduceMotion")} />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="a11y-underline" className="flex items-center gap-2 font-medium">
                <Link2 className="h-4 w-4" aria-hidden="true" /> Underline links
              </Label>
              <p className="text-sm text-muted-foreground">
                Mark every link with an underline, not colour alone.
              </p>
            </div>
            <Switch
              id="a11y-underline"
              checked={underlineLinks}
              onCheckedChange={() => toggle("underlineLinks")}
            />
          </div>

          <div>
            <p className="mb-2 font-medium">Text size</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Text size">
              {sizes.map((s) => (
                <Button
                  key={s.v}
                  variant={fontSize === s.v ? "default" : "outline"}
                  onClick={() => setFontSize(s.v)}
                  role="radio"
                  aria-checked={fontSize === s.v}
                  className="min-h-11"
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <Button
              variant="outline"
              onClick={reset}
              disabled={isDefault}
              className="min-h-11 w-full"
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Reset to defaults
            </Button>
            {/* aria-live so confirmation reaches a screen reader: the visual
                cue for a reset is the controls changing, which is invisible
                to anyone not looking at them. */}
            <p aria-live="polite" className="sr-only">
              {isDefault ? "Accessibility settings are at their defaults." : ""}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AccessibilityPanel;