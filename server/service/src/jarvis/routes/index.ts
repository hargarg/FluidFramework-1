/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { IAlfredTenant, IDocumentStorage, IProducer, ITenantManager } from "@microsoft/fluid-server-services-core";
import * as utils from "@microsoft/fluid-server-services-utils";
import * as cors from "cors";
import { Router } from "express";
import { Provider } from "nconf";
import * as deltas from "./deltas";
import * as documents from "./documents";
import * as tenants from "./tenants";

export function create(
    config: Provider,
    tenantManager: ITenantManager,
    storage: IDocumentStorage,
    mongoManager: utils.MongoManager,
    producer: IProducer,
    appTenants: IAlfredTenant[]): Router {

    const router: Router = Router();
    const deltasRoute = deltas.create(config, mongoManager, appTenants);
    const documentsRoute = documents.create(storage, appTenants);
    const tenantsRoute = tenants.create(config, appTenants);

    router.use(cors());
    router.use("/deltas", deltasRoute);
    router.use("/documents", documentsRoute);
    router.use("/api/tenants", tenantsRoute);

    return router;
}