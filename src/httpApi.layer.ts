import { Layer, Logger, eventFilter } from '@yagura/yagura';

import { HttpRouter } from './routes';
import { HttpRequest } from './request';
import { FmwRouter } from './routers/fmw.router';

import * as colors from 'colors/safe';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HttpApiConfig {
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
    public static readonly DEFAULT_CONFIGS: HttpApiConfig = Object.freeze({ options: { debugTime: true }});

    private _router: HttpRouter;

    constructor(config?: HttpApiConfig) {
        super(config ?? HttpApiLayer.DEFAULT_CONFIGS);
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async onInitialize() {
        try {
            // TODO: decouple FmwRouter from here, set as default, but allow specifying a custom router
            this._router = new FmwRouter();
            this.declareRoutes(this._router);
        } catch (err) {
            throw err;
            // throw new YaguraError(`Failed to set up HTTP router:\n${err.message}`);
        }
        if (process.env.NODE_ENV !== 'production') {
            this.yagura.getService<Logger>('Logger').debug(`${colors.green("[HTTP]")} routes declared;\n${this._router.prettyPrint().dim}`);
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
        try {
            await this._router.handle(event);
        } catch (err) {
            this.yagura.getService<Logger>('Logger').error(colors.red("[HTTP]") + ` ${event.data.req.method} ${event.data.req.path} responded with an error:\n${(err as Error).stack.toString().dim}`);
            if(event.canSend) await event.sendError(err);
        }

        // Pass HTTP event further down if not handled
        return event.wasConsumed === true ? null : event;
    }
}
