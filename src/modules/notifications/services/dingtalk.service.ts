import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

export interface DingtalkMessageOptions {
  title: string;
  content: string;
  webhook: string;
  secret?: string;
}

@Injectable()
export class DingtalkService {
  private readonly logger = new Logger(DingtalkService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * 发送钉钉消息
   */
  async sendMessage(options: DingtalkMessageOptions): Promise<any> {
    const { title, content, webhook, secret } = options;

    try {
      // 构建请求URL
      let url = webhook;
      
      if (secret) {
        const timestamp = Date.now();
        const sign = this.generateSign(timestamp, secret);
        url += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
      }

      // 构建消息体
      const message = {
        msgtype: 'actionCard',
        actionCard: {
          title,
          text: content,
          btnOrientation: '0',
          singleTitle: '查看详情',
          singleURL: this.configService.get('app.baseUrl', 'http://localhost:3000'),
        },
      };

      // 发送请求
      const response = await axios.post(url, message, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (response.data.errcode !== 0) {
        throw new Error(`钉钉API错误: ${response.data.errmsg}`);
      }

      this.logger.log('Dingtalk message sent successfully');
      return response.data;

    } catch (error) {
      this.logger.error('Failed to send dingtalk message:', error);
      throw error;
    }
  }

  /**
   * 生成钉钉签名
   */
  private generateSign(timestamp: number, secret: string): string {
    const stringToSign = `${timestamp}\n${secret}`;
    const sign = crypto
      .createHmac('sha256', secret)
      .update(stringToSign)
      .digest('base64');
    return sign;
  }

  /**
   * 发送文本消息
   */
  async sendTextMessage(webhook: string, text: string, secret?: string): Promise<any> {
    return this.sendMessage({
      title: '通知',
      content: text,
      webhook,
      secret,
    });
  }

  /**
   * 发送Markdown消息
   */
  async sendMarkdownMessage(
    webhook: string,
    title: string,
    markdown: string,
    secret?: string,
  ): Promise<any> {
    try {
      let url = webhook;
      
      if (secret) {
        const timestamp = Date.now();
        const sign = this.generateSign(timestamp, secret);
        url += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
      }

      const message = {
        msgtype: 'markdown',
        markdown: {
          title,
          text: markdown,
        },
      };

      const response = await axios.post(url, message, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (response.data.errcode !== 0) {
        throw new Error(`钉钉API错误: ${response.data.errmsg}`);
      }

      return response.data;

    } catch (error) {
      this.logger.error('Failed to send dingtalk markdown message:', error);
      throw error;
    }
  }

  /**
   * 测试钉钉Webhook连接
   */
  async testWebhook(webhook: string, secret?: string): Promise<boolean> {
    try {
      await this.sendTextMessage(webhook, '这是一条测试消息', secret);
      return true;
    } catch (error) {
      this.logger.error('Dingtalk webhook test failed:', error);
      return false;
    }
  }
}