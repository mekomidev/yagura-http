import { Service, Logger, promiseTimeout } from '@yagura/yagura';
import { HttpError, HttpErrorType } from './errors/http.error';
import { HttpRequest } from './request';

import { Express as ExpressApp } from 'express';
import * as express from 'express';

import * as colors from 'colors/safe';
import { Server } from 'node:http';

export interface HttpServerConfig {
    port: number;
    timeout: number;
    errorCodes?: [HttpErrorType];
    defaultError: string | number;
    expressSettings?: {[key: string]: any};
}

/**
 * Express.js-based HTTP server Layer.
 * Starts a HTTP server on the given port with the given configuration and middleware,
 * and dispatches [HttpRequest] events through Yagura, to be handled by [HttpApiLayer] instances.
 */
export class HttpServerService extends Service {
    public readonly config: HttpServerConfig;

    private logger: Logger;
    private _express: ExpressApp;
    private _server: Server;

    /** Initializes the Layer
     *
     * @param {HttpLayerConfig} config
     * @param {[() => RequestHandler]} middleware Ordered array of Express.js middleware factory functions to be mounted
     */
    constructor(config: HttpServerConfig) {
        super('HttpServer', 'yagura');
        this.config = config;

        // Initialize all defined error types
        if (this.config.errorCodes && this.config.errorCodes.length > 0) {
            this.config.errorCodes.forEach((errorCode) => {
                HttpError.addType(errorCode);
            });
        }
    }

    /** Creates an Express app instance and starts a HTTP server */
    public async initialize() {
        this.logger = this.yagura.getService('Logger');

        if (this._express) {
            throw new Error('This strategy has already been started');
        }

        const port: number = parseInt(process.env.HTTP_PORT, 10) || this.config.port;

        // Initialize Express
        const app: ExpressApp = express();
        // Attach middleware
        require('express-async-errors');

        // Apply settings
        for (const key in this.config.expressSettings) {
            if (this.config.expressSettings.hasProperty(key)) {
                app.set(key, this.config.expressSettings[key]);
            }
        }

        // Pass events to Yagura
        app.use(async (req, res) => {
            return promiseTimeout(this.config.timeout, this.yagura.dispatch(new HttpRequest({ req, res })));
        });

        // Set up error handling
        app.use(async (err: Error, req: express.Request, res: express.Response) => {
            this.logger.error(`[HTTP] ERROR UNHANDLED BY YAGURA`);

            if (!res.headersSent) {
                if (err instanceof HttpError) {
                    const apiError: HttpError = err;
                    apiError.sendResponse(res);
                } else {
                    res.sendStatus(500);
                }
            } else {
                this.logger.error('[HTTP] Could not notify client about internal error, headers already sent, ending request...');
            }


            this.logger.error(`${colors.red("[HTTP]")} ${colors.bold(req.method)} ${res.statusCode.toString().dim} ${req.path}`);
            this.logger.error(err);

            // Send
            await new Promise((resolve) => res.end(resolve));

            // Calls Yagura's error handler
            try {
                await this.yagura.handleError(err);
            } catch {
                // ...but carefully, never trust devs, what if THAT crashes?
                this.logger.error(`Yo, seriously?`);
            }
        });

        // Start server
        this._express = app;
        await new Promise((resolve) => {
            this._server = this._express.listen(port, () => {
                this.logger.info(colors.bold(`[HTTP] Server listening on port`.green + ` ${port}`));
                resolve(true);
            });
        });
    }

    public async stop(): Promise<void> {
        return new Promise((resolve, reject) => this._server.close((err) => { if(err) reject(err); else resolve(); }));
    }
}
