// Copy the existing game to its deployment workspace; keep the standalone build unchanged.
import {readFile,writeFile,readdir,mkdir,rename,stat} from "node:fs/promises";
import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import path from "node:path";
const exec=promisify(execFile),root=new URL("../",import.meta.url).pathname;
const destination=path.resolve(process.argv[2]||"");
if(path.basename(destination)!=="qingming-riverside-miaoda")throw new Error("Expected the dedicated deployment workspace");
const manifestFile=path.join(root,"deployment/miaoda-assets.json");
const manifest=JSON.parse(await readFile(manifestFile,"utf8"));
const meta=JSON.parse(await readFile(path.join(destination,".spark/meta.json"),"utf8"));
if(meta.app_id!==manifest.appId)throw new Error("Deployment app mismatch");
const library=JSON.parse(await readFile(path.join(root,"src/voice-library.json"),"utf8"));
const digest=bytes=>createHash("sha256").update(bytes).digest("hex");
const voices=new Map();
for(const file of await readdir(path.join(root,"src/voice-assets"))) {
 const relative=`src/voice-assets/${file}`;
 voices.set(digest(await readFile(path.join(root,relative))),relative);
}
const voiceFiles=new Map(Object.entries(library).map(([key,data])=>{
 const file=voices.get(digest(Buffer.from(data.split(",")[1],"base64")));
 if(!file)throw new Error(`Missing original audio for ${key}`);
 return [key,file];
}));
const media=["src/material-atlas.png",
 "characters/boy-standard/tripo-out/qingming-boy-standard-rig-24d61ba9/model.glb",
 "characters/girl-standard/tripo-out/qingming-girl-standard-rig-7af0cbc0/model.glb",
 ...new Set(voiceFiles.values())];
const env={...process.env};
for(const key of ["HTTPS_PROXY","HTTP_PROXY","ALL_PROXY","https_proxy","http_proxy","all_proxy"])delete env[key];
let checkpoint=Promise.resolve();
function saveManifest(){
 const contents=JSON.stringify(manifest,null,2);
 checkpoint=checkpoint.then(async()=>{
  await writeFile(manifestFile+".tmp",contents);await rename(manifestFile+".tmp",manifestFile);
 });
 return checkpoint;
}
// Recover completed uploads if a previous deployment process was interrupted.
let token="",recovered=0;
do {
 const {stdout}=await exec("lark-cli",["apps","+file-list","--as","user","--app-id",manifest.appId,
  "--type","audio/mpeg","--page-size","200",...(token?["--page-token",token]:[])],{cwd:root,env,timeout:60000});
 const result=JSON.parse(stdout);if(!result.ok)throw new Error("Cannot verify existing app assets");
 for(const row of result.data.items||[]) {
  const file=media.find(file=>file.endsWith("/"+row.file_name));
  if(file && !manifest.files[file] && row.download_url?.startsWith(`/spark/app/${manifest.appId}/`) &&
    (await stat(path.join(root,file))).size===row.size_bytes){
    manifest.files[file]={path:row.path,url:row.download_url};recovered++;
  }
 }
 token=result.data.has_more?(result.data.next_page_token||result.data.page_token):"";
}while(token);
await saveManifest();console.log("Recovered verified uploads",recovered);
let cursor=0,uploaded=0;
async function worker(){
 while(cursor<media.length){
  const file=media[cursor++];
  if(manifest.files[file])continue;
  const {stdout}=await exec("lark-cli",["apps","+file-upload","--as","user","--app-id",manifest.appId,"--file",`./${file}`],
   {cwd:root,env,timeout:90000,maxBuffer:1024*1024});
  const result=JSON.parse(stdout);
  if(!result.ok || !result.data.download_url)throw new Error(`Upload failed: ${file}`);
  const url=result.data.download_url;
  if(!url.startsWith(`/spark/app/${manifest.appId}/`))throw new Error("Unexpected asset URL");
  manifest.files[file]={path:result.data.path,url};
  await saveManifest();
  if(++uploaded%10===0)console.log("Uploaded new files",uploaded);
 }
}
// Always persist successful uploads, even if another file fails.
try {await Promise.all([worker(),worker(),worker()]);}
finally {await saveManifest();}
const out=path.join(destination,"src/game");await mkdir(out,{recursive:true});
for(const file of await readdir(path.join(root,"src"))) {
 if(!(file.endsWith(".js")||file.endsWith(".css")) || file==="character-preview.js")continue;
 let source=await readFile(path.join(root,"src",file),"utf8");
 if(file==="app.js")source=source.replace('import materialAtlasURL from "./material-atlas.png";',
  `const materialAtlasURL=${JSON.stringify(manifest.files[media[0]].url)};`);
 if(file==="hero-model.js")for(const [index,name] of [[1,"boyUrl"],[2,"girlUrl"]])
  source=source.replace(new RegExp(`import ${name} from "[^"]+";`),`const ${name}=${JSON.stringify(manifest.files[media[index]].url)};`);
 if(file==="journey.js")source=source.replace('from "./journey.css"','from "./journey.css?inline"');
 await writeFile(path.join(out,file),source);
}
const onlineVoices=Object.fromEntries([...voiceFiles].map(([key,file])=>[key,manifest.files[file].url]));
await writeFile(path.join(out,"voice-library.json"),JSON.stringify(onlineVoices,null,2));
let shell=await readFile(path.join(root,"src/shell.html"),"utf8");
shell=shell.replace(/<script>\s*\/\* BUNDLED_APP \*\/\s*<\/script>/,
 '<script type="module" src="/src/game/app.js"></script>');
if(shell.includes("BUNDLED_APP"))throw new Error("Game entry was not connected");
await writeFile(path.join(destination,"index.html"),shell);
await writeFile(path.join(destination,"src/game/ASSETS.json"),JSON.stringify({appId:manifest.appId,files:manifest.files},null,2));
await mkdir(path.join(destination,"tests"),{recursive:true});
for(const file of ["animals.mjs","beginner-route.mjs","shop-voice-coverage.mjs"]){
 const test=await readFile(path.join(root,"tests",file),"utf8");
 await writeFile(path.join(destination,"tests",file),test.replaceAll("../src/","../src/game/"));
}
console.log("Prepared existing game with",media.length,"platform assets and",voiceFiles.size,"voice mappings");
