import {defineConfig} from '@playwright/test';
import base from './playwright.coop.config';

export default defineConfig(base, {testMatch:['**/startup.spec.ts'],timeout:90000});
