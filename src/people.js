import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);
const vec = (x, y, z) => new THREE.Vector3(x, y, z);

function merged(geometries) {
  const g = mergeGeometries(
    geometries.map((g) => (g.index ? g.toNonIndexed() : g)),
  );
  g.computeBoundingSphere();
  return g;
}
function ellipsoid(x, y, z, rx, ry, rz) {
  return new THREE.SphereGeometry(1, 8, 5).scale(rx, ry, rz).translate(x, y, z);
}
function strip(a, b, width, depth) {
  const direction = b.clone().sub(a);
  return new THREE.BoxGeometry(width, direction.length(), depth)
    .applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize()),
    )
    .translate(...a.clone().add(b).multiplyScalar(0.5).toArray());
}
// Elliptical cross-sections give the coat shoulders, chest and waist a human silhouette.
function garment(rings, segments, pleats = 0, opening = false) {
  const positions = [],
    uv = [],
    indices = [];
  for (let r = 0; r < rings.length; r++) {
    const [y, rx, rz] = rings[r];
    const gap = opening ? Math.max(0, -y / 0.43) * 0.14 : 0;
    for (let j = 0; j <= segments; j++) {
      const angle = gap + (j / segments) * (Math.PI * 2 - gap * 2);
      const fold =
        1 + pleats * Math.cos(angle * 12) * (0.4 + (0.6 * r) / rings.length);
      positions.push(
        Math.sin(angle) * rx * fold,
        y,
        Math.cos(angle) * rz * fold,
      );
      uv.push(j / segments, r / (rings.length - 1));
    }
  }
  for (let r = 0; r < rings.length - 1; r++)
    for (let j = 0; j < segments; j++) {
      const a = r * (segments + 1) + j;
      if (rings[r + 1][0] > rings[r][0])
        indices.push(
          a,
          a + 1,
          a + segments + 1,
          a + 1,
          a + segments + 2,
          a + segments + 1,
        );
      else
        indices.push(
          a,
          a + segments + 1,
          a + 1,
          a + 1,
          a + segments + 1,
          a + segments + 2,
        );
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function handGeometry(side) {
  const pieces = [ellipsoid(0, 0, 0, 0.024, 0.032, 0.013)];
  for (let f = 0; f < 4; f++) {
    const x = (f - 1.5) * 0.0105,
      length = [0.03, 0.038, 0.035, 0.026][f];
    pieces.push(
      new THREE.CylinderGeometry(0.0045, 0.0038, length, 5)
        .rotateX(-0.13)
        .translate(x, -0.026 - length * 0.5, 0.003),
    );
    pieces.push(ellipsoid(x, -0.026 - length, 0.005, 0.004, 0.005, 0.004));
  }
  pieces.push(
    strip(
      vec(side * 0.017, 0.009, 0.004),
      vec(side * 0.034, -0.021, 0.013),
      0.011,
      0.012,
    ),
  );
  pieces.push(ellipsoid(side * 0.033, -0.023, 0.013, 0.006, 0.01, 0.006));
  return merged(pieces);
}

// Both segment lengths stay fixed. The pole chooses the elbow/knee bending plane.
export function twoBoneJoint(
  root,
  end,
  upperLength,
  lowerLength,
  pole,
  out = new THREE.Vector3(),
) {
  const axis = end.clone().sub(root);
  const distance = THREE.MathUtils.clamp(
    axis.length(),
    0.00001,
    upperLength + lowerLength - 0.00001,
  );
  axis.normalize();
  const projected = pole
    .clone()
    .addScaledVector(axis, -pole.dot(axis))
    .normalize();
  const along =
    (distance * distance +
      upperLength * upperLength -
      lowerLength * lowerLength) /
    (2 * distance);
  const height = Math.sqrt(
    Math.max(0, upperLength * upperLength - along * along),
  );
  return out
    .copy(root)
    .addScaledVector(axis, along)
    .addScaledVector(projected, height);
}

export function createHumanModel() {
  const torso = garment(
    [
      [0.63, 0.125, 0.085],
      [0.69, 0.13, 0.088],
      [0.8, 0.153, 0.1],
      [0.91, 0.177, 0.1],
      [0.96, 0.164, 0.085],
      [1.005, 0.065, 0.052],
    ],
    16,
    0.018,
  );
  const skirt = garment(
    [
      [0, 0.127, 0.087],
      [-0.08, 0.145, 0.095],
      [-0.22, 0.174, 0.115],
      [-0.36, 0.19, 0.128],
      [-0.43, 0.195, 0.13],
    ],
    24,
    0.055,
    true,
  );
  const head = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.025, -0.087),
      new THREE.Vector2(0.048, -0.073),
      new THREE.Vector2(0.067, -0.037),
      new THREE.Vector2(0.074, 0.012),
      new THREE.Vector2(0.073, 0.05),
      new THREE.Vector2(0.053, 0.083),
      new THREE.Vector2(0, 0.098),
    ],
    12,
  ).scale(1, 1, 0.92);
  const skinHead = merged([
    head,
    ellipsoid(-0.075, 0, 0, 0.012, 0.023, 0.014),
    ellipsoid(0.075, 0, 0, 0.012, 0.023, 0.014),
    ellipsoid(0, -0.005, 0.074, 0.012, 0.022, 0.023),
  ]);
  const face = merged([
    ellipsoid(-0.025, 0.02, 0.068, 0.0045, 0.004, 0.003),
    ellipsoid(0.025, 0.02, 0.068, 0.0045, 0.004, 0.003),
    strip(vec(-0.039, 0.033, 0.068), vec(-0.014, 0.035, 0.073), 0.004, 0.003),
    strip(vec(0.014, 0.035, 0.073), vec(0.039, 0.033, 0.068), 0.004, 0.003),
    strip(
      vec(-0.014, -0.044, 0.065),
      vec(0.014, -0.044, 0.065),
      0.0025,
      0.0025,
    ),
  ]);
  const hair = merged([
    new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.53)
      .scale(0.075, 0.1, 0.071)
      .translate(0, 0.005, -0.005),
    ellipsoid(0, 0.083, -0.047, 0.035, 0.033, 0.032),
  ]);
  const hat = merged([
    new THREE.ConeGeometry(0.205, 0.095, 16).translate(0, 0.125, 0),
    new THREE.TorusGeometry(0.203, 0.007, 4, 16)
      .rotateX(Math.PI / 2)
      .translate(0, 0.078, 0),
  ]);
  const collar = merged([
    strip(vec(-0.055, 0.998, 0.04), vec(-0.015, 0.94, 0.105), 0.026, 0.009),
    strip(vec(-0.015, 0.94, 0.105), vec(0.035, 0.86, 0.108), 0.026, 0.009),
    strip(vec(0.035, 0.86, 0.108), vec(0.075, 0.8, 0.09), 0.026, 0.009),
    strip(vec(0.055, 0.998, 0.04), vec(0.015, 0.94, 0.105), 0.025, 0.009),
    strip(vec(0.015, 0.94, 0.105), vec(-0.025, 0.88, 0.108), 0.025, 0.009),
  ]);
  const shoe = merged([
    ellipsoid(0, 0, 0.025, 0.049, 0.032, 0.09),
    ellipsoid(0, -0.012, 0.063, 0.047, 0.02, 0.058),
  ]);
  const basket = new THREE.CylinderGeometry(0.113, 0.085, 0.19, 10, 1, true);
  const handle = new THREE.TorusGeometry(0.1, 0.007, 4, 16).translate(
    0,
    0.09,
    0,
  );
  const specs = {
    torso: { geometry: torso, material: "cloth" },
    skirt: { geometry: skirt, material: "cloth" },
    collar: { geometry: collar, material: "trim" },
    belt: {
      geometry: garment(
        [
          [0.652, 0.131, 0.092],
          [0.686, 0.132, 0.093],
        ],
        16,
      ),
      material: "sash",
    },
    neck: {
      geometry: new THREE.CylinderGeometry(0.031, 0.035, 0.065, 8),
      material: "skin",
    },
    head: { geometry: skinHead, material: "skin" },
    face: { geometry: face, material: "hair" },
    hair: { geometry: hair, material: "hair" },
    hat: { geometry: hat, material: "hat" },
    basket: { geometry: basket, material: "basket" },
    handle: { geometry: handle, material: "basket" },
    longSkirt: {
      geometry: garment(
        [
          [0, 0.13, 0.09],
          [-0.2, 0.18, 0.12],
          [-0.43, 0.23, 0.15],
          [-0.59, 0.25, 0.17],
        ],
        24,
        0.08,
      ),
      material: "cloth",
    },
    sideBuns: {
      geometry: merged([
        ellipsoid(-0.086, 0.035, -0.025, 0.035, 0.038, 0.035),
        ellipsoid(0.086, 0.035, -0.025, 0.035, 0.038, 0.035),
      ]),
      material: "hair",
    },
    hairpin: {
      geometry: strip(
        vec(-0.11, 0.08, -0.04),
        vec(0.11, 0.08, -0.04),
        0.008,
        0.009,
      ),
      material: "sash",
    },
    greyHair: {
      geometry: hair.clone().scale(1.01, 1.01, 1.01),
      material: "grey",
    },
    beard: {
      geometry: new THREE.ConeGeometry(0.035, 0.12, 8)
        .rotateZ(Math.PI)
        .translate(0, -0.09, 0.042),
      material: "grey",
    },
    cane: {
      geometry: merged([
        new THREE.CylinderGeometry(0.012, 0.017, 0.72, 7).translate(
          0.29,
          0.36,
          0.12,
        ),
        ellipsoid(0.29, 0.72, 0.12, 0.035, 0.018, 0.018),
      ]),
      material: "basket",
    },
  };
  specs.greySideBuns = { geometry: specs.sideBuns.geometry, material: "grey" };
  for (const [suffix, side] of [
    ["L", 1],
    ["R", -1],
  ]) {
    specs[`shoulder${suffix}`] = {
      geometry: ellipsoid(0, 0, 0, 0.077, 0.073, 0.075),
      material: "cloth",
    };
    specs[`elbow${suffix}`] = {
      geometry: ellipsoid(0, 0, 0, 0.065, 0.065, 0.063),
      material: "cloth",
    };
    specs[`upperArm${suffix}`] = {
      geometry: new THREE.CylinderGeometry(0.071, 0.059, 1, 8),
      material: "cloth",
    };
    specs[`forearm${suffix}`] = {
      geometry: new THREE.CylinderGeometry(0.059, 0.081, 1, 10),
      material: "cloth",
    };
    specs[`cuff${suffix}`] = {
      geometry: new THREE.CylinderGeometry(0.083, 0.083, 0.018, 10),
      material: "trim",
    };
    specs[`hand${suffix}`] = { geometry: handGeometry(side), material: "skin" };
    specs[`thigh${suffix}`] = {
      geometry: new THREE.CylinderGeometry(0.057, 0.046, 1, 8),
      material: "pants",
    };
    specs[`calf${suffix}`] = {
      geometry: new THREE.CylinderGeometry(0.045, 0.033, 1, 8),
      material: "pants",
    };
    specs[`knee${suffix}`] = {
      geometry: ellipsoid(0, 0, 0, 0.047, 0.047, 0.047),
      material: "pants",
    };
    specs[`shoe${suffix}`] = { geometry: shoe, material: "shoes" };
  }
  const object = new THREE.Object3D(),
    body = new THREE.Matrix4(),
    matrix = new THREE.Matrix4(),
    rotation = new THREE.Quaternion();
  const shoulder = new THREE.Vector3(),
    wrist = new THREE.Vector3(),
    elbow = new THREE.Vector3();
  const hip = new THREE.Vector3(),
    ankle = new THREE.Vector3(),
    knee = new THREE.Vector3(),
    direction = new THREE.Vector3();
  const pole = new THREE.Vector3(),
    point = new THREE.Vector3(),
    euler = new THREE.Euler();
  function pose(time, a, write) {
    const elder = a.age === "elder",
      child = a.age === "child",
      female = a.gender === "female";
    const phase = time * (elder ? 2.3 : child ? 4.7 : 3.4) + (a.phase || 0),
      gait = a.walking ? Math.sin(phase) : 0;
    const bob =
      (a.walking
        ? 0.008 * Math.cos(phase * 2)
        : 0.003 * Math.sin(time * 1.2 + (a.phase || 0))) -
      (a.seated ? 0.31 : 0) -
      (a.running ? 0.04 : 0);
    rotation.setFromEuler(
      euler.set(
        elder ? 0.075 : a.running ? 0.12 : a.walking ? 0.018 : 0,
        gait * 0.025,
        Math.sin(time * 0.6 + (a.phase || 0)) * 0.008,
      ),
    );
    body.compose(vec(0, bob, 0), rotation, ONE);
    function put(name, position, scale = ONE, quaternion = null, upper = true) {
      object.position.copy(position);
      object.scale.copy(scale);
      object.quaternion.copy(quaternion || new THREE.Quaternion());
      object.updateMatrix();
      if (upper) matrix.multiplyMatrices(body, object.matrix);
      else matrix.copy(object.matrix);
      write(name, matrix);
    }
    function bone(name, lower, upper) {
      direction.copy(upper).sub(lower);
      rotation.setFromUnitVectors(UP, direction.clone().normalize());
      put(
        name,
        point.copy(lower).add(upper).multiplyScalar(0.5),
        vec(1, direction.length(), 1),
        rotation,
        false,
      );
    }
    put("torso", vec(0, 0, 0));
    put("collar", vec(0, 0, 0));
    put("belt", vec(0, 0, 0));
    put(
      "skirt",
      vec(0, 0.655, 0),
      vec(1, a.shortCoat || a.seated ? 0.52 : 1, 1),
    );
    put(
      "longSkirt",
      vec(0, 0.655, 0),
      female ? (a.seated ? vec(1, 0.42, 1.15) : ONE) : vec(0, 0, 0),
    );
    put("neck", vec(0, 1.003, 0));
    rotation.setFromEuler(
      euler.set(
        Math.sin(time * 0.8 + (a.phase || 0)) * 0.025,
        Math.sin(time * 0.36 + (a.phase || 0)) * 0.13,
        0,
      ),
    );
    const headScale = child ? vec(1.17, 1.17, 1.17) : ONE;
    for (const name of ["head", "face", "hair"])
      put(name, vec(0, 1.095, 0), headScale, rotation);
    put(
      "sideBuns",
      vec(0, 1.095, 0),
      (female || child) && !elder ? headScale : vec(0, 0, 0),
      rotation,
    );
    put(
      "hairpin",
      vec(0, 1.095, 0),
      female && !child ? ONE : vec(0, 0, 0),
      rotation,
    );
    put("greyHair", vec(0, 1.095, 0), elder ? ONE : vec(0, 0, 0), rotation);
    put(
      "greySideBuns",
      vec(0, 1.095, 0),
      elder && female ? ONE : vec(0, 0, 0),
      rotation,
    );
    put(
      "beard",
      vec(0, 1.095, 0),
      elder && !female ? ONE : vec(0, 0, 0),
      rotation,
    );
    put("cane", vec(0, 0, 0), elder && !a.seated ? ONE : vec(0, 0, 0));
    put("hat", vec(0, 1.095, 0), a.hat ? ONE : vec(0, 0, 0), rotation);
    for (const [suffix, side] of [
      ["L", -1],
      ["R", 1],
    ]) {
      const swing = gait * -side;
      shoulder.set(side * 0.166, 0.94, 0).applyMatrix4(body);
      wrist.set(side * 0.221, 0.565, 0.035 + swing * (a.running ? 0.18 : 0.12));
      if (a.carrying && side === 1) wrist.set(0.235, 0.675, 0.15);
      if (a.holdingToy && side === 1) wrist.set(0.235, 0.79, 0.18);
      if (a.eating && side === 1) wrist.set(0.09, 1.0, 0.18);
      if (elder && side === 1) wrist.set(0.29, 0.75, 0.12);
      if (a.seated) wrist.set(side * 0.2, 0.68, 0.19);
      if (a.rower) wrist.set(side * 0.16, 0.775 - side * 0.042, 0.22);
      wrist.applyMatrix4(body);
      pole.set(side * 0.18, 0, -1);
      twoBoneJoint(shoulder, wrist, 0.225, 0.215, pole, elbow);
      put(`shoulder${suffix}`, shoulder, ONE, null, false);
      put(`elbow${suffix}`, elbow, ONE, null, false);
      bone(`upperArm${suffix}`, elbow, shoulder);
      bone(`forearm${suffix}`, wrist, elbow);
      direction.copy(elbow).sub(wrist).normalize();
      rotation.setFromUnitVectors(UP, direction);
      put(
        `cuff${suffix}`,
        point.copy(wrist).addScaledVector(direction, 0.012),
        ONE,
        rotation,
        false,
      );
      put(
        `hand${suffix}`,
        point.copy(wrist).addScaledVector(direction, -0.031),
        ONE,
        rotation,
        false,
      );
      const legPhase = phase + (side === 1 ? Math.PI : 0),
        lift = a.walking
          ? Math.max(0, Math.cos(legPhase)) * (a.running ? 0.11 : 0.065)
          : 0;
      hip.set(side * 0.073, 0.625, 0).applyMatrix4(body);
      ankle.set(
        side * 0.074,
        0.076 + lift,
        a.seated
          ? 0.29
          : a.walking
            ? Math.sin(legPhase) * (a.running ? 0.19 : 0.13)
            : 0.012,
      );
      pole.set(0, a.seated ? 1 : 0, 1);
      twoBoneJoint(hip, ankle, 0.28, a.seated ? 0.26 : 0.28, pole, knee);
      put(`knee${suffix}`, knee, ONE, null, false);
      bone(`thigh${suffix}`, knee, hip);
      bone(`calf${suffix}`, ankle, knee);
      rotation.setFromEuler(
        euler.set(a.walking ? Math.sin(legPhase) * 0.08 : 0, side * 0.065, 0),
      );
      put(
        `shoe${suffix}`,
        vec(ankle.x, 0.043 + lift, ankle.z + 0.023),
        ONE,
        rotation,
        false,
      );
    }
    put("basket", vec(0.235, 0.385, 0.15), a.carrying ? ONE : vec(0, 0, 0));
    put("handle", vec(0.235, 0.48, 0.15), a.carrying ? ONE : vec(0, 0, 0));
  }
  return { specs, pose };
}
