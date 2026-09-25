import {defineConfig} from '@playwright/test';
import base from './playwright.coop.config';
export default defineConfig(base,{testMatch:['**/visual-overhaul.spec.ts'],timeout:360000});
