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

    it("should start and respond to requests", async () => {
        const service = new HttpServerService(config);
        app = await Yagura.start([], [service]);
        const server = (service as any)._express;

        const res = await chai.request(server)
            .get('/');

        expect(res).to.have.status(404);
    });

    afterEach(async () => {
        await app.getService<HttpServerService>('HttpServer').stop();
    });
});