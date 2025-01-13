import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// 临时文件路径
const TEMP_FILE_PATH = path.join(__dirname, '../../temp/twitter_pending.json');
const LAST_USER_PATH = path.join(__dirname, '../../temp/last_user.txt');
const BARK_URL = process.env.BARK_KEY ? `https://api.day.app/${process.env.BARK_KEY}` : '';

// 确保temp目录存在
if (!fs.existsSync(path.dirname(TEMP_FILE_PATH))) {
  fs.mkdirSync(path.dirname(TEMP_FILE_PATH), { recursive: true });
}

interface TwitterData {
  headline: string;
  content: string;
  link: string;
  date_posted: string;
}

// 读取待处理的数据
export function readPendingData(): TwitterData[] {
  try {
    if (fs.existsSync(TEMP_FILE_PATH)) {
      const data = JSON.parse(fs.readFileSync(TEMP_FILE_PATH, 'utf-8'));
      return Array.isArray(data) ? data : [];
    }
  } catch (error) {
    console.error('Error reading pending Twitter data:', error);
  }
  return [];
}

// 删除临时文件
export function removePendingData() {
  try {
    if (fs.existsSync(TEMP_FILE_PATH)) {
      fs.unlinkSync(TEMP_FILE_PATH);
    }
  } catch (error) {
    console.error('Error removing pending Twitter data:', error);
  }
}

// 保存待处理的数据
function savePendingData(newData: TwitterData[]) {
  try {
    // 使用Set来去重，通过link字段（因为每个推文的链接是唯一的）
    const uniqueTweets = Array.from(
      new Map(newData.map(tweet => [tweet.link, tweet])).values()
    );
    
    fs.writeFileSync(TEMP_FILE_PATH, JSON.stringify(uniqueTweets));
  } catch (error) {
    console.error('Error saving pending Twitter data:', error);
  }
}

// 获取下一个要处理的用户
function getNextUser(sources: string[]): string | null {
  const twitterSources = sources.filter(source => source.includes('x.com'));
  if (twitterSources.length === 0) return null;

  let lastProcessedIndex = 0;
  try {
    if (fs.existsSync(LAST_USER_PATH)) {
      const lastUser = fs.readFileSync(LAST_USER_PATH, 'utf-8');
      const index = twitterSources.indexOf(lastUser);
      lastProcessedIndex = index >= 0 ? (index + 1) % twitterSources.length : 0;
    }
  } catch (error) {
    console.error('Error reading last user:', error);
  }

  const nextSource = twitterSources[lastProcessedIndex];
  fs.writeFileSync(LAST_USER_PATH, nextSource);
  return nextSource;
}

// 发送Bark通知
async function sendBarkNotification(title: string, body: string) {
  if (!process.env.BARK_KEY) {
    return; // 如果没有配置BARK_KEY，直接返回
  }
  
  try {
    await fetch(`${BARK_URL}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`);
  } catch (error) {
    console.error('Failed to send Bark notification:', error);
  }
}

export async function scrapeTwitter(sources: string[]) {
  const nextSource = getNextUser(sources);
  if (!nextSource) return;

  const usernameMatch = nextSource.match(/x\.com\/([^\/]+)/);
  if (!usernameMatch) return;

  const username = usernameMatch[1];
  console.log(`Processing Twitter user: ${username}`);

  try {
    const query = `from:${username}`;
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const apiUrl = `https://api.twitterapi.io/twitter/tweet/advanced_search?query=${encodeURIComponent(query)}`;

    const response = await fetch(apiUrl, {
      headers: {
        "X-API-Key": `${process.env.X_API_BEARER_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorMsg = `Failed to fetch tweets: ${response.statusText}`;
      await sendBarkNotification('Twitter抓取失败', `用户: ${username}\n错误: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const tweets = await response.json();

    if (tweets.meta?.result_count > 0 && Array.isArray(tweets.data)) {
      const tweetData = tweets.data.map((tweet: any) => ({
        id: tweet.id,
        headline: tweet.text.split('\n')[0],
        content: tweet.text,
        link: `https://x.com/i/status/${tweet.id}`,
        date_posted: tweet.created_at || startTime,
        author: {
          username: tweet.author?.userName || tweet.author?.screen_name,
          name: tweet.author?.name,
          profile_image: tweet.author?.profilePicture,
          verified: tweet.author?.isVerified || tweet.author?.isBlueVerified
        },
        metrics: {
          retweet_count: tweet.retweetCount,
          reply_count: tweet.replyCount,
          like_count: tweet.likeCount,
          quote_count: tweet.quoteCount,
          view_count: tweet.viewCount,
          bookmark_count: tweet.bookmarkCount
        },
        media: tweet.extendedEntities?.media?.map((media: any) => ({
          type: media.type,
          url: media.media_url_https,
          preview_url: media.url,
          video_info: media.type === 'video' ? {
            duration_ms: media.video_info?.duration_millis,
            variants: media.video_info?.variants
          } : undefined
        })) || [],
        quoted_tweet: tweet.quoted_tweet ? {
          id: tweet.quoted_tweet.id,
          content: tweet.quoted_tweet.text,
          author: tweet.quoted_tweet.author?.userName
        } : null,
        language: tweet.lang,
        source: tweet.source
      }));

      if (tweetData.length > 0) {
        const existingData = readPendingData();
        const newData = [...existingData, ...tweetData];
        savePendingData(newData);
        const successMsg = `成功获取 ${tweetData.length} 条推文`;
        await sendBarkNotification('Twitter抓取成功', `用户: ${username}\n${successMsg}`);
        console.log(`Successfully fetched ${tweetData.length} tweets from ${username}`);
      }
    } else {
      const noDataMsg = `没有找到新推文`;
      await sendBarkNotification('Twitter抓取提醒', `用户: ${username}\n${noDataMsg}`);
      console.log(`No tweets found for ${username}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await sendBarkNotification('Twitter抓取错误', `用户: ${username}\n错误: ${errorMsg}`);
    console.error(`Error fetching tweets for ${username}:`, error);
  }
} 