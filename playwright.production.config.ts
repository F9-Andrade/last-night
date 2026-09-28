import {defineConfig} from '@playwright/test';
import base from './playwright.coop.config';

export default defineConfig({
  ...base,
  testMatch:['**/production-loading.spec.ts'],timeout:120000,
  use:{...base.use,baseURL:process.env.LAST_NIGHT_TEST_URL??'http://127.0.0.1:4173'},
  webServer:process.env.LAST_NIGHT_TEST_URL?[]:{command:'npm run preview -- --host 127.0.0.1 --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:true},
});
