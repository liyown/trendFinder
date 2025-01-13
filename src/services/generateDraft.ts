import dotenv from 'dotenv';
import Together from 'together-ai';
import { z } from 'zod';

dotenv.config();

interface Story {
  story_or_tweet_link: string;
  description: string;
  date_posted: string;
  content: string;
}

interface DraftPost {
  interestingTweetsOrStories: Story[];
}

/**
 * 将CSS样式转换为内联样式对象
 */
function convertStyleToInline(styles: { [key: string]: string }) {
  return Object.entries(styles)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
}

/**
 * 获取基础样式配置
 */
function getBaseStyles() {
  return {
    container: {
      'max-width': '100%',
      'margin': '0 auto',
      'padding': '15px',
      'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      'line-height': '1.8',
      'color': '#333'
    },
    title: {
      'font-size': '24px',
      'font-weight': 'bold',
      'text-align': 'center',
      'margin': '20px 0',
      'color': '#1a1a1a'
    },
    storyContainer: {
      'margin-bottom': '35px',
      'padding': '25px',
      'border': '1px solid #eaeaea',
      'border-radius': '8px',
      'box-shadow': '0 2px 8px rgba(0,0,0,0.05)',
      'background': '#fff',
      'position': 'relative'
    },
    storyTitle: {
      'font-size': '20px',
      'font-weight': 'bold',
      'color': '#1a1a1a',
      'margin': '0 0 15px',
      'padding-left': '10px',
      'border-left': '4px solid #07c160'
    },
    storyMeta: {
      'font-size': '14px',
      'color': '#666',
      'margin': '10px 0'
    },
    storyContent: {
      'font-size': '16px',
      'line-height': '1.8',
      'color': '#333',
      'margin': '15px 0',
      'text-align': 'justify',
      'padding': '15px',
      'background': '#f9f9f9',
      'border-radius': '6px'
    },
    storyLink: {
      'font-size': '14px',
      'color': '#07c160',
      'text-decoration': 'none',
      'display': 'block',
      'margin-top': '15px',
      'padding-top': '15px',
      'border-top': '1px dashed #eaeaea'
    },
    divider: {
      'width': '50px',
      'height': '3px',
      'background': 'linear-gradient(90deg, transparent, #07c160, transparent)',
      'margin': '20px auto'
    }
  };
}

/**
 * Generate a post draft with trending ideas based on raw stories.
 */
export async function generateDraft(rawStories: string) {
  console.log(`正在生成包含原始故事的文章草稿 (${rawStories.length} 字符)...`)

  try {
    // 初始化 Together 客户端
    const together = new Together();

    // 获取当前日期，作为文章头部的日期
    const currentDate = new Date().toLocaleDateString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: 'numeric',
      day: 'numeric',
    });

    // 使用 Together 的聊天功能与 Llama 3.1 模型
    const completion = await together.chat.completions.create({
      model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      messages: [
        {
          role: 'system',
          content: `你将获得一系列关于AI的故事。请只返回JSON格式数据，不要包含任何其他文字：
            {
              "interestingTweetsOrStories": [
                {
                  "story_or_tweet_link": "链接",
                  "description": "描述",
                  "date_posted": "发布日期",
                  "content": "详细内容"
                }
              ]
            }`,
        },
        {
          role: 'user',
          content: `你的任务是从这些故事中整理好，润色，补充相关知识，提高可读性，同时内容不要想人工智能生成的一样，并返回一个JSON。 
          每个故事提供一个 'story_or_tweet_link'，'description'（简短描述），'date_posted'（发布时间）和'content'（详细内容）。 
          返回所有相关的故事，每个故事都作为单独的对象，详细内容需要润色，提高可读性，同时内容不要像人工智能生成的一样，字数多一点，不少于300字。
          这里是原始故事列表:\n\n${rawStories}\n\n
          注意：请直接返回JSON数据，不要包含任何其他文字说明。`
        },
      ],
      response_format: { type: 'json_object' },
    });

    // 检查是否获得了第一个选择的有效 JSON 数据
    const rawJSON = completion?.choices?.[0]?.message?.content;
    if (!rawJSON) {
      console.log("没有返回JSON输出");
      return "没有输出";
    }

    // 尝试提取和解析 JSON
    try {
      console.log("原始响应:", rawJSON);
      
      // 尝试直接解析
      let parsedResponse: DraftPost;
      try {
        parsedResponse = JSON.parse(rawJSON) as DraftPost;
      } catch (e) {
        // 如果直接解析失败，尝试提取 JSON 部分
        const jsonMatch = rawJSON.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("无法从响应中提取有效的 JSON");
        }
        parsedResponse = JSON.parse(jsonMatch[0]) as DraftPost;
      }

      // 验证解析后的数据
      if (!parsedResponse?.interestingTweetsOrStories?.length) {
        throw new Error("解析的 JSON 数据不包含所需的故事数组");
      }

      // 获取基础样式
      const styles = getBaseStyles();

      // 构建 HTML 内容
      const htmlContent = parsedResponse.interestingTweetsOrStories
        .map((story, index) => {
          return `
          <div style="${convertStyleToInline(styles.storyContainer)}">
              <div style="${convertStyleToInline(styles.storyTitle)}">${story.description}</div>
              <div style="${convertStyleToInline(styles.storyMeta)}">📅 发布时间：${story.date_posted}</div>
              <div style="${convertStyleToInline(styles.storyContent)}">${story.content}</div>
              <div style="${convertStyleToInline(styles.storyLink)}">👉 查看原文: ${story.story_or_tweet_link}</div>
              ${index < parsedResponse.interestingTweetsOrStories.length - 1 ? 
                `<div style="${convertStyleToInline(styles.divider)}"></div>` : ''}
          </div>`;
        })
        .join('');

      // 完整的 HTML 内容（只包含 body 内容，使用内联样式）
      const fullHtmlContent = `
      <div style="${convertStyleToInline(styles.container)}">
          <div style="${convertStyleToInline(styles.title)}">🚀 今日 AI 热点</div>
          ${htmlContent}
      </div>`;

      // 构建符合公众号 API 的 JSON 格式
      const articleJson = {
        articles: [
          {
            title: `今日 AI 热点 - ${currentDate}`,
            author: "刘耀文",
            digest: `${currentDate} AI 领域热点新闻汇总`,
            content: fullHtmlContent,
            thumb_media_id: "SwCSRjrdGJNaWioRQUHzgHJZrV6TNIA3EAaKJabbh4hKjw1instlmsOt9MlN20xo", // 需要在实际使用时设置
            need_open_comment: 1,
            only_fans_can_comment: 0
          }
        ]
      };

      return JSON.stringify(articleJson, null, 2);

    } catch (error) {
      console.error("生成草稿时出错", error);
      return "生成草稿时出错。";
    }

  } catch (error) {
    console.error("生成草稿时出错", error);
    return "生成草稿时出错。";
  }
}
