/* eslint-disable @typescript-eslint/no-unused-expressions */
import { Yagura } from '@yagura/yagura';
import { HttpApiLayer, HttpRouter, HttpServerConfig, HttpServerService, HttpRequest } from '../src';

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
            router.route('/').get(async (event: HttpRequest) => {
                await event.send(200);
            })
        }
    }

    class ErrorApiLayer extends HttpApiLayer {
        constructor() {
            super();
        }

        public async initialize() { /* */ };

        public declareRoutes(router: HttpRouter) {
            router.route('/').get(() => {
                throw new Error("This is a test");
            })
        }
    }

    before(() => {
        chai.use(chaiHttp);
    });

    let app: Yagura;

    it("should respond to requests on the indicate route", async () => {
        app = await Yagura.start([ new ExampleApiLayer() ], [ new HttpServerService(config) ]);

        const server = (app.getService<HttpServerService>('HttpServer') as any)._express;
        const res = await chai.request(server)
            .get('/');

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
            .get('/');

        expect(res).to.have.status(500);
    });

    afterEach(async () => {
        await app.getService<HttpServerService>('HttpServer').stop();
    })
});