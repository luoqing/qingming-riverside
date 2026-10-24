import { build } from "esbuild";
import { readFile, writeFile, rename } from "node:fs/promises";
const result = await build({
  entryPoints: [new URL("./src/app.js", import.meta.url).pathname],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  loader: { ".png": "dataurl", ".css": "text", ".glb": "dataurl" },
  legalComments: "inline",
  write: false,
});
const shell = await readFile(
  new URL("./src/shell.html", import.meta.url),
  "utf8",
);
const license = await readFile(
  new URL("./node_modules/three/LICENSE", import.meta.url),
  "utf8",
);
await writeFile(
  new URL("./.index.html.tmp", import.meta.url),
  shell
    .replace(
      "<!doctype html>",
      () => `<!doctype html>\n<!-- Three.js\n${license}\n-->`,
    )
    .replace("/* BUNDLED_APP */", () =>
      result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script"),
    ),
);
await rename(new URL("./.index.html.tmp",import.meta.url),new URL("./index.html",import.meta.url));
console.log("Built standalone index.html");
const characters=await build({entryPoints:[new URL("./src/character-preview.js",import.meta.url).pathname],bundle:true,minify:true,format:"iife",target:"es2020",loader:{".glb":"dataurl"},write:false});
const characterShell=await readFile(new URL("./src/character-preview.html",import.meta.url),"utf8");
await writeFile(new URL("./.characters.html.tmp",import.meta.url),characterShell.replace("/* CHARACTER_APP */",()=>characters.outputFiles[0].text.replace(/<\/script/gi,"<\\/script")));
await rename(new URL("./.characters.html.tmp",import.meta.url),new URL("./characters.html",import.meta.url));
console.log("Built standalone characters.html");
