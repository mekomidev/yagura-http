import { HttpRequest } from '../request';
import { HttpRoute, HttpRouter, HttpMethod, HttpRouteCallback, HttpRouteHandler } from '../routes';

import * as path from 'path';
import * as FindMyWay from 'find-my-way';
import { HttpError } from '../errors/http.error';

class FmwRoute<V extends FindMyWay.HTTPVersion = FindMyWay.HTTPVersion.V1> extends HttpRoute {
    private readonly _router: HttpRouter;

    constructor(router: HttpRouter, name: string) {
        super(name);
        this._router = router;
    }

    public route(subpath: string): FmwRoute<V> {
        return new FmwRoute(this._router, path.join(this.path, subpath));
    }

    public method(method: HttpMethod, handler: HttpRouteCallback) {
        this._router.declareHandler(this.path, method, handler);
    }
}

export class FmwRouter<V extends FindMyWay.HTTPVersion = FindMyWay.HTTPVersion.V1> extends HttpRouter {
    private _fmw: FindMyWay.Instance<V>;
    private _routes: HttpRouteHandler[] = [];

    constructor() {
        super();
        this._fmw = FindMyWay({
            ignoreTrailingSlash: true,
            maxParamLength: 2048,
        });
    }

    public route(routePath: string): HttpRoute {
        return new FmwRoute(this, routePath);
    }

    public async handle(event: HttpRequest): Promise<boolean> {
        const method = event.data.req.method as FindMyWay.HTTPMethod;
        const routePath = event.data.req.path;   // TODO: sanitize path

        const routeResult = this._fmw.find(FmwRouter._defaultMethod, routePath);
        if (!!routeResult && !!routeResult.handler) {
            const fmwHandler = routeResult.handler as () => number;
            const handlerBox = this._routes[ fmwHandler() ];
            const handler = handlerBox.ALL ?? handlerBox[method];

            if(!handler)
                throw new HttpError(405);

            event.data.req.params = routeResult.params;
            await handler(event);
            return true;
        } else {
            return false;
        }
    }

    private static readonly _defaultMethod: FindMyWay.HTTPMethod = 'GET';
    public declareHandler(url: string, method: HttpMethod, handler: HttpRouteCallback): void {
        const fmwRoute = this._fmw.find(FmwRouter._defaultMethod, url);
        let fmwHandler = fmwRoute?.handler as () => number

        if(!fmwHandler) {
            const n = this._routes.push({} as HttpRouteHandler) - 1;
            fmwHandler = () => n;
            this._fmw.on(FmwRouter._defaultMethod, url, fmwHandler);
        }

        const box: HttpRouteHandler = this._routes[ fmwHandler() ];
        box[method] = handler;
    }

    public prettyPrint(): string {
        // TODO: the type definition of prettyPrint does not allow opts, contact find-my-way devs
        return (this._fmw as any).prettyPrint({ commonPrefix: false });
    }
}
