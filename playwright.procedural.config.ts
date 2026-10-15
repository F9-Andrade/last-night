import {defineConfig} from '@playwright/test';
import base from './playwright.economy.config';
export default defineConfig({...base,testMatch:['**/procedural.spec.ts'],timeout:300000});
