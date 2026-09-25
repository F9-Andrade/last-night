import {defineConfig} from '@playwright/test';
import base from './playwright.coop.config';

export default defineConfig(base, {
  testMatch: ['**/fps.spec.ts', '**/fps-playthrough.spec.ts', '**/audio.spec.ts', '**/phase9.spec.ts', '**/coop.spec.ts'],
});
