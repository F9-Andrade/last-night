import {defineConfig} from '@playwright/test';
import base from './playwright.coop.config';
export default defineConfig(base,{testMatch:['**/performance-pass.spec.ts'],timeout:240000,outputDir:'test-results/performance-pass',use:{...base.use,viewport:{width:1920,height:1080}}});
