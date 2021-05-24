import { HttpRequest } from '../request';
import { HttpRoute, HttpRouter, HttpMethod, HttpRouteCallback } from '../routes';

import * as path from 'path';
import * as FindMyWay from 'find-my-way';

class FmwRoute<V extends FindMyWay.HTTPVersion = FindMyWay.HTTPVersion.V1> extends HttpRoute {
    private readonly _fmw: FindMyWay.Instance<V>;

    constructor(fmw: FindMyWay.Instance<V>, name: string) {
        super(name);
        this._fmw = fmw;
    }

    public route(subpath: string): FmwRoute<V> {
        return new FmwRoute(this._fmw, path.join(this.path, subpath));
    }

    public method(method: HttpMethod, handler: HttpRouteCallback) {
        const m = method.toUpperCase() as FindMyWay.HTTPMethod;

        if(method === 'ALL') {
            this._fmw.all(this.path, handler as any as FindMyWay.Handler<V>);
        } else {
            this._fmw.off(m, this.path);
            this._fmw.on(m, this.path, handler as any as FindMyWay.Handler<V>);
        }
    }
}

export class FmwRouter<V extends FindMyWay.HTTPVersion = FindMyWay.HTTPVersion.V1> extends HttpRouter {
    private _fmw: FindMyWay.Instance<V>;

    constructor() {
        super();
        this._fmw = FindMyWay();
    }

    public route(routePath: string): HttpRoute {
        return new FmwRoute(this._fmw, routePath);
    }

    public async handle(event: HttpRequest): Promise<boolean> {
        const method = event.data.req.method;
        const routePath = event.data.req.path;   // TODO: sanitize path

        const routeResult = this._fmw.find(method as FindMyWay.HTTPMethod, routePath);
        if (!!routeResult && !!routeResult.handler) {
            const handler: HttpRouteCallback = routeResult.handler as any as HttpRouteCallback;     // dangerous!
            event.data.req.params = routeResult.params;

            await handler(event);

            return true;
        } else {
            return false;
        }
    }

    public prettyPrint(): string {
        // TODO: the type definition of prettyPrint does not allow opts, contact find-my-way devs
        return (this._fmw as any).prettyPrint({ commonPrefix: false });
    }
}
