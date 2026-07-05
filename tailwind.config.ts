import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#070b1c",
          900: "#0b1230",
          800: "#111a42",
          700: "#1a2557",
        },
        gold: {
          300: "#f3dfa2",
          400: "#e6c877",
          500: "#d4af37",
          600: "#b8942a",
        },
      },
      fontFamily: {
        serifJp: ['"Shippori Mincho"', '"Hiragino Mincho ProN"', "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
