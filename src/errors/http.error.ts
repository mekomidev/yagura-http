import { Response } from 'express';

export interface HttpErrorType {
    code: number;
    type: string;
    message?: string;
}

/** Error to be thrown for HTTP API responses */
export class HttpError extends Error {
    /*
     *  Static members
     */

    public static addType(errorType: HttpErrorType, override: boolean = false) {
        if (!!HttpError._types && HttpError._types[errorType.type] && !override) {
            throw new Error(`An HttpErrorType with type "${errorType.type}" already exists`);
        } else {
            HttpError._types.set(errorType.type, errorType);
        }
    }

    private static _types: Map<string, HttpErrorType> = new Map<string, HttpErrorType>();

    /*
     *  Instance members
     */

    public readonly type: HttpErrorType;

    constructor(errorType?: HttpErrorType | string | number) {
        // Find error type
        let error: HttpErrorType;
        if (!errorType) {
            error = HttpError._types.get('default');
        } else if (typeof errorType === 'string') {
            error = errorType = HttpError._types[errorType];
        } else if (typeof errorType === 'number') {
            error = Array.from(HttpError._types.values()).find((e) => e.code === errorType);
            if(!error) {
                error =  {
                    type: '',
                    code: errorType
                }
            }
        } else {
            error = errorType;
        }

        // Compose error string
        let string = 'HTTP';
        if (error.code) { string += ` ${error.code}`; }
        if (error.type) { string += ` [${error.type}]`; }
        if (error.message) { string += `: ${error.message}`; }
        super(string);

        this.type = error;
    }

    public sendResponse(res: Response) {
        res.status(this.type.code || 500).send({ error: this.type.type });
    }
}
