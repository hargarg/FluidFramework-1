# @fluid-internal/node-host

## Fluid Loader for Node.js evironment

This example demonstrates loading Fluid objects inside Node.js environment. To understand how Fluid loader works, read the [literate](../hosts-sample/README.md) loader example first.

We are using the rabbitmq to queue the request for documents to initiate the nodecodeloader.
We are currently loading the prosemirrorcomponent and whenever there are any changes for the data can be sent to the azure blob storage

## Difference with Literate Loader

The primary difference is how Fluid object packages are being loaded. While the literate loader can 'script include' a file inside a browser environment, Node requires a different approach.
It uses 'npm install' to install the package directly in local file system. Once installed, it returns the installed code as an entry point for the loader to invoke.

Note that if you are installing packages from a private registry, you need to create .npmrc file with auth tokens inside your installation directory first.

## Build steps
npm run docker-build

Below command to start rabbitmq and redis
npm run docker-start

```

Once parameters are set up, use the following commands for building and running:

```bash
npm run build
npm run start
```

To enable the nodecodeloader for a document Send a Post request to:
http://localhost:3000/server/{tenantId}/{documentId}



