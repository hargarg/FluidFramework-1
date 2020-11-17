/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { IFluidObject } from "@fluidframework/core-interfaces";
import { IFluidCodeDetails } from "@fluidframework/container-definitions";
import { Container, Loader } from "@fluidframework/container-loader";
import { launchCLI } from "./cli";
import { IQuorum } from "@fluidframework/protocol-definitions";

/**
 * The initializeChaincode method takes in a document and a desired npm package and establishes a code quorum
 * on this package.
 */
export async function initializeChaincode(document: Container, pkg?: IFluidCodeDetails): Promise<void> {
    if (pkg === undefined) {
        return;
    }

    const quorum = document.getQuorum();

    // Wait for connection so that proposals can be sent
    if (!document.connected) {
        await new Promise<void>((resolve) => document.on("connected", () => resolve()));
    }

    // And then make the proposal if a code proposal has not yet been made
    if (!quorum.has("code")) {
        await quorum.propose("code", pkg);
    }
}

/**
 * fetchCore is used to make a request against the loader to load a Fluid object.
 */
async function fetchCore(loader: Loader, url: string) {
    const response = await loader.request({ url });

    if (response.status !== 200 || response.mimeType !== "fluid/object") {
        return;
    }

    const fluidObject = response.value as IFluidObject;
   // console.log(fluidObject)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    launchCLI(fluidObject);
}

/**
 * fetchFluidObject is used to allow a host to interact with a Fluid object. Given that we may be establishing a
 * new set of code on the document it listens for the "contextChanged" event which fires when a new code value is
 * quorumed on.
 */
export async function fetchFluidObject(loader: Loader, container: Container, url: string) {
    console.log("fetchfluid");
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    fetchCore(loader, url);
    container.on("contextChanged", () => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        fetchCore(loader, url);
    });
}


/**
 * Close the container if none of the members of Quorum
 * @param document 
 */
export async function CheckMembersofQuorum(document: Container,) {
    const quorum: IQuorum = document.getQuorum();
    const members = quorum.getMembers()
    console.log(members)
    return members.size
}

/**
 * This function polls quorum and close the container if there is no member
 * @param document 
 */
export async function PollAndCloseDocument(document: Container) {

    const intervalObj = setInterval(async function () {
        if (await CheckMembersofQuorum(document) <= 1) {
            document.close();
            clearInterval(intervalObj)
        }
    }, 5000);

}


