import { scrapeSources } from '../services/scrapeSources';
import { getCronSources } from '../services/getCronSources';
import { generateDraft } from '../services/generateDraft';
import { sendDraft } from '../services/sendDraft';
import { scrapeTwitter } from '../services/twitterScraper';
export const handleCron = async (): Promise<void> => {
  try {
    const cronSources = await getCronSources();
    const rawStories = await scrapeSources(cronSources!);
    const rawStoriesString = JSON.stringify(rawStories);
    const draftPost = await generateDraft(rawStoriesString);
    const result = await sendDraft(draftPost!);
    console.log(result);
  } catch (error) {
    console.error(error);
  }
}



export async function startTwitterTask() {
  try {
    console.log('开始执行Twitter数据抓取任务...');
    const sources = await getCronSources();
    if (sources && sources.length > 0) {
      await scrapeTwitter(sources);
      console.log('Twitter数据抓取任务完成');
    } else {
      console.log('没有找到Twitter数据源');
    }
  } catch (error) {
    console.error('Twitter数据抓取任务失败:', error);
  }
} 