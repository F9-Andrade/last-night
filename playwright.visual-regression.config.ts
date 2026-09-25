import {defineConfig} from '@playwright/test';
import base from './playwright.coop.config';

export default defineConfig(base, {
  testMatch: ['**/visual-regression.spec.ts'],
  timeout: 300000,
});
