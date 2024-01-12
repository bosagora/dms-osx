import MybatisMapper, { Params } from "mybatis-mapper";
import pg, { QueryResult, QueryResultRow } from "pg";
import { createdb } from "pgtools";
import { IDatabaseConfig } from "../common/Config";
import { logger } from "../common/Logger";

export class Storage {
    protected _pool: pg.Pool | undefined;
    protected config: IDatabaseConfig;

    constructor(config: IDatabaseConfig) {
        this.config = config;
    }

    public async initialize() {
        if (this.config.database !== "postgres") {
            try {
                await createdb(
                    {
                        user: this.config.user,
                        password: this.config.password,
                        host: this.config.host,
                        port: this.config.port,
                    },
                    this.config.database
                );
                // tslint:disable-next-line:no-empty
            } catch (e) {}
        }

        this._pool = new pg.Pool({
            user: this.config.user,
            password: this.config.password,
            host: this.config.host,
            port: this.config.port,
            database: this.config.database,
            max: this.config.max,
            connectionTimeoutMillis: this.config.connectionTimeoutMillis,
        });
    }

    public get pool(): pg.Pool {
        if (this._pool !== undefined) return this._pool;
        logger.error("Storage is not ready yet.");
        process.exit(1);
    }

    public createTables(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            resolve();
        });
    }

    public close(): Promise<void> {
        return this.pool.end();
    }

    public queryForMapper<R extends QueryResultRow = any, I extends any[] = any[]>(
        namespace: string,
        sql_id: string,
        param?: Params
    ): Promise<QueryResult<R>> {
        return new Promise<QueryResult<R>>(async (resolve, reject) => {
            try {
                const sql = MybatisMapper.getStatement(namespace, sql_id, param, { language: "sql", indent: "  " });
                const res = await this.pool.query(sql);
                resolve(res);
            } catch (err) {
                return reject(err);
            }
        });
    }

    protected exec(sql: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                await this.pool.query(sql);
                resolve();
            } catch (err) {
                return reject(err);
            }
        });
    }
}
