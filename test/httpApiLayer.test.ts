/* eslint-disable @typescript-eslint/no-unused-expressions */
import { Yagura } from '@yagura/yagura';
import { HttpApiLayer, HttpRouter, HttpServerConfig, HttpServerService, HttpRequest, CrudAdapter, CrudResponse } from '../src';

import 'mocha';
// import * as sinon from 'sinon';
import * as chai from 'chai';
import chaiHttp = require('chai-http');
const expect = chai.expect;

// import 'clarify';

describe('HttpApiLayer', () => {
    const config: HttpServerConfig = {
        port: 30000,
        timeout: 1000,
        defaultError: 500
    };

    class ExampleApiLayer extends HttpApiLayer {
        public declareRoutes(router: HttpRouter) {
            router.route('/my-route').get(async (event: HttpRequest) => {
                await event.send(200);
            })
        }
    }

    class AllApiLayer extends HttpApiLayer {
        public declareRoutes(router: HttpRouter) {
            router.route('/my-route').all(async (event: HttpRequest) => {
                await event.send(200);
            })
        }
    }

    class LongApiLayer extends HttpApiLayer {
        public declareRoutes(router: HttpRouter) {
            router.route('/my-route2/is/long').get(async (event: HttpRequest) => {
                await event.send(200);
            })
        }
    }

    class MultipleApiLayer extends HttpApiLayer {
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
        public declareRoutes(router: HttpRouter) {
            router.route('/routeB').get(async (event: HttpRequest) => {
                await event.send(200, {data: 'BBB'});
            });
        }
    }

    class ErrorApiLayer extends HttpApiLayer {
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
        const resA = await chai.request(server)
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
    it("should respond to all methods when declared", async () => {
        app = await Yagura.start([ new AllApiLayer() ], [ new HttpServerService(config) ]);
        const server = (app.getService<HttpServerService>('HttpServer') as any)._express;

        const resGet = await chai.request(server)
            .get('/my-route');
        const resPut = await chai.request(server)
            .get('/my-route');
        const resPost = await chai.request(server)
            .get('/my-route');
        const resDelete = await chai.request(server)
            .get('/my-route');

        expect(resGet).to.have.status(200);
        expect(resPut).to.have.status(200);
        expect(resPost).to.have.status(200);
        expect(resDelete).to.have.status(200);
    });

    // TODO: find-my-way doesn't support this as of now (https://github.com/delvedor/find-my-way/issues/75)
    // it("should respond with 405 when method missing", async () => {
    //     app = await Yagura.start([ new ErrorApiLayer() ], [ new HttpServerService(config) ]);

    //     const server = (app.getService<HttpServerService>('HttpServer') as any)._express;
    //     const res = await chai.request(server)
    //         .delete('/my-route');

    //     expect(res).to.have.status(405);
    // });

    // CrudAdapter
    describe('CrudAdapter', () => {
        class DataAdapter implements CrudAdapter<number> {
            private data: number[] = [0, 1, 2, 3, 4];

            public getMany(query: any): Promise<CrudResponse<number[]>> {
                const result: number[] = this.data.slice();
                let res: CrudResponse<number[]>;

                if(query.even === 'true' || query.odd === 'false') {
                    res = { code: 200, data: result.filter((v) => v % 2 === 0) };
                } else if(query.even === 'false' || query.odd === 'true') {
                    res = { code: 200, data: result.filter((v) => v % 2 === 1) };
                } else {
                    res = { code: 200, data: result };
                }

                return Promise.resolve(res);
            }
            public getOne(id: any): Promise<CrudResponse<number>> {
                id = Number.parseInt(id, 10);
                let res;
                const result: number = this.data[id];
                if(result === undefined) {
                    res = { code: 404, data: undefined };
                } else {
                    res = { code: 200, data: result.toString(10) };
                }

                return Promise.resolve(res);
            }
            public create(input: Partial<number>): Promise<CrudResponse<number>> {
                const id = this.data.push(input) - 1;
                const res: CrudResponse<number> = { code: 201, data: input };

                return Promise.resolve(res);
            }
            public update(id: any, input: Partial<number>): Promise<CrudResponse<number>> {
                id = Number.parseInt(id, 10);
                let res;
                if(this.data[id] !== undefined) {
                    this.data[id] = input;
                    res = { code: 200, data: input.toString(10) }
                } else {
                    res = { code: 404, data: undefined };
                }

                return Promise.resolve(res);
            }
            public delete(id: any): Promise<CrudResponse<number | void>> {
                id = Number.parseInt(id, 10);
                let res;
                if(this.data[id] !== undefined) {
                    res = { code: 200 }
                } else {
                    res = { code: 404 };
                }

                return Promise.resolve(res);
            }
        }

        class CrudResourceLayer extends HttpApiLayer {
            public declareRoutes(router: HttpRouter) {
                router.route('/data').model(new DataAdapter());
            }
        }

        it("should mount as route", async () => {
            app = await Yagura.start([ new CrudResourceLayer() ], [ new HttpServerService(config) ]);
            const server = (app.getService<HttpServerService>('HttpServer') as any)._express;
            expect(app).to.be.instanceOf(Yagura);

            const res = await chai.request(server)
                .get('/');

            expect(res).to.have.status(404);
        });

        it("should respond to GET method for one item", async () => {
            app = await Yagura.start([ new CrudResourceLayer() ], [ new HttpServerService(config) ]);

            const server = (app.getService<HttpServerService>('HttpServer') as any)._express;
            const res = await chai.request(server)
                .get('/data/0');

            expect(res).to.have.status(200);
            expect(res.body).to.be.eq(0);
        });

        it("should respond to GET method for many items with a query", async () => {
            app = await Yagura.start([ new CrudResourceLayer() ], [ new HttpServerService(config) ]);

            const server = (app.getService<HttpServerService>('HttpServer') as any)._express;
            const res = await chai.request(server)
                .get('/data?even=true');

            expect(res).to.have.status(200);
            expect(res.body).to.be.eql([0, 2, 4]);
        });

        it("should respond to POST method", async () => {
            app = await Yagura.start([ new CrudResourceLayer() ], [ new HttpServerService(config) ]);

            const server = (app.getService<HttpServerService>('HttpServer') as any)._express;
            const res = await chai.request(server)
                .post('/data')
                .send('25');

            expect(res).to.have.status(201);
            expect(res.body).to.be.eq(25);
        });

        it("should respond to PUT method", async () => {
            app = await Yagura.start([ new CrudResourceLayer() ], [ new HttpServerService(config) ]);

            const server = (app.getService<HttpServerService>('HttpServer') as any)._express;
            const res = await chai.request(server)
                .put('/data/0')
                .send('25');

    it("should respond to GET method for one item");

    it("should respond to GET method for many items with a query");

    it("should respond to POST method");

    it("should respond to PUT method");

    it("should respond to DELETE method");

    afterEach(async () => {
        await app.getService<HttpServerService>('HttpServer').stop();
    })
});