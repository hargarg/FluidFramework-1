/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    IWebServer,
    IWebServerFactory
} from "@fluidframework/server-services-core";
import * as utils from "@fluidframework/server-services-utils";
import { Deferred } from "@fluidframework/common-utils";
import { Provider } from "nconf";
import * as winston from "winston";
import * as core from "@fluidframework/server-services-core";
import { ICache } from "./redisCache";

import * as app from "./app";
import { DocumentLoader } from "./documentLoader";

export class NodeLoaderRunner implements utils.IRunner {
    private server!: IWebServer;
    private runningDeferred!: Deferred<void>;
    private readonly running = new Deferred<void>();
    constructor(
        private readonly serverFactory: IWebServerFactory,
        private readonly config: Provider,
        private readonly port: string | number,
        private readonly messageReceiver: core.ITaskMessageReceiver,
        private readonly cache: ICache
    ) {
    }

    public async start(): Promise<void> {
        this.runningDeferred = new Deferred<void>();
        console.log(this.cache);
        // Create the HTTP server and attach alfred to it
        const alfred = app.create(
            this.config);
        alfred.set("port", this.port);

        this.server = this.serverFactory.create(alfred);

        const httpServer = this.server.httpServer;

        const messageReceiverP = this.messageReceiver.initialize();
        await Promise.all([messageReceiverP]).catch((err) => {
            this.running.reject(err);
        });

        // Should reject on message receiver error.
        this.messageReceiver.on("error", (err) => {
            this.running.reject(err);
        });

        // Accept a task.
        this.messageReceiver.on("message", (message: core.ITaskMessage) => {
            const type = message;
            winston.info("messsssssssssssssssss", type)
            const messageContent = message.content
            const documentLoader = new DocumentLoader(
                "@fluid-example/prosemirror@0.28.0",
                messageContent.documentId,
                messageContent.tenantId
            );
            documentLoader.loadDocument()
        });

        // Listen on provided port, on all network interfaces.
        httpServer.listen(this.port);
        httpServer.on("error", (error) => this.onError(error));
        httpServer.on("listening", () => this.onListening());

        return this.runningDeferred.promise;
    }

    public stop(): Promise<void> {
        // Close the underlying server and then resolve the runner once closed
        this.server.close().then(
            () => {
                this.runningDeferred.resolve();
            },
            (error) => {
                this.runningDeferred.reject(error);
            });

        return this.runningDeferred.promise;
    }

    /**
     * Event listener for HTTP server "error" event.
     */
    private onError(error) {
        if (error.syscall !== "listen") {
            throw error;
        }

        const bind = typeof this.port === "string"
            ? `Pipe ${this.port}`
            : `Port ${this.port}`;

        // Handle specific listen errors with friendly messages
        switch (error.code) {
            case "EACCES":
                this.runningDeferred.reject(`${bind} requires elevated privileges`);
                break;
            case "EADDRINUSE":
                this.runningDeferred.reject(`${bind} is already in use`);
                break;
            default:
                throw error;
        }
    }

    /**
     * Event listener for HTTP server "listening" event.
     */
    private onListening() {
        const addr = this.server.httpServer.address();
        const bind = typeof addr === "string"
            ? `pipe ${addr}`
            : `port ${addr.port}`;
        winston.info(`Listening on ${bind}`);
    }
}
