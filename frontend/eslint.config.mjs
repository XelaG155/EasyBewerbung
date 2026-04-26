import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Downgrade pre-existing rule violations from error to warning so
    // the lint job can run blocking on NEW errors only. The current
    // baseline (~90 violations across the codebase) is documented:
    //
    // - react-hooks/set-state-in-effect       was added in React 19;
    //   pre-existing setState-in-useEffect callsites need a
    //   case-by-case review before mechanical conversion.
    // - @typescript-eslint/no-explicit-any   concentrated in legacy
    //   API helpers; tightening means typing the API surface first.
    // - react/no-unescaped-entities          7 cosmetic instances in
    //   the dashboard copy.
    // - prefer-const                          1 instance in i18n-context.
    //
    // None are pilot-blockers. The override keeps lint useful (new
    // violations of OTHER rules still error out) without permanently
    // red-blocking the deploy on a backlog. Sweep in a dedicated PR
    // and remove the override at that point.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
      "prefer-const": "warn",
    },
  },
  {
    // Test fixtures use `use(...)` helpers and patterns that don't fit
    // the React-component naming convention. Disable rules-of-hooks for
    // the e2e directory only.
    files: ["e2e/**/*.ts", "e2e/**/*.tsx"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
]);

export default eslintConfig;
