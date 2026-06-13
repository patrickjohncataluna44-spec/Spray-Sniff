/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
    './postcss-unwrap-cascade-layers.cjs': {},
  },
}

export default config
