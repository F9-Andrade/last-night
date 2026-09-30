import {defineConfig} from '@playwright/test';
import base from './playwright.coop.config';
export default defineConfig(base,{testMatch:['**/lan.spec.ts'],timeout:180000,use:{...base.use,baseURL:process.env.LAN_TEST_URL??'http://127.0.0.1:8787',viewport:{width:1366,height:768}},webServer:{command:'npm run lan',url:'http://127.0.0.1:8787/lan-health',reuseExistingServer:true}});
