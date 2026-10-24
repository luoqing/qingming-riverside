import { riverCenter, riverWidth, bridgeHeight } from "./paths.js";
const routeGrids = new WeakMap();
export function bridgeWalkHeight(z) {
  const a = Math.abs(z);
  if (a >= 8.7) return 0.5;
  if (a > 8) return 0.5 + ((8.7 - a) / 0.7) * 0.435;
  return Math.max(
    bridgeHeight(Math.max(-7.7, Math.min(7.7, z))) + 0.1,
    a > 7 ? 0.935 : 0,
  );
}
export function walkSurface(x, z) {
  if (x < -39 || x > 39 || z < -18.7 || z > 18.7) return null;
  if (Math.abs(x + 5) < 1.68 && Math.abs(z) < 8.7) return bridgeWalkHeight(z);
  if (Math.abs(z - riverCenter(x)) < riverWidth(x) + 0.22) return null;
  return 0.5;
}
export function isBlocked(x, z, obstacles, radius = 0.19) {
  if (walkSurface(x, z) === null) return true;
  for (const o of obstacles) {
    if (o.kind === "circle") {
      if (Math.hypot(x - o.x, z - o.z) < o.radius + radius) return true;
      continue;
    }
    const c = Math.cos(o.angle || 0),
      s = Math.sin(o.angle || 0),
      dx = x - o.x,
      dz = z - o.z;
    if (
      Math.abs(dx * c - dz * s) < o.w / 2 + radius &&
      Math.abs(dx * s + dz * c) < o.d / 2 + radius
    )
      return true;
  }
  return false;
}
export function moveOnLand(position, dx, dz, obstacles) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
  let blocked = false;
  for (let i = 0; i < steps; i++) {
    if (
      canStep(
        position.x,
        position.z,
        position.x + dx / steps,
        position.z,
        obstacles,
      )
    )
      position.x += dx / steps;
    else blocked = true;
    if (
      canStep(
        position.x,
        position.z,
        position.x,
        position.z + dz / steps,
        obstacles,
      )
    )
      position.z += dz / steps;
    else blocked = true;
  }
  position.y = walkSurface(position.x, position.z) ?? 0.5;
  return blocked;
}
export function canStep(x, z, nx, nz, obstacles) {
  if (isBlocked(nx, nz, obstacles)) return false;
  const fromBridge = Math.abs(x + 5) < 1.68,
    toBridge = Math.abs(nx + 5) < 1.68;
  if (fromBridge !== toBridge && Math.min(Math.abs(z), Math.abs(nz)) < 8.05)
    return false;
  return (
    Math.abs((walkSurface(nx, nz) ?? 0.5) - (walkSurface(x, z) ?? 0.5)) < 0.62
  );
}
export function clearSegment(from, to, obstacles) {
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.06),
  );
  let previous = from;
  for (let i = 1; i <= steps; i++) {
    const next = {
      x: from.x + ((to.x - from.x) * i) / steps,
      z: from.z + ((to.z - from.z) * i) / steps,
    };
    if (!canStep(previous.x, previous.z, next.x, next.z, obstacles))
      return false;
    previous = next;
  }
  return true;
}
export function nearestWalkable(point, obstacles, radius = 0.19) {
  if (!isBlocked(point.x, point.z, obstacles, radius)) return { ...point };
  for (let ring = 1; ring <= 16; ring++)
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2,
        p = {
          x: point.x + Math.cos(a) * ring * 0.12,
          z: point.z + Math.sin(a) * ring * 0.12,
        };
      if (!isBlocked(p.x, p.z, obstacles, radius)) return p;
    }
  return null;
}
// Small, fixed navigation grid: it follows real walkable land, not straight lines through water.
export function findRoute(start, target, obstacles, maxVisited = Infinity) {
  const cell = 0.4,
    x0 = -38.8,
    z0 = -18.4,
    nx = 195,
    nz = 93,
    total = nx * nz;
  const coord = (id) => ({
    x: x0 + (id % nx) * cell,
    z: z0 + Math.floor(id / nx) * cell,
  });
  const nearest = (p) => {
    const gx = Math.max(0, Math.min(nx - 1, Math.round((p.x - x0) / cell))),
      gz = Math.max(0, Math.min(nz - 1, Math.round((p.z - z0) / cell)));
    for (let r = 0; r <= 4; r++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          const ix = gx + dx,
            iz = gz + dz;
          if (ix < 0 || ix >= nx || iz < 0 || iz >= nz) continue;
          const id = iz * nx + ix,
            c = coord(id);
          if (
            !isBlocked(c.x, c.z, obstacles) &&
            (isBlocked(p.x, p.z, obstacles) || clearSegment(p, c, obstacles))
          )
            return id;
        }
    return -1;
  };
  const a = nearest(start),
    b = nearest(target);
  if (a < 0 || b < 0) return null;
  const parent = new Int32Array(total);
  parent.fill(-1);
  const signature = JSON.stringify(obstacles);
  let grid = routeGrids.get(obstacles);
  if (!grid || grid.signature !== signature) {
    grid = {
      signature,
      valid: new Int8Array(total),
      edges: new Uint8Array(total),
    };
    routeGrids.set(obstacles, grid);
  }
  const queue = new Int32Array(total),
    { valid, edges } = grid;
  let head = 0,
    tail = 1;
  queue[0] = a;
  parent[a] = a;
  while (head < tail && parent[b] < 0 && head < maxVisited) {
    const id = queue[head++],
      p = coord(id),
      ix = id % nx,
      iz = Math.floor(id / nx);
    const neighbors = [
      ix > 0 ? id - 1 : -1,
      ix < nx - 1 ? id + 1 : -1,
      iz > 0 ? id - nx : -1,
      iz < nz - 1 ? id + nx : -1,
    ];
    for (let direction = 0; direction < neighbors.length; direction++) {
      const n = neighbors[direction];
      if (n < 0 || parent[n] >= 0) continue;
      const q = coord(n);
      if (!valid[n]) valid[n] = isBlocked(q.x, q.z, obstacles) ? -1 : 1;
      if (valid[n] < 0) continue;
      const checked = 1 << direction,
        allowed = 1 << (direction + 4);
      if (!(edges[id] & checked)) {
        edges[id] |= checked;
        if (clearSegment(p, q, obstacles)) edges[id] |= allowed;
      }
      if (!(edges[id] & allowed)) continue;
      parent[n] = id;
      queue[tail++] = n;
    }
  }
  if (parent[b] < 0) return null;
  const path = [];
  let at = b;
  while (at !== a) {
    path.push(coord(at));
    at = parent[at];
  }
  path.push(coord(a));
  path.reverse();
  const simplified = [];
  for (let i = 0; i < path.length; i++) {
    const prev = path[i - 1] || start,
      next = path[i + 1];
    if (
      !next ||
      Math.abs(
        (path[i].x - prev.x) * (next.z - path[i].z) -
          (path[i].z - prev.z) * (next.x - path[i].x),
      ) > 0.0001
    )
      simplified.push(path[i]);
  }
  if (
    !isBlocked(target.x, target.z, obstacles) &&
    clearSegment(coord(b), target, obstacles)
  )
    simplified.push({ x: target.x, z: target.z });
  return simplified;
}
