import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testMatch:['**/ui-render-optimization.spec.ts'],timeout:90000});
