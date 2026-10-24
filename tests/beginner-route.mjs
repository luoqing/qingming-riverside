import assert from "node:assert/strict";
import {beginnerRoute} from "../src/beginner-route.js";
import {newJourney} from "../src/travel-state.js";
import {VENDORS,SIGHTS,HARBOR} from "../src/travel-data.js";
import {FRIENDS} from "../src/story.js";
const state=newJourney(),steps=beginnerRoute(state);
assert.equal(steps.length,6);assert.equal(steps[0].id,"meet");assert.equal(steps.at(-1).id,"finale");
const destinations=new Set([...VENDORS,...SIGHTS,...FRIENDS,HARBOR].map(d=>d.id));
for(const step of steps){assert.equal(step.done,false);for(const [id] of step.stops)assert.ok(destinations.has(id),`Missing navigation destination ${id}`);}
for(const id of ["invited","drum","gift","ribbon"])state.story.push(id);
state.rides=1;state.poems.push("我在虹桥看见大船。");
assert.equal(beginnerRoute(state).filter(s=>s.done).length,5);
assert.ok(beginnerRoute(state).at(-1).text.includes("约定都做好"));
state.story.push("finale");assert.ok(beginnerRoute(state).every(s=>s.done));
console.log("PASS: six-step route follows real story progress and all navigation actions resolve to actual places");
