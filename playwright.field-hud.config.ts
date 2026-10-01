import {defineConfig} from '@playwright/test';
import base from './playwright.coop.config';
export default defineConfig({...base,
 testMatch:['**/field-hud.spec.ts'],timeout:240000,workers:1,
 use:{...base.use,baseURL:'http://127.0.0.1:5175',viewport:{width:1366,height:768},deviceScaleFactor:1},
 webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',url:'http://127.0.0.1:5175',reuseExistingServer:true},
});
