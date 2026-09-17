/**
 * 监控告警服务
 * 集成Slack/Telegram/邮件通知功能
 */

import axios from 'axios';

interface AlertConfig {
  slackWebhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  emailConfig?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    from: string;
    to: string[];
  };
}

export interface AlertMessage {
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export class AlertService {
  private config: AlertConfig;
  private isEnabled: boolean;

  constructor(config: AlertConfig) {
    this.config = config;
    this.isEnabled = this.hasValidConfig();
    
    if (this.isEnabled) {
      console.log('🔔 告警服务已启用');
    } else {
      console.warn('⚠️  告警服务未配置，将仅记录日志');
    }
  }

  /**
   * 检查是否有有效的告警配置
   */
  private hasValidConfig(): boolean {
    return !!(this.config.slackWebhookUrl || 
              (this.config.telegramBotToken && this.config.telegramChatId) || 
              this.config.emailConfig);
  }

  /**
   * 发送告警
   */
  async sendAlert(alert: AlertMessage): Promise<void> {
    const timestamp = alert.timestamp || new Date();
    const formattedMessage = this.formatMessage(alert, timestamp);
    
    console.log(`[${timestamp.toISOString()}] ${alert.level.toUpperCase()}: ${alert.title} - ${alert.message}`);
    
    if (!this.isEnabled) {
      return;
    }

    const promises: Promise<void>[] = [];

    // Slack通知
    if (this.config.slackWebhookUrl) {
      promises.push(this.sendSlackAlert(alert, formattedMessage));
    }

    // Telegram通知
    if (this.config.telegramBotToken && this.config.telegramChatId) {
      promises.push(this.sendTelegramAlert(alert, formattedMessage));
    }

    // 邮件通知
    if (this.config.emailConfig && alert.level === 'critical') {
      promises.push(this.sendEmailAlert(alert, formattedMessage));
    }

    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('告警发送失败:', error);
    }
  }

  /**
   * 发送Slack告警
   */
  private async sendSlackAlert(alert: AlertMessage, formattedMessage: string): Promise<void> {
    try {
      const payload = {
        text: formattedMessage,
        attachments: [
          {
            color: this.getAlertColor(alert.level),
            fields: [
              {
                title: '级别',
                value: alert.level.toUpperCase(),
                short: true
              },
              {
                title: '时间',
                value: alert.timestamp?.toISOString() || new Date().toISOString(),
                short: true
              },
              {
                title: '详情',
                value: alert.message,
                short: false
              }
            ]
          }
        ]
      };

      await axios.post(this.config.slackWebhookUrl!, payload);
      console.log('📢 Slack告警发送成功');
    } catch (error) {
      console.error('Slack告警发送失败:', error);
    }
  }

  /**
   * 发送Telegram告警
   */
  private async sendTelegramAlert(alert: AlertMessage, formattedMessage: string): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`;
      const payload = {
        chat_id: this.config.telegramChatId,
        text: formattedMessage,
        parse_mode: 'HTML'
      };

      await axios.post(url, payload);
      console.log('📱 Telegram告警发送成功');
    } catch (error) {
      console.error('Telegram告警发送失败:', error);
    }
  }

  /**
   * 发送邮件告警
   */
  private async sendEmailAlert(alert: AlertMessage, formattedMessage: string): Promise<void> {
    // TODO: 实现邮件发送功能
    // 可以使用nodemailer或其他邮件库
    console.log('📧 邮件告警（待实现）:', formattedMessage);
  }

  /**
   * 格式化告警消息
   */
  private formatMessage(alert: AlertMessage, timestamp: Date): string {
    const emoji = this.getAlertEmoji(alert.level);
    const timeStr = timestamp.toLocaleString('zh-CN');
    
    return `${emoji} *${alert.title}*\n` +
           `⏰ ${timeStr}\n` +
           `📝 ${alert.message}\n` +
           `🔢 级别: ${alert.level.toUpperCase()}`;
  }

  /**
   * 获取告警颜色（用于Slack）
   */
  private getAlertColor(level: string): string {
    switch (level) {
      case 'info': return '#36a64f';
      case 'warning': return '#ffcc00';
      case 'error': return '#ff9900';
      case 'critical': return '#ff0000';
      default: return '#666666';
    }
  }

  /**
   * 获取告警表情
   */
  private getAlertEmoji(level: string): string {
    switch (level) {
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'critical': return '🚨';
      default: return '📢';
    }
  }

  /**
   * 发送合约事件告警
   */
  async sendContractEventAlert(eventData: {
    eventName: string;
    transactionHash: string;
    blockNumber: number;
    logIndex: number;
    orderId?: string;
    amount?: string;
    payer?: string;
    // 调用方（contractListenerService）一直在传这三个字段，但类型里没有声明
    token?: string;
    treasury?: string;
    chainId?: string | number;
  }): Promise<void> {
    const alert: AlertMessage = {
      title: `合约事件: ${eventData.eventName}`,
      message: `交易哈希: ${eventData.transactionHash}\n` +
               `区块: ${eventData.blockNumber}, 日志索引: ${eventData.logIndex}\n` +
               `订单ID: ${eventData.orderId || 'N/A'}\n` +
               `金额: ${eventData.amount || 'N/A'}\n` +
               `支付者: ${eventData.payer || 'N/A'}`,
      level: 'info',
      metadata: eventData
    };

    await this.sendAlert(alert);
  }

  /**
   * 发送系统异常告警
   */
  async sendSystemErrorAlert(error: Error, context?: string): Promise<void> {
    const alert: AlertMessage = {
      title: '系统异常',
      message: `错误: ${error.message}\n` +
               `堆栈: ${error.stack}\n` +
               `上下文: ${context || '无'}`,
      level: 'error',
      metadata: { error: error.message, stack: error.stack, context }
    };

    await this.sendAlert(alert);
  }

  /**
   * 发送RPC连接异常告警
   */
  async sendRpcErrorAlert(error: Error, rpcUrl: string): Promise<void> {
    const alert: AlertMessage = {
      title: 'RPC连接异常',
      message: `RPC URL: ${rpcUrl}\n` +
               `错误: ${error.message}`,
      level: 'critical',
      metadata: { rpcUrl, error: error.message }
    };

    await this.sendAlert(alert);
  }

  /**
   * 发送合约状态变更告警
   */
  async sendContractStatusAlert(isPaused: boolean, transactionHash?: string): Promise<void> {
    const status = isPaused ? '已暂停' : '已恢复';
    const alert: AlertMessage = {
      title: `合约状态变更: ${status}`,
      message: `合约状态已变更为: ${status}\n` +
               (transactionHash ? `交易哈希: ${transactionHash}` : ''),
      level: isPaused ? 'warning' : 'info',
      metadata: { isPaused, transactionHash }
    };

    await this.sendAlert(alert);
  }
}