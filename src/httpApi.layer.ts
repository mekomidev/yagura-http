import { Yagura, Layer, Logger, YaguraError, eventFilter } from '@yagura/yagura';

import { HttpError, HttpErrorType } from './errors/http.error';
import { HttpRequest, HttpRouter } from './http';

import { FmwRouter } from './routers/fmw.router';

export interface HttpApiConfig {
    options: {
        debugTime: boolean;
    };
}

/**
 * Abstract HTTP router definition.
 *
 * In a Yagura application with a HttpServerLayer mounted,
 * the HttpApiLayer (mounted afterwards) receives the HTTP requests
 * and routes them per user's definition.
 */
export abstract class HttpApiLayer extends Layer {
    public readonly config: HttpApiConfig;

    private _router: HttpRouter;

    constructor(name: string, config: HttpApiConfig) {
        super(name, config);

        try {
            // TODO: decouple FmwRouter from here, set as default, but allow specifying a custom router
            this._router = new FmwRouter();
            this.declareRoutes(this._router);

            if (process.env.NODE_ENV !== 'production') {
                (this.yagura.getService('Logger') as Logger).debug("[HTTP]".green.bold + ` routes declared;\n` + this._router.prettyPrint().dim);
            }
        } catch (err) {
            throw err;
            // throw new YaguraError(`Failed to set up HTTP router:\n${err.message}`);
        }
    }

    /**
     * Given a base router, declare all routes and their respective method handlers
     *
     * @param {HttpRoute} router base router to attach the routes and method callbacks to
     */
    public abstract declareRoutes(router: HttpRouter): void;

    @eventFilter([HttpRequest])
    public async handleEvent(event: HttpRequest): Promise<HttpRequest> {
        const startTime = Date.now();
        const handled: boolean = await this._router.handle(event);
        const endTime = Date.now();

        if (this.config.options.debugTime) {
            const time = endTime - startTime;
            (this.yagura.getService('Logger') as Logger).verbose("[HTTP]".green.bold + ` ${event.req.method.toUpperCase().bold} ${event.req.path} ` + `[${time}ms]`.dim);
        }

        // Pass HTTP event further down if not handled
        return handled ? null : event;
    }
}
