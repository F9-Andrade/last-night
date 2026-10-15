import {defineConfig} from '@playwright/test';
import base from './playwright.coop.config';

export default defineConfig({...base,
  testMatch:['**/field-books.spec.ts'],timeout:300000,
  use:{...base.use,viewport:{width:1366,height:768}},
});
