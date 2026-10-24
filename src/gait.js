// +X-forward Tripo exports rotate around their lateral axis: positive hip
// rotation lifts the thigh forward; knee flexion must use the opposite sign.
export function legGait(phase, running = false) {
  const swing = Math.sin(phase);
  const recovery = Math.max(0, -swing);
  return {
    hip: swing * (running ? 0.78 : 0.52),
    knee: -(running ? 0.2 + recovery * 1.25 : 0.1 + recovery * 0.62),
    ankle: running ? recovery * 0.45 : recovery * 0.24,
  };
}
