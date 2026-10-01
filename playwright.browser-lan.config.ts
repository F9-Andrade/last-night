import {defineConfig} from '@playwright/test';
import base from './playwright.coop.config';
export default defineConfig(base,{testMatch:['**/browser-lan.spec.ts'],timeout:300000});
