import * as THREE from "three";
const material = (color) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
const M = {
  red: material("#aa3d32"),
  wood: material("#987244"),
  paper: material("#dbc695"),
  dark: material("#674b31"),
  green: material("#6c8c65"),
  blue: material("#607d8a"),
  pink: material("#d18b94"),
};
function mesh(g, m, parent) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = true;
  parent.add(o);
  return o;
}
function rod(a, b, r, m, parent) {
  const d = b.clone().sub(a),
    o = mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), m, parent);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return o;
}
export function makeToy(kind) {
  const root = new THREE.Group();
  root.name = kind;
  if (kind === "rattle") {
    const handle = mesh(
      new THREE.CylinderGeometry(0.018, 0.021, 0.31, 8),
      M.wood,
      root,
    );
    handle.position.y = 0.1;
    const head = new THREE.Group();
    head.position.y = 0.29;
    root.add(head);
    const drum = mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.075, 18),
      M.red,
      head,
    );
    drum.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      const face = mesh(new THREE.CircleGeometry(0.108, 18), M.paper, head);
      face.position.z = side * 0.039;
      face.rotation.y = side < 0 ? Math.PI : 0;
      const ring = mesh(
        new THREE.TorusGeometry(0.116, 0.007, 4, 18),
        M.wood,
        head,
      );
      ring.position.z = side * 0.038;
      const dot = mesh(new THREE.CircleGeometry(0.031, 12), M.red, head);
      dot.position.z = side * 0.041;
      dot.rotation.y = side < 0 ? Math.PI : 0;
    }
    const beads = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.x = side * 0.119;
      head.add(pivot);
      const cord = rod(
        new THREE.Vector3(),
        new THREE.Vector3(side * 0.132, 0, 0),
        0.003,
        M.dark,
        pivot,
      );
      const bead = mesh(new THREE.SphereGeometry(0.023, 7, 5), M.red, pivot);
      bead.position.x = side * 0.132;
      beads.push({ pivot, side });
    }
    return {
      root,
      update(t, playing) {
        head.rotation.y = playing ? Math.sin(t * 14) * 1.2 : 0;
        for (const { pivot, side } of beads)
          pivot.rotation.y = playing ? Math.sin(t * 14 - side * 0.5) * 2.45 : 0;
      },
    };
  }
  if (kind === "dragonfly") {
    const stem = mesh(
      new THREE.CylinderGeometry(0.012, 0.016, 0.3, 7),
      M.wood,
      root,
    );
    stem.position.y = 0.1;
    const rotor = new THREE.Group();
    rotor.position.y = 0.25;
    root.add(rotor);
    const blade = mesh(
      new THREE.BoxGeometry(0.37, 0.014, 0.055),
      M.green,
      rotor,
    );
    blade.rotation.z = 0.06;
    const hub = mesh(new THREE.SphereGeometry(0.025, 8, 5), M.wood, rotor);
    return {
      root,
      update(t, playing) {
        rotor.rotation.y = playing ? t * 45 : t * 0.3;
      },
    };
  }
  if (kind === "kite") {
    const vertices = [
      0, 0.46, 0, 0.25, 0.17, 0, 0, -0.12, 0, -0.25, 0.17, 0, 0, 0.17, 0.012,
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]);
    geo.computeVertexNormals();
    const k = mesh(geo, M.red, root);
    for (const pair of [
      [0, 2],
      [1, 3],
    ])
      rod(
        new THREE.Vector3(...vertices.slice(pair[0] * 3, pair[0] * 3 + 3)),
        new THREE.Vector3(...vertices.slice(pair[1] * 3, pair[1] * 3 + 3)),
        0.005,
        M.wood,
        root,
      );
    const tail = [];
    for (let i = 0; i < 12; i++)
      tail.push(
        new THREE.Vector3(Math.sin(i * 0.7) * 0.05, -0.12 - i * 0.055, 0),
      );
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(tail),
      new THREE.LineBasicMaterial({ color: "#76513c" }),
    );
    root.add(line);
    for (let i = 0; i < 3; i++) {
      const bow = mesh(
        new THREE.PlaneGeometry(0.12, 0.045),
        i % 2 ? M.paper : M.blue,
        root,
      );
      bow.position.set(Math.sin((i * 3 + 2) * 0.7) * 0.05, -0.25 - i * 0.16, 0);
      bow.rotation.z = i * 0.4;
    }
    return {
      root,
      update(t, playing) {
        root.rotation.z = Math.sin(t * 1.5) * 0.09;
      },
    };
  }
  if (kind === "bamboo-fan") {
    const fan = mesh(
      new THREE.CircleGeometry(0.24, 18, Math.PI * 0.12, Math.PI * 0.76),
      M.paper,
      root,
    );
    fan.position.y = 0.1;
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * 0.12 + (i / 8) * Math.PI * 0.76;
      rod(
        new THREE.Vector3(0, 0.1, 0),
        new THREE.Vector3(Math.cos(a) * 0.24, 0.1 + Math.sin(a) * 0.24, 0.004),
        0.004,
        M.wood,
        root,
      );
    }
    rod(
      new THREE.Vector3(0, -0.08, 0),
      new THREE.Vector3(0, 0.12, 0),
      0.014,
      M.wood,
      root,
    );
    return { root, update() {} };
  }
  if (kind === "sachet" || kind === "herb-bundle") {
    const bag = mesh(
      new THREE.SphereGeometry(1, 10, 7),
      kind === "sachet" ? M.red : M.green,
      root,
    );
    bag.scale.set(0.07, 0.09, 0.04);
    bag.position.y = 0.08;
    const tie = mesh(
      new THREE.TorusGeometry(0.031, 0.004, 4, 12),
      M.paper,
      root,
    );
    tie.position.y = 0.16;
    rod(
      new THREE.Vector3(0, 0.16, 0),
      new THREE.Vector3(0, 0.25, 0),
      0.003,
      M.wood,
      root,
    );
    return { root, update() {} };
  }
  if (["spring-tea", "osmanthus-tea", "bean-soup"].includes(kind)) {
    const cup = mesh(
      new THREE.CylinderGeometry(0.075, 0.05, 0.1, 12, 1, true),
      M.paper,
      root,
    );
    cup.position.y = 0.07;
    const tea = mesh(new THREE.CircleGeometry(0.068, 12), M.dark, root);
    tea.rotation.x = -Math.PI / 2;
    tea.position.y = 0.114;
    return { root, update() {} };
  }
  if (
    [
      "sesame-cake",
      "date-cake",
      "candied-fruit",
      "meat-bun",
      "vegetable-bun",
      "peach",
      "apricot",
      "water-chestnut",
    ].includes(kind)
  ) {
    const paper = mesh(new THREE.PlaneGeometry(0.22, 0.19), M.paper, root);
    paper.rotation.x = -Math.PI / 2;
    paper.position.y = 0.01;
    const snack = mesh(
      new THREE.SphereGeometry(1, 12, 8),
      ["peach", "apricot", "candied-fruit"].includes(kind)
        ? M.pink
        : kind === "date-cake"
          ? M.wood
          : M.paper,
      root,
    );
    snack.scale.set(0.075, kind.includes("bun") ? 0.065 : 0.036, 0.07);
    snack.position.y = 0.05;
    if (kind === "sesame-cake")
      for (let i = 0; i < 12; i++) {
        const seed = mesh(new THREE.SphereGeometry(0.0035, 4, 3), M.dark, root);
        seed.position.set(
          Math.cos(i * 2.4) * 0.05,
          0.082,
          Math.sin(i * 2.4) * 0.05,
        );
      }
    return { root, update() {} };
  }
  const color =
    kind === "peony"
      ? "#ba567e"
      : kind === "willow-sprig"
        ? "#8ba36c"
        : "#df96a4";
  const flower = material(color);
  flower.userData.toyOwned=true;
  const wrap = mesh(new THREE.CylinderGeometry(.036,.018,.075,10,1,true), M.paper, root);
  wrap.position.y=.035;
  const tie=mesh(new THREE.TorusGeometry(.025,.004,4,12),M.red,root);
  tie.rotation.x=Math.PI/2;tie.position.y=.025;
  for (let i = 0; i < 5; i++) {
    const a=i*2.4, x=Math.cos(a)*.06,
      z=Math.sin(a)*.045, top = .24 + Math.sin(i * 1.8) * .035;
    rod(
      new THREE.Vector3(x*.12, -.055, z*.12),
      new THREE.Vector3(x, top, z),
      0.004,
      M.green,
      root,
    );
    for (let p = 0; p < 10; p++) {
      const a = (p / 5) * Math.PI * 2, radius=p<5 ? .022 : .011,
        petal = mesh(new THREE.SphereGeometry(1, 7, 4), flower, root);
      petal.position.set(
        x + Math.cos(a) * radius,
        top + (p<5 ? 0 : .012),
        z + Math.sin(a) * radius,
      );
      petal.scale.set(.025,.011,.019);
      petal.rotation.z=Math.cos(a)*.35;
    }
    const leaf = mesh(new THREE.SphereGeometry(1, 6, 4), M.green, root);
    leaf.scale.set(0.012, 0.05, 0.006);
    leaf.position.set(x * .7, top * .65, z);
    leaf.rotation.z = 0.65;
  }
  return { root, update() {} };
}
