// Three overlapping circles cover the body, panniers, neck and head at foot level.
export function camelBodies(position) {
  return [[.38,.52],[-.38,.52],[-1.12,.3]].map(([offset,radius])=>({
    x:position.x+offset,z:position.z,y:.5,radius,kind:"circle",source:"camel",
  }));
}
export function canMoveCamel(from,to,people) {
  const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.04));
  for(let i=1;i<=steps;i++) {
    const at={x:from.x+(to.x-from.x)*i/steps,z:from.z+(to.z-from.z)*i/steps};
    for(const body of camelBodies(at))for(const person of people) {
      if(Math.abs((person.y??.5)-.5)<1.5 &&
        Math.hypot(body.x-person.x,body.z-person.z)<body.radius+person.radius+.025)return false;
    }
  }
  return true;
}
