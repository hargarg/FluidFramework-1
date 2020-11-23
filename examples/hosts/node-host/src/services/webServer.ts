/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { HttpServer } from "@fluidframework/server-services-shared";
// import { IWebServer, IWebSocketServer } from "@fluidframework/server-services-core";

export class WebServer {
    constructor(public httpServer: HttpServer) {
    }

    public async close(): Promise<void> {
        await Promise.all([this.httpServer.close()]);
    }
}
