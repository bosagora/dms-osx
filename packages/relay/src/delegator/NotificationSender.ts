import { logger } from "../common/Logger";

/**
 * 모바일 푸쉬 알림을 발송하는 델리게이트의 인터패이스입니다.
 */
export interface INotificationSender {
    send(title: string, body: string): Promise<boolean>;
}

export interface INotificationEventHandler {
    receive(title: string, body: string): void;
}

/**
 * 모바일 푸쉬 알림을 발송하는 클래스입니다.
 */
export class NotificationSender implements INotificationSender {
    private readonly handler: INotificationEventHandler | undefined;

    constructor(handler?: INotificationEventHandler) {
        this.handler = handler;
    }

    public async send(title: string, body: string): Promise<boolean> {
        if (this.handler !== undefined) {
            this.handler.receive(title, body);
        }
        return true;
    }
}

/**
 * 모바일 푸쉬 알림을 발송하는 클래스입니다.
 */
export class NotificationNoSender implements INotificationSender {
    public async send(title: string, body: string): Promise<boolean> {
        logger.info(`Notification - ${title} - ${body}`);
        return true;
    }
}
