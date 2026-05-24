import nextPlugin from "@next/eslint-plugin-next"

const { flatConfig: nextFlatConfig } = nextPlugin

export default [
  {
    ignores: [".next/**", "node_modules/**", "out/**", "build/**"],
  },
  nextFlatConfig.recommended,
  nextFlatConfig.coreWebVitals,
]
