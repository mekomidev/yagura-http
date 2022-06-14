import { YaguraEvent } from '@yagura/yagura';
import { HttpError } from './errors/http.error';

import { Response, Request } from 'express';

export interface HttpEventData {
    req: Request;
    res: Response;
    errorBodyType: ErrorResponseBodyType;
}

export enum ErrorResponseBodyType {
    Object,
    Type,
    Message
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


        // NOTE: calling res.send() with a number causes that number to be set as the status; this is a bug and needs to be reported to expressjs/types
        if(typeof data === 'number')
            data = data.toString(10);

        await new Promise((resolve) => { this.data.res.status(status).send(data).end(resolve) });
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
            switch (this.data.errorBodyType) {
                case ErrorResponseBodyType.Object:
                    this.data.res.writeHead(err.type.code).write(JSON.stringify(err.type));
                    break;
                case ErrorResponseBodyType.Message:
                    this.data.res.writeHead(err.type.code).write(err.type.message);
                    break;
                case ErrorResponseBodyType.Type:
                    this.data.res.writeHead(err.type.code).write(err.type.type);
                    break;
            }
        } else {
            if (process.env.NODE_ENV === 'production') {
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
            this.data.res.statusCode = 404;
        }

        if(!this.data.res.finished)
            return new Promise((resolve) => this.data.res.end(resolve) );

        return;
    }
}
