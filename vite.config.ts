import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this project from https://<user>.github.io/trip-planner/
export default defineConfig({
  base: '/trip-planner/',
  plugins: [react()],
});
