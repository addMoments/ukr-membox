import { v5 as _uuidv5 } from 'uuid';

let startNum = Math.round(Date.now() / 1000);

function packUUID(hexstring: string) {
    try {
        const noDashes = hexstring.replaceAll("-", "");
        const match = noDashes.match(/\w{2}/g);

        if (!match){
            throw new Error("Invalid hexstring");
        }

        const rawB64 = btoa(match.map(function(a) {
            return String.fromCharCode(parseInt(a, 16));
        }).join(""));
        const noSuffix = rawB64.slice(0,-2);
        const b64Url = noSuffix.replaceAll("/", "_").replaceAll("+", "-");

        return b64Url;
    } catch (error) {
        return "";
    }
};

function unpackUUID(b64uuid: string) {
    try {
        const rawB64 = b64uuid.replaceAll("_", "/").replaceAll("-", "+")+"==";
        const hexNoDashes = atob(rawB64).split("").map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");

        const s = hexNoDashes;
        return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`
    } catch (error) {
        return "";
    }

}

const uuidv5 = (nameSpace: string) => {
    const inc = (Math.round(Math.random()*999)+9)/1000000;
    startNum += inc;
    return _uuidv5(`${startNum}`, nameSpace);
}

export { uuidv5, packUUID, unpackUUID };