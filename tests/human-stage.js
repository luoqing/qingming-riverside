import * as THREE from 'three';
import {createHumanModel} from '../src/people.js';
const scene=new THREE.Scene();scene.background=new THREE.Color('#d8d0c0');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1200,850);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.style.margin=0;document.body.appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(33,1200/850,.01,30);camera.position.set(2.1,1.65,4.6);camera.lookAt(0,.65,0);
scene.add(new THREE.HemisphereLight('#fff3dd','#6e6c5d',2));const light=new THREE.DirectionalLight('#fff0d0',3);light.position.set(-3,5,4);light.castShadow=true;light.shadow.normalBias=.015;light.shadow.bias=-.0001;light.shadow.mapSize.set(1024,1024);scene.add(light);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:'#c3b9a7',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.005;ground.receiveShadow=true;scene.add(ground);
const model=createHumanModel();const materials={cloth:new THREE.MeshStandardMaterial({color:'#68756a',roughness:1,side:THREE.DoubleSide}),trim:new THREE.MeshStandardMaterial({color:'#d1c2a6'}),sash:new THREE.MeshStandardMaterial({color:'#665344'}),skin:new THREE.MeshStandardMaterial({color:'#c5a081',roughness:.75}),hair:new THREE.MeshStandardMaterial({color:'#29261f'}),pants:new THREE.MeshStandardMaterial({color:'#5b5549'}),shoes:new THREE.MeshStandardMaterial({color:'#333127'}),hat:new THREE.MeshStandardMaterial({color:'#bda474'}),basket:new THREE.MeshStandardMaterial({color:'#a88b59',side:THREE.DoubleSide})};
for(let i=0;i<4;i++){
 const group=new THREE.Group();group.position.x=(i-1.5)*.7;group.rotation.y=[-.25,.5,-.7,Math.PI][i];scene.add(group);
 model.pose(.6,{walking:i===1,carrying:i===2,hat:i===0,shortCoat:i===1,phase:i},(name,matrix)=>{if(!matrix.determinant())return;const spec=model.specs[name],m=new THREE.Mesh(spec.geometry,materials[spec.material]);m.matrixAutoUpdate=false;m.matrix.copy(matrix);m.castShadow=true;m.receiveShadow=true;group.add(m);});
}
renderer.render(scene,camera);window.stageReady=true;
