export class Event {
    public static PROPOSED: string = "proposed";
    public static PROOFED: string = "proofed";
    public static PROOFED_BLOCK: string = "proofed_block";
    public static APPROVED: string = "approved";
    public static FINALIZED: string = "finalized";
    public static EXECUTED: string = "executed";
    public static CANCELED: string = "canceled";
}

export interface IEvent {
    type: string;
    args?: any;
}

export type TListener = (type: string, args?: any) => Promise<void>;

export class EventDispatcher {
    private listeners: Map<string, TListener[]> = new Map();

    private events: IEvent[] = [];

    public async dispatchEvent(type: string, args?: any) {
        this.events.push({ type, args });
    }

    public addEventListener(type: string, listener: TListener, thisArg?: any): void {
        const listeners = this.listeners.get(type);
        if (thisArg) listener = listener.bind(thisArg);
        if (listeners === undefined) {
            this.listeners.set(type, [listener]);
            return;
        }
        if (listeners.find((m) => m === listener) === undefined) {
            listeners.push(listener);
        }
    }

    public removeEventListener(type: string, listener: TListener, thisArg?: any): void {
        const listeners = this.listeners.get(type);
        if (listeners !== undefined) {
            if (thisArg) listener = listener.bind(thisArg);
            const findIdx = listeners.findIndex((m) => m === listener);
            if (findIdx !== -1) {
                listeners.splice(findIdx, 1);
            }
            if (listeners.length === 0) this.listeners.delete(type);
        }
    }

    public hasEventListener(type: string): boolean {
        const listeners = this.listeners.get(type);
        if (listeners === undefined) return false;
        return listeners.length > 0;
    }

    public async dispatcher() {
        let event = this.events.shift();
        while (event !== undefined) {
            const listeners = this.listeners.get(event.type);
            if (listeners !== undefined) {
                for (const m of listeners) {
                    try {
                        await m(event.type, event.args);
                    } catch (e) {
                        //
                    }
                }
            }
            event = this.events.shift();
        }
    }
}
