# zsf3

Fresh Mapbox baseline rebuilt from scratch with:

- Vite + React + TypeScript
- Mapbox GL JS loaded from npm
- A raw `three.js` custom layer that renders a large red debug box above the East River

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and add your public Mapbox token:

```env
VITE_MAPBOX_ACCESS_TOKEN=your_public_mapbox_token_here
```

3. Start the dev server:

```bash
npm run dev
```

## Current baseline

- Uses `mapbox://styles/mapbox/standard`
- Adds a `fill-extrusion` buildings layer on `style.load`
- Adds a custom `three.js` layer using the official Mapbox transform pattern
- Includes a `Reset view` button that flies back to the debug box target
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default {
  // other rules...
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json', './tsconfig.app.json'],
    tsconfigRootDir: __dirname,
  },
}
```

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list
