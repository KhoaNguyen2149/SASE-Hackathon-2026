import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',fullyParallel:false,workers:1,timeout:60000,
  expect:{timeout:15000},reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:3100',trace:'retain-on-failure',screenshot:'only-on-failure',...devices['Desktop Chrome'],viewport:{width:1440,height:1000}},
  webServer:{command:'npx next dev --hostname 127.0.0.1 --port 3100',url:'http://127.0.0.1:3100/api/health',timeout:120000,reuseExistingServer:!process.env.CI,env:{DATABASE_PATH:'./data/e2e.sqlite',SEED_DEMO:'true',APP_URL:'http://127.0.0.1:3100',NEXT_BUILD_DIR:'.next-e2e',SMTP_HOST:''}}
});
