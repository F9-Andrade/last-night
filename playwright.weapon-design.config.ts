import {defineConfig} from '@playwright/test';
import base from './playwright.coop.config';
export default defineConfig(base,{testMatch:['**/weapon-design.spec.ts','**/weapon-rig.spec.ts'],timeout:180000,outputDir:'test-results/weapon-design',use:{...base.use,viewport:{width:1600,height:900}}});
