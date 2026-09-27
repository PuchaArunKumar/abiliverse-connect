import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // supabase/functions/mcp is a generated bundle produced by @lovable.dev/mcp-js,
  // not hand-written source. Linting it reports the bundler's own output style.
  { ignores: ["dist", "supabase/functions/mcp/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // These modules deliberately export a hook or a class-name helper beside
      // their component (the shadcn/ui convention, and the context hooks).
      // Fast refresh falls back to a full reload for them, which is harmless.
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          allowExportNames: [
            "badgeVariants",
            "buttonVariants",
            "toggleVariants",
            "navigationMenuTriggerStyle",
            "useFormField",
            "useSidebar",
            "toast",
            "useA11y",
            "useAuth",
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
