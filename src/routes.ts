import { HttpRequest } from './request';
import * as Express from 'express';

export class HttpRouteFormattingError extends Error {}

export type HttpRouteCallback = (event: HttpRequest) => Promise<void>;

export type HttpMethod = 'ALL' | 'HEAD' | 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';

export abstract class HttpRoute {
    /** Path relative to the route this route is mounted on */
    public readonly path: string;

    constructor(name: string) {
        this.path = name;
    }

    public abstract route(subpath: string): HttpRoute;

    /*
     *  REST/CRUD request handlers
     */

    /** Assigns a callback to a specified HTTP method on this route */
    public abstract method(method: HttpMethod, handler: HttpRouteCallback): void;
    /** Attaches a callback to all HTTP methods on this route */
    public all(cb: HttpRouteCallback) { this.method('ALL', cb); }
    /** Attaches a callback to the HTTP GET method on this route */
    public get(cb: HttpRouteCallback) { this.method('GET', cb); }
    /** Attaches a callback to the HTTP PUT method on this route */
    public put(cb: HttpRouteCallback) { this.method('PUT', cb); }
    /** Attaches a callback to the HTTP POST method on this route */
    public post(cb: HttpRouteCallback) { this.method('POST', cb); }
    /** Attaches a callback to the HTTP DELETE method on this route */
    public delete(cb: HttpRouteCallback) { this.method('DELETE', cb); }

    /**
     * Mounts a model with CrudAdapter on current route and attaches CRUD handlers to HTTP methods and relevant subroutes.
     * All error handling should be taken care of according to HTTP REST API standards.
     *
     * Example:
     * GET .../        => model.getAll(query);
     * GET .../id      => model.get(id);
     * POST .../       => model.create(data);
     * PUT .../id      => model.update(id, data);
     * DELETE .../id   => model.delete(id);
     *
     * @param {CrudAdapter} model a CRUD model adapter to mount as a resource
     *
     * @returns itself, for chaining
     * @experimental
     */
    public model<D, I, Q>(model: CrudAdapter<D, I, Q>): HttpRoute {
        // GET many
        this.get(async (event: HttpRequest) => {
            const res = await model.getMany(event.data.req.query as unknown as Q);
            const hasRes: boolean = typeof res !== 'undefined' && res.length > 0;
            await event.send(hasRes ? 200 : 404, hasRes ? res : null);
        });

        // GET one
        this.route('/:id').get(async (event: HttpRequest) => {
            const res = await model.getOne(event.data.req.params.id as unknown as I);
            const hasRes: boolean = typeof res !== 'undefined';
            await event.send(hasRes ? 200 : 404, hasRes ? res : null);
        });

        // POST (create)
        this.post(async (event) => {
            await new Promise(resolve => Express.raw()(event.data.req, event.data.res, resolve));
            // TODO: implement validation
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const res = await model.create(event.data.req.body);
            await event.send(201, res);
        });

        // PUT (update)
        this.route('/:id').put(async (event) => {
            await new Promise(resolve => Express.raw()(event.data.req, event.data.res, resolve));
            // TODO: implement validation
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const res = await model.update(event.data.req.params.id as unknown as I, event.data.req.body);
            await event.send(200, res);
        });

        // DELETE one
        this.route('/:id').delete(async (event) => {
            const res = await model.delete(event.data.req.params.id as unknown as I);
            const hasRes: boolean = typeof res !== 'undefined';
            await event.send(hasRes ? 200 : 204, hasRes ? res : null);
        });

        return this;
    }
}

export abstract class HttpRouter {
    /**
     * Creates a subroute according to the provided path, and returns its last node
     *
     * @param {string} path subroute path
     *
     * @returns {HttpRoute} last node of the created subroute, corresponding to the given path
     */
    public abstract route(routePath: string): HttpRoute;

    /**
     * Given a HTTP request, it calls the relevant callbacks.
     *
     * @param {HttpRequest} event HTTP request to handle
     *
     * @returns {boolean} whether an appropriate route was found in the tree
     */
    public abstract handle(event: HttpRequest): Promise<boolean>;

    public abstract prettyPrint(): string;
}

// export class ParamRoute extends HttpRoute {

// }

/**
 * Boilerplate interface for writing CRUD-structured resource request callbacks
 */
export interface CrudAdapter<D, I, Q> {
    getMany(query: Q): Promise<D[]>;
    getOne(id: I): Promise<D>;
    create(data: Partial<D>): Promise<D>;
    update(id: I, data: Partial<D>): Promise<D>;
    delete(id: I): Promise<D | void>;
}
