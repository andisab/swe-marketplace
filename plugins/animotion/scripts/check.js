// check.js — static checks of the scenes in an HTML file (no browser). Returns { errors, warnings, info }.
// The render pass (check --render) is in render.js.
"use strict";
const H = require("./htmlfile");

const HAZARDS = [
  [/\bMath\.random\s*\(/, "Math.random() (use s.rand(), which is seeded, so every frame is reproducible)"],
  [/\bDate\.now\s*\(|\bnew Date\s*\(\s*\)/, "the current date or time (every frame must depend only on the timeline's time)"],
  [/\bperformance\.now\s*\(/, "performance.now() (every frame must depend only on the timeline's time)"],
  [/\bset(?:Timeout|Interval)\s*\(/, "timers (sequence with positions and s.wait instead)"],
  [/\brequestAnimationFrame\s*\(/, "requestAnimationFrame (the runtime owns the clock)"],
  [/\bfetch\s*\(|\bXMLHttpRequest\b/, "network requests (the file must work offline)"],
];
const FOREIGN = [
  [/\bgsap\.|\bTimelineMax\b|\.to\(\s*["'#.]/, "GSAP-style calls (animotion's verbs are s.tween, s.enter, s.move…; wrap a GSAP timeline in s.custom if you bring one)"],
  [/\banime\s*\(|\banime\.timeline\b|\bcreateTimeline\s*\(/, "anime.js calls (wrap them in s.custom, or use animotion's verbs)"],
];

// The timeline's code with comments and string literals blanked, so a hazard is found in code only.
function codeOnly(js) {
  return js.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|(["'`])(?:\\[\s\S]|(?!\1)[^\\])*\1/g, (m) => (m[0] === "/" ? " " : '""'));
}

function checkFile(text) {
  const errors = [], warnings = [], info = [];
  const list = H.scenes(text), named = H.namedDefinitions(text);
  const region = H.runtimeRegion(text);
  if (!list.length) {
    if (region) warnings.push("the file has the animotion runtime but no <am-scene>: run `inline` to remove it");
    else info.push("no <am-scene> in the file");
    return { errors, warnings, info, scenes: [] };
  }
  const linked = (/<script\b[^>]*\bsrc=["']([^"']*animotion\.js)["']/i.exec(text) || [])[1];
  if (!region && linked) info.push(`loads the runtime from ${linked}, so the file isn't self-contained (fine for a guide or a page served with the plugin; run \`animotion inline\` for a deliverable)`);
  else if (!region) errors.push("the animotion runtime isn't in the file: run `animotion inline <file>`");
  else if (region.version !== H.runtimeVersion() || region.content.trim() !== H.safeScript(H.runtimeJs()).trim()) warnings.push(region.version === H.runtimeVersion() ? "the runtime differs from the plugin's copy of the same version: run `animotion inline <file>` to refresh it" : `the runtime (${region.version || "?"}) is not the plugin's ${H.runtimeVersion()}: run \`animotion inline <file>\` to refresh it`);

  const names = new Map();
  for (const s of list) {
    const where = `scene ${s.attrs.name ? `"${s.attrs.name}"` : `#${s.index + 1}`} (line ${s.line})`;
    const E = (m) => errors.push(`${where}: ${m}`), W = (m) => warnings.push(`${where}: ${m}`);
    if (s.error) { E(s.error); continue; }
    if (s.attrs.name) { if (names.has(s.attrs.name)) W(`the name is also used on line ${names.get(s.attrs.name)}`); names.set(s.attrs.name, s.line); }
    if (s.template === null) E("has no <template> (the scene's markup and timeline go inside one)");
    const hasCode = !!s.code.trim(), hasNamed = s.attrs.name && named.has(s.attrs.name);
    if (!hasCode && !hasNamed && s.attrs.duration === undefined) E(`has no timeline: add <script type="text/animotion"> inside the template${s.attrs.name ? `, or AM.scene("${s.attrs.name}", …)` : ""}, or a duration for a CSS-only scene`);
    if (!s.attrs["aria-label"] && !s.attrs["aria-labelledby"]) E("needs aria-label: one sentence saying what the animation shows (screen readers get it instead of the motion)");
    if (s.attrs.loop === undefined && s.attrs.poster === undefined) info.push(`${where}: poster defaults to the end; name the last resolved beat's label (poster="done") so adding a hold or a beat doesn't move it`);
    if (s.attrs.loop !== undefined && s.attrs.poster === undefined) W("loops but names no poster: add poster=\"<label>\" for the frame still views show (the last frame of a loop is often its least telling)");
    if (s.attrs.loop !== undefined && s.attrs.controls === "none") W("loops with controls=\"none\": auto-playing motion longer than 5 s needs a way to pause it (WCAG 2.2.2)");
    if (s.attrs.trigger === "steps" && !s.cues.length) W('trigger="steps" without <am-cue data-step="n" to="label"> children: nothing tells it where each build stops');
    for (const c of s.cues) {
      if (!c["data-step"] || !/^\d+$/.test(c["data-step"])) W("an <am-cue> needs data-step=\"n\"");
      if (!c.to) W("an <am-cue> needs to=\"<label>\"");
    }
    if (s.attrs.trigger && !["enter", "steps", "manual"].includes(s.attrs.trigger)) E(`trigger="${s.attrs.trigger}" isn't one of enter, steps, manual`);
    if (s.attrs.reset && !["fade", "cut"].includes(s.attrs.reset)) E(`reset="${s.attrs.reset}" isn't fade or cut`);
    if (s.attrs.loop !== undefined && s.attrs.loop !== "" && s.attrs.loop !== "infinite" && !/^\d+$/.test(s.attrs.loop)) E(`loop="${s.attrs.loop}" isn't a count or "infinite"`);
    if (hasCode) {
      try { new Function("s", "AM", s.code); } catch (e) { E(`the timeline doesn't parse: ${e.message}`); }
      const bare = codeOnly(s.code);   // comments and string literals can mention anything
      for (const [re, msg] of HAZARDS) if (re.test(bare)) E(`the timeline uses ${msg}`);
      for (const [re, msg] of FOREIGN) if (re.test(bare) && !/s\.custom\s*\(/.test(bare)) W(`the timeline looks like ${msg}`);
    }
    const tpl = s.template || "";
    if (H.kitRegion && H.kitRegion(text) && /--am-dur-[a-z]+\s*:/.test(tpl)) W("its template defines --am-* tokens the page's kit already provides; inline copies animotion/kit.html into every scene, so drop the copy from the template");
    if (/\b(?:class|id)=["'][^"']*\bsw-/.test(tpl) || /\bdata-sw-/.test(tpl)) W("uses sw- names inside the template; those belong to slideware's runtime");
    if (/(?:^|[;{\s])transition(?:-duration)?\s*:\s*(?!none\b)[^;}]*\d/i.test(tpl.replace(/<script[\s\S]*?<\/script>/gi, ""))) W("its CSS has a transition; transitions don't run inside a scene (the runtime turns them off so every frame is exact): animate the change with a verb (tween, set with a tween) instead");
    if (/animation(?:-iteration-count)?\s*:[^;}]*\binfinite\b/i.test(tpl)) W("a CSS animation in the template repeats infinitely; give it a finite count so the scene can be sought (it joins the scene's clock)");
    if (/(?:src|href)\s*=\s*["'](?:https?:)?\/\//i.test(tpl) || /url\(\s*["']?(?:https?:)?\/\//i.test(tpl)) W("loads something from the network; embed it (data: URI or inline SVG) so the file works offline");
  }
  info.push(`${list.length} scene${list.length === 1 ? "" : "s"}; runtime ${region ? region.version : linked ? "linked, " + linked : "missing"}`);
  return { errors, warnings, info, scenes: list };
}

module.exports = { checkFile, codeOnly };
