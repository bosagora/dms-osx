import * as winston from "winston";

const { combine, timestamp, printf, colorize } = winston.format;
// tslint:disable-next-line:no-shadowed-variable
const customFormat = printf(({ level, timestamp, message }) => {
    return `${level.toUpperCase()} [${timestamp}] ${message}`;
});

export class Logger {
    public static defaultConsoleTransport() {
        // console log mode options
        const options = {
            handleExceptions: true,
            json: false,
            format: combine(
                timestamp({
                    format: "YYYY-MM-DD HH:mm:ss",
                }),
                customFormat
            ),
        };

        return new winston.transports.Console(options);
    }

    public static create(): winston.Logger {
        return winston.createLogger({
            level: "verbose",
            transports: [Logger.defaultConsoleTransport()],
        });
    }
}

export const logger: winston.Logger = Logger.create();
