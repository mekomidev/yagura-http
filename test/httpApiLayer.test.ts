/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/dot-notation */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-expressions */
import { Yagura } from '@yagura/yagura';
import { HttpApiLayer, HttpRouter, HttpServerConfig, HttpServerService, HttpRequest, CrudAdapter, HttpError } from '../src';

import 'mocha';
// import * as sinon from 'sinon';
import * as chai from 'chai';
import chaiHttp = require('chai-http');
import { ErrorResponseBodyType } from '../src/request';
const expect = chai.expect;

// import 'clarify';

describe('HttpApiLayer', () => {
    const config: HttpServerConfig = {
        port: 30000,
        timeout: 1000,
        debugTime: true,
        defaultError: 500,
        errorBodyContent: ErrorResponseBodyType.Type
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

    class HttpErrorApiLayer extends HttpApiLayer {
        public declareRoutes(router: HttpRouter) {
            router.route('/my-route').get(() => {
                throw new HttpError(400);
            })
        }
    }

    class HttpErrorBodyApiLayer extends HttpApiLayer {
        errorObject = new HttpError({
            code: 404,
            type: 'not_found',
            message: 'resource not found'
        });

        public declareRoutes(router: HttpRouter) {
            router.route('/error').get(() => {
                throw this.errorObject;
            })
        }
    }

    before(() => {
        chai.use(chaiHttp);
    });

    let app: Yagura;

    it("should respond to requests on the indicated route", async () => {
        app = await Yagura.start([ new ExampleApiLayer() ], [ new HttpServerService(config) ]);
        const server = app.getService<HttpServerService>('HttpServer')['_express'];

        const res = await chai.request(server)
            .get('/my-route');

        expect(res).to.have.status(200);
    });

    it("should respond with 404 when there's no route", async () => {
        app = await Yagura.start([ new ExampleApiLayer() ], [ new HttpServerService(config) ]);
        const server = app.getService<HttpServerService>('HttpServer')['_express'];

        const res = await chai.request(server)
            .get('/inexistent');

        expect(res).to.have.status(404);
    });

    it("should respond with 500 when an error occurs", async () => {
        app = await Yagura.start([ new ErrorApiLayer() ], [ new HttpServerService(config) ]);
        const server = app.getService<HttpServerService>('HttpServer')['_express'];

        const res = await chai.request(server)
            .get('/my-route');

        expect(res).to.have.status(500);
    });

    it('should respond with thrown HttpError', async () => {
        app = await Yagura.start([ new HttpErrorApiLayer() ], [ new HttpServerService(config) ]);
        const server = app.getService<HttpServerService>('HttpServer')['_express'];

        const res = await chai.request(server)
            .get('/my-route');

        expect(res).to.have.status(400);
    });

    // routing
    it("should follow a complex path with more than one subpath", async () => {
        app = await Yagura.start([ new LongApiLayer() ], [ new HttpServerService(config) ]);
        const server = app.getService<HttpServerService>('HttpServer')['_express'];

        const res = await chai.request(server)
            .get('/my-route2/is/long');

        expect(res).to.have.status(200);
    });

    it("should handle multiple routes per router", async () => {
        app = await Yagura.start([ new MultipleApiLayer() ], [ new HttpServerService(config) ]);
        const server = app.getService<HttpServerService>('HttpServer')['_express'];

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
        const server = app.getService<HttpServerService>('HttpServer')['_express'];

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
        const server = app.getService<HttpServerService>('HttpServer')['_express'];

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

    it("should respond with the error\'s object type when using the default configuration", async () => {
        const apiLayer = new HttpErrorBodyApiLayer();
        app = await Yagura.start([apiLayer], [new HttpServerService()]);
        const res = await chai.request((app.getService<HttpServerService>('HttpServer') as any)._express).get('/error');

        expect(res.text).to.be.eq(apiLayer.errorObject.type.type);
    });

    it("should respond with the error\'s object type as the response\'s body", async () => {
        const apiLayer = new HttpErrorBodyApiLayer();
        app = await Yagura.start([apiLayer], [new HttpServerService({ ...config, errorBodyContent: ErrorResponseBodyType.Object })]);
        const res = await chai.request((app.getService<HttpServerService>('HttpServer') as any)._express).get('/error');

        expect(res.text).to.be.eq(JSON.stringify(apiLayer.errorObject.type));
    });

    it("should respond with the error\'s message as the response\'s body", async () => {
        const apiLayer = new HttpErrorBodyApiLayer();
        app = await Yagura.start([apiLayer], [new HttpServerService({ ...config, errorBodyContent: ErrorResponseBodyType.Message })]);
        const res = await chai.request((app.getService<HttpServerService>('HttpServer') as any)._express).get('/error');

        expect(res.text).to.be.eq(apiLayer.errorObject.type.message);
    });

    it("should respond with the error\'s type as the response\'s body", async () => {
        const apiLayer = new HttpErrorBodyApiLayer();
        app = await Yagura.start([apiLayer], [new HttpServerService({ ...config, errorBodyContent: ErrorResponseBodyType.Type })]);
        const res = await chai.request((app.getService<HttpServerService>('HttpServer') as any)._express).get('/error');

        expect(res.text).to.be.eq(apiLayer.errorObject.type.type);
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
        interface DataQuery {
            even: string;
            odd: string;
        }

        class DataAdapter implements CrudAdapter<number, string, DataQuery> {
            private data: number[] = [0, 1, 2, 3, 4];

            public async getMany(query: DataQuery): Promise<number[]> {
                const result: number[] = this.data.slice();

                if(query.even === 'true' || query.odd === 'false') {
                    return result.filter((v) => v % 2 === 0);
                } else if(query.even === 'false' || query.odd === 'true') {
                    return result.filter((v) => v % 2 === 1);
                } else {
                    return result;
                }
            }
            public async getOne(id: string | number): Promise<number> {
                id = Number.parseInt(id as string, 10);
                const result: number = this.data[id];
                return result;
            }
            public async create(input: Partial<number>): Promise<number> {
                const id = this.data.push(input) - 1;
                return input;
            }
            public async update(id: string | number, input: Partial<number>): Promise<number> {
                id = Number.parseInt(id as string, 10);

                if(this.data[id] !== undefined) {
                    return this.data[id] = input;
                } else {
                    throw new HttpError(404);
                }
            }
            public async delete(id: string | number): Promise<number | void> {
                id = Number.parseInt(id as string, 10);
                return this.data[id];
            }
        }

        class CrudResourceLayer extends HttpApiLayer {
            public declareRoutes(router: HttpRouter) {
                router.route('/data').model(new DataAdapter());
            }
        }

        it("should mount as route", async () => {
            app = await Yagura.start([ new CrudResourceLayer() ], [ new HttpServerService(config) ]);
            const server = app.getService<HttpServerService>('HttpServer')['_express'];
            expect(app).to.be.instanceOf(Yagura);

            const res = await chai.request(server)
                .get('/');

            expect(res).to.have.status(404);
        });

        it("should respond to GET method for one item", async () => {
            app = await Yagura.start([ new CrudResourceLayer() ], [ new HttpServerService(config) ]);
            const server = app.getService<HttpServerService>('HttpServer')['_express'];
            const res = await chai.request(server)
                .get('/data/0');

            expect(res).to.have.status(200);
            expect(res.text).to.be.eq('0');
        });

        it("should respond to GET method for many items with a query", async () => {
            app = await Yagura.start([ new CrudResourceLayer() ], [ new HttpServerService(config) ]);
            const server = app.getService<HttpServerService>('HttpServer')['_express'];
            const res = await chai.request(server)
                .get('/data?even=true');

            expect(res).to.have.status(200);
            expect(res.body).to.be.eql([0, 2, 4]);
        });

        it("should respond to POST method", async () => {
            app = await Yagura.start([ new CrudResourceLayer() ], [ new HttpServerService(config) ]);
            const server = app.getService<HttpServerService>('HttpServer')['_express'];
            const res = await chai.request(server)
                .post('/data')
                .set('content-type', 'text/plain')
                .send('25');

            expect(res).to.have.status(201);
            expect(res.text).to.be.eq('25');
        });

        it("should respond to PUT method", async () => {
            app = await Yagura.start([ new CrudResourceLayer() ], [ new HttpServerService(config) ]);
            const server = app.getService<HttpServerService>('HttpServer')['_express'];
            const res = await chai.request(server)
                .put('/data/0')
                .set('content-type', 'text/plain')
                .send('25');

            expect(res).to.have.status(200);
            expect(res.text).to.be.eq('25');
        });

        it("should respond to DELETE method", async () => {
            app = await Yagura.start([ new CrudResourceLayer() ], [ new HttpServerService(config) ]);
            const server = app.getService<HttpServerService>('HttpServer')['_express'];
            const res = await chai.request(server)
                .delete('/data/0');

            expect(res).to.have.status(200);
            expect(res.text).to.be.eq('0');
        });

        // afterEach(async () => {
        //     await app.getService<HttpServerService>('HttpServer').stop();
        // })
    });

    afterEach(async () => {
        await app.getService<HttpServerService>('HttpServer').stop();
    })
});