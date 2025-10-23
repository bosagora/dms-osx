import express from "express";
import fs from "fs";
import http from "http";
import https from "https";
import { IServerConfig } from "../common/Config";

export class WebService {
    /**
     * The application of express module
     */
    public app: express.Application;
    /**
     * The HTTPS server
     */
    public httpsServer: https.Server | null = null;
    /**
     * The HTTP server
     */
    public httpServer: http.Server | null = null;
    /**
     * Server configuration
     */
    private readonly serverConfig: IServerConfig;

    /**
     * Constructor
     * @param config Server configuration
     */
    constructor(config: IServerConfig) {
        this.serverConfig = config;
        this.app = express();
    }

    /**
     * Asynchronously start the web server(s)
     */
    public start(): Promise<void> {
        // Listen on provided ports on address.
        return new Promise<void>((resolve, reject) => {
            const promises: Promise<void>[] = [];

            // Check if at least one server is enabled
            if (!this.serverConfig.http.enable && !this.serverConfig.https.enable) {
                reject(new Error("At least one of HTTP or HTTPS server must be enabled"));
                return;
            }

            // Start HTTPS server if enabled
            if (this.serverConfig.https.enable) {
                if (!this.serverConfig.https.cert || !this.serverConfig.https.key) {
                    reject(new Error("HTTPS is enabled but certificate or key path is not configured"));
                    return;
                }

                if (!fs.existsSync(this.serverConfig.https.cert)) {
                    reject(new Error(`SSL certificate file not found: ${this.serverConfig.https.cert}`));
                    return;
                }

                if (!fs.existsSync(this.serverConfig.https.key)) {
                    reject(new Error(`SSL key file not found: ${this.serverConfig.https.key}`));
                    return;
                }

                const options = {
                    cert: fs.readFileSync(this.serverConfig.https.cert),
                    key: fs.readFileSync(this.serverConfig.https.key),
                };

                this.httpsServer = https.createServer(options, this.app);

                // Start HTTPS server
                const httpsPromise = new Promise<void>((res, rej) => {
                    this.httpsServer!.on("error", rej);
                    this.httpsServer!.listen(this.serverConfig.https.port, this.serverConfig.address, () => {
                        console.log(`HTTPS server listening on ${this.serverConfig.address}:${this.serverConfig.https.port}`);
                        res();
                    });
                });
                promises.push(httpsPromise);
            }

            // Start HTTP server if enabled
            if (this.serverConfig.http.enable) {
                this.httpServer = http.createServer(this.app);

                const httpPromise = new Promise<void>((res, rej) => {
                    this.httpServer!.listen(this.serverConfig.http.port, this.serverConfig.address, () => {
                        const message = this.serverConfig.https.enable
                            ? `HTTP server listening on ${this.serverConfig.address}:${this.serverConfig.http.port} (internal use)`
                            : `HTTP server listening on ${this.serverConfig.address}:${this.serverConfig.http.port}`;
                        console.log(message);
                        res();
                    }).on("error", (err: any) => {
                        if (this.serverConfig.https.enable) {
                            // When HTTPS is also enabled, HTTP errors are non-fatal
                            if (err.code === "EADDRINUSE") {
                                console.warn(`HTTP port ${this.serverConfig.http.port} is already in use. Skipping HTTP server.`);
                            } else if (err.code === "EACCES") {
                                console.warn(`HTTP port ${this.serverConfig.http.port} requires elevated privileges. Skipping HTTP server.`);
                            } else {
                                console.warn(`Failed to start HTTP server: ${err.message}`);
                            }
                            res();
                        } else {
                            // When HTTP is the only server, errors are fatal
                            rej(err);
                        }
                    });
                });
                promises.push(httpPromise);
            }

            Promise.all(promises)
                .then(() => resolve())
                .catch((err) => reject(err));
        });
    }

    public stop(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const promises: Promise<void>[] = [];

            if (this.httpsServer) {
                promises.push(
                    new Promise<void>((res, rej) => {
                        this.httpsServer!.close((err) => {
                            if (err) rej(err);
                            else res();
                        });
                    })
                );
            }

            if (this.httpServer) {
                promises.push(
                    new Promise<void>((res, rej) => {
                        this.httpServer!.close((err) => {
                            if (err) rej(err);
                            else res();
                        });
                    })
                );
            }

            Promise.all(promises)
                .then(() => resolve())
                .catch((err) => reject(err));
        });
    }
}
