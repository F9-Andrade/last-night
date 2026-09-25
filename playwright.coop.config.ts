import {defineConfig} from '@playwright/test';
import base from './playwright.network.config';
export default defineConfig(base,{testMatch:['**/coop.spec.ts'],timeout:420000,use:{...base.use,...(process.env.LAST_NIGHT_GPU==='1'?{launchOptions:{args:['--enable-webgl','--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']}}:{})}});
