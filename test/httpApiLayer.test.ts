/* eslint-disable @typescript-eslint/no-unused-expressions */
import { Yagura } from '@yagura/yagura';
import { HttpApiLayer, HttpRouter, HttpServerConfig, HttpServerService, HttpRequest } from '../src';
import { Response } from 'superagent';

import 'mocha';
// import * as sinon from 'sinon';
const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;

// import 'clarify';

describe('HttpApiLayer', () => {
    const config: HttpServerConfig = {
        port: 30000,
        timeout: 10000,
        defaultError: 500
    };

    class ExampleApiLayer extends HttpApiLayer {
        constructor() {
            super();
        }

        public async initialize() { /* */ };

        public declareRoutes(router: HttpRouter) {
            router.route('/my-route').get(async (event: HttpRequest) => {
                await event.send(200);
            })
        }
    }

    class LongApiLayer extends HttpApiLayer {
        constructor() {
            super();
        }

        public async initialize() { /* */ };

        public declareRoutes(router: HttpRouter) {
            router.route('/my-route2/is/long').get(async (event: HttpRequest) => {
                await event.send(200);
            })
        }
    }

    class MultipleApiLayer extends HttpApiLayer {
        constructor() {
            super();
        }

        public async initialize() { /* */ };

        public declareRoutes(router: HttpRouter) {
            router.route('/routeA').get(async (event: HttpRequest) => {
                await event.send(200, {data: 'a'});
            });

            router.route('/routeB').get(async (event: HttpRequest) => {
                await event.send(200, {data: 'b'});
            });

            router.route('/routeC').get(async (event: HttpRequest) => {
                await event.send(200, {data: 'c'});
            });
        }
    }

    class OverridingApiLayer extends HttpApiLayer {
        constructor() {
            super();
        }

        public async initialize() { /* */ };

        public declareRoutes(router: HttpRouter) {
            router.route('/routeB').get(async (event: HttpRequest) => {
                await event.send(200, {data: 'BBB'});
            });
        }
    }

    class ErrorApiLayer extends HttpApiLayer {
        constructor() {
            super();
        }

        public async initialize() { /* */ };

        public declareRoutes(router: HttpRouter) {
            router.route('/my-route').get(() => {
                throw new Error("This is a test");
            })
        }
    }

    before(() => {
        chai.use(chaiHttp);
    });

    let app: Yagura;

    it("should respond to requests on the indicated route", async () => {
        app = await Yagura.start([ new ExampleApiLayer() ], [ new HttpServerService(config) ]);

        const server = (app.getService<HttpServerService>('HttpServer') as any)._express;
        const res = await chai.request(server)
            .get('/my-route');

        expect(res).to.have.status(200);
    });

    it("should respond with 404 when there's no route", async () => {
        app = await Yagura.start([ new ExampleApiLayer() ], [ new HttpServerService(config) ]);

        const server = (app.getService<HttpServerService>('HttpServer') as any)._express;
        const res = await chai.request(server)
            .get('/inexistent');

        expect(res).to.have.status(404);
    });

    it("should respond with 500 when an error occurs", async () => {
        app = await Yagura.start([ new ErrorApiLayer() ], [ new HttpServerService(config) ]);

        const server = (app.getService<HttpServerService>('HttpServer') as any)._express;
        const res = await chai.request(server)
            .get('/my-route');

        expect(res).to.have.status(500);
    });

    // routing
    it("should follow a complex path with more than one subpath", async () => {
        app = await Yagura.start([ new LongApiLayer() ], [ new HttpServerService(config) ]);

        const server = (app.getService<HttpServerService>('HttpServer') as any)._express;
        const res = await chai.request(server)
            .get('/my-route2/is/long');

        expect(res).to.have.status(200);
    });

    it("should handle multiple routes per router", async () => {
        app = await Yagura.start([ new MultipleApiLayer() ], [ new HttpServerService(config) ]);

        const server = (app.getService<HttpServerService>('HttpServer') as any)._express;
        const resA = await chai.request(server)
            .get('/routeA');

        const resB = await chai.request(server)
            .get('/routeB');

        const resC = await chai.request(server)
            .get('/routeC');

        expect(resA).to.have.status(200);
        expect(resB).to.have.status(200);
        expect(resC).to.have.status(200);
    });

    it("should handle multiple layers with the correct priority", async () => {
        app = await Yagura.start([ new OverridingApiLayer(), new MultipleApiLayer() ], [ new HttpServerService(config) ]);

        const server = (app.getService<HttpServerService>('HttpServer') as any)._express;
        const resA: Response = await chai.request(server)
            .get('/routeA');

        const resB = await chai.request(server)
            .get('/routeB');

        const resC = await chai.request(server)
            .get('/routeC');

        expect(resA.body.data).to.be.eq('a');
        expect(resB.body.data).to.be.eq('BBB');
        expect(resC.body.data).to.be.eq('c');
    });

    // methods
    it("should respond to all methods when declared");

    it("should respond to custom methods when declared");

    // TODO: find-my-way doesn't support this as of now (https://github.com/delvedor/find-my-way/issues/75)
    // it("should respond with 405 when method missing", async () => {
    //     app = await Yagura.start([ new ErrorApiLayer() ], [ new HttpServerService(config) ]);

    //     const server = (app.getService<HttpServerService>('HttpServer') as any)._express;
    //     const res = await chai.request(server)
    //         .delete('/my-route');

    //     expect(res).to.have.status(405);
    // });

    // CrudAdapter
    it("should mount as route");

    it("should respond to GET method for one item");

    it("should respond to GET method for many items with a query");

    it("should respond to POST method");

    it("should respond to PUT method");

    it("should respond to DELETE method");

    afterEach(async () => {
        await app.getService<HttpServerService>('HttpServer').stop();
    })
});