import {TextAnalyticsClient, AzureKeyCredential} from "@azure/ai-text-analytics"

const key = '079d7fa757fd475fa1d7ef6f77bd876a';
const endpoint = 'https://fluid-entity.cognitiveservices.azure.com/';
// const textAnalyticsClient = new TextAnalyticsClient(endpoint,  new AzureKeyCredential(key));

export interface LinkedEntities{
    name:string;
    url:string
}

export interface Entities{
    text:string;
    category:string;
    subCategory:string;
}

export interface CognitiveMessage{

    recognizedEntities?:Entities;

    recognizedLinkedEntities?:LinkedEntities; 

}

export class AzureCognitiveService{
    private readonly  textAnalyticsClient: TextAnalyticsClient;
    private textCallMap:Map<string, CognitiveMessage> = new Map()
    constructor(){
        this.textAnalyticsClient = new TextAnalyticsClient(endpoint, new AzureKeyCredential(key))
    }


    public async getLinkedEntities(input){

        const result:any = await this.textAnalyticsClient.recognizeLinkedEntities(input);
        console.log(result)
        result.forEach(doc => {
            
            doc.entities.forEach(entity => {
                const data:LinkedEntities = {name:entity.name,url:entity.url }
                entity.matches.forEach(match => {
                    this.textCallMap.set(match.text, {recognizedLinkedEntities:data})
                })
            })

        })

        console.log("-----textmap-----linkdentitiies", this.textCallMap)
    }

    public async getEntity(selectedText, docData){
        if(this.textCallMap.get(selectedText)){
            return this.textCallMap.get(selectedText)
        }
        await this.getLinkedEntities([docData]);
        return this.textCallMap.get(selectedText);
       // await this.getLinkedEntities([docData]);
       // return this.textCallMap;
    }
}

