import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import materialAtlasURL from "./material-atlas.png";
import { createHumanModel } from "./people.js";
import { VENDORS } from "./travel-data.js";
import { makeToy } from "./toys.js";
import { isBlocked, nearestWalkable } from "./walk.js";
import { createCrowdPaths, createCrowdMotion } from "./crowd.js";
import { FRIENDS } from "./story.js";
import {camelBodies,canMoveCamel} from "./animals.js";
import { createSurveyMap } from "./survey-map.js";
import { createJourney } from "./journey.js";
import {
  riverCenter,
  riverWidth,
  bridgeHeight as bridgeY,
  boatPose,
} from "./paths.js";

async function main() {
  // Everything, including textures and the river reflection, is made locally.
  let seed = 87123;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const range = (a, b) => a + (b - a) * random(),
    pick = (a) => a[Math.floor(random() * a.length)];
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z),
    TAU = Math.PI * 2;
  const mobile = matchMedia("(max-width:700px)").matches;
  const reduced = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#ded6c6");
  scene.fog = new THREE.Fog("#ded6c6", 115, 235);
  const camera = new THREE.PerspectiveCamera(
    39,
    innerWidth / innerHeight,
    0.1,
    450,
  );
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  const gl = renderer.getContext(),
    debugRenderer = gl.getExtension("WEBGL_debug_renderer_info");
  const softwareRenderer =
    debugRenderer &&
    /SwiftShader|llvmpipe|softpipe/i.test(
      gl.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL),
    );
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    "aria-label",
    "三维长卷，拖动旋转，滚轮缩放",
  );
  document.querySelector("#scene").appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 9;
  controls.maxDistance = 210;
  controls.maxPolarAngle = Math.PI * 0.465;
  controls.minPolarAngle = 0.12;
  controls.target.set(0, 1, 0);
  controls.panSpeed = 0.7;
  scene.add(new THREE.HemisphereLight("#f4efe2", "#837c61", 1.85));
  const sun = new THREE.DirectionalLight("#fff1d7", 3.0);
  sun.position.set(-28, 43, 21);
  sun.castShadow = true;
  sun.shadow.mapSize.set(
    softwareRenderer ? 1024 : 2048,
    softwareRenderer ? 1024 : 2048,
  );
  sun.shadow.camera.left = -58;
  sun.shadow.camera.right = 58;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -42;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 125;
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00015;
  sun.shadow.radius = 3;
  sun.target.position.set(0, 0, -1);
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight("#dbe6eb", 0.7);
  fill.position.set(28, 15, -30);
  scene.add(fill);
  const world = new THREE.Group();
  scene.add(world);
  const staticRoot = new THREE.Group();
  const obstacles = [];
  const stallCanopies = new Map();
  world.add(staticRoot);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1),
    sphereGeo = new THREE.SphereGeometry(1, 9, 6),
    icoGeo = new THREE.IcosahedronGeometry(1, 1);
  const leafGeo = new THREE.SphereGeometry(1, 6, 4);
  function mat(color, extra = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.87, ...extra });
  }
  function mesh(geo, material, parent = staticRoot) {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(x, y, z, w, h, d, material, parent = staticRoot) {
    const m = mesh(boxGeo, material, parent);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    return m;
  }
  function ball(
    x,
    y,
    z,
    w,
    h,
    d,
    material,
    parent = staticRoot,
    geo = sphereGeo,
  ) {
    const m = mesh(geo, material, parent);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    return m;
  }
  function rod(a, b, r, material, parent = staticRoot, r2 = r) {
    const g = new THREE.CylinderGeometry(r2, r, a.distanceTo(b), 7);
    const m = mesh(g, material, parent);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
    return m;
  }
  function tube(points, r, material, parent = staticRoot, segments = 24) {
    return mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        segments,
        r,
        6,
        false,
      ),
      material,
      parent,
    );
  }
  function texture(draw, w = 512, h = 512) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    draw(ctx, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  const groundTex = texture((c, w, h) => {
    c.fillStyle = "#bdb08a";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 22000; i++) {
      c.fillStyle = pick(["#928e64", "#d6c49b", "#c7bd99", "#9a9c74"]);
      c.globalAlpha = range(0.08, 0.3);
      c.fillRect(random() * w, random() * h, range(1, 4), range(1, 4));
    }
    c.globalAlpha = 1;
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(13, 7);
  const wallTex = texture((c, w, h) => {
    c.fillStyle = "#88877b";
    c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 24)
      for (let x = -48; x < w; x += 64) {
        const xx = x + ((y / 24) % 2) * 32;
        c.fillStyle = `hsl(42 7% ${range(43, 57)}%)`;
        c.fillRect(xx + 1, y + 1, 62, 22);
        c.strokeStyle = "#6a6a60";
        c.lineWidth = 1;
        c.strokeRect(xx + 1, y + 1, 62, 22);
      }
    for (let i = 0; i < 2000; i++) {
      c.fillStyle = "#d5c6a433";
      c.fillRect(random() * w, random() * h, range(1, 3), range(1, 3));
    }
  });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(2, 1);
  const atlas = (await new THREE.TextureLoader().loadAsync(materialAtlasURL))
    .image;
  function atlasTile(x, y) {
    const t = texture(
      (c, w, h) =>
        c.drawImage(
          atlas,
          (x * atlas.width) / 2,
          (y * atlas.height) / 2,
          atlas.width / 2,
          atlas.height / 2,
          0,
          0,
          w,
          h,
        ),
      1024,
      1024,
    );
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  const woodTex = atlasTile(0, 0),
    roofTex = atlasTile(1, 0),
    soilTex = atlasTile(0, 1),
    foliageTex = atlasTile(1, 1);
  soilTex.repeat.set(22, 12);
  const M = {
    ground: mat("#c8cbb2", { map: soilTex }),
    path: mat("#ffffff", { map: groundTex }),
    shore: mat("#a69973"),
    stone: mat("#b9b09a"),
    wood: mat("#ffffff", { map: woodTex, bumpMap: woodTex, bumpScale: 0.035 }),
    darkWood: mat("#493725"),
    lightWood: mat("#9d7548"),
    beam: mat("#67472e"),
    plaster: mat("#c8bb9c"),
    dark: mat("#342c21"),
    roof: mat("#d0d0c8", { map: roofTex, bumpMap: roofTex, bumpScale: 0.065 }),
    ridge: mat("#63665d"),
    tileEdge: mat("#62665d"),
    brick: mat("#ffffff", { map: wallTex }),
    terracotta: mat("#925b3d"),
    linen: mat("#c7aa73", { side: THREE.DoubleSide }),
    red: mat("#8f3828"),
    green: mat("#536043"),
    bamboo: mat("#9b8756"),
    leaf: [],
  };
  const timberTex = woodTex.clone();
  timberTex.center.set(0.5, 0.5);
  timberTex.rotation = Math.PI / 2;
  for (const [name, color] of [
    ["darkWood", "#958570"],
    ["beam", "#d8bd97"],
    ["lightWood", "#fff0cc"],
  ]) {
    M[name].map = timberTex;
    M[name].bumpMap = timberTex;
    M[name].bumpScale = 0.018;
    M[name].color.set(color);
  }
  M.plaster.bumpMap = groundTex;
  M.plaster.bumpScale = 0.015;
  const humanModel = createHumanModel();
  const clothTexture = texture(
    (c, w, h) => {
      c.fillStyle = "#f5f2e9";
      c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 3)
        for (let x = 0; x < w; x += 2) {
          const shade =
            210 + Math.floor((Math.sin(x * 12.9 + y * 78.2) * 0.5 + 0.5) * 35);
          c.fillStyle = `rgb(${shade},${shade},${shade})`;
          c.fillRect(x, y, 1, 1);
        }
    },
    128,
    128,
  );
  const humanMaterials = {
    cloth: mat("#ffffff", {
      map: clothTexture,
      bumpMap: clothTexture,
      bumpScale: 0.006,
      roughness: 0.96,
      side: THREE.DoubleSide,
    }),
    trim: mat("#c9bca2", { bumpMap: clothTexture, bumpScale: 0.004 }),
    sash: mat("#64594a"),
    skin: mat("#c5a081", { roughness: 0.74 }),
    hair: mat("#2b2823"),
    grey: mat("#b6b2a1"),
    pants: mat("#625c50"),
    shoes: mat("#35332c"),
    hat: M.linen,
    basket: M.bamboo,
  };
  const boatmanCloth = humanMaterials.cloth.clone();
  boatmanCloth.color.set("#68705b");
  for (const color of [
    "#c3c9b2",
    "#d3d6bc",
    "#bbc8ac",
    "#ced4b7",
    "#bccbb0",
    "#d2dbc2",
  ])
    M.leaf.push(
      mat(color, { map: foliageTex, bumpMap: foliageTex, bumpScale: 0.06 }),
    );
  const windUniform = { value: 0 };
  const walkingView = { value: 0 },
    walkingFocus = { value: V() };
  for (const material of Object.values(humanMaterials)) {
    material.onBeforeCompile = shader => {
      shader.uniforms.walkingView=walkingView;shader.uniforms.walkingFocus=walkingFocus;
      shader.vertexShader="varying vec3 personWorld;\n"+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
        vec4 personPoint=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          personPoint=instanceMatrix*personPoint;
        #endif
        personWorld=(modelMatrix*personPoint).xyz;`);
      shader.fragmentShader="uniform float walkingView;\nuniform vec3 walkingFocus;\nvarying vec3 personWorld;\n"+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
        if(walkingView>.5){
          vec3 focus=walkingFocus+vec3(0.,.55,0.);
          vec3 axis=cameraPosition-focus;
          float along=dot(personWorld-focus,axis)/max(dot(axis,axis),.001);
          float radius=length(personWorld-(focus+axis*along));
          if(along>.1&&along<1.1&&radius<.48)discard;
        }`);
    };
    material.customProgramCacheKey=()=>"people-clear-player-view-v1";
  }
  for (const m of M.leaf) {
    m.onBeforeCompile = (s) => {
      s.uniforms.windTime = windUniform;
      s.uniforms.walkingView = walkingView;
      s.uniforms.walkingFocus = walkingFocus;
      s.vertexShader =
        "uniform float windTime;\nvarying vec3 foliageWorld;\n" +
        s.vertexShader;
      s.vertexShader = s.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nfloat sw = max(0.0, position.y-1.8); transformed.x += sin(windTime*0.75+position.x*0.41+position.z*0.37)*min(sw*0.015,0.095);",
      );
      s.vertexShader = s.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nfoliageWorld=(modelMatrix*vec4(transformed,1.0)).xyz;",
      );
      s.fragmentShader =
        "uniform float walkingView;\nuniform vec3 walkingFocus;\nvarying vec3 foliageWorld;\n" +
        s.fragmentShader;
      s.fragmentShader = s.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
      if(walkingView>.5){
        vec3 axis=cameraPosition-walkingFocus;
        float along=dot(foliageWorld-walkingFocus,axis)/max(dot(axis,axis),.001);
        float radius=length(foliageWorld-(walkingFocus+axis*along));
        float clearView=1.0-smoothstep(1.1,1.8,radius);
        float noise=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
        if(along>.02&&along<1.02&&foliageWorld.y>walkingFocus.y-.45&&noise<clearView)discard;
      }`,
      );
    };
    m.customProgramCacheKey = () => "leaves-wind-walking-visibility";
  }

  // Consolidate static geometry by material. This keeps a dense town inexpensive to draw.
  function consolidate(root) {
    root.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert(),
      buckets = new Map(),
      old = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      const n = g.index ? g.toNonIndexed() : g;
      if (g !== n) g.dispose();
      for (const a of Object.keys(n.attributes))
        if (!["position", "normal", "uv"].includes(a)) n.deleteAttribute(a);
      if (!n.attributes.uv)
        n.setAttribute(
          "uv",
          new THREE.BufferAttribute(
            new Float32Array(n.attributes.position.count * 2),
            2,
          ),
        );
      if (!buckets.has(o.material)) buckets.set(o.material, []);
      buckets.get(o.material).push(n);
      old.push(o);
    });
    for (const o of old) o.removeFromParent();
    root.clear();
    for (const [material, geos] of buckets) {
      const g = mergeGeometries(geos, false);
      const m = mesh(g, material, root);
      for (const geo of geos) geo.dispose();
      m.name = "batched-detail";
    }
  }
  function land(north) {
    const p = [],
      uv = [],
      ind = [];
    const N = 120;
    for (let i = 0; i <= N; i++) {
      const x = -40 + (80 * i) / N,
        edge = riverCenter(x) + (north ? -1 : 1) * riverWidth(x);
      for (let j = 0; j <= 8; j++) {
        const z = THREE.MathUtils.lerp(edge, north ? -19.5 : 19.5, j / 8),
          y = 0.46 - Math.exp(-j * 1.2) * 0.21 + Math.sin(x * 1.7 + z) * 0.018;
        p.push(x, y, z);
        uv.push((x + 40) / 80, (z + 20) / 40);
      }
    }
    for (let i = 0; i < N; i++)
      for (let j = 0; j < 8; j++) {
        const a = i * 9 + j;
        ind.push(
          ...(north
            ? [a, a + 9, a + 1, a + 1, a + 9, a + 10]
            : [a, a + 1, a + 9, a + 1, a + 10, a + 9]),
        );
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ind);
    g.computeVertexNormals();
    mesh(g, M.ground);
  }
  land(true);
  land(false);
  function roadPath(side) {
    const p = [],
      uv = [],
      idx = [];
    for (let i = 0; i <= 100; i++) {
      const x = -39 + (78 * i) / 100;
      for (const offset of [0.6, 2.5]) {
        const z = riverCenter(x) + side * (riverWidth(x) + offset);
        p.push(x, 0.487, z);
        uv.push((x + 40) / 80, (z + 20) / 40);
      }
    }
    for (let i = 0; i < 100; i++) {
      const a = i * 2;
      idx.push(
        ...(side > 0
          ? [a, a + 1, a + 2, a + 1, a + 3, a + 2]
          : [a, a + 2, a + 1, a + 1, a + 2, a + 3]),
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    mesh(g, M.path);
  }
  roadPath(-1);
  roadPath(1);
  const marketPatch = new THREE.Shape();
  marketPatch.moveTo(-21, 7.1);
  marketPatch.lineTo(7, 7.2);
  marketPatch.quadraticCurveTo(10, 11.5, 5, 15.5);
  marketPatch.lineTo(-19, 15.4);
  marketPatch.quadraticCurveTo(-23, 12, -21, 7.1);
  const plaza = new THREE.ShapeGeometry(marketPatch, 18);
  plaza.rotateX(-Math.PI / 2);
  plaza.translate(0, 0.486, 0);
  plaza.scale(1, 1, -1);
  plaza.computeVertexNormals();
  for (let i = 0; i < plaza.attributes.uv.count; i++)
    plaza.attributes.uv.setXY(
      i,
      (plaza.attributes.position.getX(i) + 40) / 80,
      (plaza.attributes.position.getZ(i) + 20) / 40,
    );
  mesh(plaza, M.path).material.side = THREE.DoubleSide;
  for (let i = 0; i < plaza.index.count; i += 3) {
    const a = plaza.index.getX(i + 1);
    plaza.index.setX(i + 1, plaza.index.getX(i + 2));
    plaza.index.setX(i + 2, a);
  }
  plaza.computeVertexNormals();
  const paperTex = texture(
    (c, w, h) => {
      c.fillStyle = "#e3d2ac";
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 35000; i++) {
        c.fillStyle = pick(["#79633913", "#fff9da22", "#a37f491b"]);
        c.fillRect(random() * w, random() * h, range(1, 3), range(0.3, 2));
      }
      c.strokeStyle = "#b99d6555";
      c.lineWidth = 1;
      c.strokeRect(15, 15, w - 30, h - 30);
      c.strokeRect(20, 20, w - 40, h - 40);
      c.globalAlpha = 0.22;
      c.strokeStyle = "#998452";
      for (let i = 0; i < 70; i++) {
        let x = random() * w,
          y = random() * h;
        c.beginPath();
        c.moveTo(x, y);
        for (let j = 0; j < 6; j++) {
          x += range(-25, 25);
          y += range(-8, 8);
          c.lineTo(x, y);
        }
        c.stroke();
      }
      c.globalAlpha = 0.35;
      c.fillStyle = "#725a35";
      c.font = "24px serif";
      c.fillText("清 明 上 河", w * 0.39, h - 25);
    },
    2048,
    1024,
  );
  const paperMat = mat("#ffffff", { map: paperTex, side: THREE.DoubleSide });
  const pg = new THREE.PlaneGeometry(88, 44, 132, 44);
  pg.rotateX(-Math.PI / 2);
  const pa = pg.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i),
      z = pa.getZ(i);
    pa.setY(
      i,
      -0.1 +
        Math.pow(Math.max(0, Math.abs(x) - 39), 2) * 0.09 +
        Math.pow(Math.max(0, Math.abs(z) - 19), 2) * 0.015 +
        Math.sin(x * 0.23 + z * 0.22) * 0.025,
    );
  }
  pg.computeVertexNormals();
  mesh(pg, paperMat);
  for (const x of [-44.2, 44.2]) {
    const m = mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 44.8, 28),
      M.lightWood,
    );
    m.rotation.x = Math.PI / 2;
    m.position.set(x, 0.9, 0);
    for (const z of [-22.7, 22.7]) {
      const cap = mesh(
        new THREE.CylinderGeometry(0.65, 0.65, 0.35, 20),
        M.darkWood,
      );
      cap.rotation.x = Math.PI / 2;
      cap.position.set(x, 0.9, z);
    }
  }
  const table = mesh(new THREE.PlaneGeometry(700, 700), mat("#cfc6b6"));
  table.rotation.x = -Math.PI / 2;
  table.position.y = -1.0;
  // Earthen banks and scattered stones give the river a physical boundary.
  for (let i = 0; i < 400; i++) {
    const x = range(-39.8, 39.8),
      s = random() < 0.5 ? -1 : 1,
      z = riverCenter(x) + s * (riverWidth(x) + range(-0.04, 0.23));
    ball(
      x,
      0.24,
      z,
      range(0.13, 0.45),
      range(0.12, 0.26),
      range(0.12, 0.31),
      pick([M.shore, M.stone, M.ground]),
      staticRoot,
      icoGeo,
    );
  }
  for (let i = 0; i < 180; i++) {
    const x = range(-39, 39),
      z = range(-19, 19);
    if (Math.abs(z - riverCenter(x)) < riverWidth(x) + 1) continue;
    ball(
      x,
      0.49,
      z,
      range(0.03, 0.12),
      0.025,
      range(0.03, 0.1),
      M.stone,
      staticRoot,
      icoGeo,
    );
  }

  // Curved tiled hip roofs: the geometry and all four facades remain real from the rear.
  function roofHeight(x, z, w, d, h) {
    const t = Math.max(
      0,
      Math.min(1 - Math.abs(z) / (d / 2), (w / 2 - Math.abs(x)) / (d * 0.47)),
    );
    return (
      h * Math.pow(t, 1.45) +
      0.25 *
        Math.pow(Math.abs(x) / (w / 2), 8) *
        Math.pow(Math.abs(z) / (d / 2), 4)
    );
  }
  function roof(parent, w, d, h, y, material = M.roof) {
    const positions = [],
      uv = [],
      idx = [],
      nx = 24,
      nz = 16;
    for (let j = 0; j <= nz; j++)
      for (let i = 0; i <= nx; i++) {
        const x = (i / nx - 0.5) * w,
          z = (j / nz - 0.5) * d;
        positions.push(x, y + roofHeight(x, z, w, d, h), z);
        uv.push(x / 2.56, z / 3.8);
      }
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    mesh(geo, material, parent).material.side = THREE.DoubleSide;
    const ridgeLen = Math.max(0.3, w - d * 0.94);
    rod(
      V(-ridgeLen / 2, y + h + 0.05, 0),
      V(ridgeLen / 2, y + h + 0.05, 0),
      0.085,
      M.ridge,
      parent,
    );
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const points = [];
        for (let i = 0; i <= 7; i++) {
          const t = i / 7,
            x = sx * (ridgeLen / 2 + (w / 2 - ridgeLen / 2) * t),
            z = ((sz * d) / 2) * t;
          points.push(V(x, y + roofHeight(x, z, w, d, h) + 0.04, z));
        }
        tube(points, 0.055, M.ridge, parent, 10);
      }
    // Raised tile seams catch the low sun instead of relying only on a flat texture.
    for (let x = -w / 2 + 0.13; x < w / 2; x += 0.32)
      for (const side of [-1, 1]) {
        const points = [];
        for (let j = 0; j <= 7; j++) {
          const z = side * (0.02 + ((d / 2 - 0.02) * j) / 7);
          points.push(V(x, y + roofHeight(x, z, w, d, h) + 0.035, z));
        }
        tube(points, 0.027, M.tileEdge, parent, 8);
      }
    for (const side of [-1, 1])
      rod(
        V(-w / 2, y + 0.06, (side * d) / 2),
        V(w / 2, y + 0.06, (side * d) / 2),
        0.075,
        M.darkWood,
        parent,
      );
  }
  const signMaterials = new Map();
  function signMaterial(text, bg = "#443a2a", fg = "#e3cfa4") {
    const key = text + bg;
    if (signMaterials.has(key)) return signMaterials.get(key);
    const t = texture(
      (c, w, h) => {
        c.fillStyle = bg;
        c.fillRect(0, 0, w, h);
        c.strokeStyle = fg;
        c.lineWidth = 4;
        c.strokeRect(7, 7, w - 14, h - 14);
        c.fillStyle = fg;
        c.font = 'bold 69px "Noto Serif CJK SC",serif';
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(text, w / 2, h / 2 + 4);
      },
      256,
      128,
    );
    const m = mat("#ffffff", { map: t });
    signMaterials.set(key, m);
    return m;
  }
  function building(x, z, w = 5.3, d = 3.6, stories = 1, angle = 0, name = "") {
    obstacles.push({
      x,
      z,
      w: w + 0.3,
      d: d + 0.3,
      angle,
      kind: "rect",
      source: "building",
    });
    const g = new THREE.Group();
    staticRoot.add(g);
    g.position.set(x, 0.5, z);
    g.rotation.y = angle;
    const h = stories * 1.9 + 0.35;
    box(0, 0.05, 0, w + 0.36, 0.18, d + 0.3, M.stone, g);
    box(0, h / 2, 0, w, h, d, M.plaster, g);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        box(
          sx * (w / 2 - 0.08),
          h / 2,
          sz * (d / 2 + 0.02),
          0.14,
          h + 0.15,
          0.15,
          M.beam,
          g,
        );
    for (const side of [-1, 1]) {
      const frontZ = side * (d / 2 + 0.025);
      box(0, 0.18, frontZ, w, 0.16, 0.12, M.darkWood, g);
      box(0, h - 0.08, frontZ, w, 0.16, 0.14, M.beam, g);
      for (let k = 0; k < stories; k++) {
        const yy = k * 1.9 + 0.8;
        for (let j = 0; j < Math.round(w / 1.3); j++) {
          const xx = -w / 2 + 0.65 + j * 1.3;
          box(xx, yy, frontZ + side * 0.025, 0.9, 1.12, 0.08, M.dark, g);
          for (let a = -0.34; a < 0.4; a += 0.17)
            box(
              xx + a,
              yy,
              frontZ + side * 0.08,
              0.045,
              1.1,
              0.055,
              M.lightWood,
              g,
            );
          box(xx, yy, frontZ + side * 0.08, 0.91, 0.045, 0.055, M.lightWood, g);
        }
        box(0, k * 1.9 + 0.25, frontZ, w, 0.09, 0.12, M.beam, g);
      }
    }
    for (const sx of [-1, 1]) {
      for (let j = 0; j < 3; j++)
        box(
          sx * (w / 2 + 0.025),
          h * 0.55,
          -d * 0.3 + j * d * 0.3,
          0.06,
          0.8,
          0.55,
          M.darkWood,
          g,
        );
      box(sx * (w / 2 + 0.035), h / 2, 0, 0.1, 0.1, d, M.beam, g);
    }
    if (stories === 2) {
      box(0, 1.95, d / 2 + 0.35, w + 0.1, 0.12, 0.8, M.wood, g);
      for (let j = 0; j < 8; j++)
        box(
          -w / 2 + (j * w) / 7,
          2.27,
          d / 2 + 0.7,
          0.065,
          0.56,
          0.065,
          M.beam,
          g,
        );
      box(0, 2.54, d / 2 + 0.7, w, 0.06, 0.07, M.lightWood, g);
      roof(g, w + 0.7, d + 0.65, 0.65, 1.82);
    }
    roof(g, w + 0.85, d + 0.9, Math.min(1.6, d * 0.38), h + 0.05);
    for (let xx = -w / 2 + 0.3; xx < w / 2; xx += 0.65)
      for (const side of [-1, 1]) {
        box(
          xx,
          h - 0.13,
          side * (d / 2 + 0.13),
          0.18,
          0.22,
          0.5,
          M.lightWood,
          g,
        );
        box(xx, h - 0.29, side * (d / 2 + 0.04), 0.32, 0.1, 0.28, M.beam, g);
      }
    if (name)
      box(
        0,
        h - 0.55,
        d / 2 + 0.14,
        Math.min(1.8, w * 0.42),
        0.62,
        0.09,
        signMaterial(name),
        g,
      );
    return g;
  }

  // North-bank waterfront, rear streets and actual courtyard backs.
  for (const p of [
    [-30, -10.6, 5.2, 3.9, 1, "茶肆"],
    [-23.8, -10.5, 5.5, 4.2, 1, "酒"],
    [-17.2, -10.1, 5.4, 3.8, 2, "客舍"],
    [-10.8, -10.5, 4.5, 3.8, 1, "布庄"],
    [3.6, -9.6, 5.5, 3.7, 2, "茶"],
    [23.1, -10.2, 5.5, 3.8, 2, "酒楼"],
    [30, -10.4, 6, 3.8, 2, "香药"],
    [36.1, -10.8, 4.6, 3.6, 1, "绸缎"],
  ])
    building(p[0], p[1], p[2], p[3], p[4], range(-0.035, 0.035), p[5]);
  for (const p of [
    [-33, -16.9, 5, 3],
    [-25.6, -17, 5.7, 3.4],
    [-17.6, -16.5, 5.9, 3.9],
    [-8.7, -16.8, 5.2, 3.5],
    [0.1, -16.3, 5.8, 3.8],
    [7, -17.1, 4.3, 3.1],
    [23.8, -17.1, 4.6, 3],
  ])
    building(p[0], p[1], p[2], p[3], 1, Math.PI, "");
  // Foreground residences frame rather than obstruct the bridge approach.
  for (const p of [
    [-28.5, 16.9, 6.5, 3.8],
    [-20.6, 17.1, 5.8, 3.6],
    [10.3, 17.1, 6.3, 3.6],
    [18.2, 16.7, 5.6, 3.9],
    [33.5, 16.8, 7.2, 3.7],
  ])
    building(p[0], p[1], p[2], p[3], 1, Math.PI + range(-0.07, 0.07));
  for (const x of [-34, -28, -21, -14, 2, 25, 32]) {
    obstacles.push({
      kind: "rect",
      source: "courtyard-wall",
      x,
      z: -14.3,
      w: 3.8,
      d: 0.28,
    });
    box(x, 0.95, -14.3, 3.6, 0.85, 0.16, M.plaster);
    box(x, 1.41, -14.3, 3.8, 0.14, 0.28, M.ridge);
  }
  // Low orchard walls on the near bank.
  for (const [x, w] of [
    [-34, 6],
    [18, 4],
    [27, 5],
  ]) {
    obstacles.push({
      kind: "rect",
      source: "orchard-wall",
      x,
      z: 13,
      w: w + 0.4,
      d: 0.5,
    });
    box(x, 1.0, 13, w, 1, 0.25, M.plaster);
    box(x, 1.54, 13, w + 0.2, 0.15, 0.48, M.ridge);
    for (const sx of [-1, 1])
      box(x + (sx * w) / 2, 1, 13, 0.4, 1.2, 0.5, M.brick);
  }

  // A real arch opening, battlements and two-storey gate tower.
  function cityGate() {
    for (const side of [-1, 1]) {
      obstacles.push({
        source: "city-wall",
        x: 14 + side * 3.01,
        z: -11.9,
        w: 3.58,
        d: 2.9,
        kind: "rect",
      });
      obstacles.push({
        source: "city-wall",
        x: 14 + side * 8.2,
        z: -11.9,
        w: 6.8,
        d: 1.8,
        kind: "rect",
      });
    }
    const g = new THREE.Group();
    staticRoot.add(g);
    g.position.set(14, 0.5, -11.9);
    const shape = new THREE.Shape();
    shape.moveTo(-4.8, 0);
    shape.lineTo(4.8, 0);
    shape.lineTo(4.8, 4.6);
    shape.lineTo(-4.8, 4.6);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-1.22, 0);
    hole.lineTo(-1.22, 2.2);
    hole.absarc(0, 2.2, 1.22, Math.PI, 0, true);
    hole.lineTo(1.22, 0);
    hole.closePath();
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 2.9,
      bevelEnabled: false,
      curveSegments: 20,
    });
    const wall = mesh(geo, M.brick, g);
    wall.position.z = -1.45;
    for (const sx of [-1, 1]) {
      box(sx * 8.2, 1.7, 0, 6.8, 3.4, 1.8, M.brick, g);
      for (let i = 0; i < 10; i++)
        box(sx * 5 + i * sx * 0.67, 3.68, 0, 0.38, 0.58, 1.9, M.brick, g);
    }
    for (let i = 0; i < 15; i++)
      box(-4.7 + i * 0.67, 4.85, 0, 0.4, 0.6, 3, M.brick, g);
    for (const side of [-1, 1]) {
      for (let i = 0; i <= 18; i++) {
        const a = (i / 18) * Math.PI;
        const m = box(
          Math.cos(a) * 1.4,
          2.2 + Math.sin(a) * 1.4,
          side * 1.49,
          0.27,
          0.32,
          0.15,
          M.stone,
          g,
        );
        m.rotation.z = a - Math.PI / 2;
      }
      for (const sx of [-1, 1])
        box(sx * 1.4, 1.1, side * 1.5, 0.25, 2.2, 0.16, M.stone, g);
      box(
        0,
        4.05,
        side * 1.53,
        1.7,
        0.48,
        0.08,
        signMaterial("汴京", "#8b7755", "#d7c7a0"),
        g,
      );
    }
    const upper = new THREE.Group();
    g.add(upper);
    upper.position.y = 4.9;
    box(0, 0.85, 0, 6.8, 1.7, 2.6, M.darkWood, upper);
    for (const side of [-1, 1])
      for (let i = 0; i < 7; i++) {
        box(-3 + i, 1.05, side * 1.42, 0.13, 2.05, 0.13, M.red, upper);
        box(-3 + i, 0.7, side * 1.45, 0.75, 0.8, 0.1, M.wood, upper);
      }
    roof(upper, 8.1, 4.4, 1.15, 2);
    box(0, 3.5, 0, 4.9, 1.1, 2.0, M.wood, upper);
    for (let i = 0; i < 6; i++)
      for (const side of [-1, 1])
        box(
          -2.35 + i * 0.94,
          3.55,
          side * 1.04,
          0.1,
          1.1,
          0.1,
          M.darkWood,
          upper,
        );
    roof(upper, 6.8, 3.6, 1.1, 4.05);
    // Rear stairs make the wall physically accessible from inside the town.
    for (let i = 0; i < 16; i++)
      box(7.8 - i * 0.23, 0.12 + i * 0.22, -2.3, 0.4, 0.2, 1.15, M.brick, g);
  }
  cityGate();
  function pagoda() {
    obstacles.push({ x: 32, z: -17.4, radius: 1.7, kind: "circle" });
    const g = new THREE.Group();
    staticRoot.add(g);
    g.position.set(32, 0.5, -17.4);
    const roofMat = mat("#855f43");
    for (let k = 0; k < 7; k++) {
      const r = 1.45 - k * 0.115,
        y = k * 1.38;
      const wall = mesh(
        new THREE.CylinderGeometry(r * 0.91, r, 1.28, 8),
        M.terracotta,
        g,
      );
      wall.position.y = y + 0.65;
      wall.rotation.y = Math.PI / 8;
      for (let j = 0; j < 8; j++) {
        const a = (j / 8) * TAU;
        const win = box(
          Math.sin(a) * (r * 0.94),
          y + 0.7,
          Math.cos(a) * r * 0.94,
          0.32,
          0.55,
          0.065,
          M.dark,
          g,
        );
        win.rotation.y = a;
      }
      const eave = mesh(
        new THREE.CylinderGeometry(r * 0.38, r + 0.45, 0.65, 8),
        roofMat,
        g,
      );
      eave.position.y = y + 1.42;
      eave.rotation.y = Math.PI / 8;
      const rim = mesh(
        new THREE.CylinderGeometry(r + 0.45, r + 0.45, 0.08, 8),
        M.terracotta,
        g,
      );
      rim.position.y = y + 1.12;
      rim.rotation.y = Math.PI / 8;
    }
    rod(V(0, 10.25, 0), V(0, 11.65, 0), 0.06, M.darkWood, g);
    for (let i = 0; i < 5; i++)
      ball(
        0,
        10.5 + i * 0.2,
        0,
        0.16 - i * 0.022,
        0.08,
        0.16 - i * 0.022,
        M.terracotta,
        g,
      );
  }
  pagoda();

  // Rainbow bridge: continuous curved deck and visible interlocking timber ribs.
  const bridgeX = -5,
    bridgeLength = 15.4,
    bridgeWidth = 3.9;
  for (let i = 0; i < 92; i++) {
    const z = -bridgeLength / 2 + ((i + 0.5) * bridgeLength) / 92,
      y = bridgeY(z),
      slope = (bridgeY(z + 0.02) - bridgeY(z - 0.02)) / 0.04;
    const b = box(
      bridgeX,
      y,
      z,
      bridgeWidth,
      0.18,
      bridgeLength / 92 + 0.025,
      i % 5 === 0 ? M.lightWood : M.wood,
    );
    b.rotation.x = -Math.atan(slope);
  }
  for (const x of [-1.75, -1.18, -0.6, 0, 0.6, 1.18, 1.75]) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const z = -7.8 + (15.6 * i) / 24;
      pts.push(V(bridgeX + x, bridgeY(z) - 0.36, z));
    }
    tube(pts, 0.13, M.beam, staticRoot, 36);
  }
  for (const side of [-1, 1]) {
    const x = bridgeX + side * 2.02;
    for (let i = 0; i <= 28; i++) {
      const z = -7.7 + (15.4 * i) / 28,
        y = bridgeY(z);
      rod(V(x, y, z), V(x, y + 1.0, z), 0.065, M.darkWood);
      ball(x, y + 1.05, z, 0.105, 0.09, 0.105, M.lightWood);
      if (i < 28) {
        const zz = z + 15.4 / 28;
        rod(V(x, y + 0.98, z), V(x, bridgeY(zz) + 0.98, zz), 0.06, M.lightWood);
        rod(V(x, y + 0.47, z), V(x, bridgeY(zz) + 0.47, zz), 0.045, M.beam);
      }
    }
    for (let layer = 0; layer < 3; layer++)
      for (let i = 0; i < 6; i++) {
        const z = -7.3 + i * 2.45,
          zz = z + 2.45;
        rod(
          V(x, bridgeY(z) - 0.35 - layer * 0.22, z),
          V(x, bridgeY(zz) - 0.35 - layer * 0.22, zz),
          0.1,
          M.beam,
        );
      }
    for (let i = 0; i < 10; i++) {
      const z = -6.9 + i * 1.5,
        y = bridgeY(z) - 0.5;
      rod(V(x, y, z), V(x, y - 0.65, z + 1.3), 0.075, M.lightWood);
    }
  }
  for (const z of [-7.5, 7.5]) {
    box(bridgeX, 0.6, z, 4.8, 0.65, 1.0, M.brick);
    for (const x of [-1.7, 1.7])
      rod(
        V(bridgeX + x, 0.5, z * 0.75),
        V(bridgeX + x, bridgeY(z * 0.75) - 0.28, z * 0.75),
        0.18,
        M.beam,
      );
  }
  for (let i = 0; i < 12; i++) {
    const z = -6.6 + i * 1.2;
    rod(
      V(bridgeX - 1.95, bridgeY(z) - 0.35, z),
      V(bridgeX + 1.95, bridgeY(z) - 0.35, z),
      0.095,
      M.darkWood,
    );
  }

  // Open market stalls, individual baskets and ceramic vessels.
  const flags = [];
  function vessel(
    x,
    y,
    z,
    r = 0.22,
    parent = staticRoot,
    material = M.terracotta,
  ) {
    parent.updateWorldMatrix(true, false);
    const groundPoint = parent.localToWorld(V(x, y, z));
    if (groundPoint.y < 0.75) {
      const scale = parent.getWorldScale(V());
      obstacles.push({
        kind: "circle",
        source: "vessel",
        x: groundPoint.x,
        z: groundPoint.z,
        radius: r * Math.max(scale.x, scale.z),
      });
    }
    const profile = [
      V(0.09, 0),
      V(0.13, 0.05),
      V(0.25, 0.13),
      V(0.23, 0.32),
      V(0.14, 0.4),
      V(0.14, 0.46),
    ].map((p) => new THREE.Vector2((p.x * r) / 0.25, (p.y * r) / 0.25));
    const m = mesh(new THREE.LatheGeometry(profile, 9), material, parent);
    m.position.set(x, y, z);
    const hole = mesh(new THREE.CircleGeometry(r * 0.52, 9), M.dark, parent);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(x, y + r * 1.85, z);
  }
  const goods = {
    cake: mat("#b88746"),
    bread: mat("#d9c393"),
    fruit: mat("#ba6250"),
    apricot: mat("#ce9852"),
    leaf: mat("#748359"),
    paper: mat("#e8d9b6"),
    pink: mat("#cc7d95"),
  };
  const merchants = [];
  function stall(vendor) {
    const { x, z, w, d, kind } = vendor;
    obstacles.push({
      x,
      z: z + 0.25,
      w: w * 0.9,
      d: d * 0.6,
      kind: "rect",
      source: "stall-table",
    });
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        obstacles.push({
          kind: "circle",
          source: "stall-post",
          x: x + (sx * w) / 2,
          z: z + (sz * d) / 2,
          radius: 0.06,
        });
    const g = new THREE.Group();
    staticRoot.add(g);
    g.position.set(x, 0.5, z);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        rod(
          V((sx * w) / 2, 0, (sz * d) / 2),
          V((sx * w) / 2, 2.2, (sz * d) / 2),
          0.055,
          M.beam,
          g,
        );
    box(0, 0.72, 0.25, w * 0.9, 0.12, d * 0.6, M.wood, g);
    for (const sx of [-1, 1])
      box(sx * w * 0.35, 0.35, 0.25, 0.1, 0.7, d * 0.48, M.beam, g);
    const points = [],
      uv = [],
      idx = [];
    for (let j = 0; j <= 8; j++)
      for (let i = 0; i <= 12; i++) {
        const xx = (i / 12 - 0.5) * (w + 0.4),
          zz = (j / 8 - 0.5) * (d + 0.5);
        points.push(
          xx,
          2.18 +
            Math.cos((i / 12) * Math.PI * 2) * -0.13 -
            Math.cos((j / 8) * Math.PI * 2) * 0.08,
          zz,
        );
        uv.push(i / 12, j / 8);
      }
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 12; i++) {
        const a = j * 13 + i;
        idx.push(a, a + 13, a + 1, a + 1, a + 13, a + 14);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const canopy = mesh(
      geo,
      mat(vendor.color, { side: THREE.DoubleSide, transparent: true }),
      world,
    );
    canopy.position.copy(g.position);
    stallCanopies.set(vendor.id, canopy);
    box(
      0,
      1.83,
      d * 0.5 + 0.13,
      1.4,
      0.34,
      0.06,
      signMaterial(vendor.category),
      g,
    );
    for (let i = 0; i < 10; i++) {
      const xx = range(-w * 0.42, w * 0.42),
        zz = range(-d * 0.23, d * 0.4);
      const radius = range(0.12, 0.22),
        potMaterial = pick([M.terracotta, M.linen, M.green]);
      const top = 0.8,
        zzFront = zz * 0.5 + 0.18;
      if (kind === "flowers") {
        vessel(xx, top, zzFront, radius * 0.64, g, M.terracotta);
        const bouquet = makeToy(i % 3 === 0 ? "peony" : "begonia");
        bouquet.root.position.set(xx, top + radius * 1.0, zzFront);
        bouquet.root.scale.setScalar(0.8);
        g.add(bouquet.root);
      } else if (kind === "toys") {
        if (i > 5) continue;
        const toy = makeToy(["rattle", "dragonfly", "kite"][i % 3]);
        toy.root.position.set(xx, top + 0.05, zzFront);
        toy.root.scale.setScalar(0.8);
        toy.root.rotation.y = i * 0.45;
        g.add(toy.root);
      } else if (kind === "books") {
        box(xx, top + 0.025, zzFront, 0.4, 0.04, 0.28, goods.paper, g);
        box(xx, top + 0.05, zzFront, 0.26, 0.006, 0.012, M.darkWood, g);
        if (i % 2 === 0) {
          const scroll = mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8),
            M.linen,
            g,
          );
          scroll.rotation.z = Math.PI / 2;
          scroll.position.set(xx, top + 0.06, zzFront + 0.12);
        }
      } else if (kind === "cakes" || kind === "buns") {
        const plate = mesh(
          new THREE.CylinderGeometry(radius * 1.15, radius * 1.15, 0.035, 10),
          M.bamboo,
          g,
        );
        plate.position.set(xx, top, zzFront);
        for (let q = 0; q < 3; q++)
          ball(
            xx + (q - 1) * 0.07,
            top + 0.07 + (q === 1 ? 0.04 : 0),
            zzFront,
            0.08,
            kind === "buns" ? 0.075 : 0.035,
            0.075,
            kind === "buns" ? goods.bread : goods.cake,
            g,
          );
      } else if (kind === "fruit") {
        vessel(xx, top, zzFront, radius * 0.75, g, M.bamboo);
        for (let q = 0; q < 3; q++)
          ball(
            xx + (q - 1) * 0.06,
            top + 0.15 + (q === 1 ? 0.04 : 0),
            zzFront,
            0.07,
            0.07,
            0.065,
            i % 2 ? goods.fruit : goods.apricot,
            g,
          );
      } else if (kind === "scents") {
        ball(
          xx,
          top + 0.07,
          zzFront,
          0.1,
          0.08,
          0.07,
          i % 2 ? M.red : goods.leaf,
          g,
        );
        rod(
          V(xx - 0.04, top + 0.08, zzFront),
          V(xx + 0.04, top + 0.12, zzFront),
          0.008,
          M.linen,
          g,
        );
      } else vessel(xx, top, zzFront, radius * 0.6, g, potMaterial);
    }
    for (let i = 0; i < 4; i++)
      vessel(
        range(-w * 0.6, w * 0.6),
        0,
        -d * 0.65 - range(0, 0.3),
        range(0.21, 0.33),
        g,
        M.bamboo,
      );
    const merchant = new THREE.Group();
    merchant.position.set(0, 0.02, -d * 0.45);
    g.add(merchant);
    const shirt = humanMaterials.cloth.clone();
    shirt.color.set(vendor.color);
    const profile = {
      shortCoat: true,
      gender: ["cakes", "flowers", "scents"].includes(vendor.id) ? "female" : "male",
      age: ["tea", "fruit"].includes(vendor.id) ? "elder" : "adult",
      phase: merchants.length * 1.7,
    }, pieces = {};
    humanModel.pose(
      0,
      profile,
      (name, matrix) => {
        if (!matrix.determinant()) return;
        const spec = humanModel.specs[name],
          m = mesh(
            spec.geometry,
            spec.material === "cloth" ? shirt : humanMaterials[spec.material],
            merchant,
          );
        m.matrixAutoUpdate = false;
        m.matrix.copy(matrix);
        pieces[name] = m;
      },
    );
    merchants.push({profile,pieces});
  }
  for (const vendor of VENDORS) stall(vendor);
  function umbrella(x, z, r = 1.3) {
    obstacles.push({
      kind: "circle",
      source: "umbrella-post",
      x,
      z,
      radius: 0.07,
    });
    rod(V(x, 0.5, z), V(x, 2.8, z), 0.055, M.darkWood);
    const top = mesh(new THREE.ConeGeometry(r, 0.55, 12, 1, true), M.linen);
    top.position.set(x, 2.62, z);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      rod(
        V(x, 2.9, z),
        V(x + Math.cos(a) * r, 2.35, z + Math.sin(a) * r),
        0.018,
        M.lightWood,
      );
    }
  }
  umbrella(-1.3, 7.9);
  umbrella(18.1, -6.1, 1.1);
  umbrella(-18.5, 6.6, 0.95);
  for (let i = 0; i < 22; i++) {
    const x = range(-17, 6),
      z = range(10.7, 14.4);
    if (x > -7 && x < -2) continue;
    vessel(
      x,
      0.5,
      z,
      range(0.14, 0.27),
      staticRoot,
      pick([M.terracotta, M.bamboo]),
    );
  }
  for (const [x, z, text] of [
    [-8.1, 9.8, "茶"],
    [-18.1, -6.9, "酒"],
    [26.3, -7.5, "食"],
  ]) {
    obstacles.push({ kind: "circle", source: "sign-post", x, z, radius: 0.06 });
    rod(V(x, 0.5, z), V(x, 4.1, z), 0.055, M.darkWood);
    rod(V(x, 3.9, z), V(x + 0.8, 3.9, z), 0.035, M.darkWood);
    const f = mesh(
      new THREE.PlaneGeometry(0.65, 1.8, 6, 12),
      signMaterial(text, "#9b422e", "#e0c38c"),
      world,
    );
    f.material.side = THREE.DoubleSide;
    f.position.set(x + 0.42, 2.9, z);
    flags.push({
      mesh: f,
      base: Float32Array.from(f.geometry.attributes.position.array),
      phase: random() * TAU,
    });
  }

  // Branches and small overlapping leaf clusters, not billboard trees.
  function tree(x, z, size = 1, willow = false) {
    if (Math.abs(z - riverCenter(x)) < riverWidth(x) + 0.45)
      z =
        riverCenter(x) + Math.sign(z - riverCenter(x)) * (riverWidth(x) + 0.45);
    const y = 0.48,
      h = range(2.5, 3.7) * size;
    obstacles.push({ kind: "circle", x, z, radius: 0.17 * size });
    const trunkTop = V(x + size * 0.25, y + h, z);
    rod(V(x, y, z), trunkTop, 0.17 * size, M.darkWood, staticRoot, 0.1 * size);
    if (willow) {
      for (let j = 0; j < 9; j++) {
        const a = (j / 9) * TAU,
          tip = V(
            x + Math.cos(a) * size * 1.55,
            y + h + range(-0.1, 0.45) * size,
            z + Math.sin(a) * size * 1.55,
          );
        tube(
          [
            V(x, y + h * 0.63, z),
            trunkTop
              .clone()
              .add(
                V(
                  Math.cos(a) * size * 0.7,
                  size * 0.5,
                  Math.sin(a) * size * 0.7,
                ),
              ),
            tip,
          ],
          0.045 * size,
          M.beam,
          staticRoot,
          9,
        );
        for (let k = 0; k < 3; k++) {
          const end = tip
            .clone()
            .add(V(range(-0.4, 0.4) * size, 0, range(-0.4, 0.4) * size));
          for (let q = 0; q < 13; q++) {
            const t = q / 12,
              xx = end.x + Math.sin(t * Math.PI) * Math.cos(a) * size * 0.48,
              zz = end.z + Math.sin(t * Math.PI) * Math.sin(a) * size * 0.48;
            ball(
              xx,
              end.y - t * h * 0.7,
              zz,
              0.14 * size,
              0.26 * size,
              0.1 * size,
              pick(M.leaf.slice(1)),
              staticRoot,
              leafGeo,
            );
          }
        }
      }
      return;
    }
    for (let j = 0; j < 7; j++) {
      const a = (j / 7) * TAU + range(-0.3, 0.3),
        tip = V(
          x + Math.cos(a) * size * range(0.9, 1.7),
          y + h + range(-0.5, 0.5) * size,
          z + Math.sin(a) * size * range(0.8, 1.6),
        );
      rod(
        V(x + 0.12 * size, y + h * 0.6, z),
        tip,
        0.065 * size,
        M.darkWood,
        staticRoot,
        0.025 * size,
      );
      for (let k = 0; k < 13; k++) {
        const point = tip
          .clone()
          .add(
            V(
              range(-0.75, 0.75),
              range(-0.2, 0.65),
              range(-0.7, 0.7),
            ).multiplyScalar(size),
          );
        ball(
          point.x,
          point.y,
          point.z,
          range(0.3, 0.57) * size,
          range(0.2, 0.4) * size,
          range(0.3, 0.55) * size,
          pick(M.leaf),
          staticRoot,
          leafGeo,
        );
      }
    }
  }
  for (const [x, z, s, w] of [
    [-36, 10, 1.05, 0],
    [-26, 6.5, 1, 0],
    [-20, 14.3, 1.1, 0],
    [-32, -6.7, 1, 1],
    [-29, -15, 0.9, 0],
    [-19, -15, 0.85, 0],
    [-8, -15.2, 1.2, 0],
    [0.8, -13.7, 1, 0],
    [8.8, -15.4, 1.1, 0],
    [22, -14.4, 1.05, 0],
    [27.8, -16.1, 0.8, 0],
    [37.3, -16.5, 1.0, 1],
    [38, -6.7, 1, 1],
    [25, 9.5, 1.25, 1],
    [29, 12, 1, 0],
    [3, 15.7, 0.8, 0],
    [-36, -16.8, 0.9, 0],
    [-38, 16.8, 1.1, 0],
  ])
    tree(x, z, s, !!w);
  for (let i = 0; i < 25; i++) {
    const x = range(-38, 38),
      z = pick([range(-19, -18), range(18, 19)]);
    tree(x, z, range(0.45, 0.7), false);
  }
  // Tufts and shrubs break up the sandy banks without covering the road.
  for (let i = 0; i < 350; i++) {
    const x = range(-39, 39),
      side = random() < 0.5 ? -1 : 1,
      z = riverCenter(x) + side * (riverWidth(x) + range(0.1, 0.6));
    if (Math.abs(x - bridgeX) < 2.7) continue;
    for (let j = 0; j < 3; j++) {
      const m = mesh(
        new THREE.ConeGeometry(0.035, range(0.16, 0.4), 3),
        pick(M.leaf),
      );
      m.position.set(x + range(-0.12, 0.12), 0.56, z + range(-0.12, 0.12));
      m.rotation.z = range(-0.5, 0.5);
    }
  }
  for (let i = 0; i < 90; i++) {
    const x = range(-39, 39),
      z = range(-19, 19);
    if (
      Math.abs(z - riverCenter(x)) < riverWidth(x) + 3 ||
      Math.abs(x - bridgeX) < 3
    )
      continue;
    ball(x, 0.65, z, 0.3, 0.26, 0.3, pick(M.leaf), staticRoot, icoGeo);
  }

  // Wooden landing stages and their submerged posts.
  for (const [x, side] of [
    [-25, 1],
    [19, -1],
    [31, 1],
  ]) {
    const z = riverCenter(x) + side * (riverWidth(x) - 0.55);
    for (let j = 0; j < 14; j++)
      box(x - 1.8 + j * 0.27, 0.4, z, 0.25, 0.12, 1.9, M.wood);
    for (const xx of [-1.6, 1.6])
      for (const zz of [-0.7, 0.7])
        rod(V(x + xx, -0.5, z + zz), V(x + xx, 0.95, z + zz), 0.08, M.darkWood);
  }

  // Sculpted wooden hulls: tapered bow/stern, bent ribs and woven bamboo covers.
  const canopyTex = texture(
    (c, w, h) => {
      c.fillStyle = "#ab8852";
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < w; i += 6) {
        c.fillStyle = i % 12 === 0 ? "#d9b577" : "#785932";
        c.fillRect(i, 0, 2, h);
      }
      for (let y = 0; y < h; y += 25) {
        c.fillStyle = "#62452d";
        c.fillRect(0, y, w, 3);
      }
      for (let i = 0; i < 3000; i++) {
        c.fillStyle = "#d5ad6a33";
        c.fillRect(random() * w, random() * h, 1, 4);
      }
    },
    512,
    256,
  );
  canopyTex.wrapS = canopyTex.wrapT = THREE.RepeatWrapping;
  const canopyMat = mat("#ffffff", { map: canopyTex, side: THREE.DoubleSide }),
    boats = [];
  function boat(length, width, x, lane, speed, mast = false) {
    const g = new THREE.Group();
    world.add(g);
    const n = 28,
      m = 10,
      p = [],
      uv = [],
      idx = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n,
        xx = (u - 0.5) * length,
        shape = Math.pow(Math.sin(Math.PI * u), 0.58);
      for (let j = 0; j <= m; j++) {
        const a = (j / m) * Math.PI,
          zz = Math.cos(a) * width * 0.5 * shape,
          yy =
            0.5 -
            0.64 * Math.sin(a) +
            0.47 * Math.pow(Math.abs(u - 0.5) * 2, 5);
        p.push(xx, yy, zz);
        uv.push(u * 4, j / m);
      }
    }
    for (let i = 0; i < n; i++)
      for (let j = 0; j < m; j++) {
        const a = i * (m + 1) + j;
        idx.push(a, a + 1, a + m + 1, a + 1, a + m + 2, a + m + 1);
      }
    const hull = new THREE.BufferGeometry();
    hull.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    hull.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    hull.setIndex(idx);
    hull.computeVertexNormals();
    mesh(hull, M.wood, g).material.side = THREE.DoubleSide;
    for (const side of [-1, 1]) {
      const points = [];
      for (let i = 0; i <= 28; i++) {
        const u = i / 28;
        points.push(
          V(
            (u - 0.5) * length,
            0.53 + 0.47 * Math.pow(Math.abs(u - 0.5) * 2, 5),
            side * width * 0.5 * Math.pow(Math.sin(Math.PI * u), 0.58),
          ),
        );
      }
      tube(points, 0.055, M.darkWood, g, 28);
    }
    box(0, 0.05, 0, length * 0.7, 0.09, width * 0.57, M.darkWood, g);
    for (let i = 0; i < 20; i++)
      box(
        (i / 19 - 0.5) * length * 0.76,
        0.12,
        0,
        (length * 0.76) / 20 - 0.015,
        0.05,
        width * 0.66,
        M.lightWood,
        g,
      );
    const coverLen = length * 0.53,
      coverR = width * 0.43,
      coverP = [],
      coverUV = [],
      coverI = [];
    for (let i = 0; i <= 12; i++)
      for (let j = 0; j <= 20; j++) {
        const a = (j / 20) * Math.PI;
        coverP.push(
          (i / 12 - 0.5) * coverLen,
          0.46 + Math.sin(a) * coverR,
          Math.cos(a) * coverR,
        );
        coverUV.push((i / 12) * 2, j / 20);
      }
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 20; j++) {
        const a = i * 21 + j;
        coverI.push(a, a + 21, a + 1, a + 1, a + 21, a + 22);
      }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute("position", new THREE.Float32BufferAttribute(coverP, 3));
    cg.setAttribute("uv", new THREE.Float32BufferAttribute(coverUV, 2));
    cg.setIndex(coverI);
    cg.computeVertexNormals();
    mesh(cg, canopyMat, g);
    for (let k = 0; k < 8; k++) {
      const xx = (k / 7 - 0.5) * coverLen,
        pts = [];
      for (let j = 0; j <= 16; j++) {
        const a = (j / 16) * Math.PI;
        pts.push(
          V(
            xx,
            0.46 + Math.sin(a) * (coverR + 0.025),
            Math.cos(a) * (coverR + 0.025),
          ),
        );
      }
      tube(pts, 0.025, M.darkWood, g, 16);
    }
    // Boatmen use the same anatomical model as the crowd, with both hands on the oar.
    const px = length * 0.34;
    const figure = new THREE.Group();
    figure.position.set(px, 0.14, 0);
    figure.rotation.y = 0.7;
    g.add(figure);
    figure.updateMatrix();
    const grips = {};
    humanModel.pose(
      0,
      {
        rower: true,
        hat: true,
        shortCoat: true,
        gender: x === -24 ? "female" : "male",
      },
      (name, matrix) => {
        if (matrix.determinant() === 0) return;
        const spec = humanModel.specs[name],
          m = mesh(
            spec.geometry,
            spec.material === "cloth"
              ? boatmanCloth
              : humanMaterials[spec.material],
            figure,
          );
        m.matrixAutoUpdate = false;
        m.matrix.copy(matrix);
        if (name === "handL" || name === "handR")
          grips[name] = new THREE.Vector3()
            .setFromMatrixPosition(matrix)
            .applyMatrix4(figure.matrix);
      },
    );
    const oarDirection = grips.handR.clone().sub(grips.handL).normalize();
    const oarEnd = grips.handR.clone().addScaledVector(oarDirection, 2.4);
    rod(
      grips.handL.clone().addScaledVector(oarDirection, -0.6),
      oarEnd,
      0.023,
      M.lightWood,
      g,
    );
    const blade = ball(
      oarEnd.x,
      oarEnd.y,
      oarEnd.z,
      0.08,
      0.025,
      0.25,
      M.wood,
      g,
    );
    blade.rotation.y = 0.7;
    if (mast) {
      rod(
        V(-length * 0.27, 0.25, 0),
        V(-length * 0.27, 3.0, 0),
        0.04,
        M.darkWood,
        g,
      );
      tube(
        [
          V(-length * 0.48, 0.8, 0),
          V(-length * 0.27, 2.9, 0),
          V(length * 0.45, 0.8, 0),
        ],
        0.012,
        M.linen,
        g,
        2,
      );
    }
    consolidate(g);
    g.position.set(x, 0.2, riverCenter(x) + lane);
    if (speed < 0) g.rotation.y = Math.PI;
    boats.push({ g, x, lane, speed, phase: random() * TAU, length });
    return g;
  }
  boat(6.8, 1.8, -30, 1.7, 0.24, true);
  boat(6.3, 1.7, -19, -1.7, -0.18);
  boat(7.6, 1.9, 13, 0.75, 0.21);
  boat(5.4, 1.55, 32, -0.9, -0.16);
  boat(6.2, 1.65, -35, -1.1, 0.14);
  boat(6.6, 1.65, 23, 3.8, 0, true);
  boat(5.8, 1.55, -24, 3.8, 0);
  boat(7.3, 1.8, 7, -3.6, 0, true);

  // A small camel caravan on the north-bank quay.
  const caravan = [],
    camelMat = mat("#987044"),
    saddleMat = mat("#8c4330");
  function camel(x) {
    const g = new THREE.Group();
    world.add(g);
    ball(0, 1.12, 0, 0.83, 0.46, 0.32, camelMat, g);
    for (const hx of [-0.26, 0.25])
      ball(hx, 1.55, 0, 0.27, 0.3, 0.25, camelMat, g);
    tube(
      [V(-0.65, 1.2, 0), V(-0.9, 1.7, 0), V(-1, 2.08, 0)],
      0.11,
      camelMat,
      g,
      9,
    );
    ball(-1.12, 2.04, 0, 0.29, 0.14, 0.13, camelMat, g);
    for (const sz of [-1, 1])
      ball(-0.98, 2.17, sz * 0.13, 0.065, 0.12, 0.045, camelMat, g);
    for (const xx of [-0.53, 0.51])
      for (const zz of [-0.21, 0.21]) {
        rod(V(xx, 0.95, zz), V(xx + 0.07, 0.52, zz), 0.065, camelMat, g);
        rod(V(xx + 0.07, 0.52, zz), V(xx - 0.02, 0.12, zz), 0.045, camelMat, g);
        box(xx - 0.05, 0.08, zz, 0.19, 0.12, 0.12, M.darkWood, g);
      }
    tube(
      [V(0.73, 1.28, 0), V(0.94, 0.86, 0), V(1, 0.65, 0)],
      0.035,
      camelMat,
      g,
      8,
    );
    box(0, 1.54, 0, 0.72, 0.1, 0.75, saddleMat, g);
    for (const zz of [-0.35, 0.35]) {
      box(0.05, 1.18, zz, 0.48, 0.48, 0.3, M.linen, g);
      box(0.05, 1.2, zz * 1.45, 0.36, 0.04, 0.03, saddleMat, g);
    }
    consolidate(g);
    g.position.set(x, 0.5, riverCenter(x) - riverWidth(x) - 1.1);
    caravan.push({ g, x });
  }
  for (const x of [14.8, 18, 21.2, 24.4]) camel(x);

  // Continuous moving river with a true planar reflection of this same scene.
  const waterPositions = [],
    waterUV = [],
    waterIndex = [];
  for (let i = 0; i <= 160; i++) {
    const x = -40 + (80 * i) / 160;
    for (const s of [-1, 1]) {
      waterPositions.push(x, -(riverCenter(x) + s * riverWidth(x)), 0);
      waterUV.push(i / 160, (s + 1) / 2);
    }
  }
  for (let i = 0; i < 160; i++) {
    const a = i * 2;
    waterIndex.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const waterGeo = new THREE.BufferGeometry();
  waterGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(waterPositions, 3),
  );
  waterGeo.setAttribute("uv", new THREE.Float32BufferAttribute(waterUV, 2));
  waterGeo.setIndex(waterIndex);
  waterGeo.computeVertexNormals();
  const waterShader = {
    uniforms: {
      color: { value: new THREE.Color("#607e78") },
      tDiffuse: { value: null },
      textureMatrix: { value: new THREE.Matrix4() },
      time: { value: 0 },
    },
    vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld; void main(){vUv=textureMatrix*vec4(position,1.0);vWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:
      `uniform sampler2D tDiffuse; uniform vec3 color; uniform float time; varying vec4 vUv; varying vec3 vWorld;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 void main(){vec2 p=vWorld.xz;float a=sin(p.x*5.2+p.y*9.0+time*1.7),b=sin(p.x*11.0-p.y*6.0-time*1.2);vec2 ripple=vec2(a,b)*.0019;vec2 uv=vUv.xy/vUv.w+ripple;vec3 reflected=texture2D(tDiffuse,uv).rgb;reflected+=texture2D(tDiffuse,uv+vec2(.0011,.0008)).rgb;reflected+=texture2D(tDiffuse,uv-vec2(.0011,.0008)).rgb;reflected/=3.;vec3 view=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(view.y,0.),2.);float n=noise(p*1.7+vec2(-time*.15,time*.03));vec3 base=color*(.92+n*.16);float lines=pow(max(0.,a*.5+b*.5),12.)*.12;float glint=pow(max(0.,sin(p.x*18.+p.y*23.+time*2.2)*sin(p.x*7.-p.y*9.-time)),18.)*.15;vec3 result=mix(base,reflected,.19+fresnel*.52)+vec3(.52,.49,.32)*(lines+glint);gl_FragColor=vec4(result,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(
        ";#include",
        ";\n#include",
      ),
  };
  const water = new Reflector(waterGeo, {
    color: 0x466b61,
    textureWidth: softwareRenderer ? 512 : mobile ? 768 : 1280,
    textureHeight: softwareRenderer ? 384 : mobile ? 768 : 1024,
    clipBias: 0.003,
    shader: waterShader,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.18;
  water.material.side = THREE.DoubleSide;
  water.name = "汴河水面";
  world.add(water);
  obstacles.push({
    kind: "rect",
    source: "granny-bench",
    x: 11.8,
    z: -7.5,
    w: 0.65,
    d: 0.4,
    angle: 0.7,
  });
  // Flatten the entire architectural model only once, retaining moving groups separately.
  consolidate(staticRoot);

  // People are instanced articulated figurines. They follow banks and the actual bridge profile.
  const crowdGroups = [
      ["bridge", 24],
      ["bank", 44],
      ["market", 24],
      ["rear", 14],
    ],
    actorCount = crowdGroups.reduce((sum, [, count]) => sum + count, 0),
    people = [],
    parts = {};
  let journey = null,
    peopleTime = 0;
  const friendBodies = FRIENDS.map(f => ({ x:f.x, z:f.z, y:0.5, radius:f.age === "child" ? 0.22 : 0.3 }));
  const crowdPaths = createCrowdPaths(obstacles, friendBodies);
  const robeColors = [
    "#777b68",
    "#555d58",
    "#b5a385",
    "#8f7962",
    "#83704e",
    "#53625c",
    "#a49576",
    "#697685",
  ];
  function instance(name, geometry, material) {
    const m = new THREE.InstancedMesh(geometry, material, actorCount);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    world.add(m);
    parts[name] = m;
    return m;
  }
  for (const [name, spec] of Object.entries(humanModel.specs))
    instance(name, spec.geometry, humanMaterials[spec.material]);
  for (let i = 0; i < actorCount; i++) {
    let cursor = 0,
      type = "rear",
      localIndex = 0;
    for (const [group, count] of crowdGroups) {
      if (i < cursor + count) {
        type = group;
        localIndex = i - cursor;
        break;
      }
      cursor += count;
    }
    people.push({
      type,
      t: random(),
      speed: range(0.018, 0.035) * (random() < 0.5 ? -1 : 1),
      offset: range(-1.3, 1.3),
      scale: range(0.82, 1.08),
      phase: random() * TAU,
      hat: random() < 0.3,
      basket: random() < 0.35,
      color: new THREE.Color(pick(robeColors)),
      x: range(-18, 7),
      z: range(7.8, 14.9),
      side: localIndex % 2 ? -1 : 1,
      gender: localIndex % 2 ? "female" : "male",
      age:
        localIndex % 7 === 0
          ? "elder"
          : localIndex % 5 === 0
            ? "child"
            : "adult",
    });
    if (people[i].age === "child") {
      people[i].scale *= 0.65;
      people[i].speed *= 1.15;
      people[i].basket = false;
      people[i].hat = false;
    }
    if (people[i].age === "elder") {
      people[i].scale *= 0.95;
      people[i].speed *= 0.65;
      people[i].basket = false;
      people[i].hat = false;
    }
    if (people[i].gender === "female")
      people[i].color.set(
        ["#a07d80", "#7d8899", "#718b7a", "#af977a", "#927ba0"][i % 5],
      );
    const actor = people[i],
      paths =
        actor.type === "bridge"
          ? crowdPaths.bridge
          : actor.type === "bank"
            ? crowdPaths.bank[actor.side]
            : actor.type === "rear"
              ? crowdPaths.rear
              : i % 10 ? crowdPaths.market : [];
    actor.path = paths[i % paths.length] || null;
    actor.progress = actor.path ? actor.t * actor.path.length * 2 : 0;
    actor.walkClock = 0;
    const standing = nearestWalkable({ x: actor.x, z: actor.z }, obstacles);
    if (standing) {
      actor.x = standing.x;
      actor.z = standing.z;
    } else {
      actor.x = -6.7;
      actor.z = 11.7;
    }
    for (const [name, spec] of Object.entries(humanModel.specs))
      if (spec.material === "cloth") parts[name].setColorAt(i, people[i].color);
  }
  const actorMatrix = new THREE.Matrix4(),
    partMatrix = new THREE.Matrix4(),
    actorQuat = new THREE.Quaternion(),
    unitY = V(0, 1, 0);
  const advanceCrowd = createCrowdMotion(people, obstacles, [...friendBodies,...caravan.flatMap(c=>camelBodies(c.g.position))]);
  let crowdUpdateMs = 0;
  function updatePeople(t) {
    const dt = Math.min(0.7, Math.max(0, t - peopleTime));
    peopleTime = t;
    const player = journey?.active ? journey.focus : null;
    const crowdStarted = performance.now();
    advanceCrowd(dt, [...(journey?.crowdBodies || friendBodies), ...caravan.flatMap(c=>camelBodies(c.g.position)), ...(player ? [{x:player.x,y:player.y,z:player.z,radius:0.24}] : [])]);
    crowdUpdateMs = performance.now() - crowdStarted;
    for (const {profile,pieces} of merchants) humanModel.pose(t,profile,(name,matrix)=>{
      if(pieces[name]) {pieces[name].matrix.copy(matrix);pieces[name].matrixWorldNeedsUpdate=true;}
    });
    for (let i = 0; i < people.length; i++) {
      const a = people[i];
      const {x,z,y,yaw,moving} = a;
      actorQuat.setFromAxisAngle(unitY, yaw);
      actorMatrix.compose(V(x, y, z), actorQuat, V(a.scale, a.scale, a.scale));
      humanModel.pose(
        moving ? a.walkClock : t,
        {
          walking: moving,
          phase: a.phase,
          hat: a.hat,
          carrying: a.basket,
          shortCoat: i % 4 === 0,
          gender: a.gender,
          age: a.age,
        },
        (name, matrix) => {
          partMatrix.multiplyMatrices(actorMatrix, matrix);
          parts[name].setMatrixAt(i, partMatrix);
        },
      );
      a.position = [x, y, z];
    }
    for (const m of Object.values(parts)) m.instanceMatrix.needsUpdate = true;
  }
  updatePeople(0);

  // The three landmarks share fixed world coordinates in every camera view.
  const landmarks = [
    ["虹桥", V(bridgeX, 5.8, 0)],
    ["汴河", V(-22, 0.5, 0)],
    ["城阙", V(14, 10.7, -11.9)],
  ];
  for (const a of landmarks) {
    const el = document.createElement("div");
    el.className = "label";
    const span = document.createElement("span");
    span.textContent = a[0];
    el.appendChild(span);
    document.body.appendChild(el);
    a.push(el);
  }
  const views = {
    overview: {
      position: V(20, 41, 83),
      target: V(0, 1.1, 0),
      caption: "沿着汴河，走进画里的春日。",
    },
    bridge: {
      position: V(9, 13, 20),
      target: V(-5, 2.4, 0),
      caption: "虹桥卧波。桥下舟行，桥上人来。",
    },
    harbor: {
      position: V(-23, 8.4, 18.5),
      target: V(-20, 0.8, 1),
      caption: "河埠小憩，看一艘篷船缓缓驶过。",
    },
    gate: {
      position: V(31, 17, 13),
      target: V(15, 3, -10),
      caption: "越过城门，是纵横交错的街巷与院落。",
    },
  };
  let selectedView = "overview",
    transition = null,
    touring = false,
    paused = reduced,
    elapsed = 0,
    frames = 0,
    lastFrame = 0;
  function chooseView(name, instant = false) {
    selectedView = name;
    const v = views[name],
      pos = v.position.clone(),
      target = v.target.clone();
    if (name === "overview") {
      if (innerWidth / innerHeight < 1.1) {
        pos.set(92, 75, 35);
        if (innerWidth / innerHeight < 0.65) {
          pos.set(68, 165, 0);
          target.set(0, 1.1, -2);
        }
      } else if (innerWidth / innerHeight > 1.7) pos.multiplyScalar(0.92);
    }
    if (instant) {
      camera.position.copy(pos);
      controls.target.copy(target);
      controls.update();
    } else
      transition = {
        start: performance.now(),
        from: camera.position.clone(),
        to: pos,
        fromTarget: controls.target.clone(),
        target,
      };
    document.querySelectorAll("[data-view]").forEach((b) => {
      const on = b.dataset.view === name;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    document.querySelector("#caption").textContent = v.caption;
    document.body.dataset.cameraView = name;
  }
  function stopTour() {
    touring = false;
    controls.autoRotate = false;
    document.querySelector("#tour").setAttribute("aria-pressed", "false");
    document.querySelector("#tour").setAttribute("aria-label", "开启自动环游");
  }
  for (const b of document.querySelectorAll("[data-view]"))
    b.addEventListener("click", () => {
      stopTour();
      chooseView(b.dataset.view);
    });
  document.querySelector("#tour").addEventListener("click", () => {
    touring = !touring;
    controls.autoRotate = touring;
    controls.autoRotateSpeed = 0.32;
    document
      .querySelector("#tour")
      .setAttribute("aria-pressed", String(touring));
    document
      .querySelector("#tour")
      .setAttribute("aria-label", touring ? "关闭自动环游" : "开启自动环游");
  });
  const pauseButton = document.querySelector("#pause");
  function updatePause() {
    pauseButton.setAttribute("aria-pressed", String(paused));
    pauseButton.setAttribute(
      "aria-label",
      paused ? "继续场景动画" : "暂停场景动画",
    );
    pauseButton.title = paused ? "继续场景动画" : "暂停场景动画";
    pauseButton.textContent = paused ? "▷" : "Ⅱ";
  }
  updatePause();
  pauseButton.addEventListener("click", () => {
    paused = !paused;
    updatePause();
  });
  controls.addEventListener("start", () => {
    transition = null;
    stopTour();
  });
  window.addEventListener("keydown", (e) => {
    if (journey.active) return;
    if (e.target !== renderer.domElement) return;
    if (e.key === "Home") {
      chooseView("overview");
      e.preventDefault();
    }
    if (e.code === "Space") {
      paused = !paused;
      updatePause();
      e.preventDefault();
    }
  });
  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    if (selectedView === "overview" && !journey.active) chooseView("overview");
  });
  renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    document.querySelector("#caption").textContent =
      "画面暂时中断，请刷新页面重新展开长卷。";
  });
  chooseView("overview", true);
  journey = createJourney({
    world,
    camera,
    controls,
    canvas: renderer.domElement,
    humanModel,
    humanMaterials,
    boats,
    obstacles,
    stallCanopies,
    getCrowd: () => [
      ...(journey?.crowdBodies || friendBodies),
      ...people.map((a) => ({
        x: a.position[0],
        y: a.position[1],
        z: a.position[2],
        radius: a.radius,
      })),
      ...caravan.flatMap(({ g }) => camelBodies(g.position)),
    ],
    getMapImage: createSurveyMap({
      renderer,
      scene,
      world,
      staticRoot,
      water,
      canopies: stallCanopies,
      boats,
      walkingView,
    }),
    onStart() {
      stopTour();
      transition = null;
      paused = false;
      walkingView.value = 1;
      updatePause();
    },
    onOverview() {
      walkingView.value = 0;
      chooseView("overview");
    },
  });
  Object.defineProperty(window, "__journey", { get: () => journey.snapshot() });
  const clock = new THREE.Clock(),
    projected = new THREE.Vector3();
  document.addEventListener("visibilitychange", () => clock.getDelta());
  function animate() {
    requestAnimationFrame(animate);
    // A slow foreground frame advances the same bounded simulation clock for
    // boats, wind and pedestrians, rather than making only the people slow down.
    const dt = Math.min(clock.getDelta(), 0.7);
    const simulationPaused = paused || (journey.active && journey.paused);
    if (!simulationPaused && !document.hidden) elapsed += dt;
    windUniform.value = elapsed;
    water.material.uniforms.time.value = elapsed;
    if (!simulationPaused) {
      updatePeople(elapsed);
      for (const b of boats) {
        const p = boatPose(b, elapsed);
        b.g.position.set(
          p.x,
          0.21 + Math.sin(elapsed * 0.75 + b.phase) * 0.025,
          p.z,
        );
        b.g.rotation.x = Math.sin(elapsed * 0.8 + b.phase) * 0.008;
        b.g.rotation.z = Math.cos(elapsed * 0.6 + b.phase) * 0.005;
        b.g.rotation.y = p.yaw;
      }
      for (const c of caravan) {
        const desiredX = c.x - Math.sin(elapsed * 0.065) * 1.8;
        const x=c.g.position.x+THREE.MathUtils.clamp(desiredX-c.g.position.x,-dt*.13,dt*.13);
        const z = riverCenter(x) - riverWidth(x) - 1.1;
        const player = journey.active ? journey.focus : null;
        const bodies=[...people,...(journey?.crowdBodies || friendBodies),
          ...(player ? [{x:player.x,y:player.y,z:player.z,radius:.24}] : [])];
        if(!canMoveCamel(c.g.position,{x,z},bodies))continue;
        c.g.position.set(x, 0.51 + Math.sin(elapsed * 2 + c.x) * 0.015, z);
      }
      for (const f of flags) {
        const p = f.mesh.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const xx = f.base[i * 3],
            yy = f.base[i * 3 + 1];
          p.setZ(
            i,
            Math.sin(elapsed * 1.6 + yy * 4 + f.phase) * 0.09 * (0.4 + xx),
          );
        }
        p.needsUpdate = true;
        f.mesh.geometry.computeVertexNormals();
      }
    }
    if (transition) {
      const t = THREE.MathUtils.clamp(
          (performance.now() - transition.start) / 1550,
          0,
          1,
        ),
        s = t * t * (3 - 2 * t);
      camera.position.lerpVectors(transition.from, transition.to, s);
      controls.target.lerpVectors(transition.fromTarget, transition.target, s);
      if (t === 1) transition = null;
    }
    journey.update(dt, elapsed);
    controls.update(dt);
    walkingFocus.value.copy(journey.focus);
    walkingFocus.value.y += 0.85;
    // Keep a tabletop model clear when the camera retreats to fit a portrait screen.
    scene.fog.near = Math.max(
      115,
      camera.position.distanceTo(controls.target) + 70,
    );
    scene.fog.far = scene.fog.near + 120;
    if (controls.target.x > 40) controls.target.x = 40;
    if (controls.target.x < -40) controls.target.x = -40;
    if (controls.target.z > 20) controls.target.z = 20;
    if (controls.target.z < -20) controls.target.z = -20;
    for (const [name, position, el] of landmarks) {
      projected.copy(position).project(camera);
      const x = (projected.x * 0.5 + 0.5) * innerWidth,
        y = (-projected.y * 0.5 + 0.5) * innerHeight;
      el.style.transform = `translate(${x}px,${y}px)`;
      el.style.opacity =
        projected.z < 1 &&
        x > 30 &&
        x < innerWidth - 70 &&
        y > 140 &&
        y < innerHeight - 160
          ? "1"
          : "0";
    }
    renderer.render(scene, camera);
    frames++;
    lastFrame = performance.now();
    if (frames === 2)
      document.querySelector("#loading").classList.add("hidden");
  }
  // Read-only diagnostics for acceptance checks; not a second rendering or animation path.
  Object.defineProperty(window, "__qingming", {
    get: () => ({
      frames,
      elapsed,
      paused,
      touring,
      selectedView,
      camera: camera.position.toArray(),
      target: controls.target.toArray(),
      people: people.map((p) => p.position),
      pedestrians: people.map(p=>({x:p.x,y:p.y,z:p.z,radius:p.radius,moving:p.moving,
        yaw:p.yaw,walkClock:p.walkClock,type:p.type,age:p.age,gender:p.gender,hasPath:!!p.path})),
      merchants: merchants.map(({pieces})=>pieces.head.matrix.toArray()),
      camels: caravan.map(c=>({x:c.g.position.x,z:c.g.position.z,bodies:camelBodies(c.g.position)})),
      demographics: people.reduce((counts, p) => {
        const key = p.age + "-" + p.gender;
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {}),
      obstacles: obstacles.map((o) => ({ ...o })),
      boats: boats.map((b) => b.g.position.toArray()),
      calls: renderer.info.render.calls,
      crowdUpdateMs,
      triangles: renderer.info.render.triangles,
      lastFrame,
      softwareRenderer: Boolean(softwareRenderer),
      landmarks: landmarks.map((a) => ({
        name: a[0],
        position: a[1].toArray(),
      })),
    }),
  });
  animate();
}
main().catch((e) => {
  console.error(e);
  const box = document.querySelector("#error");
  box.classList.add("show");
  box.textContent = "场景未能展开，请使用支持 WebGL 的现代浏览器。" + e.message;
  document.querySelector("#loading").classList.add("hidden");
});
