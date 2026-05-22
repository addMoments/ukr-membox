import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto'; 

const ROUTES = [
];

function generateShortUUID(length = 10) {
  // URL-safe alphabet (similar to base62 but URL-friendly)
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

  const generateRandomString = (alphabet, length)=>{
    if (!alphabet || alphabet.length === 0) {
      throw new Error('Alphabet must be a non-empty string');
    }
    
    if (length <= 0) {
      throw new Error('Length must be a positive number');
    }
  
    const alphabetLength = alphabet.length;
    const randomBytes = crypto.randomBytes(length);
    let result = '';
  
    for (let i = 0; i < length; i++) {
      // Use modulo to map random byte to alphabet index
      const randomIndex = randomBytes[i] % alphabetLength;
      result += alphabet[randomIndex];
    }
  
    return result;
  }

  return generateRandomString(alphabet, length);
}

const main = async ()=>{
    console.log("Postbuild started");
    const buildDir = path.join(".", 'build');
    let promises = [
        //fs.unlink(path.join(buildDir, 'asset-manifest.json')),
    ]

    const [cssFolder, jsFolder] = await Promise.all([
        fs.readdir(path.join(buildDir, 'static', 'css')),
        fs.readdir(path.join(buildDir, 'static', 'js')),
    ]);

    const hashMap = {};
    let mainJs = "";

    const procFolder = (folderName)=>{
        const folder = folderName == "css" ? cssFolder : jsFolder;
        const folderPath = x => path.join(buildDir, 'static', folderName, x);

        for (const file of folder){
            if (file.endsWith(".map") || file.endsWith(".LICENSE.txt")){
                promises.push(fs.unlink(folderPath(file)));
                continue;
            }

            const splitName = file.split(".");
            const origHash = splitName[1];

            if (!hashMap[origHash]){
                hashMap[origHash] = generateShortUUID();
            }

            const newSplit = [...splitName];
            newSplit[1] = hashMap[origHash];

            if (folderName == "js" && file.startsWith("main.")){
                mainJs = folderPath(newSplit.join("."))
            }

            promises.push(fs.rename(
                folderPath(file), 
                folderPath(newSplit.join("."))
            ));
        }
    }

    procFolder("css");
    procFolder("js");
    await Promise.all(promises);
    promises = [];

    const [indexContent, mainJsContent] = await Promise.all([
        fs.readFile(path.join(buildDir, 'index.html'), 'utf8'),
        fs.readFile(mainJs, 'utf8'),
    ]);

    const fixContent = (content = "")=>{
        let newContent = content;

        Object.keys(hashMap).forEach(origHash => {
            newContent = newContent.replaceAll(origHash, hashMap[origHash]);
        })

        return newContent;
    };

    const newIndexContent = fixContent(indexContent);

    promises.push(fs.writeFile(path.join(buildDir, 'index.html'), newIndexContent));
    promises.push(fs.writeFile(mainJs, fixContent(mainJsContent)));
    promises.push(fs.unlink(path.join(buildDir, 'asset-manifest.json')));

    ROUTES.forEach(route => {
        promises.push((async ()=>{
            await fs.mkdir(path.join(buildDir, route), { recursive: true });
            await fs.writeFile(path.join(buildDir, route, 'index.html'), newIndexContent);
        })())
    })

    await Promise.all(promises);
};

main();