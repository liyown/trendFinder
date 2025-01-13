import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function getWeixinAccessToken() {
  try {
    const response = await axios.get(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${process.env.WEIXIN_APP_ID}&secret=${process.env.WEIXIN_APP_SECRET}`
    );
    return response.data.access_token;
  } catch (error) {
    console.error('获取微信 access token 失败:', error);
    throw error;
  }
}

export async function sendToWeixin(content: string, mediaId: string) {
  try {
    // 获取微信 access token
    const accessToken = await getWeixinAccessToken();
    
    // 构建文章内容
    const article = {
      articles: [{
        title: content.split('\n')[0], // 使用第一行作为标题
        thumb_media_id: mediaId,
        author: "AI Trend Finder",
        digest: content.slice(0, 200), // 摘要使用前200字
        content: content,
        content_source_url: "",
        show_cover_pic: 1
      }]
    };

    // 发送草稿到微信
    const response = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`,
      article,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status !== 200 || response.data.errcode) {
      throw new Error(`微信API返回错误: ${JSON.stringify(response.data)}`);
    }

    return response.data;
  } catch (error) {
    console.error('发送草稿到微信公众号失败:', error);
    throw error;
  }
} 