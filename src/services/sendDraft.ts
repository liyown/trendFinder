import dotenv from 'dotenv';
import { sendToWeixin } from './weixin';

dotenv.config();

const BARK_URL = process.env.BARK_KEY ? `https://api.day.app/${process.env.BARK_KEY}` : '';

// 发送Bark通知
async function sendBarkNotification(title: string, body: string) {
  if (!process.env.BARK_KEY) {
    return;
  }
  
  try {
    await fetch(`${BARK_URL}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`);
  } catch (error) {
    console.error('Failed to send Bark notification:', error);
  }
}

export async function sendDraft(content: string) {
  try {
    await sendToWeixin(content, "SwCSRjrdGJNaWioRQUHzgHJZrV6TNIA3EAaKJabbh4hKjw1instlmsOt9MlN20xo");
    await sendBarkNotification('文章发送成功', '内容已成功发送到微信');
    console.log('Draft sent successfully');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await sendBarkNotification('文章发送失败', `错误: ${errorMsg}`);
    console.error('Error sending draft:', error);
    throw error;
  }
}