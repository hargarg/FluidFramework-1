export class LocalStorage {
    private fileName: string = 'sampleFile';
    private initialState = {"doc":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello, world!"}]},{"type":"paragraph","content":[{"type":"text","text":"grgrg"}]}]},"selection":{"type":"text","anchor":1,"head":1}};
    
    constructor(){
        //create a new file here if it does not exists
    }

    public getInitialState(){
        return this.initialState?.doc;
    }

    public getFileName = (): string => {
        return this.fileName;
    }

    public writeToFile = (dataDump: any): void => {
        console.log('\***************** Data Dump **************************/');
        this.initialState = dataDump;
        console.log(dataDump);
    }
}