
import * as url from "url";
import { IFluidCodeDetails, IProxyLoaderFactory } from "@fluidframework/container-definitions";
import { Loader } from "@fluidframework/container-loader";
import { IFluidResolvedUrl } from "@fluidframework/driver-definitions";
import { IUser } from "@fluidframework/protocol-definitions";
import { RouterliciousDocumentServiceFactory } from "@fluidframework/routerlicious-driver";
import { ContainerUrlResolver } from "@fluidframework/routerlicious-host";
import * as jwt from "jsonwebtoken";
import { NodeCodeLoader } from "./nodeCodeloader";
import { fetchFluidObject, initializeChaincode } from "./utils";
import { getEndPoints, getTenantInfo } from "./TenantInfo"

export class DocumentLoader {
    private installPath = "/tmp/fluid-objects";
    private timeoutMS = 60000;
    private clientId = "16d97a2b-b1e7-4ddf-a203-0d0ccf040b84";

    constructor(
        private readonly pkgId: string,
        private readonly documentId: string,
        private readonly tenantId: string
    ) { }

    private getUser() {
        return {
            id: this.clientId,
        } as IUser;
    }

    public async loadDocument() {
        const user = this.getUser();
        const endpoint = getEndPoints();
        const tenantInfo = getTenantInfo(this.tenantId);
        console.log(tenantInfo);
        const documentId = this.documentId
        const tenantId = this.tenantId
        const hostToken = jwt.sign(
            {
                user,
            },
            tenantInfo.bearerSecret);
        const token = jwt.sign(
            {
                documentId,
                scopes: ["doc:read", "doc:write", "summary:write"],
                tenantId,
                user,
            },
            tenantInfo.tenantKey);

        // Genearting Fluid urls.
        const encodedTenantId = encodeURIComponent(this.tenantId);
        const encodedDocId = encodeURIComponent(this.documentId);
        const documentUrl = `fluid://${url.parse(endpoint.ordererEndpoint).host}/${encodedTenantId}/${encodedDocId}`;
        const deltaStorageUrl = `${endpoint.ordererEndpoint}/deltas/${encodedTenantId}/${encodedDocId}`;
        const storageUrl = `${endpoint.storageEndpoint}/repos/${encodedTenantId}`;

        // Crafting IFluidResolvedUrl with urls and access tokens.
        const resolved: IFluidResolvedUrl = {
            endpoints: {
                deltaStorageUrl,
                ordererUrl: endpoint.ordererEndpoint,
                storageUrl,
            },
            tokens: { jwt: token },
            type: "fluid",
            url: documentUrl,
        };
        console.log(resolved)
        const resolver = new ContainerUrlResolver(
            endpoint.ordererEndpoint,
            hostToken,
            new Map([[documentUrl, resolved]]));

        // A code loader that installs the code package in a specified location (installPath).
        // Once installed, the loader returns an entry point to Fluid Container to invoke the code.
        const nodeCodeLoader = new NodeCodeLoader(this.installPath, this.timeoutMS);

        // Construct the loader
        const loader = new Loader(
            resolver,
            new RouterliciousDocumentServiceFactory(),
            nodeCodeLoader,
            {},
            {},
            new Map<string, IProxyLoaderFactory>(),
        );

        // Resolving the URL to its underlying Fluid document.
        const fluidDocument = await loader.resolve({ url: documentUrl });

        // Fetches the underlying Fluid object.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        fetchFluidObject(loader, fluidDocument, documentUrl);

        // Proposes the code package for a new document.
        if (!fluidDocument.existing) {
            const details: IFluidCodeDetails = {
                config: {},
                package: this.pkgId,
            };

            await initializeChaincode(fluidDocument, details)
                .catch((error) => console.error("chaincode error", error));
        }

    }




}