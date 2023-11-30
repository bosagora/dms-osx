import { logger } from "../common/Logger";

import { Expo, ExpoPushErrorReceipt, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { Config } from "../common/Config";
import { boolean } from "hardhat/internal/core/params/argumentTypes";

/**
 * 모바일 푸쉬 알림을 발송하는 델리게이트의 인터패이스입니다.
 */
export interface INotificationSender {
    send(to: string, title: string, body: string, data: any): Promise<boolean>;
}

export interface INotificationEventHandler {
    receive(to: string, title: string, body: string, data: any): void;
}

/**
 * 모바일 푸쉬 알림을 발송하는 클래스입니다.
 */
export class NotificationSender implements INotificationSender {
    private readonly config: Config;
    private readonly handler: INotificationEventHandler | undefined;

    constructor(config: Config, handler?: INotificationEventHandler) {
        this.config = config;
        this.handler = handler;
    }

    public async send(to: string, title: string, body: string, data: any): Promise<boolean> {
        if (this.handler !== undefined) {
            this.handler.receive(to, title, body, data);
        }
        if (!Expo.isExpoPushToken(to)) {
            if (!process.env.TESTING) logger.error(`Push token ${to} is not a valid Expo push token`);
            return false;
        }
        const messages: ExpoPushMessage[] = [];
        messages.push({
            to,
            title,
            sound: "default",
            body,
            data,
        });
        const expo = new Expo({ accessToken: this.config.relay.expoAccessToken });
        const chunks = expo.chunkPushNotifications(messages);
        const tickets = [];
        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                logger.error(error);
            }
        }

        let success: boolean = true;
        for (const ticket of tickets) {
            if (ticket.status === "error") {
                logger.error(ticket.message);
                success = false;
            }
        }
        return success;
    }
}

/**
 * 모바일 푸쉬 알림을 발송하는 클래스입니다.
 */
export class NotificationNoSender implements INotificationSender {
    public async send(to: string, title: string, body: string, data: any): Promise<boolean> {
        logger.info(`Notification - ${title} - ${body}`);
        return true;
    }
}
