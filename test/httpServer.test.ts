/* eslint-disable @typescript-eslint/no-unused-expressions */
import { Yagura } from '@yagura/yagura';
import { HttpServerConfig, HttpServerService } from '../src';

import { Server } from 'node:http';
import { AddressInfo } from 'net';
import { Express as ExpressApp } from 'express';

import 'mocha';
import * as sinon from 'sinon';
import * as chai from 'chai';
import chaiHttp = require('chai-http');
const expect = chai.expect;

// import 'clarify';

describe('HttpServer', () => {
    const config: HttpServerConfig = {
        port: 30000,
        timeout: 1000,
        defaultError: 500
    };

    before(() => {
        chai.use(chaiHttp);
    });

    let app: Yagura;

    it("should start and listen for requests", async () => {
        const service = new HttpServerService(config);
        app = await Yagura.start([], [service]);
        const server: Server = (service as any)._server;

        expect(server.listening).to.be.eq(true);
        expect((server.address() as AddressInfo).port).to.be.eq(config.port);
    });

    it('should dispatch event on request received', async () => {
        const service = new HttpServerService(config);
        app = await Yagura.start([], [service]);
        const server: ExpressApp = (service as any)._express;

        // use spy
        const spy = sinon.spy(app, 'dispatch');

        const res = await chai.request(server)
            .get('/');

        expect(spy.called).to.be.eq(true);
    });

    it('should respond with 408 when the request handling times out', async () => {
        const service = new HttpServerService(config);
        app = await Yagura.start([], [service]);
        const server: ExpressApp = (service as any)._express;

        // use stub
        sinon.stub(app, 'dispatch').returns(new Promise(resolve => setTimeout(resolve, config.timeout * 2)));

        const resPromise = chai.request(server)
            .get('/');

        const res = await resPromise;

        expect(res.status).to.be.eq(408);
    });

    it('should respond with 404 when there was no response', async () => {
        const service = new HttpServerService(config);
        app = await Yagura.start([], [service]);
        const server: ExpressApp = (service as any)._express;

        const res = await chai.request(server)
            .get('/');

        expect(res.status).to.be.eq(404);
    });

    afterEach(async () => {
        if(app)
            await app.getService<HttpServerService>('HttpServer').stop();
        else
            console.warn('Yagura not running');
    });
});