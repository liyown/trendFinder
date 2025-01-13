import { handleCron, startTwitterTask } from "./controllers/cron"
import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

// async function main() {
//   console.log(`Starting process to generate draft...`);
//   await handleCron();
// }
// main();

 // Start of Selection
// 每 5 秒调用一次 Twitter 任务
cron.schedule('*/5 * * * * *', async () => {
  await startTwitterTask();
});



//If you want to run the cron job manually, uncomment the following line:
cron.schedule(`0 17 * * *`, async () => {
 console.log(`Starting process to generate draft...`);
 await handleCron();
});