import {defineConfig} from '@playwright/test';
import base from './playwright.coop.config';
export default defineConfig(base,{testMatch:['**/cloud.spec.ts'],timeout:240000,outputDir:'test-results/supabase/traces'});
