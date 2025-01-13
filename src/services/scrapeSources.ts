import FirecrawlApp from '@mendable/firecrawl-js';
import dotenv from 'dotenv';
import { z } from 'zod';
import { readPendingData, removePendingData } from './twitterScraper';

dotenv.config();

let app: FirecrawlApp;
let useScrape = false;
let useTwitter = false;

// Initialize Firecrawl
if (process.env.FIRECRAWL_API_KEY) {
  app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  useScrape = true;
} 

if (process.env.X_API_BEARER_TOKEN) {
  useTwitter = true;
}

// 1. Define the schema for our expected JSON
const StorySchema = z.object({
  headline: z.string().describe("Story or post headline"),
  content: z.string().describe(""),
  link: z.string().describe("A link to the post or story"),
  date_posted: z.string().describe("The date the story or post was published"),
});

const StoriesSchema = z.object({
  stories: z.array(StorySchema).describe(
    "A list of today's AI or LLM-related stories"
  ),
});

export async function scrapeSources(sources: string[]) {
  const num_sources = sources.length;
  console.log(`Scraping ${num_sources} sources...`);

  let combinedText: { stories: any[] } = { stories: [] };

  // 首先读取Twitter缓存数据
  if (useTwitter) {
    const twitterData = readPendingData();
    if (twitterData.length > 0) {
      combinedText.stories.push(...twitterData);
      // 读取后删除缓存数据
      removePendingData();
    }
  }

  for (const source of sources) {
    // 跳过Twitter源，因为已经在另一个服务中处理
    if (source.includes("x.com")) {
      continue;
    }
    
    // 处理其他源
    if (useScrape) {
      // Firecrawl will both scrape and extract for you
      // Provide a prompt that instructs Firecrawl what to extract
      const currentDate = new Date().toLocaleDateString();
      const promptForFirecrawl = `
      Return only today's AI or LLM related story or post headlines and links in JSON format from the page content. 
      They must be posted today, ${currentDate}. The format should be:
        {
          "stories": [
            {
              "headline": "headline1",
              "content":"content1"
              "link": "link1",
              "date_posted": "YYYY-MM-DD"
            },
            ...
          ]
        }
      If there are no AI or LLM stories from today, return {"stories": []}.
      
      The source link is ${source}. 
      If a story link is not absolute, prepend ${source} to make it absolute. 
      Return only pure JSON in the specified format (no extra text, no markdown, no \\\).  
      The content should be about 500 words, which can summarize the full text and the main point.
      Translate all into Chinese.
      `;

      // Use app.extract(...) directly
      const scrapeResult = await app.scrapeUrl(source, {
        formats: ["extract"],
        extract: {
          prompt: promptForFirecrawl,
          schema: StoriesSchema
        }
      });

      if (!scrapeResult.success || !scrapeResult.extract?.stories) {
        throw new Error(`Failed to scrape: ${scrapeResult.error}`);
      }

      // The structured data
      const todayStories = scrapeResult.extract;
      console.log(todayStories)
      if (todayStories && todayStories.stories) {
        console.log(
          `Found ${todayStories.stories.length} stories from ${source}`
        );
        combinedText.stories.push(...todayStories.stories);
      } else {
        console.log(`No valid stories data found from ${source}`);
      }
    }
  }

  return combinedText.stories;
}
