import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig(base,{testMatch:['**/network.spec.ts'],timeout:360000,expect:{timeout:30000},workers:1,use:{...base.use,viewport:{width:960,height:640},launchOptions:{args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']}}});
