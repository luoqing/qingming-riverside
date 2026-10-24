import { riverCenter, riverWidth } from "./paths.js";

// Same world coordinates as the town. The survey image supplies detail; these
// layers make the actual river, streets and solid footprints legible for navigation.
export function navigationLayers(obstacles) {
  const bank = (side, offset = 0) =>
    Array.from({ length: 81 }, (_, i) => {
      const x = -40 + i;
      return [x, riverCenter(x) + side * (riverWidth(x) + offset)];
    });
  const line = (points) =>
    points.map((p, i) => `${i ? "L" : "M"}${p.join(" ")}`).join(" ");
  const river = `${line(bank(-1))} ${bank(1)
    .reverse()
    .map((p) => `L${p.join(" ")}`)
    .join(" ")} Z`;
  const roads = [-1, 1].map((side) => line(bank(side, 1.55).slice(1, -1)));
  const blocks = obstacles
    .filter(
      (o) =>
        o.kind === "rect" &&
        [
          "building",
          "city-wall",
          "courtyard-wall",
          "orchard-wall",
          "stall-table",
        ].includes(o.source),
    )
    .map(
      (o) =>
        `<rect x="${o.x - o.w / 2}" y="${o.z - o.d / 2}" width="${o.w}" height="${o.d}" transform="rotate(${(-(o.angle || 0) * 180) / Math.PI} ${o.x} ${o.z})" class="${o.source === "stall-table" ? "map-stall" : "map-building"}"/>`,
    )
    .join("");
  return `<g data-layer="river"><path d="${river}" class="map-river"/></g>
    <g data-layer="roads"><path d="M-21 7.1 L7 7.2 Q10 11.5 5 15.5 L-19 15.4 Q-23 12 -21 7.1 Z" class="map-market"/>
      ${roads.map((d) => `<path d="${d}" class="map-road-edge"/><path d="${d}" class="map-road"/>`).join("")}
      <path d="M-5 -9 L-5 9" class="map-bridge"/>
    </g><g data-layer="buildings">${blocks}</g>
    <g data-layer="route"><path class="map-route-halo"/><path class="map-route"/></g>`;
}
export function routePath(start, route) {
  if (!route?.length) return "";
  return [start, ...route]
    .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.z}`)
    .join(" ");
}
