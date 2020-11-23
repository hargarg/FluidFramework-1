import { DataObject, DataObjectFactory } from "@fluidframework/aqueduct";
import { ISyncBridgeConnector, ISyncMessageHandler, SyncBridgeConnectorContext, SyncMessage, SyncMessageHandlerResult, SyncMessageType } from "syncbridge";
import { AzureCognitiveService } from "../cognitiveUtil/cognitiveService";

export class AzureCognitiveConnector extends DataObject implements ISyncBridgeConnector, ISyncMessageHandler {
    private connectorContext!: SyncBridgeConnectorContext;
    public azureCognitiveService: AzureCognitiveService;

    public static get ComponentName() {
        return 'AzureCognitiveConnector';
      }
    
      public static readonly factory = new DataObjectFactory(AzureCognitiveConnector.ComponentName, AzureCognitiveConnector, [], {});

      protected async initializingFirstTime() {
        console.log('TestConnector initializingFirstTime');
      }
    
      protected async hasInitialized() {
        if (!isWebClient()){
            this.azureCognitiveService = new AzureCognitiveService();

        }
        else{
          this.azureCognitiveService = new AzureCognitiveService();
        }
        console.log('TestConnector hasInitialized');
      }
    
      public get ISyncBridgeConnector() {
        return this;
      }

      public get ISyncMessageHandler() {
        return this;
      }

      public init(context: SyncBridgeConnectorContext) {
        this.connectorContext = context;
        this.connectorContext.client.registerSyncMessageHandler(this);
      }
    

      public handleSyncMessage = async (syncMessage: SyncMessage): Promise<SyncMessageHandlerResult | undefined> => {
        console.log("in the AzureCognitiveConnector", syncMessage)
        return await this.handleSyncMessageInternal(syncMessage);
      };

      private handleSyncMessageInternal = async (message: SyncMessage): Promise<SyncMessageHandlerResult> => {
        if(!isWebClient()){
        switch (message.opCode) {
            case 'GET_DATA':
              
              const data = await this.azureCognitiveService.getEntity(message.payload.data.keyword, message.payload.data.docdata);
              console.log(".... in the handleSyncMessageInternal ", data)
              const RETURN_DATA:SyncMessage = {
                opCode: 'RETURN_DATA',
                type: SyncMessageType.SyncOperation,
                payload: {data:{searchResult:data, textSearch:message.payload.data.keyword }}
              };
              this.connectorContext.client.submit(RETURN_DATA)
            
              return {
                success: true
              } as SyncMessageHandlerResult;
            }}
      }
    
      public static getFactory() {
        return this.factory;
      }
}


const isWebClient = () => {
    return typeof window !== "undefined" && typeof window.document !== "undefined";
};