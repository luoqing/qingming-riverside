import * as THREE from "three";

// Survey the real town once. No second layout, invented building positions or remote map assets.
export function createSurveyMap({
  renderer,
  scene,
  world,
  staticRoot,
  water,
  canopies,
  boats,
  walkingView,
}) {
  let cached = null;
  return () => {
    if (cached) return cached;
    const width = 1536,
      height = 768,
      target = new THREE.WebGLRenderTarget(width, height);
    const camera = new THREE.OrthographicCamera(-43, 43, 21.5, -21.5, 0.1, 160);
    camera.position.set(0, 95, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    const preserved = new Set([
        staticRoot,
        water,
        ...canopies.values(),
        ...boats.map((b) => b.g),
      ]),
      hidden = world.children
        .filter((o) => !preserved.has(o))
        .map((o) => [o, o.visible]);
    const original = {
      target: renderer.getRenderTarget(),
      fog: scene.fog,
      walking: walkingView.value,
      material: water.material,
      before: water.onBeforeRender,
    };
    const plainWater = new THREE.MeshBasicMaterial({
      color: "#6d9c96",
      side: THREE.DoubleSide,
    });
    try {
      for (const [o] of hidden) o.visible = false;
      scene.fog = null;
      walkingView.value = 0;
      water.material = plainWater;
      water.onBeforeRender = () => {};
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      const pixels = new Uint8Array(width * height * 4);
      renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d"),
        data = context.createImageData(width, height);
      for (let row = 0; row < height; row++)
        data.data.set(
          pixels.subarray(
            (height - 1 - row) * width * 4,
            (height - row) * width * 4,
          ),
          row * width * 4,
        );
      context.putImageData(data, 0, 0);
      cached = canvas.toDataURL("image/webp", 0.9);
      return cached;
    } finally {
      renderer.setRenderTarget(original.target);
      scene.fog = original.fog;
      walkingView.value = original.walking;
      water.material = original.material;
      water.onBeforeRender = original.before;
      for (const [o, visible] of hidden) o.visible = visible;
      plainWater.dispose();
      target.dispose();
    }
  };
}
