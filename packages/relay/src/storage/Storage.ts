import MybatisMapper, { Params } from "mybatis-mapper";
import pg, { QueryResult, QueryResultRow } from "pg";
import { IDatabaseConfig } from "../common/Config";

export class Storage {
    protected pool: pg.Pool;

    constructor(databaseConfig: IDatabaseConfig, callback: (err: Error | null) => void) {
        this.pool = new pg.Pool({
            user: databaseConfig.user,
            password: databaseConfig.password,
            host: databaseConfig.host,
            port: databaseConfig.port,
            database: databaseConfig.database,
            max: databaseConfig.max,
            connectionTimeoutMillis: databaseConfig.connectionTimeoutMillis,
        });
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
                // console.log(sql);
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
