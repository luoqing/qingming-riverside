import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { legGait } from "./gait.js";
import boyUrl from "../characters/boy-standard/tripo-out/qingming-boy-standard-rig-24d61ba9/model.glb";
import girlUrl from "../characters/girl-standard/tripo-out/qingming-girl-standard-rig-7af0cbc0/model.glb";

// Real Tripo skinned meshes. Locomotion is applied to the exported bones in their
// own rest frames, so generation-specific axes do not disconnect the joints.
export function createHeroVisual(parent) {
  const models=new Map(), errors=[];
  const loader=new GLTFLoader();
  let selected="female", clock=0;
  for (const [gender,url] of [["male",boyUrl],["female",girlUrl]]) {
    loader.load(url,gltf=>{
      const root=new THREE.Group(), scene=gltf.scene;
      const bounds=new THREE.Box3().setFromObject(scene), size=bounds.getSize(new THREE.Vector3());
      const forwardX=size.z>size.x;
      root.rotation.y=forwardX ? -Math.PI/2 : 0;
      root.scale.setScalar(1.2/size.y);
      root.add(scene);parent.add(root);
      const bones=[];
      scene.traverse(object=>{
        if(object.isMesh) {object.castShadow=true;object.receiveShadow=true;object.frustumCulled=false;}
        if(object.isBone) bones.push({object,rest:object.quaternion.clone(),position:object.position.clone()});
      });
      root.updateMatrixWorld(true);
      const inverse=root.matrixWorld.clone().invert();
      for(const bone of bones) {
        const world=bone.object.getWorldQuaternion(new THREE.Quaternion());
        // World X maps to model-local side after the +X-forward export is rotated.
        const side=new THREE.Vector3(forwardX ? 0 : 1,0,forwardX ? 1 : 0).transformDirection(root.matrixWorld);
        bone.bendAxis=side.applyQuaternion(world.clone().invert()).normalize();
        bone.dropAxis=new THREE.Vector3(forwardX ? 1 : 0,0,forwardX ? 0 : 1).transformDirection(root.matrixWorld).applyQuaternion(world.clone().invert()).normalize();
        bone.restPoint=bone.object.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
      }
      // Tripo assigns different limb numbers in each generation. Classify joints
      // by their actual rest positions and descendants, never by those numbers.
      const child=b=>bones.filter(k=>k.object.parent===b.object).sort((a,c)=>a.restPoint.y-c.restPoint.y)[0];
      const choose=(side,kind)=>bones.filter(b=>{
        const p=b.restPoint,k=child(b)?.restPoint;
        return p.z*side>0.035 && p.z*side<0.14 && k &&
          (kind==="leg" ? p.y>0.3 && p.y<0.52 && p.y-k.y>0.12 :
            p.y>0.57 && p.y<0.75 && p.y-k.y>0.05 && Math.abs(k.z)>Math.abs(p.z)+0.035);
      }).sort((a,b)=>Math.abs(a.restPoint.y-(kind==="leg"?0.44:0.66))-Math.abs(b.restPoint.y-(kind==="leg"?0.44:0.66)))[0];
      const named=name=>bones.find(b=>b.object.name.endsWith(name));
      const arms=[named("RightArm")||choose(-1,"arm"),named("LeftArm")||choose(1,"arm")];
      const legs=[named("RightUpLeg")||choose(-1,"leg"),named("LeftUpLeg")||choose(1,"leg")];
      const hand=named("RightHand")||bones.filter(b=>b.restPoint.z<-.21 && b.restPoint.y<.56 && b.restPoint.y>.4)
        .sort((a,b)=>Math.abs(a.restPoint.z+.245)-Math.abs(b.restPoint.z+.245))[0];
      const head=named("Head")||bones.filter(b=>b.object.name.includes("Head_")&&b.restPoint.y>.7&&b.restPoint.y<.8)
        .sort((a,b)=>a.restPoint.y-b.restPoint.y)[0];
      const namedFeet=bones.filter(b=>/Foot$|ToeBase$/.test(b.object.name));
      for(const arm of arms) if(arm) {
        const elbow=child(arm);
        const lateral=forwardX ? "z" : "x";
        const spread=elbow ? elbow.restPoint[lateral]-arm.restPoint[lateral] : 0;
        const down=elbow ? arm.restPoint.y-elbow.restPoint.y : 1;
        arm.dropAngle=Math.sign(spread)*Math.atan2(Math.abs(spread),Math.max(.001,down))*.7;
      }
      const gripOffset=new THREE.Vector3(), gripRotation=new THREE.Quaternion();
      let gripWeight=0;
      if(hand) {
        // Locate the palm from vertices actually weighted to this hand, rather
        // than attaching the handle to the wrist joint or a world-space offset.
        scene.traverse(mesh=>{
          if(!mesh.isSkinnedMesh)return;
          const joint=mesh.skeleton.bones.indexOf(hand.object);
          if(joint<0)return;
          const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
          for(let i=0;i<position.count;i++) {
            let weight=0;
            for(let k=0;k<4;k++)if(skinIndex.getComponent(i,k)===joint)weight+=skinWeight.getComponent(i,k);
            if(weight<.5)continue;
            const p=new THREE.Vector3().fromBufferAttribute(position,i);
            mesh.localToWorld(p); hand.object.worldToLocal(p);
            gripOffset.addScaledVector(p,weight);gripWeight+=weight;
          }
        });
        if(gripWeight)gripOffset.divideScalar(gripWeight);
        // Calibrate an upright handle in the neutral bent-elbow carry pose.
        // Subsequent wrist/arm rotation then moves the prop with the palm.
        const arm=arms[0], elbow=arm && child(arm), q=new THREE.Quaternion();
        if(arm) {
          arm.object.quaternion.multiply(q.setFromAxisAngle(arm.dropAxis,arm.dropAngle));
          arm.object.quaternion.multiply(q.setFromAxisAngle(arm.bendAxis,.22));
        }
        if(elbow)elbow.object.quaternion.multiply(q.setFromAxisAngle(elbow.bendAxis,1.1));
        parent.updateMatrixWorld(true);
        gripRotation.copy(hand.object.getWorldQuaternion(q)).invert()
          .multiply(parent.getWorldQuaternion(new THREE.Quaternion()));
        for(const b of bones)b.object.quaternion.copy(b.rest);
      }
      models.set(gender,{root,bones,arms,legs,hand,head,child,gripOffset,gripRotation,feet:namedFeet.length ? namedFeet : bones.filter(b=>b.restPoint.y<.08 && !/Root$/.test(b.object.name))});
      root.visible=gender===selected;
    },undefined,error=>errors.push(String(error.message||error)));
  }
  const turn=new THREE.Quaternion();
  return {
    update(dt,gender,pose,handPoint) {
      selected=gender;clock+=dt*(pose.running ? 1.6 : 1);
      for(const [key,model] of models) model.root.visible=key===gender;
      const model=models.get(gender);if(!model)return false;
      for(const b of model.bones) {b.object.quaternion.copy(b.rest);b.object.position.copy(b.position);}
      const gait=pose.walking ? Math.sin(clock*6.2) : 0;
      const bend=(b,angle)=>{if(b)b.object.quaternion.multiply(turn.setFromAxisAngle(b.bendAxis,angle));};
      model.legs.forEach((b,i)=>{
        const stride=legGait(clock*6.2+(i ? Math.PI : 0),pose.running);
        bend(b,pose.seated ? -1.1 : pose.walking ? stride.hip : 0);
        const knee=b && model.child(b);
        bend(knee,pose.seated ? 1.35 : pose.walking ? stride.knee : 0);
        if(knee && !pose.seated && pose.walking) bend(model.child(knee),stride.ankle);
      });
      model.arms.forEach((b,i)=>{
        if(b)b.object.quaternion.multiply(turn.setFromAxisAngle(b.dropAxis,b.dropAngle));
        const carrying=pose.holdingToy && i===0;
        bend(b,carrying ? .22+gait*.04 : gait*(i ? 1 : -1)*(pose.running ? .42 : .36));
        if(b)bend(model.child(b),carrying ? 1.1+(pose.playing ? Math.sin(clock*12)*.07 : 0) : pose.running ? .45 : .12);
      });
      bend(model.head,Math.sin(clock*0.7)*0.025);
      model.root.position.y=pose.seated ? -0.28 : pose.walking ? Math.cos(clock*12.4)*0.022 : Math.sin(clock*1.5)*0.003;
      parent.updateMatrixWorld(true);
      if(!pose.seated && model.feet.length) {
        const point=new THREE.Vector3();let lowest=Infinity;
        for(const foot of model.feet) {foot.object.getWorldPosition(point);parent.worldToLocal(point);lowest=Math.min(lowest,point.y);}
        model.root.position.y+=0.012-lowest;
        parent.updateMatrixWorld(true);
      }
      if(model.hand && handPoint) {
        handPoint.position.copy(model.gripOffset);
        model.hand.object.localToWorld(handPoint.position);
        parent.worldToLocal(handPoint.position);
        handPoint.quaternion.copy(parent.getWorldQuaternion(new THREE.Quaternion())).invert()
          .multiply(model.hand.object.getWorldQuaternion(new THREE.Quaternion()))
          .multiply(model.gripRotation);
        handPoint.scale.set(1,1,1);
      }
      return true;
    },
    get ready(){return models.has(selected);},
    get status(){return {loaded:[...models.keys()],errors:[...errors],source:"Tripo P1 / Mixamo humanoid rig",animation:"procedural-skeleton",
      joints:[...models].map(([gender,m])=>({gender,arms:m.arms.map(b=>b?.object.name),legs:m.legs.map(b=>b?.object.name),
        gripOffset:m.gripOffset.toArray(),fingerBones:m.bones.filter(b=>/Thumb|Index|Middle|Ring|Pinky/.test(b.object.name)).length,
        rotations:[...m.arms,...m.legs].map(b=>b?.object.quaternion.toArray()),
        kneeBendDegrees:m.legs.map(hip=>{
          const knee=hip && m.child(hip), foot=knee && m.child(knee);
          if(!hip || !knee || !foot)return null;
          const a=hip.object.getWorldPosition(new THREE.Vector3()),b=knee.object.getWorldPosition(new THREE.Vector3()),c=foot.object.getWorldPosition(new THREE.Vector3());
          return 180-THREE.MathUtils.radToDeg(a.sub(b).angleTo(c.sub(b)));
        })}))};},
  };
}
