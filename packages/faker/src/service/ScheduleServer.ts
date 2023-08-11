import { Config } from "../common/Config";
import { Scheduler } from "../scheduler/Scheduler";

export class ScheduleServer {
    /**
     * The collection of schedulers
     * @protected
     */
    protected schedules: Scheduler[] = [];

    /**
     * The configuration of the database
     * @private
     */
    private readonly _config: Config;

    /**
     * Constructor
     * @param config Configuration
     * @param schedules Array of Scheduler
     */
    constructor(config: Config, schedules?: Scheduler[]) {
        this._config = config;

        if (schedules) {
            schedules.forEach((m) => this.schedules.push(m));
            this.schedules.forEach((m) =>
                m.setOption({
                    config: this._config,
                })
            );
        }
    }

    /**
     * 스케줄러들을 시작합니다.
     */
    public async start(): Promise<void> {
        this.schedules.forEach((m) => m.start());
    }

    /**
     * 스케줄러들을 종료합니다. 완전히 종료될 때까지 대기합니다.
     */
    public async stop(): Promise<void> {
        for (const m of this.schedules) await m.stop();
        for (const m of this.schedules) await m.waitForStop();
    }
}
