import { YaguraEvent } from '@yagura/yagura';

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

        this.data.res.status(status).send(data);
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
