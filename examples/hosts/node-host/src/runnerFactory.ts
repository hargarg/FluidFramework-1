/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

// tslint:disable max-classes-per-file

import * as services from "@fluidframework/server-services";
import * as core from "@fluidframework/server-services-core";
import * as utils from "@fluidframework/server-services-utils";
import { Provider } from "nconf";
import * as redis from "redis";
import { ICache, RedisCache } from "./redisCache";
import { NodeLoaderRunner } from "./runner";
import {
    WebServerFactory
} from "./services";

export class NodeLoaderResources implements utils.IResources {
    constructor(
        public config: Provider,
        public port: any,
        public webServerFactory: any,
        public messageReceiver: core.ITaskMessageReceiver,
        public cache: ICache) {
    }

    public async dispose(): Promise<void> {
        await this.messageReceiver.close();
        console.log("Not Implemented")
    }
}

export class NodeLoaderResourcesFactory implements utils.IResourcesFactory<NodeLoaderResources> {
    public async create(config: Provider): Promise<NodeLoaderResources> {
        // const workerConfig = config.get("worker");
        const port = utils.normalizePort(process.env.PORT || "3000");
        const webServerFactory = new WebServerFactory();

        const rabbitmqConfig = config.get("rabbitmq");
        const redisConfig = config.get("redis");
        const redisOptions: redis.ClientOpts = { password: redisConfig.pass };
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (redisConfig.tls) {
            redisOptions.tls = {
                serverName: redisConfig.host,
            };
        }

        const queueName = config.get("nodeloader-agent:queue");

        const redisClient = redis.createClient(redisConfig.port, redisConfig.host, redisOptions);
        const cache = new RedisCache(redisClient);

        const messageReceiver = services.createMessageReceiver(rabbitmqConfig, queueName);

        return new NodeLoaderResources(config, port, webServerFactory, messageReceiver, cache);
    }
}

export class NodeLoaderRunnerFactory implements utils.IRunnerFactory<NodeLoaderResources> {
    public async create(resources: NodeLoaderResources): Promise<utils.IRunner> {
        return new NodeLoaderRunner(
            resources.webServerFactory,
            resources.config,
            resources.port,
            resources.messageReceiver,
            resources.cache);
    }
}
