export const wrap01 = (value) => ((value % 1) + 1) % 1;
export const riverCenter = (x) => Math.sin((x + 11) * 0.075) * 1.8 - 0.6;
export const riverWidth = (x) => 5 + 0.5 * Math.cos(x * 0.12);
export const bridgeHeight = (z) =>
  0.68 + 4.15 * Math.pow(Math.max(0, 1 - (z / 7.7) ** 2), 1.13);
export const BOAT_SPEED_MULTIPLIER = 2.4;

// Moving vessels turn in the river instead of crossing the parchment at its ends.
export function boatPose(boat, time) {
  if (!boat.speed)
    return { x: boat.x, z: riverCenter(boat.x) + boat.lane, yaw: 0 };
  const radius = 38 - boat.length * 0.5;
  const angle =
    Math.asin(Math.max(-1, Math.min(1, boat.x / radius))) +
    (time * boat.speed * BOAT_SPEED_MULTIPLIER) / radius;
  const x = radius * Math.sin(angle),
    dx = boat.speed * Math.cos(angle);
  const dz =
    Math.cos((x + 11) * 0.075) * 1.8 * 0.075 * dx -
    (boat.lane * Math.sin(angle) * boat.speed) / radius;
  return {
    x,
    z: riverCenter(x) + boat.lane * Math.cos(angle),
    yaw: -Math.atan2(dz, dx),
  };
}
