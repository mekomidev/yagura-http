import { Yagura, Overlay, Logger, YaguraError, eventFilter } from '@yagura/yagura';
import { HttpError, HttpErrorType } from './errors/http.error';
import { HttpRequest } from './http';

import { Express as ExpressApp } from 'express';
import * as express from 'express';
import { RequestHandler } from "express-serve-static-core";

import 'colors';

export interface HttpServerConfig {
    port: number;
    errorCodes?: [HttpErrorType];
    defaultError: string | number;
    expressSettings?: {[key: string]: any};
}

/**
 * Express.js-based HTTP server overlay.
 * Starts a HTTP server on the given port with the given configuration and middleware,
 * and dispatches [HttpRequest] events through Yagura, to be handled by [HttpApiOverlay] instances.
 */
export class HttpServerOverlay extends Overlay {
    public readonly config: HttpServerConfig;

    private logger: Logger;
    private _express: ExpressApp;
    private _expressMiddleware: [() => RequestHandler];

    /** Initializes the overlay
     *
     * @param {HttpOverlayConfig} config
     * @param {[() => RequestHandler]} middleware Ordered array of Express.js middleware factory functions to be mounted
     */
    constructor(config: HttpServerConfig, middleware?: [() => RequestHandler]) {
        super('HttpServer', config);
        this._expressMiddleware = middleware || [] as any;

        // Initialize all defined error types
        if (this.config.errorCodes && this.config.errorCodes.length > 0) {
            this.config.errorCodes.forEach((errorCode) => {
                HttpError.addType(errorCode);
            });
        }
    }

    /** Creates an Express app instance and starts a HTTP server */
    public async initialize() {
        this.logger = Yagura.getModule('Logger');

        if (this._express) {
            throw new Error('This strategy has already been started');
        }

        const port: number = parseInt(process.env.HTTP_PORT, 10) || this.config.port;

        // Initialize Express
        const app: ExpressApp = express();
        // Attach middleware
        require('express-async-errors');
        for (const m of this._expressMiddleware) {
            app.use(m());
        }
        // Apply settings
        for (const key in this.config.expressSettings) {
            if (this.config.expressSettings.hasProperty(key)) {
                app.set(key, this.config.expressSettings[key]);
            }
        }

        // Pass events to Yagura
        app.use((req, res) => {
            Yagura.dispatch(new HttpRequest({ req, res }));
        });

        // Set up error handling
        app.use(async (err: Error, req: express.Request, res: express.Response, next: () => void) => {
            this.logger.error('[HTTP] UNHANDLED ERROR caught');
            this.logger.error(err);

            if (!res.headersSent) {
                if (err instanceof HttpError) {
                    const apiError: HttpError = err as HttpError;
                    // apiError.sendResponse(res);
                } else {
                    res.sendStatus(500);
                }
            } else {
                this.logger.error('\nCould not notify client about internal error, headers already sent');
            }

            res.end();

            // Calls Overlay's error handler
            try {
                await Yagura.handleError(err);
            } catch {
                // ...but carefully, never trust devs, what if THAT crashes?
                this.logger.error(`Yo, seriously?`);
            }

            // TODO: verify if necessary
            next();
        });

        // Start server
        this._express = app;
        await new Promise((resolve, reject) => {
            this._express.listen(port, () => {
                this.logger.info(`Server listening on port`.green + ` ${port}`.bold);
                resolve();
            });
        });
    }

    @eventFilter([HttpRequest])
    /**
     * Handles [HttpRequest] instances that were not able to be routed
     * by responding with a configured [HttpError] code (defaults to [404]).
     */
    public async handleEvent(event: HttpRequest): Promise<YaguraEvent> {
        // Send the default error response
        (new HttpError(this.config.defaultError || 404)).sendResponse(event.res);

        // The HttpRequest will always be ansered to here and never forwarded further
        return null;
    }
}
