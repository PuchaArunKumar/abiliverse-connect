import { useState } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Accessibility, Link2, RotateCcw, Sun, Type, Zap } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useA11y } from "@/contexts/AccessibilityContext";
import { cn } from "@/lib/utils";

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

  const handleFontSize = (value: string) => {
    const match = sizes.find((s) => s.v === value);
    if (match) setFontSize(match.v);
  };

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
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
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
              <p className="text-sm text-muted-foreground">
                Switches to the Lexend typeface, with wider letter and word spacing.
              </p>
            </div>
            <Switch id="a11y-dys" checked={dyslexiaFont} onCheckedChange={() => toggle("dyslexiaFont")} />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="a11y-motion" className="flex items-center gap-2 font-medium">
                <Zap className="h-4 w-4" aria-hidden="true" /> Reduce motion
              </Label>
              <p className="text-sm text-muted-foreground">
                Turn off animations and transitions. Already applied if your device is set to reduce motion.
              </p>
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
            <p id="a11y-text-size" className="font-medium">Text size</p>
            <p id="a11y-text-size-hint" className="mb-2 text-sm text-muted-foreground">
              Scaled from the text size set in your browser.
            </p>
            {/* A real radio group: Tab reaches the chosen size, and the arrow
                keys move between sizes and select them, which is what the
                radio role tells a screen reader user to expect. Buttons
                wearing role="radio" announced that and did neither. */}
            <RadioGroupPrimitive.Root
              value={fontSize}
              onValueChange={handleFontSize}
              aria-labelledby="a11y-text-size"
              aria-describedby="a11y-text-size-hint"
              className="grid grid-cols-2 gap-2"
            >
              {sizes.map((s) => (
                <RadioGroupPrimitive.Item
                  key={s.v}
                  value={s.v}
                  className={cn(
                    buttonVariants({ variant: fontSize === s.v ? "default" : "outline" }),
                    "min-h-11",
                  )}
                >
                  {s.label}
                </RadioGroupPrimitive.Item>
              ))}
            </RadioGroupPrimitive.Root>
          </div>

          <div className="border-t border-border pt-6">
            {/* aria-disabled rather than disabled: disabling the button while
                it has focus (it is the control just pressed) would drop focus
                out of the panel. */}
            <Button
              variant="outline"
              onClick={() => {
                if (!isDefault) reset();
              }}
              aria-disabled={isDefault}
              className="min-h-11 w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
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
