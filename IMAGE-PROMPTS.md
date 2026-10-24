# 图像生成记录

生成方式：内置 image_gen。多角度图使用用户提供的参考图片，材质图独立生成。图片用于辅助设计和真实几何的表面材质，未用作伪三维背景。

## 多角度模型参考

保存为 `modeling-reference.png`。

```text
Use case: stylized-concept. Asset type: coherent multi-view modeling reference contact sheet for a Three.js miniature diorama. Input image 1 is the reference for the miniature scenery, materials, and layout. Produce a single beautiful landscape sheet with FOUR views of THE EXACT SAME physical diorama: large front three-quarter view, rear three-quarter view, opposite bank view, and overhead plan. Preserve identical spatial relationships in every view, do not invent a different city in each panel. Fixed layout: long rectangular parchment scroll base, river running left-to-right through the middle with a bend on the far left; ONE tall arched timber rainbow bridge crossing north-south slightly left of center; low timber grey tiled Song-style shop blocks along north bank; a grey city gate with two-storey wooden gate tower north-east of the bridge; one slender brick pagoda further north-east; bustling market and willow trees on near south bank; multiple wooden covered cargo boats on river. Front has market foreground and bridge leading toward north town; rear reveals courtyard backs, gate rear and bridge timber trusses, NOT a second facade randomly replacing the rear. Miniature physical model craftsmanship: curved grey roof tiles, aged brown timber, sand colored paths, muted green trees, jade-grey water, warm daylight with gentle shadows. Keep one contiguous model and consistent footprint, counts of bridge/gate/pagoda, same boats and architectural palette in all panels. No UI, no labels, no text. Aim at faithful buildable forms rather than an impossible painting.
```

## 材质图集

保存为 `src/material-atlas.png`。四个象限在浏览器内分别取样，最终图片数据内嵌在 HTML 中。

```text
Use case: stylized-concept. Asset type: photorealistic material texture atlas for a 3D scale miniature ancient Chinese town. One square image divided into EXACTLY FOUR equally sized quadrants, no margins, no gutter, no labels. TOP LEFT: aged warm brown wood boards, fine authentic irregular grain, boards run horizontally, subtle dark joints, no nails. TOP RIGHT: tightly packed traditional dark grey Chinese fired-clay roof tiles, viewed perfectly perpendicular from directly above, fine arched tile channels, rows of overlapping little tiles, subtle moss and weathering, medium dark neutral grey, NOT blue, NOT gold, NOT an entire roof or building. BOTTOM LEFT: fine dry sandy tan soil, tiny stones, irregular scattered subtle muted olive moss patches, no objects. BOTTOM RIGHT: dense natural tiny olive-green and sage-green deciduous leaves, small individual leaves with realistic fine veins and dark gaps, flat texture surface, no big branches, no sky. All materials evenly lit diffuse natural light, no strong directional shadows, no perspective, no borders, high fine surface detail. The four quadrants are raw material surfaces intended to be cut out and wrapped onto 3D geometry, not a collage of objects.
```

生成图不能保证所有不可见细节严格一致。因此最终一致性由同一个 Three.js 场景保障，所有相机视角均观察同一份模型。
