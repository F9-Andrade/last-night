import {defineConfig} from '@playwright/test';
import base from './playwright.coop.config';
export default defineConfig(base,{testMatch:['**/construction.spec.ts'],timeout:180000,use:{...base.use,viewport:{width:1366,height:768}}});
