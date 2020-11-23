export interface ITenantInfo {
    tenantId: string
    tenantKey: string
    bearerSecret: string
}

export interface IEndpoints {
    ordererEndpoint: string,
    storageEndpoint: string
}

export function getSampleTenantInfo() {
    const sampleTenant: ITenantInfo = {
        tenantId: "",
        tenantKey: "",
        bearerSecret: ""

    }
    return sampleTenant
}

export function getTenantInfo(tenantId) {
    console.log(tenantId)
    const sampleTenant: ITenantInfo = {
        tenantId: "",
        tenantKey: "",
        bearerSecret: ""

    }
    return sampleTenant
}

export function getEndPoints() {
    return {
        ordererEndpoint: "https://alfred.frs.office-int.com",
        storageEndpoint: "https://historian.frs.office-int.com"
    }
}

