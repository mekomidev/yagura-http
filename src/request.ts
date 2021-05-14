import { YaguraEvent } from '@yagura/yagura';
import { HttpError } from './errors/http.error';

import { Response, Request } from 'express';

export interface HttpEventData {
    req: Request;
    res: Response;
}

/**
 * A [YaguraEvent] subclass representing a HTTP request.
 * Incapsules [req] and [res] objects in order to pass them through the Layer stack.
 */
export class HttpRequest extends YaguraEvent {
    public readonly data: HttpEventData;

    constructor(data: HttpEventData) {
        super(data);
        this.data.res.statusCode = -1;
    }

    // Response methods
    /**
     * Send a response to this [HttpRequest]
     *
     * @param {Number} status HTTP status code to respond with
     * @param {any} data HTTP response body contents
     */
    public async send(status: number, data?: any): Promise<Response> {
        if(!this.canSend) {
            throw new Error("HTTP headers have already been written");
        }

        this.data.res.writeHead(status).write(data ?? '');
        await this.consume();
        return this.data.res;
    }

    /**
     * Send a response to this [HttpRequest] based on an [Error]
     *
     * @param {Error} err The error to be parsed into a response
     */
    public async sendError(err: Error): Promise<Response> {
        if(!this.canSend) {
            throw new Error("HTTP headers have already been written");
        }

        if (err instanceof HttpError) {
            this.data.res.writeHead(err.type.code).write(err.type.type);
        } else {
            if(process.env.NODE_ENV === 'production') {
                this.data.res.writeHead(500);
            } else {
                this.data.res.writeHead(500).write(err.stack);
            }
        }

        await this.consume();
        return this.data.res;
    }

    public get canSend(): boolean {
        return !this.data.res.headersSent;
    }

    public async onConsumed(): Promise<void> {
        if(this.data.res.statusCode === -1) {
            this.data.res.writeHead(404);
        }

        if(!this.data.res.finished)
            return new Promise((resolve) => this.data.res.end(() => resolve()));

        return;
    }
}
