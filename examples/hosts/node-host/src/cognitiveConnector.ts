import {TextAnalyticsClient, AzureKeyCredential} from "@azure/ai-text-analytics"

const key = '079d7fa757fd475fa1d7ef6f77bd876a';
const endpoint = 'https://fluid-entity.cognitiveservices.azure.com/';
const textAnalyticsClient = new TextAnalyticsClient(endpoint,  new AzureKeyCredential(key));

async function sentimentAnalysis(client){

    const sentimentInput = [
        "I had the best day of my life in USA. I wish you were there with me in seattle. Friends on netflix is good"
    ];
    const sentimentResult = await client.recognizeLinkedEntities(sentimentInput);

    sentimentResult.forEach(document => {
        document.entities.forEach(entity => {
            const data = {name:entity.name,url:entity.url }
            entity.matches.forEach(match => {
                console.log(match.text, {recognizedLinkedEntities:data})
            })
        })

    })
}
sentimentAnalysis(textAnalyticsClient)