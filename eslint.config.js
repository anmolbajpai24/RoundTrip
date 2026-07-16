import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  { ignores: ["dist/**", "dev-dist/**", "node_modules/**", "docs/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    rules: {
      // App style: intentionally-unused args/caught errors start with _.
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react/jsx-uses-vars": "error", // JSX usage counts for no-unused-vars
      // The compiler-era heuristic flags this app's established debounce /
      // prop-sync effects; keep it visible but not blocking.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: ["api/**/*.js", "vite.config.js", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
];
