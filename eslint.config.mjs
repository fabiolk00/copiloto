import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import security from "eslint-plugin-security";

// Substitui semgrep (sem binário para Windows e sem Docker/WSL neste
// ambiente — ver SECURITY_REVIEW.md) como a camada de SAST: detecta
// padrões clássicos (eval, child_process, regex vulnerável a ReDoS,
// require dinâmico, etc.) direto no lint, já integrado ao CI existente.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  security.configs.recommended,
  {
    // Specs/fixtures do Playwright não são código React — o parâmetro de
    // fixture chamado `use` (convenção oficial do Playwright) engana a
    // heurística de nome do react-hooks, que o trata como o hook `use()`.
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Artefatos gerados (relatórios, traces com bundles de terceiros) — nunca código do projeto.
    "harness/report/**",
    ".security-tools/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
