import {defineConfig} from '@playwright/test';
import base from './playwright.coop.config';
export default defineConfig(base,{testMatch:['**/fps.spec.ts','**/melee-motion.spec.ts'],grep:/every FPS weapon|first-person punch|remote melee/,outputDir:'test-results/weapon-regression',timeout:240000});
