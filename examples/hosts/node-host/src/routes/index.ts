import { Router } from "express";
import * as services from "@fluidframework/server-services";
import { Provider } from "nconf";
import * as redis from "redis";
import { RedisCache } from "../redisCache";
// import * as winston from "winston";




export function create(config: Provider): Router {
    const router: Router = Router();
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
    console.log(cache);

    const messagesender = services.createMessageSender(rabbitmqConfig, config.get("rabbitmqsender"));
    messagesender.initialize()


    router.post("/server/:tenantId/:documentId/:pkgNo", (request, response, next) => {
  
        messagesender.sendTask(queueName, { type: "task:nodestart", content: { documentId: request.params.documentId, tenantId: request.params.tenantId, pkgNo:request.params.pkgNo } })
        // documentLoader.loadDocument()
        response.status(200).json("completed")
    });

    return router;
}