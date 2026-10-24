import {
  findRoute,
  nearestWalkable,
  clearSegment,
  walkSurface,
  canStep,
  isBlocked,
} from "./walk.js";
import { riverCenter, riverWidth } from "./paths.js";

export function makeWalkPath(start, end, obstacles) {
  const a = nearestWalkable(start, obstacles),
    b = nearestWalkable(end, obstacles);
  if (!a || !b) return null;
  const route = findRoute(a, b, obstacles);
  if (!route) return null;
  const points = [a, ...route].filter(
    (p, i, all) =>
      !i || Math.hypot(p.x - all[i - 1].x, p.z - all[i - 1].z) > 0.001,
  );
  if (points.length < 2) return null;
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    if (!clearSegment(points[i - 1], points[i], obstacles)) return null;
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].z - points[i - 1].z,
        ),
    );
  }
  const length = lengths.at(-1);
  function sample(progress) {
      const cycle = ((progress % (length * 2)) + length * 2) % (length * 2),
        forward = cycle < length,
        d = forward ? cycle : length * 2 - cycle;
      let index = 1;
      while (index < lengths.length - 1 && lengths[index] < d) index++;
      const p = points[index - 1],
        q = points[index],
        t = (d - lengths[index - 1]) / (lengths[index] - lengths[index - 1]),
        x = p.x + (q.x - p.x) * t,
        z = p.z + (q.z - p.z) * t;
      return {
        x,
        z,
        y: walkSurface(x, z) ?? 0.5,
        yaw: Math.atan2(
          (q.x - p.x) * (forward ? 1 : -1),
          (q.z - p.z) * (forward ? 1 : -1),
        ),
      };
  }
  return {
    points,
    length,
    sample,
    // Distinct outward/return lanes joined by semicircles: no instant 180°
    // pivot at a dead end and no head-on traffic on the same centre line.
    sampleLoop(progress, lane = 0.3) {
      const cap = Math.PI * lane, period = length * 2 + cap * 2;
      const s = ((progress % period) + period) % period;
      if (s < length || (s >= length + cap && s < length * 2 + cap)) {
        const returning = s >= length + cap;
        const d = returning ? length * 2 + cap - s : s;
        const center = sample(d), a = sample(Math.max(0, d - .15)), b = sample(Math.min(length - .00001, d + .15));
        const yaw = Math.atan2(b.x - a.x, b.z - a.z) + (returning ? Math.PI : 0);
        return {x:center.x + Math.cos(yaw)*lane, z:center.z - Math.sin(yaw)*lane, yaw, center};
      }
      const atEnd = s < length + cap, center = sample(atEnd ? length - .00001 : 0);
      const yaw = center.yaw + (atEnd ? 0 : Math.PI);
      const angle = (atEnd ? s - length : s - length * 2 - cap) / lane;
      return {x:center.x + lane*Math.cos(yaw-angle), z:center.z - lane*Math.sin(yaw-angle), yaw:yaw-angle, center};
    },
  };
}
export function createCrowdPaths(obstacles, fixed = []) {
  // Plan for a body, not a point. Story characters also occupy the street.
  const corridors = [...obstacles, ...fixed.map(p=>({...p,kind:"circle"}))].map(o=>
    o.kind === "circle" ? {...o,radius:o.radius+.12} : {...o,w:o.w+.24,d:o.d+.24});
  const bank = {};
  for (const side of [-1, 1]) {
    bank[side] = [];
    for (const margin of [1.05, 1.8]) {
      const at = (x) => ({
        x,
        z: riverCenter(x) + side * (riverWidth(x) + margin),
      });
      const path = makeWalkPath(at(-35), at(35), corridors);
      if (path) bank[side].push(path);
    }
  }
  const bridge = [-0.95, 0, 0.95]
    .map((offset) =>
      makeWalkPath(
        { x: -5 + offset, z: -9.1 },
        { x: -5 + offset, z: 9.1 },
        corridors,
      ),
    )
    .filter(Boolean);
  const rear = [
    makeWalkPath({ x: 14, z: -9.3 }, { x: 30.6, z: -15.1 }, corridors),
  ].filter(Boolean);
  const market = [10.9, 12.4, 14.6].map(z =>
    makeWalkPath({x: -20, z}, {x: 5, z}, corridors),
  ).filter(Boolean);
  return { bank, bridge, rear, market };
}

// Every pedestrian has a body, not just a point sliding along a shared spline.
export function createCrowdMotion(actors, obstacles, fixed = []) {
  // Broad phase shared by all steering candidates. Test exact shapes only in
  // this cell, including a body/step margin around each obstacle's bounds.
  const grid = new Map();
  for (const o of obstacles) {
    const r = (o.kind === "circle" ? o.radius : Math.hypot(o.w,o.d)/2) + .7;
    for(let x=Math.floor((o.x-r)/2);x<=Math.floor((o.x+r)/2);x++)
      for(let z=Math.floor((o.z-r)/2);z<=Math.floor((o.z+r)/2);z++) {
        const key=`${x},${z}`;
        if(!grid.has(key))grid.set(key,[]);
        grid.get(key).push(o);
      }
  }
  const placed = [];
  for (const a of actors) {
    a.radius = 0.26 * a.scale;
    const at = a.path ? a.path.sampleLoop(a.progress) : a;
    const spawnY = walkSurface(at.x,at.z) ?? .5;
    const circles = [...fixed, ...placed].filter(p => Math.abs((p.y ?? 0.5) - spawnY) < 1.5)
      .map(p => ({ ...p, kind: "circle" }));
    const safe = nearestWalkable(at, [...obstacles, ...circles], a.radius);
    if (!safe) throw new Error("No safe pedestrian spawn");
    a.x = safe.x; a.z = safe.z; a.y = walkSurface(a.x, a.z);
    a.yaw = at.yaw ?? a.phase;
    a.walkClock = 0;
    a.moving = false;
    a.stuck = 0;
    a.turnCooldown = 0;
    placed.push(a);
  }
  let pending = 0, planBudget = 0;
  return function advance(dt, blockers = fixed) {
    // Fixed simulation ticks keep avoidance and recovery identical at different
    // render rates. A long frame must not starve all but one blocked walker.
    const step = .025;
    pending += Math.max(0, Math.min(dt, .7));
    const steps = Math.floor((pending + 1e-9) / step);
    pending -= steps * step;
    for (const a of actors) a.moving = false;
    for (let tick = 0; tick < steps; tick++) {
    let planned = false;
    planBudget = Math.min(.05, planBudget + step);
    for (const a of actors) {
      if (!a.path || !step) continue;
      const solids = grid.get(`${Math.floor(a.x/2)},${Math.floor(a.z/2)}`) || [];
      const speed = Math.abs(a.speed) * 32;
      while(a.detour?.length && Math.hypot(a.detour[0].x-a.x,a.detour[0].z-a.z)<.16)a.detour.shift();
      if(a.detour && !a.detour.length) {a.detour=null;a.progress=a.detourEnd;}
      let target = a.detour?.[0] || a.path.sampleLoop(a.progress + .7);
      if(target.center && isBlocked(target.x,target.z,obstacles,a.radius))target=target.center;
      // Spawn separation or cutting a corner can put the body ahead of its
      // cursor. Reaching the look-ahead point must advance it, not stop forever.
      if(!a.detour && Math.hypot(target.x-a.x,target.z-a.z)<.18) {
        a.progress+=.6;
        target=a.path.sampleLoop(a.progress+.7);
        if(isBlocked(target.x,target.z,obstacles,a.radius))target=target.center;
      }
      let dx = target.x - a.x, dz = target.z - a.z;
      const norm = Math.hypot(dx,dz) || 1;
      dx/=norm;dz/=norm;
      const nearby = [...actors, ...blockers].filter(b => b !== a &&
        Math.hypot(a.x-b.x, a.z-b.z) < 1.5);
      // Choose the same passing side early, rather than pushing directly back
      // against another pedestrian and oscillating between opposite decisions.
      for (const b of nearby) {
        if(Math.abs((b.y ?? .5)-a.y)>1.5)continue;
        const x = b.x-a.x, z = b.z-a.z, d = Math.hypot(x,z);
        const ahead = x*dx+z*dz, side = x*dz-z*dx;
        if(ahead>0 && Math.abs(side)<a.radius+b.radius+.15) {
          const pressure=Math.max(0,1.4-d)*.8;
          const rightX=dz,rightZ=-dx;
          dx+=rightX*pressure;dz+=rightZ*pressure;
        }
      }
      const heading = Math.atan2(dx,dz), amount = speed*step;
      let best = null, score = -Infinity;
      for (const turn of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.55, -1.55]) {
        const yaw = heading+turn, x = a.x+Math.sin(yaw)*amount, z = a.z+Math.cos(yaw)*amount;
        if (!canStep(a.x,a.z,x,z,solids) || isBlocked(x,z,solids,a.radius)) continue;
        const y=walkSurface(x,z);
        if (nearby.some(b => Math.abs((b.y ?? .5)-y)<1.5 && Math.hypot(x-b.x,z-b.z) < a.radius+b.radius+0.015)) continue;
        const value = (Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(x-target.x,z-target.z))/Math.max(amount,0.0001)
          - Math.abs(turn)*.1 - Math.abs(Math.atan2(Math.sin(yaw-a.yaw),Math.cos(yaw-a.yaw)))*.08;
        if (value > score) { score=value; best={x,z,yaw}; }
      }
      // A narrow bridge can require waiting. Never resolve a blockage by teleporting.
      if (best && score > -.08) {
        const moved=Math.hypot(best.x-a.x,best.z-a.z);
        a.x=best.x; a.z=best.z; a.y=walkSurface(a.x,a.z);
        const angle=Math.atan2(Math.sin(best.yaw-a.yaw),Math.cos(best.yaw-a.yaw));
        a.yaw += Math.max(-step*3,Math.min(step*3,angle));
        a.walkClock += moved/(.42*a.scale);
        if(!a.detour)a.progress += moved;
        a.moving=true;
        a.stuck=Math.max(0,a.stuck-step*2);
      } else a.stuck+=step;
      a.turnCooldown=Math.max(0,a.turnCooldown-step);
      // Try a short walkable detour before turning back to the other lane.
      // Only the walking target changes; the body never teleports or overlaps.
      if(a.stuck>1.5 && !a.turnCooldown && !planned && planBudget >= .05) {
        planned = true;
        planBudget = 0;
        const pad=Math.max(0,a.radius-.19)+.025;
        const around=[...obstacles,...nearby.filter(b=>Math.abs((b.y??.5)-a.y)<1.5).map(b=>({x:b.x,z:b.z,radius:b.radius,kind:"circle"}))]
          .map(o=>o.kind==="circle" ? {...o,radius:o.radius+pad} : {...o,w:o.w+pad*2,d:o.d+pad*2});
        const future=a.path.sampleLoop(a.progress+3);
        const goal=nearestWalkable(future,around,a.radius);
        // Background walkers must not search an entire town for a local dodge.
        const detour=goal && findRoute(a,goal,around,400);
        const cap=Math.PI*.3, period=2*a.path.length+2*cap;
        if(detour?.length) {a.detour=detour;a.detourEnd=a.progress+3;}
        else {a.detour=null;a.progress=period-cap-a.progress;}
        a.stuck=0;a.turnCooldown=6;
      }
    }
    }
  };
}
