import {defineConfig} from '@playwright/test';
import base from './playwright.coop.config';
export default defineConfig({...base,
 testMatch:['**/economy.spec.ts'],timeout:300000,
 use:{...base.use,baseURL:'http://127.0.0.1:5174',viewport:{width:1366,height:768}},
 webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',url:'http://127.0.0.1:5174',reuseExistingServer:true},
});
