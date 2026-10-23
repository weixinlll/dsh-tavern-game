// Compact battle setup and play surface for the dsh-tavern-game plugin.
// Visual direction: Swiss — a white, hairline grid and one clear blue accent keep
// a dense six-person party readable. The signature move is a single blue action
// bar above a quiet, collapsible roster; the full-screen scene gets the space.
window.__ModuleLoader__.load({
  id: 'dsh-tavern-game',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef } = React
    const useLayoutEffect = React.useLayoutEffect || useEffect
    const PLUGIN = 'dsh-tavern-game'
    const PREFIX = `${PLUGIN}/`
    const CSS = `
.stg{--ink:#182230;--muted:#617084;--line:#dce3ea;--paper:#fff;--wash:#f5f7f9;--blue:#155eef;--blue-dark:#1246b8;--red:#c63d4d;box-sizing:border-box;color:var(--ink);background:var(--paper);font:14px/1.45 "Helvetica Neue",Arial,system-ui,sans-serif;min-width:0;overflow-wrap:anywhere}
.stg *{box-sizing:border-box}.stg button,.stg input,.stg select,.stg textarea{font:inherit;color:inherit}.stg button{cursor:pointer}.stg button:focus-visible,.stg input:focus-visible,.stg select:focus-visible,.stg textarea:focus-visible,.stg summary:focus-visible{outline:2px solid var(--blue);outline-offset:2px}.stg button:disabled{opacity:.48;cursor:not-allowed}.stg input,.stg select{min-width:0;width:100%;min-height:34px;border:1px solid var(--line);border-radius:5px;padding:5px 8px;background:#fff}.stg button{min-height:34px;border:1px solid var(--line);border-radius:5px;background:#fff;padding:6px 10px}.stg button:hover:not(:disabled){border-color:var(--blue);color:var(--blue-dark)}.stg .stg-primary{background:var(--blue);border-color:var(--blue);color:#fff;font-weight:650}.stg .stg-primary:hover:not(:disabled){background:var(--blue-dark);color:#fff}.stg small,.stg .stg-muted{color:var(--muted)}.stg p,.stg h1,.stg h2,.stg h3{margin:0}.stg .stg-wrap{width:min(100%,840px);margin:0 auto;padding:14px}.stg .stg-head{display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid var(--line)}.stg .stg-head h1{font-size:18px;line-height:1.2;letter-spacing:-.02em}.stg .stg-head small{margin-left:auto}.stg .stg-controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;padding:12px 0;border-bottom:1px solid var(--line)}.stg .stg-controls label{display:block;color:var(--muted);font-size:12px}.stg .stg-controls select{margin-top:4px}.stg .stg-mainbtn{min-height:38px;padding:7px 13px}.stg .stg-msg{min-height:20px;margin:6px 0;color:var(--muted);font-size:12px}.stg .stg-msg[data-error=true]{color:var(--red)}.stg .stg-section{padding-top:6px}.stg .stg-sectionhead{display:flex;align-items:center;gap:8px;margin:5px 0 8px}.stg .stg-sectionhead h2{font-size:14px}.stg .stg-sectionhead small{margin-left:auto}.stg .stg-party{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.stg .stg-card{border:1px solid var(--line);border-radius:6px;background:#fff;min-width:0}.stg .stg-card summary{list-style:none;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;cursor:pointer;padding:8px 10px;min-height:42px}.stg .stg-card summary::-webkit-details-marker{display:none}.stg .stg-card summary strong{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stg .stg-card summary span{font-variant-numeric:tabular-nums;color:var(--muted);font-size:12px}.stg .stg-edit{border-top:1px solid var(--line);padding:8px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.stg .stg-edit label{font-size:11px;color:var(--muted);min-width:0}.stg .stg-edit label:first-child{grid-column:span 2}.stg .stg-edit input{margin-top:3px;min-height:30px;padding:4px 6px}.stg .stg-skillfold{grid-column:1/-1;border-top:1px solid var(--line);padding-top:5px}.stg .stg-skillfold summary{min-height:28px;padding:3px 0;font-size:12px;color:var(--blue-dark)}.stg .stg-skillrows{display:grid;gap:5px}.stg .stg-skillrows label{display:grid;grid-template-columns:58px minmax(0,1fr);align-items:center;gap:5px}.stg .stg-save{grid-column:1/-1;justify-self:end;min-height:29px;padding:3px 10px}.stg .stg-empty{padding:14px 10px;border:1px dashed var(--line);border-radius:6px;color:var(--muted);font-size:13px}.stg .stg-actions{display:flex;gap:7px;align-items:center;margin-top:10px}.stg .stg-actions .stg-primary{margin-left:auto}.stg-overlay{position:fixed;inset:0;z-index:10000;max-width:none!important;width:100vw;height:100vh;height:100dvh;overflow:auto;background:#111923!important;color:#fff!important}.stg-battle{min-height:100%;display:flex;flex-direction:column;background:#101722}.stg-scene{position:relative;isolation:isolate;flex:1 0 55vh;min-height:330px;overflow:hidden;background-color:#25374a;background-position:center;background-size:cover}.stg-scene:after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,#09111a66,transparent 32%,#09111a99)}.stg-hudrow{position:absolute;z-index:3;left:12px;right:12px;top:12px;display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.stg-hud{width:min(42%,290px);padding:8px 10px;border:1px solid #ffffff88;border-radius:6px;background:#111923d9;backdrop-filter:blur(8px)}.stg-hud strong{font-size:13px}.stg-hp{height:7px;background:#ffffff30;border-radius:9px;overflow:hidden;margin-top:5px}.stg-hp span{display:block;height:100%;background:#50d890;transition:width .25s}.stg-hp[data-low=true] span{background:#ffba55}.stg-hud small{display:block;color:#e7edf5;margin-top:2px}.stg-fighters{position:absolute;z-index:2;inset:15% 5% 4%;display:flex;align-items:flex-end;justify-content:space-between;pointer-events:none}.stg-side{display:flex;align-items:flex-end;gap:clamp(0px,2vw,18px);max-width:47%;height:100%}.stg-side[data-enemy=true]{flex-direction:row-reverse}.stg-figure{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;position:relative;height:100%;min-width:0}.stg-figure img{max-height:75%;max-width:min(21vw,185px);width:auto;object-fit:contain;filter:drop-shadow(0 9px 15px #0008)}.stg-figure[data-active=true] img{animation:stg-act .42s ease-out}.stg-figure[data-hit=true] img{animation:stg-hit .3s ease-out}.stg-figure[data-down=true]{opacity:.42;filter:grayscale(.5)}.stg-figure>span{font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 4px #000;background:#101722b8;border-radius:3px;padding:2px 6px;margin-top:3px}.stg-caption{position:absolute;z-index:4;left:50%;bottom:19%;transform:translateX(-50%);padding:6px 12px;border-radius:5px;background:transparent;color:#fff;text-shadow:0 1px 4px #000,0 2px 12px #000;font-weight:650;pointer-events:none;animation:stg-caption 1.7s ease-out both;max-width:80%;text-align:center}.stg-battle-tools{position:absolute;z-index:4;right:12px;bottom:12px;display:flex;gap:6px}.stg-battle-tools button{min-height:30px;padding:4px 8px;background:#111923d9;color:#fff;border-color:#ffffff45;font-size:12px}.stg-controls-battle{flex:none;background:#fff;color:var(--ink);padding:12px max(12px,env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));max-height:44vh;overflow:auto}.stg-controls-battle .stg-round{display:flex;gap:10px;align-items:center;border-bottom:1px solid var(--line);padding-bottom:7px;margin-bottom:7px}.stg-controls-battle .stg-round small{margin-left:auto}.stg-controls-battle .stg-skills{display:flex;gap:7px;overflow-x:auto;padding:2px 0 7px}.stg-controls-battle .stg-skills button{flex:0 0 160px;text-align:left;min-height:54px}.stg-controls-battle .stg-skills button strong,.stg-controls-battle .stg-skills button small{display:block}.stg-controls-battle .stg-skills button small{font-size:11px;margin-top:2px}.stg-log{display:grid;gap:3px;max-height:76px;overflow:auto;border-top:1px solid var(--line);padding-top:6px;color:var(--muted);font-size:12px}.stg-result{margin:7px 0;padding:9px;border-radius:5px;background:#eef4ff;color:#193e82}.stg-summary{width:100%;min-height:100px;margin:6px 0;border:1px solid var(--line);border-radius:5px;padding:8px;resize:vertical}.stg-return{display:flex;gap:7px;align-items:center}.stg-return .stg-primary{margin-left:auto}@keyframes stg-act{0%{transform:translateX(0)}42%{transform:translateX(16px) scale(1.03)}100%{transform:translateX(0)}}@keyframes stg-hit{20%{transform:translateX(-9px);filter:brightness(1.7)}65%{transform:translateX(5px)}100%{transform:none}}@keyframes stg-caption{0%{opacity:0;transform:translate(-50%,6px)}15%,72%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-6px)}}@media(max-width:600px){.stg .stg-wrap{padding:10px}.stg .stg-party{grid-template-columns:1fr}.stg .stg-controls{grid-template-columns:1fr}.stg .stg-mainbtn{width:100%}.stg-scene{min-height:280px;flex-basis:46vh}.stg-fighters{inset:22% 3% 5%}.stg-figure img{max-width:30vw;max-height:68%}.stg-hud{width:47%;padding:6px 7px}.stg-controls-battle{max-height:54vh}.stg-caption{bottom:22%}}
@media(prefers-reduced-motion:reduce){.stg-figure[data-active=true] img,.stg-figure[data-hit=true] img,.stg-caption{animation:none}}

.stg-hud{width:clamp(112px,25vw,170px);padding:5px 7px;background:#10172299;border-color:#ffffff45;border-radius:5px}.stg-hud strong{font-size:11px}.stg-hud small{font-size:10px;margin-top:2px}.stg-hp{height:4px;margin-top:4px}.stg-controls-battle{width:min(100%,720px);align-self:center;border-radius:10px 10px 0 0;padding:9px 12px;max-height:36vh}.stg-controls-battle .stg-skills button{flex-basis:150px;min-height:44px}.stg-controls-battle .stg-skills small{max-height:3.2em;overflow:hidden}.stg-hudrow{left:10px;right:10px;top:10px}.stg-log{max-height:46px;font-size:11px}@media(max-width:600px){.stg-hud{width:min(40%,146px);padding:5px 6px}.stg-controls-battle{max-height:40vh}}@media(prefers-reduced-motion:reduce){.stg-figure[data-act] img{animation:none}}
.stg-overlay{overflow:hidden}.stg-battle{height:100dvh;min-height:100dvh;position:relative}.stg-scene{position:absolute;inset:0;min-height:0;height:100%;flex:none}.stg-scene:after{background:linear-gradient(180deg,#07101a55,transparent 24%,transparent 58%,#07101a77)}
.stg-fighters{inset:14% 4% 5%;justify-content:space-around}.stg-side{max-width:48%;gap:clamp(2px,1vw,12px)}.stg-figure{width:clamp(62px,14vw,150px)}.stg-figure img{width:100%;height:auto;max-height:72%;object-fit:contain}.stg-figure .stg-sprite{width:100%;aspect-ratio:1/1;max-height:72%;background-image:var(--sheet);background-position:0 0;background-size:400% 400%;background-repeat:no-repeat;filter:drop-shadow(0 9px 15px #0008)}.stg-figure[data-mirror=true] .stg-sprite{transform:scaleX(-1)}.stg-figure[data-frame="0"] .stg-sprite{background-position:0 0}.stg-figure[data-frame="1"] .stg-sprite{background-position:33.333% 0}.stg-figure[data-frame="2"] .stg-sprite{background-position:66.666% 0}.stg-figure[data-frame="3"] .stg-sprite{background-position:100% 0}.stg-figure[data-frame="4"] .stg-sprite{background-position:0 33.333%}.stg-figure[data-frame="5"] .stg-sprite{background-position:33.333% 33.333%}.stg-figure[data-frame="6"] .stg-sprite{background-position:66.666% 33.333%}.stg-figure[data-frame="7"] .stg-sprite{background-position:100% 33.333%}.stg-figure[data-frame="8"] .stg-sprite{background-position:0 66.666%}.stg-figure[data-frame="9"] .stg-sprite{background-position:33.333% 66.666%}.stg-figure[data-frame="10"] .stg-sprite{background-position:66.666% 66.666%}.stg-figure[data-frame="11"] .stg-sprite{background-position:100% 66.666%}.stg-figure[data-frame="12"] .stg-sprite{background-position:0 100%}.stg-figure[data-frame="13"] .stg-sprite{background-position:33.333% 100%}.stg-figure[data-frame="14"] .stg-sprite{background-position:66.666% 100%}.stg-figure[data-frame="15"] .stg-sprite{background-position:100% 100%}
.stg-controls-battle{position:absolute;z-index:5;left:50%;bottom:max(10px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(94vw,680px);max-height:42dvh;overflow:auto;border:1px solid #ffffff45;border-radius:8px;background:#101722b8;color:#fff;backdrop-filter:blur(7px);padding:8px 10px}.stg-controls-battle .stg-round{border:0;padding:0;margin:0 0 5px;gap:8px}.stg-controls-battle .stg-round small{color:#d7dfeb}.stg-controls-battle button{min-height:30px;padding:4px 9px;background:#111923d9;border-color:#ffffff55;color:#fff}.stg-controls-battle button:hover:not(:disabled){color:#fff;background:#23364e;border-color:#a9caff}.stg-controls-battle .stg-primary{background:#c68936;border-color:#e1b96d}.stg-commandrow,.stg-targets,.stg-inventory{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.stg-commandrow>button{min-width:74px}.stg-commandpanel{margin-top:6px;padding-top:6px;border-top:1px solid #ffffff33}.stg-commandpanel select{width:auto;min-width:100px;min-height:30px;border:1px solid #ffffff55;border-radius:4px;background:#182433;color:white;padding:3px 6px}.stg-controls-battle .stg-skills{flex-wrap:wrap;overflow:visible;padding:4px 0}.stg-controls-battle .stg-skills button{flex:1 1 140px;text-align:left;min-height:38px}.stg-controls-battle .stg-skills button small{color:#cbd6e4}.stg-log{color:#ecf1f7;border-color:#ffffff33}.stg-result{background:#111923c9;color:#fff}.stg-result + *{margin-top:5px}.stg-summary{background:#182433;color:#fff;border-color:#ffffff55}.stg-return button{color:white}.stg-caption{z-index:4;bottom:33%;font-size:clamp(13px,2vw,20px)}.stg-hud{pointer-events:none}.stg-battle-tools{top:10px;bottom:auto;right:10px}.stg-figure[data-frame="13"] .stg-sprite{opacity:.55;filter:grayscale(1)}@media(max-width:600px){.stg-controls-battle{width:calc(100% - 16px);max-height:46dvh;padding:7px}.stg-fighters{inset:19% 1% 7%}.stg-figure{width:clamp(58px,17vw,112px)}.stg-hudrow{top:8px;left:8px;right:8px}.stg-caption{bottom:38%}}
.stg-sprite{position:relative;overflow:hidden}.stg-sprite img.stg-sheet{display:none}.stg-sprite[data-mode=idle]{animation:stg-idle 1.2s steps(1,end) infinite}.stg-sprite[data-mode=attack]{animation:stg-attack .44s steps(1,end) 1}.stg-sprite[data-mode=kick]{animation:stg-kick .44s steps(1,end) 1}.stg-sprite[data-mode=hit]{animation:stg-hitframes .32s steps(1,end) 1}.stg-sprite[data-mode=cast]{animation:stg-cast .42s steps(1,end) 1}.stg-sprite[data-mode=guard]{animation:stg-guard .35s steps(1,end) 1}.stg-sprite[data-mode=dodge]{animation:stg-dodge .35s steps(1,end) 1}.stg-sprite[data-mode=victory]{animation:stg-victory .7s steps(1,end) infinite}@keyframes stg-idle{0%{background-position:0 0}33%,66%{background-position:33.333% 0}67%,100%{background-position:66.666% 0}}@keyframes stg-attack{0%{background-position:100% 0}25%{background-position:0 33.333%}50%{background-position:33.333% 33.333%}75%{background-position:100% 33.333%}}@keyframes stg-kick{0%{background-position:100% 0}25%{background-position:0 33.333%}50%{background-position:66.666% 33.333%}75%{background-position:100% 33.333%}}@keyframes stg-hitframes{0%,55%{background-position:100% 66.666%}56%,100%{background-position:100% 33.333%}}@keyframes stg-cast{0%,40%{background-position:0 66.666%}45%,75%{background-position:33.333% 66.666%}80%,100%{background-position:100% 33.333%}}@keyframes stg-guard{0%,100%{background-position:66.666% 66.666%}}@keyframes stg-dodge{0%,55%{background-position:0 100%}56%,100%{background-position:100% 33.333%}}@keyframes stg-victory{0%,49%{background-position:66.666% 100%}50%,100%{background-position:100% 100%}}.stg-team-huds{display:grid;gap:4px;max-width:33%;}.stg-team-huds:last-child{justify-items:end}.stg-team-huds .stg-hud{width:clamp(96px,20vw,145px)}@media(prefers-reduced-motion:reduce){.stg-sprite{animation:none!important}}
.stg-controls-battle{left:12px;bottom:max(12px,env(safe-area-inset-bottom));transform:none;width:min(352px,calc(100vw - 24px));max-height:48dvh;overflow:auto;border:0;border-radius:0;background:transparent;backdrop-filter:none;padding:0;color:#fff}.stg-controls-battle .stg-round{color:#fff;text-shadow:0 2px 8px #000}.stg-controls-battle .stg-commandrow{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.stg-controls-battle .stg-commandrow>button{min-height:42px;background:#fff9ee;color:#251741;border:2px solid #45276f;border-radius:4px;font-weight:800;font-size:14px;box-shadow:0 3px 0 #23133c;clip-path:polygon(7% 0,100% 0,93% 100%,0 100%)}.stg-controls-battle .stg-commandrow>button:nth-child(1){border-left:6px solid #2fc5d2}.stg-controls-battle .stg-commandrow>button:nth-child(2){border-left:6px solid #ee6d93}.stg-controls-battle .stg-commandrow>button:nth-child(3){border-left:6px solid #8b61db}.stg-controls-battle .stg-commandrow>button:nth-child(4){border-left:6px solid #efa646}.stg-controls-battle .stg-commandrow>button:hover:not(:disabled){background:#fff;color:#20143f;transform:translateY(-1px)}.stg-controls-battle .stg-commandpanel{padding:7px;border:1px solid #ffffff45;border-radius:5px;background:#101722df;box-shadow:0 5px 20px #0008}.stg-controls-battle .stg-skills button{background:#fff9ee;color:#251741;border:1px solid #d9caec}.stg-controls-battle .stg-skills button small{color:#5b506d}.stg-controls-battle .stg-targets{font-size:11px}.stg-controls-battle .stg-commandrow>button:focus-visible{outline:3px solid #4bd3e2;outline-offset:2px}@media(max-width:600px){.stg-controls-battle{left:8px;bottom:max(8px,env(safe-area-inset-bottom));width:min(330px,calc(100vw - 16px));max-height:46dvh}}

.stg-fighters{inset:12% 3% 5%;align-items:stretch;justify-content:space-between}.stg-side{position:relative;width:48%;max-width:48%;height:100%;display:block}.stg-side .stg-figure{position:absolute;bottom:5%;left:0;height:auto;width:clamp(190px,27vw,390px);max-width:none}.stg-side .stg-figure:nth-child(2){left:28%;bottom:16%;transform:scale(.9);transform-origin:50% 100%}.stg-side .stg-figure:nth-child(3){left:53%;bottom:28%;transform:scale(.8);transform-origin:50% 100%}.stg-side[data-enemy=true] .stg-figure{left:auto;right:0;bottom:16%}.stg-side[data-enemy=true] .stg-figure:nth-child(2){left:auto;right:28%;bottom:28%}.stg-side[data-enemy=true] .stg-figure:nth-child(3){left:auto;right:53%;bottom:40%}.stg-side[data-count="1"] .stg-figure{width:clamp(270px,42vw,600px);left:1%;bottom:2%;max-width:135%}.stg-side[data-enemy=true][data-count="1"] .stg-figure{width:clamp(250px,38vw,540px);left:auto;right:1%;bottom:20%}.stg-figure .stg-sprite,.stg-figure .stg-rig-viewport{max-height:none;aspect-ratio:1/1}.stg-figure>span{position:absolute;bottom:4%;margin:0;font-size:12px}.stg-team-huds:last-child{padding-top:40px}.stg-commandrow>button{font-size:17px;font-weight:750;min-height:54px;display:flex;gap:14px;align-items:center;justify-content:center}.stg-commandrow svg{width:24px;height:24px;flex:none;stroke:currentColor;stroke-width:1.7;fill:none}.stg-controls-battle .stg-log{display:none}.stg-controls-battle:has(.stg-result) .stg-log{display:grid}
@media(max-width:600px){.stg-fighters{inset:22% 1% 8%}.stg-side .stg-figure{width:clamp(135px,36vw,200px)}.stg-side .stg-figure:nth-child(2){left:23%;bottom:23%}.stg-side .stg-figure:nth-child(3){left:42%;bottom:45%}.stg-side[data-enemy=true] .stg-figure:nth-child(2){right:23%;bottom:35%}.stg-side[data-enemy=true] .stg-figure:nth-child(3){right:42%;bottom:57%}.stg-side[data-count="1"] .stg-figure{width:clamp(210px,58vw,320px);left:-6%;bottom:12%}.stg-side[data-enemy=true][data-count="1"] .stg-figure{width:clamp(195px,53vw,290px);right:-6%;bottom:40%}.stg-commandrow>button{font-size:14px;min-height:43px;gap:8px}.stg-commandrow svg{width:19px;height:19px}}

.stg-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 10px;margin:6px 0 10px;padding:8px;border:1px solid #ded6eb;border-radius:6px;background:#fcfbff}.stg-options>label,.stg-ai-model>label{display:grid;gap:3px;color:#493967;font-size:12px}.stg-options select{min-height:30px;padding:3px 7px}.stg-option-help{grid-column:1/-1;font-size:11px;color:#625672}.stg-ai-model{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding-top:7px;border-top:1px solid #ded6eb}.stg-ai-head{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;color:#39275b}.stg-ai-head button,.stg-ai-model>button{min-height:28px;padding:3px 8px;font-size:11px}.stg-ai-model>button{grid-column:1/-1;justify-self:end}.stg-ai-model small{grid-column:1/-1;color:#806128;font-size:11px}@media(max-width:600px){.stg-options{padding:6px}.stg-ai-model{grid-template-columns:1fr}}.stg-figure{--dash:35px}.stg-side[data-enemy=true] .stg-figure{--dash:-35px}.stg-figure[data-act=attack]{animation:stg-lunge .5s ease-out}.stg-figure[data-act=hit]{animation:stg-flinch .25s ease-out}.stg-scene[data-shot=impact]{animation:stg-camera .2s ease-out}@keyframes stg-lunge{0%,100%{translate:0 0}40%,65%{translate:var(--dash) 0}}@keyframes stg-flinch{0%,100%{translate:0 0;filter:none}30%{translate:-9px 0;filter:brightness(1.5)}65%{translate:5px 0}}@keyframes stg-camera{0%,100%{transform:translate(0,0)}25%{transform:translate(-2px,1px)}60%{transform:translate(2px,-1px)}}@media(prefers-reduced-motion:reduce){.stg-figure,.stg-scene{animation:none!important}}

.stg-visual{width:100%;aspect-ratio:1/1;position:relative;transform-origin:50% 89%;will-change:transform}.stg-figure[data-act=idle] .stg-visual{animation:stg-breathe 3.6s cubic-bezier(.45,0,.55,1) infinite}.stg-figure:nth-child(2) .stg-visual{animation-delay:-1.1s}.stg-figure:nth-child(3) .stg-visual{animation-delay:-2.3s}.stg-side[data-enemy=true] .stg-visual{animation-delay:-1.7s}.stg-visual>.stg-sprite{height:100%;width:100%}.stg-visual>img:not(.stg-sheet){width:100%;max-width:none;height:100%;max-height:none;object-fit:contain}.stg-figure>.stg-hud{position:absolute;top:10%;left:50%;transform:translate(-50%,-100%);width:clamp(100px,12vw,155px);max-width:90%;padding:4px 6px;background:#10172280;border-color:#ffffff40;backdrop-filter:blur(4px);z-index:4}.stg-figure>.stg-hud strong{font-size:11px}.stg-figure>.stg-hud small{font-size:10px}.stg-figure .stg-hp{height:4px}.stg-speed{display:flex;align-items:center;white-space:nowrap;font-size:12px;color:#fff;gap:3px}.stg-speed select{width:58px;min-height:30px;border:1px solid #ffffff45;background:#111923d9;color:#fff}.stg-entry{position:absolute;inset:0;z-index:7;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;pointer-events:none;background:#09132650;animation:stg-entry .7s ease-out both;text-shadow:0 2px 16px #000}.stg-entry strong{font-size:clamp(22px,4vw,46px);letter-spacing:.06em}.stg-entry span{font-size:14px;color:#fff}.stg-figure[data-act=attack]{animation-duration:calc(.5s / var(--playback-rate,1))}.stg-figure[data-act=hit]{animation-duration:calc(.25s / var(--playback-rate,1))}.stg-scene[data-shot=impact]{animation-duration:calc(.2s / var(--playback-rate,1))}.stg-caption{animation-duration:calc(1.7s / var(--playback-rate,1))}@keyframes stg-breathe{0%,100%{transform:translate3d(0,0,0) rotate(-.2deg) scale(1,1)}50%{transform:translate3d(1px,-2.5px,0) rotate(.2deg) scale(1.003,1.009)}}@keyframes stg-entry{0%{opacity:0;backdrop-filter:blur(5px)}20%,55%{opacity:1}100%{opacity:0;backdrop-filter:blur(0)}}@media(prefers-reduced-motion:reduce){.stg-visual,.stg-entry{animation:none!important}.stg-entry{display:none}}@media(max-width:600px){.stg-figure>.stg-hud{width:110px;max-width:100%}.stg-figure>.stg-hud small{font-size:9px}.stg-battle-tools{gap:4px}.stg-speed select{width:48px}}

.stg input[type=checkbox]{width:16px;min-height:16px;height:16px;flex:none;accent-color:var(--blue)}.stg-mediafold{padding:7px 0;border-bottom:1px solid var(--line)}.stg-mediafold>summary,.stg-manual>summary{cursor:pointer;font-size:13px;font-weight:600;padding:5px 0}.stg-manual textarea{box-sizing:border-box;border:1px solid var(--line);border-radius:5px;padding:8px;font:inherit}.stg-mediafold>label{margin:6px 0}.stg-edit textarea{border:1px solid var(--line);border-radius:5px;padding:6px;font:inherit}
.stg.stg-setup{height:100%;min-height:0;max-height:100dvh;flex:1 1 auto;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch}.stg-media-imports{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px;padding:4px 0}.stg-media-imports label{display:grid;gap:4px;font-size:12px;min-width:0}.stg-media-imports input[type=file],.stg-appearance input[type=file]{font-size:11px;min-height:30px;padding:4px}.stg-import-category{border-top:1px solid var(--line);padding:4px 0}.stg-import-category>summary{cursor:pointer;padding:5px 0;font-size:12px}.stg-appearance{display:grid;gap:7px}.stg-appearance>label{display:grid!important;grid-template-columns:1fr!important;gap:3px}.stg-appearance small{display:block}.stg-appearance-preview{display:flex;align-items:center;gap:8px}.stg-appearance-preview .stg-sprite{width:104px;height:104px;flex:none;background-size:400% 400%;background-repeat:no-repeat;background-color:#f1eff7;border-radius:5px}.stg-preview-actions{display:flex;flex-wrap:wrap;gap:4px}.stg-preview-actions button{font-size:11px;min-height:27px;padding:3px 7px}@media(max-width:480px){.stg-media-imports{grid-template-columns:1fr}}

/* Battle dock reserves its own space below the scene. */
.stg-overlay{display:flex;overflow:hidden}.stg-battle{width:100%;min-width:0;flex:1 1 0%;height:100dvh;min-height:0;display:flex;flex-direction:column;overflow:hidden}.stg-scene{position:relative;inset:auto;flex:1 1 0%;height:auto;min-height:0;width:100%;container-type:size;overflow:hidden}.stg-controls-battle.stg-control-dock{position:relative;inset:auto;transform:none;z-index:5;flex:0 0 auto;align-self:stretch;width:100%;max-width:none;max-height:52dvh;overflow-x:hidden;overflow-y:auto;border:0;border-top:1px solid #ffffff55;border-radius:0;background:#101722f2;backdrop-filter:blur(9px);padding:7px max(10px,env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));color:#fff}.stg-controls-battle .stg-round{min-height:28px;gap:8px;margin:0 0 4px;padding:0;border:0;color:#fff;text-shadow:0 2px 8px #000}.stg-controls-battle .stg-round small{color:#d7dfeb}.stg-controlbar{display:flex;align-items:center;gap:5px;margin:0 0 5px}.stg-speedcontrol{display:flex;align-items:center;gap:4px;min-width:0}.stg-controls-battle .stg-controlbar button{min-height:44px;min-width:44px;padding:5px 8px;color:#fff;background:#111923d9;border-color:#ffffff55}.stg-controls-battle .stg-controlbar button:hover:not(:disabled){color:#fff;background:#23364e;border-color:#a9caff}.stg-controls-battle .stg-speedtrigger{min-width:68px;font-variant-numeric:tabular-nums}.stg-speedmenu{display:flex;gap:3px}.stg-controls-battle .stg-speedmenu button[aria-pressed=true]{background:#e4c16f;color:#241b12;border-color:#f4dc9e;font-weight:800}.stg-controls-battle .stg-controlbar .stg-toolbutton{margin-left:auto;min-width:64px}.stg-controls-battle .stg-commandrow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.stg-controls-battle .stg-commandrow>button{min-width:0;min-height:48px;background:#fff9ee;color:#251741;border:2px solid #45276f;border-radius:4px;font-weight:800;font-size:14px;box-shadow:0 3px 0 #23133c;clip-path:polygon(4% 0,100% 0,96% 100%,0 100%)}.stg-controls-battle .stg-commandrow>button:nth-child(1){border-left:6px solid #2fc5d2}.stg-controls-battle .stg-commandrow>button:nth-child(2){border-left:6px solid #ee6d93}.stg-controls-battle .stg-commandrow>button:nth-child(3){border-left:6px solid #8b61db}.stg-controls-battle .stg-commandrow>button:nth-child(4){border-left:6px solid #efa646}.stg-controls-battle .stg-commandrow>button[aria-expanded=true]{background:#e4c16f;color:#241b12;border-color:#f4dc9e}.stg-controls-battle .stg-commandrow svg{width:20px;height:20px;flex:none;stroke:currentColor;stroke-width:1.7;fill:none}.stg-controls-battle .stg-commandpanel{margin-top:5px;padding:6px 7px;border:1px solid #ffffff45;border-radius:5px;background:#101722df}.stg-controls-battle .stg-targets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;align-items:end;font-size:11px}.stg-controls-battle .stg-targets label{display:grid;gap:2px;min-width:0;margin:0}.stg-controls-battle .stg-commandpanel select{width:100%;min-width:0;min-height:44px;padding:4px 7px;border:1px solid #ffffff55;border-radius:4px;background:#182433;color:#fff}.stg-controls-battle .stg-skills{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;padding:6px 0 1px;overflow:visible}.stg-controls-battle .stg-skills button{width:100%;min-width:0;min-height:64px;padding:6px;text-align:left;overflow:hidden;background:#fff9ee;color:#251741;border:1px solid #d9caec}.stg-controls-battle .stg-skills button strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stg-controls-battle .stg-skills button small{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;line-height:1.2;max-height:2.4em;overflow:hidden;color:#5b506d}.stg-controls-battle .stg-inventory{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.stg-controls-battle .stg-inventory>strong{grid-column:1/-1}.stg-controls-battle .stg-inventory>button,.stg-controls-battle .stg-commandpanel>button{min-height:46px;padding:6px;text-align:center}.stg-controls-battle .stg-log{display:none}.stg-controls-battle:has(.stg-result) .stg-log{display:grid}.stg-fighters{inset:9% 3% 3%;align-items:stretch;justify-content:space-between}.stg-side{position:relative;width:48%;max-width:48%;height:100%;display:block}.stg-side .stg-figure{position:absolute;bottom:5%;left:0;height:auto;width:min(clamp(190px,27vw,390px),50cqh);max-width:none}.stg-side .stg-figure:nth-child(2){left:28%;bottom:16%;transform:scale(.9);transform-origin:50% 100%}.stg-side .stg-figure:nth-child(3){left:53%;bottom:28%;transform:scale(.8);transform-origin:50% 100%}.stg-side[data-enemy=true] .stg-figure{left:auto;right:0;bottom:16%}.stg-side[data-enemy=true] .stg-figure:nth-child(2){left:auto;right:28%;bottom:28%}.stg-side[data-enemy=true] .stg-figure:nth-child(3){left:auto;right:53%;bottom:40%}.stg-side[data-count="1"] .stg-figure{width:min(clamp(270px,42vw,600px),78cqh);left:1%;bottom:2%}.stg-side[data-enemy=true][data-count="1"] .stg-figure{width:min(clamp(250px,38vw,540px),72cqh);left:auto;right:1%;bottom:12%}.stg-figure .stg-sprite,.stg-figure .stg-rig-viewport{max-height:none;aspect-ratio:1/1}.stg-figure>span{position:absolute;bottom:4%;margin:0;font-size:12px}.stg-team-huds:last-child{padding-top:0}
@media(max-width:600px){.stg-controls-battle.stg-control-dock{max-height:54dvh;padding:6px max(8px,env(safe-area-inset-right)) calc(7px + env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))}.stg-controls-battle .stg-commandrow{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.stg-controls-battle .stg-skills{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.stg-controls-battle .stg-skills button{min-height:64px}.stg-controls-battle .stg-round small{max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stg-fighters{inset:9% 1% 3%}.stg-side .stg-figure{width:min(clamp(135px,36vw,200px),50cqh)}.stg-side .stg-figure:nth-child(2){left:23%;bottom:23%}.stg-side .stg-figure:nth-child(3){left:42%;bottom:45%}.stg-side[data-enemy=true] .stg-figure:nth-child(2){right:23%;bottom:35%}.stg-side[data-enemy=true] .stg-figure:nth-child(3){right:42%;bottom:45%}.stg-side[data-count="1"] .stg-figure{width:min(clamp(210px,58vw,320px),78cqh);left:0;bottom:2%}.stg-side[data-enemy=true][data-count="1"] .stg-figure{width:min(clamp(195px,53vw,290px),72cqh);right:1%;bottom:12%}}
@media(max-width:420px){.stg-controlbar{gap:3px}.stg-controls-battle .stg-controlbar button{min-width:44px;padding:4px 6px}.stg-controls-battle .stg-speedtrigger{min-width:62px}.stg-controls-battle .stg-controlbar .stg-toolbutton{min-width:58px}}

.stg-camera-stage,.stg-camera-world{position:absolute;inset:0}.stg-camera-stage{transform-origin:50% 50%;transition:transform max(80ms,calc(260ms / var(--playback-rate,1))) cubic-bezier(.2,.7,.2,1);will-change:transform}.stg-camera-world{background-size:cover;background-position:center}.stg-scene[data-shot=impact]{animation:none}.stg-camera-world[data-impact=true]{animation:stg-camera max(65ms,calc(.2s / var(--playback-rate,1))) ease-out}.stg-side .stg-figure{translate:var(--move-x,0px) var(--move-y,0px);transition:translate max(55ms,calc(200ms / var(--playback-rate,1))) cubic-bezier(.15,.75,.25,1);will-change:translate}.stg-figure[data-travel=approach]{z-index:5}.stg-figure[data-act=attack],.stg-figure[data-act=hit]{animation:none}.stg-figure[data-act=hit] .stg-visual{animation:stg-flinch max(50ms,calc(.25s / var(--playback-rate,1))) ease-out}.stg-figure>.stg-impact-number{position:absolute;top:34%;bottom:auto;left:50%;margin:0;z-index:8;color:#fff;font-size:clamp(22px,3vw,40px);font-weight:850;white-space:nowrap;background:transparent;padding:0;text-shadow:0 2px 4px #300,0 0 12px #000;animation:stg-number max(120ms,calc(.6s / var(--playback-rate,1))) ease-out both}.stg-figure>.stg-impact-number[data-kind=heal]{color:#8ff0bc}@keyframes stg-number{0%{opacity:0;transform:translate(-50%,12px) scale(.8)}20%,70%{opacity:1;transform:translate(-50%,-5px) scale(1)}100%{opacity:0;transform:translate(-50%,-26px) scale(.96)}}@media(prefers-reduced-motion:reduce){.stg-camera-stage{transform:none!important;transition:none}.stg-camera-world,.stg-figure>.stg-impact-number,.stg-figure[data-act=hit] .stg-visual{animation:none!important}.stg-side .stg-figure{translate:0 0!important;transition:none}}
.stg-dock-header{display:flex;align-items:center;gap:8px;min-width:0;margin:0 0 5px}.stg-controls-battle .stg-dock-header .stg-round{flex:1;min-width:0;display:flex;align-items:center;gap:5px;margin:0;overflow:hidden}.stg-controls-battle .stg-dock-header .stg-round strong{flex:none;white-space:nowrap}.stg-controls-battle .stg-dock-header .stg-round span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stg-controls-battle .stg-dock-header .stg-round small{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stg-control-dock .stg-controlbar{flex:none;gap:5px;margin:0}.stg-control-dock .stg-speedcontrol{position:relative;z-index:12;flex:none}.stg-control-dock .stg-speedmenu{position:absolute;top:calc(100% + 4px);left:auto;right:0;z-index:20;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:190px;gap:4px;padding:6px;background:#101722;border:1px solid #ffffff70;border-radius:7px;box-shadow:0 8px 22px #000b}.stg-control-dock .stg-speedmenu button{width:100%;min-width:0;min-height:44px;padding:5px 8px}.stg-controls-battle .stg-dock-header .stg-controlbar .stg-toolbutton{margin-left:0;flex:none}
@media(max-width:360px){.stg-controls-battle .stg-dock-header .stg-round small{display:none}.stg-controls-battle .stg-dock-header{gap:5px}.stg-control-dock .stg-controlbar{gap:4px}}
.stg-round-plan{display:flex;gap:6px;align-items:stretch;margin-top:6px;flex-wrap:wrap}.stg-round-plan>button{flex:1 1 130px;text-align:left;min-height:42px}.stg-round-plan>button strong,.stg-round-plan>button small{display:block}.stg-round-plan>button[aria-pressed=true]{border-color:#78d6e2;background:#193341}.stg-round-confirm{display:flex;align-items:center;gap:8px;margin-top:6px}.stg-round-confirm small{flex:1;color:#dce6f0}.stg-controls-battle .stg-confirm-round{min-height:44px;min-width:130px;background:#155eef;color:#fff;border-color:#4080f6;font-weight:750}.stg-controls-battle .stg-skills button[aria-pressed=true]{border:2px solid #44bac9;background:#e9fbff}.stg-controls-battle .stg-skills .stg-skill-basic{background:#e9f5f7;border-color:#62b9c5;color:#1b4d57}.stg-controls-battle .stg-skills .stg-skill-basic[aria-pressed=true]{background:#d1f1f4;border-color:#2a9cae}.stg-controls-battle .stg-inventory>small{grid-column:1/-1;color:#c5d6e8;font-size:12px}.stg-controls-battle .stg-inventory{padding:8px 0;border-bottom:1px solid #ffffff28}.stg-generation-model .stg-actions{grid-column:1/-1;flex-wrap:wrap}.stg-generation-model .stg-ai-model{margin-top:7px}
.stg-controls-battle .stg-skills button:hover:not(:disabled),.stg-controls-battle .stg-skills button[aria-pressed=true]{color:#163647;background:#e9fbff}.stg-controls-battle .stg-skills button strong{color:inherit}
/* Organic entry surfaces: sand, moss and ochre; the story stays in control. */
.stg-story-marker{font:inherit;color:inherit}.stg.stg-encounter{display:inline-flex;align-items:center;justify-content:space-between;gap:18px;width:100%;padding:14px 18px;margin:10px 0;border:1px solid #8B9D83;border-radius:18px;background:#E8DCC7;color:#606C38;font:14px/1.45 "Palatino Linotype","Songti SC",serif;vertical-align:middle}.stg-encounter-copy{display:grid;gap:3px;min-width:0}.stg.stg-encounter strong{font-size:15px}.stg.stg-encounter small{color:#606C38;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:32ch}.stg.stg-encounter button{flex:none;min-height:44px;padding:8px 18px;border:1px solid #606C38;border-radius:16px;background:#606C38;color:#E8DCC7;font-weight:700}.stg.stg-encounter button:hover:not(:disabled){border-color:#C08E3A;background:#C08E3A;color:#E8DCC7}.stg-encounter[data-inline=true]{width:auto;max-width:100%;padding:4px 6px 4px 12px;margin:2px 6px;gap:12px}.stg-encounter[data-inline=true] strong{display:none}.stg-encounter[data-inline=true] small{max-width:16ch}.stg-story-entry-error{display:inline-block;color:#C66B3D;font:12px/1.5 system-ui,sans-serif;margin-inline-start:6px}
.stg-overlay.stg-battle-gate{display:grid;place-items:center;padding:24px;background:#606C38!important;color:#E8DCC7!important;font-family:"Palatino Linotype","Songti SC",serif}.stg-battle-gate:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.03;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='%23E8DCC7' filter='url(%23n)' d='M0 0h180v180H0z'/%3E%3C/svg%3E")}.stg-gate-card{position:relative;display:grid;gap:16px;width:min(100%,440px);padding:32px;border:1px solid #8B9D83;border-radius:24px;background:#E8DCC7;color:#606C38;animation:stg-gate-in .35s ease both}.stg-gate-card h2{font-size:30px;line-height:1.25}.stg-gate-card small{color:#606C38}.stg-gate-card p{margin:0}.stg-gate-card progress{width:100%;height:7px;accent-color:#C08E3A}.stg-gate-card button{min-height:44px;padding:9px 16px;border:1px solid #8B9D83;border-radius:16px;background:#D4B895;color:#606C38}.stg-gate-card .stg-gate-error{color:#C66B3D}.stg-battle[data-entering=true] .stg-entry{pointer-events:none}
.stg-gate-art{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.24}.stg-battle .stg-entry{inset:12px 20% auto;gap:3px;padding:10px 16px;border-radius:18px;background:#606C38d9;color:#E8DCC7;text-shadow:none;max-height:100px}.stg-battle .stg-entry strong{font-size:clamp(18px,2.4vw,28px);letter-spacing:.02em}.stg-battle .stg-entry span{font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#E8DCC7}
@keyframes stg-gate-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@media(max-width:420px){.stg-gate-card{padding:24px}.stg-encounter[data-inline=true] small{max-width:10ch}.stg.stg-encounter button{padding-inline:12px}}@media(prefers-reduced-motion:reduce){.stg-gate-card{animation:none}}
.stg-controls-battle.stg-control-dock{align-self:center;width:min(100%,1120px);max-height:50dvh;border:1px solid #ffffff40;border-bottom:0;border-radius:12px 12px 0 0;padding:7px 10px calc(8px + env(safe-area-inset-bottom))}.stg-command-workspace{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 12px;align-items:center}.stg-command-workspace[hidden]{display:none}.stg-controls-battle .stg-commandrow,.stg-controls-battle .stg-commandpanel{grid-column:1/-1;margin:0}.stg-controls-battle .stg-commandrow>button{min-height:44px}.stg-controls-battle .stg-commandpanel{padding:0;border:0;background:transparent;min-width:0}.stg-controls-battle .stg-commandpanel-fight{display:grid;grid-template-columns:230px minmax(0,1fr);gap:10px;align-items:center}.stg-controls-battle .stg-skills{display:flex;flex-wrap:wrap;gap:5px;padding:0}.stg-controls-battle .stg-skills>button{flex:1 1 120px;width:auto;max-width:210px;min-height:76px;font-size:13px;padding:6px 8px}.stg-controls-battle .stg-skills>button small{font-size:11px}.stg-controls-battle .stg-commandpanel-fight select{min-height:38px}.stg-controls-battle .stg-targets{align-self:start;margin-top:6px}.stg-controls-battle .stg-round-plan{margin:0;min-width:0;gap:5px;flex-wrap:nowrap}.stg-controls-battle .stg-round-plan>button{flex:1 1 100px;min-width:0;max-width:150px;min-height:44px;padding:4px 8px;font-size:12px}.stg-round-plan>button strong,.stg-round-plan>button small{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.stg-round-plan>button small{font-size:11px;color:#b8cadb}.stg-controls-battle .stg-round-confirm{margin:0;gap:6px}.stg-round-confirm small{max-width:190px;font-size:11px;line-height:1.3}.stg-round-confirm>button{min-height:44px;padding:5px 10px}.stg-controls-battle .stg-confirm-round{min-width:112px}.stg-controls-battle .stg-dock-header .stg-round small{max-width:46%}.stg-controls-battle .stg-controlbar .stg-dock-toggle{display:grid;place-items:center;width:44px;min-width:44px;padding:8px}.stg-dock-toggle svg{width:20px;height:20px;stroke:currentColor;stroke-width:2;fill:none}.stg-dock-toggle[aria-expanded=false] svg{transform:rotate(180deg)}.stg-control-dock:has(.stg-command-workspace[hidden]){overflow:visible}.stg-control-dock:has(.stg-command-workspace[hidden]) .stg-dock-header{margin:0}
@media(max-width:850px){.stg-controls-battle .stg-commandpanel-fight{grid-template-columns:190px minmax(0,1fr);gap:8px}.stg-controls-battle .stg-skills>button{flex-basis:100px}.stg-command-workspace{grid-template-columns:minmax(0,1fr)}.stg-controls-battle .stg-round-plan>button{max-width:180px}.stg-controls-battle .stg-round-confirm{justify-content:flex-end}.stg-round-confirm small{max-width:none;margin-right:auto}.stg-controls-battle .stg-round-confirm{grid-column:1/-1}}
@media(max-width:600px){.stg-controls-battle.stg-control-dock{max-height:54dvh;border-radius:0;padding:5px 8px calc(6px + env(safe-area-inset-bottom))}.stg-command-workspace{gap:5px}.stg-controls-battle .stg-commandrow{grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}.stg-controls-battle .stg-commandrow>button{font-size:12px;gap:4px;padding:5px 3px;border-left-width:3px}.stg-controls-battle .stg-commandrow svg{width:16px;height:16px}.stg-controls-battle .stg-commandpanel-fight{grid-template-columns:minmax(0,1fr);gap:5px}.stg-controls-battle .stg-targets{margin:0}.stg-controls-battle .stg-commandpanel-fight select{min-height:44px;font-size:12px}.stg-controls-battle .stg-skills{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}.stg-controls-battle .stg-skills>button{max-width:none;min-height:72px;padding:5px;font-size:12px}.stg-controls-battle .stg-skills>button small{font-size:10px}.stg-controls-battle .stg-dock-header .stg-round small{display:none}.stg-controls-battle .stg-controlbar .stg-toolbutton{min-width:56px;padding:5px}.stg-controls-battle .stg-speedtrigger{min-width:54px}.stg-controls-battle .stg-round-plan>button{max-width:none;font-size:11px;padding:4px 6px}.stg-controls-battle .stg-round-plan>button small{font-size:10px}.stg-controls-battle .stg-confirm-round{min-width:108px}.stg-round-confirm small{font-size:10px}}
@media(max-width:420px){.stg-controls-battle .stg-dock-header .stg-round span{display:none}.stg-controls-battle .stg-dock-header .stg-round strong{font-size:12px}}
.stg-controls-battle.stg-control-dock{display:flex;flex-direction:column;min-height:0;overflow:visible}.stg-control-dock .stg-dock-header{flex:none}.stg-command-workspace{flex:1;min-height:0;grid-template-rows:auto minmax(0,1fr) auto}.stg-controls-battle .stg-commandpanel{min-height:0;overflow-y:auto;align-self:stretch}.stg-controls-battle .stg-skills>button{line-height:1.2}.stg-controls-battle .stg-skills .stg-matchup{-webkit-line-clamp:1;max-height:1.2em}.stg-round-confirm small{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}.stg-control-dock:has(.stg-result){overflow-y:auto}
@media(max-width:850px){.stg-command-workspace{grid-template-rows:auto minmax(0,1fr) auto auto}}
@media(min-width:601px) and (max-width:850px){.stg-command-workspace{grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto minmax(0,1fr) auto}.stg-controls-battle .stg-round-confirm{grid-column:auto}.stg-round-confirm small{max-width:110px}.stg-controls-battle .stg-round-plan>button{max-width:150px}}
@media(min-width:601px) and (max-height:500px){.stg-controls-battle.stg-control-dock{max-height:60dvh}}
.stg-battle{position:relative;display:block}.stg-battle>.stg-scene{position:absolute;inset:0;width:100%;height:100%;min-height:0}.stg-actor-stage{position:absolute;inset:0 0 var(--stg-dock-space,54dvh);container-type:size}.stg-camera-stage{transform-origin:50% calc((100% - var(--stg-dock-space,54dvh)) / 2)}.stg-controls-battle.stg-control-dock{position:absolute;inset:auto auto 8px 50%;transform:translateX(-50%);width:min(calc(100% - 24px),1120px);border:1px solid #ffffff50;border-radius:14px;background:#101722d4;backdrop-filter:blur(10px)}.stg-battle .stg-caption{bottom:calc(var(--stg-dock-space,54dvh) + 12px)}.stg-scene:after{background:linear-gradient(180deg,#09111a40,transparent 32%,#09111a40)}
@media(max-width:600px){.stg-controls-battle.stg-control-dock{bottom:6px;width:calc(100% - 12px);border-radius:12px}}
`

    const route = (name) => `${PREFIX}${name}`
    const cap = (n, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(n)) ? Number(n) : min))
    const array = (v) => Array.isArray(v) ? v : []
    const unpack = (result) => result?.state || result?.stateView || result
    const actorHp = (a) => Math.max(0, Number(a?.hp) || 0)
    const hpPercent = (a) => Number(a?.maxHp) > 0 ? Math.max(0, Math.min(100, 100 * actorHp(a) / Number(a.maxHp))) : 0
    const elementLabel = (id, catalog) => array(catalog).find(type => type.id === id)?.name || (id === 'neutral' || !id ? '无属性' : id)
    const typesLabel = (actor, catalog) => (array(actor?.types).length ? actor.types : ['neutral']).map(id => elementLabel(id, catalog)).join(' / ')
    const skillMatchup = (skill, target, chart) => {
      if (!(Number(skill?.power) > 0) || !target) return ''
      const multiplier = Math.max(.25, Math.min(4, (array(target.types).length ? target.types : ['neutral']).reduce((value, type) => value * (chart?.[skill.element]?.[type] ?? 1), 1)))
      return multiplier > 1 ? `效果拔群 ×${multiplier}` : multiplier < 1 ? `效果不佳 ×${multiplier}` : '正常效果 ×1'
    }
    const BUILTIN_SCENES = [
      { id: 'forest-clearing', name: '林间遗迹' }, { id: 'mountain-courtyard', name: '山海古庭' },
      { id: 'celestial-terrace', name: '云海天宫' }, { id: 'glacial-citadel', name: '极光冰城' }, { id: 'volcanic-sanctum', name: '熔火圣殿' },
    ]
    const sceneKey = gameId => `dsh-battle-scene:${gameId}`
    const sceneChoice = gameId => { try { const id = localStorage.getItem(sceneKey(gameId)); return BUILTIN_SCENES.some(scene => scene.id === id) ? id : '' } catch (_) { return '' } }
    const battleScene = (ctx, gameId, state) => {
      const battle = state?.battle || state || {}, packId = battle.packId || state?.packId || ''
      const packName = array(state?.packs).find(pack => pack.id === packId)?.name || ''
      const scenes = /fantasy|玄幻|西幻|仙侠/i.test(`${packId} ${packName}`) ? BUILTIN_SCENES.slice(1) : [BUILTIN_SCENES[0], ...BUILTIN_SCENES.slice(2)]
      const hash = [...String(battle.id || gameId || '')].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0)
      return ctx.tavernUi.assetUrl(`human/scene/${sceneChoice(gameId) || scenes[hash % scenes.length].id}.png`)
    }
    const inProgress = (view) => !!(view?.readOnly || view?.turnState?.busy || view?.turnState?.generating || view?.turnState?.settling)
    const failureText = (error, fallback) => {
      const text = String(error?.code || '') + ' ' + String(error?.message || '')
      if (/stale|revision|text.?version|conflict|changed|head|过期|状态已变化|修订|版本/i.test(text)) return '状态已变化，请刷新状态后重试。'
      if (/Rooted actor/i.test(text)) return '当前受到束缚，暂时不能换人。'
      if (/Skill is unavailable/i.test(text)) return '此技能当前不可用，请检查资源、冷却或限制状态。'
      return error?.message || fallback
    }
    const routeCall = (ui, name, args) => ui.callHost(route(name), args)
    const makePalette = seedValue => {
      let state = (Number(seedValue) >>> 0) || 0x9e3779b9
      const next = () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296 }
      // Full color wheel plus continuous hue warping gives vivid, jewel, pastel
      // and deep variants without discontinuous per-pixel rainbow bands.
      const style = Math.floor(next() * 4)
      return { rotation: next() * 360, warp: (next() - .5) * 76, phase: next() * 360,
        saturation: (style === 2 ? .36 : .62) + next() * (style === 2 ? .26 : .34),
        mix: .64 + next() * .26, brightness: style === 2 ? .055 : style === 3 ? -.035 : 0 }
    }
    const rgbToHsl = (r, g, b) => {
      r /= 255; g /= 255; b /= 255
      const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min
      let hue = 0, saturation = 0
      const lightness = (max + min) / 2
      if (delta) {
        saturation = delta / (1 - Math.abs(2 * lightness - 1))
        if (max === r) hue = ((g - b) / delta) % 6
        else if (max === g) hue = (b - r) / delta + 2
        else hue = (r - g) / delta + 4
        hue = (hue * 60 + 360) % 360
      }
      return [hue, saturation, lightness]
    }
    const hslToRgb = (hue, saturation, lightness) => {
      const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
      const sector = hue / 60, x = chroma * (1 - Math.abs(sector % 2 - 1))
      let r = 0, g = 0, b = 0
      if (sector < 1) [r, g] = [chroma, x]
      else if (sector < 2) [r, g] = [x, chroma]
      else if (sector < 3) [g, b] = [chroma, x]
      else if (sector < 4) [g, b] = [x, chroma]
      else if (sector < 5) [r, b] = [x, chroma]
      else [r, b] = [chroma, x]
      const m = lightness - chroma / 2
      return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
    }
    const colorizeDefaultAtlas = async (source, seed, category) => {
      const picture = new Image(); picture.crossOrigin = 'anonymous'; picture.decoding = 'async'; picture.src = source
      await (picture.decode ? picture.decode() : new Promise((resolve, reject) => { picture.onload = resolve; picture.onerror = reject }))
      const canvas = document.createElement('canvas'); canvas.width = picture.naturalWidth || picture.width; canvas.height = picture.naturalHeight || picture.height
      if (!canvas.width || !canvas.height || canvas.width * canvas.height > 5_000_000) throw new Error('atlas dimensions are outside palette limits')
      const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) throw new Error('canvas is unavailable')
      context.drawImage(picture, 0, 0); picture.src = ''
      const image = context.getImageData(0, 0, canvas.width, canvas.height), pixels = image.data, palette = makePalette(seed)
      const hairPalette = makePalette((Number(seed) ^ 0x85ebca6b) >>> 0)
      // Learn a conservative hair-color signature from the crown of the standing
      // pose. Apply it only around the upper silhouette in other poses. This
      // makes hair independent from clothes without turning faces or hands green.
      // Tiny raster probes and arbitrary imported images never enter this path.
      const tileSize = canvas.width === canvas.height && canvas.width >= 512 && canvas.width % 4 === 0 ? canvas.width / 4 : 0
      const hairKeys = new Uint8Array(262144), hairLookup = new Int16Array(262144 * 3), hairReady = new Uint8Array(262144)
      const hairBounds = Array.from({ length: 16 }, () => ({ top: Infinity, bottom: -1 }))
      if (category === 'human' && tileSize) {
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] < 224) continue
          const x = (i / 4) % canvas.width, y = Math.floor(i / (canvas.width * 4)), cell = Math.floor(y / tileSize) * 4 + Math.floor(x / tileSize)
          hairBounds[cell].top = Math.min(hairBounds[cell].top, y % tileSize); hairBounds[cell].bottom = Math.max(hairBounds[cell].bottom, y % tileSize)
        }
        const crown = hairBounds[3], crownEnd = crown.top + (crown.bottom - crown.top) * .08
        for (let y = crown.top; y <= crownEnd; y++) for (let x = tileSize * 3; x < tileSize * 4; x++) {
          const i = (y * canvas.width + x) * 4
          if (pixels[i + 3] < 224) continue
          const key = ((pixels[i] >> 2) << 12) | ((pixels[i + 1] >> 2) << 6) | (pixels[i + 2] >> 2)
          hairKeys[key] = 1
        }
      }
      // Quantized lookup keeps the 4M-pixel atlas inexpensive while preserving
      // alpha and the hand-painted light/shadow ramps of the original artwork.
      const lookup = new Int16Array(262144 * 3), ready = new Uint8Array(262144)
      const smooth = (low, high, value) => { const t = Math.max(0, Math.min(1, (value - low) / (high - low))); return t * t * (3 - 2 * t) }
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 8) continue
        const key = ((pixels[i] >> 2) << 12) | ((pixels[i + 1] >> 2) << 6) | (pixels[i + 2] >> 2), at = key * 3
        if (!ready[key]) {
          const red = ((key >> 12) & 63) * 4 + 2, green = ((key >> 6) & 63) * 4 + 2, blue = (key & 63) * 4 + 2
          const [hue, saturation, lightness] = rgbToHsl(red, green, blue)
          // Keep skin-tone cores, pale highlights, eye whites and near-black
          // outlines. Red/gold cloth shadows and gray armor get smooth material
          // channels so warm-costume characters also receive visible variants.
          const coolGarment = smooth(55, 85, hue) * (1 - smooth(285, 320, hue))
          const redGarment = Math.max(1 - smooth(2, 10, hue), smooth(328, 350, hue)) * smooth(.32, .60, saturation) * (1 - smooth(.40, .62, lightness))
          const deepWarmGarment = smooth(.72, .90, saturation) * (1 - smooth(.34, .48, lightness))
          const goldGarment = smooth(38, 52, hue) * (1 - smooth(70, 90, hue)) * smooth(.70, .90, saturation) * (1 - smooth(.68, .88, lightness))
          const neutralGarment = (1 - smooth(.10, .20, saturation)) * smooth(.18, .28, lightness) * (1 - smooth(.38, .55, lightness)) * ((red > green && green > blue) ? 0 : 1)
          const animalNeutral = (1 - smooth(.12, .28, saturation)) * smooth(.14, .28, lightness) * (1 - smooth(.82, .96, lightness))
          const garment = category === 'human' ? Math.max(Math.max(coolGarment, redGarment, deepWarmGarment, goldGarment) * smooth(.12, .26, saturation), neutralGarment) : Math.max(smooth(.12, .26, saturation), animalNeutral)
          const weight = garment * smooth(.065, .16, lightness) * (1 - smooth(.88, .98, lightness))
          if (weight <= 0) ready[key] = 2
          const neutralBlend = 1 - smooth(.10, .22, saturation)
          const newHue = (hue * (1 - neutralBlend) + palette.rotation + palette.warp * Math.sin((hue + palette.phase) * Math.PI / 180) * (1 - neutralBlend) + 360) % 360
          const newSaturation = Math.min(.96, saturation * (1 - palette.mix) + palette.saturation * palette.mix)
          const newLightness = Math.max(.04, Math.min(.97, lightness + palette.brightness * 4 * lightness * (1 - lightness)))
          const recolored = hslToRgb(newHue, newSaturation, newLightness)
          // Store deltas rather than quantized colors: retain the original fine
          // gradients and antialiasing instead of flattening them into blocks.
          lookup[at] = Math.round((recolored[0] - red) * weight); lookup[at + 1] = Math.round((recolored[1] - green) * weight); lookup[at + 2] = Math.round((recolored[2] - blue) * weight)
          if (weight > 0) ready[key] = 1
        }
        let hairWeight = 0
        if (category === 'human' && hairKeys[key]) {
          const x = (i / 4) % canvas.width, y = Math.floor(i / (canvas.width * 4)), cell = Math.floor(y / tileSize) * 4 + Math.floor(x / tileSize), bounds = hairBounds[cell]
          hairWeight = 1 - smooth(.25, .43, (y % tileSize - bounds.top) / Math.max(1, bounds.bottom - bounds.top))
          if (!hairReady[key]) {
            const red = ((key >> 12) & 63) * 4 + 2, green = ((key >> 6) & 63) * 4 + 2, blue = (key & 63) * 4 + 2
            const [hue, saturation, lightness] = rgbToHsl(red, green, blue)
            const skinCore = hue >= 10 && hue <= 55 && red > green && green > blue && saturation >= .16 && saturation <= .70 && lightness >= .22 && lightness <= .91
            const warmSkin = hue >= 0 && hue < 65 && saturation > .12 && lightness >= .30
            const weight = skinCore || warmSkin ? 0 : smooth(.07, .17, lightness) * (1 - smooth(.84, .96, lightness))
            const hair = hslToRgb((hue * .25 + hairPalette.rotation + 360) % 360, Math.min(.72, .28 + hairPalette.saturation * .48), Math.min(.84, lightness + .06 + Math.max(0, hairPalette.brightness)))
            hairLookup[at] = Math.round((hair[0] - red) * weight); hairLookup[at + 1] = Math.round((hair[1] - green) * weight); hairLookup[at + 2] = Math.round((hair[2] - blue) * weight)
            hairReady[key] = weight > 0 ? 1 : 2
          }
          if (hairReady[key] !== 1) hairWeight = 0
        }
        if (ready[key] === 1 || hairWeight > 0) {
          for (let channel = 0; channel < 3; channel++) pixels[i + channel] += Math.round(lookup[at + channel] * (1 - hairWeight) + hairLookup[at + channel] * hairWeight)
        }
      }
      context.putImageData(image, 0, 0)
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG encoding failed')), 'image/png'))
      return blob
    }
    const paletteBlobCache = new Map()
    const recolorDefaultAtlas = async (source, seed, category) => {
      const key = `${source}|${seed}|${category}`
      let pending = paletteBlobCache.get(key)
      if (!pending) {
        pending = colorizeDefaultAtlas(source, seed, category)
        paletteBlobCache.set(key, pending)
        pending.catch(() => { if (paletteBlobCache.get(key) === pending) paletteBlobCache.delete(key) })
        while (paletteBlobCache.size > 8) paletteBlobCache.delete(paletteBlobCache.keys().next().value)
      } else {
        paletteBlobCache.delete(key); paletteBlobCache.set(key, pending)
      }
      return URL.createObjectURL(await pending)
    }
    if (window.__DSH_BATTLE_PALETTE_TEST__ === true) window.__DSH_BATTLE_PALETTE_TEST_EXPORT__ = recolorDefaultAtlas
    const mediaMemory = new Map()
    let mediaDbPromise = null
    const openMediaDb = () => {
      if (typeof indexedDB === 'undefined') return Promise.resolve(null)
      if (!mediaDbPromise) mediaDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open('dsh-tavern-game-media-v1', 1)
        request.onupgradeneeded = () => request.result.createObjectStore('media')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }).catch(() => null)
      return mediaDbPromise
    }
    const putMediaEntries = async (gameId, entries) => {
      for (const [key, value] of entries) mediaMemory.set(`${gameId}:${key}`, value)
      const db = await openMediaDb()
      if (!db) return false
      return new Promise(resolve => {
        let transaction
        try {
          transaction = db.transaction('media', 'readwrite')
          for (const [key, value] of entries) transaction.objectStore('media').put(value, `${gameId}:${key}`)
          transaction.oncomplete = () => resolve(true); transaction.onerror = transaction.onabort = () => resolve(false)
        } catch (_) { try { transaction?.abort() } catch (_) {}; resolve(false) }
      })
    }
    const putMedia = (gameId, key, value) => putMediaEntries(gameId, [[key, value]])
    const getMedia = async (gameId, key) => {
      const id = `${gameId}:${key}`
      if (mediaMemory.has(id)) return mediaMemory.get(id)
      const db = await openMediaDb()
      if (!db) return mediaMemory.get(id) || null
      return new Promise(resolve => {
        try {
          const request = db.transaction('media', 'readonly').objectStore('media').get(id)
          request.onsuccess = () => resolve(request.result || mediaMemory.get(id) || null); request.onerror = () => resolve(mediaMemory.get(id) || null)
        } catch (_) { resolve(mediaMemory.get(id) || null) }
      })
    }
    const parseAtlasRig = value => {
      const modes = ['idle', 'attack', 'kick', 'cast', 'hit', 'guard', 'dodge', 'down', 'victory']
      if (!value || value.schemaVersion !== 1 || value.columns !== 4 || value.rows !== 4 || !Number.isFinite(value.fps) || value.fps < 1 || value.fps > 24 || !value.clips || typeof value.clips !== 'object' || Array.isArray(value.clips)) throw new Error('动作配置需为有效的 4×4 图集，速度为 1–24 FPS。')
      const clips = {}
      const entries = Object.entries(value.clips)
      if (!entries.length || entries.length > modes.length) throw new Error('动作配置为空或动作过多。')
      for (const [mode, frames] of entries) {
        if (!modes.includes(mode) || !Array.isArray(frames) || !frames.length || frames.length > 16 || frames.some(frame => !Number.isInteger(frame) || frame < 0 || frame > 15)) throw new Error('动作名无效，帧号须为 0–15，每个动作最多16帧。')
        clips[mode] = [...frames]
      }
      return { schemaVersion: 1, columns: 4, rows: 4, fps: value.fps, clips }
    }
    const validateRaster = async (blob, pngOnly = false) => {
      if (!blob || blob.size > 12 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(blob.type) || (pngOnly && blob.type !== 'image/png')) throw new Error('请选择不超过 12 MB 的 PNG、JPEG、WebP 或 GIF 图片。')
      const bytes = new Uint8Array(await blob.slice(0, 32).arrayBuffer())
      const png = bytes.length >= 24 && [137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82].every((byte, index) => bytes[index] === byte)
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
      const gif = ['GIF87a', 'GIF89a'].includes(String.fromCharCode(...bytes.slice(0, 6)))
      if (!({ 'image/png': png, 'image/jpeg': jpeg, 'image/webp': webp, 'image/gif': gif })[blob.type]) throw new Error('图片内容与文件类型不符。')
      if (pngOnly) {
        const header = new DataView(bytes.buffer), width = header.getUint32(16), height = header.getUint32(20)
        if (!width || !height || width > 4096 || height > 4096 || width % 4 || height % 4) throw new Error('外观 PNG 尺寸需为4的倍数，且宽高不超过4096。')
      }
      let image
      try {
        if (typeof createImageBitmap === 'function') { image = await createImageBitmap(blob) }
        else {
          const url = URL.createObjectURL(blob)
          try { image = await new Promise((resolve, reject) => { const picture = new Image(); picture.onload = () => resolve(picture); picture.onerror = () => reject(new Error('图片无法解码。')); picture.src = url }) }
          finally { URL.revokeObjectURL(url) }
        }
      } catch (_) { throw new Error('图片无法解码，请重新导出图片。') }
      const valid = image.width > 0 && image.height > 0 && (!pngOnly || (image.width <= 4096 && image.height <= 4096 && !(image.width % 4) && !(image.height % 4)))
      image.close?.()
      if (!valid) throw new Error('外观 PNG 尺寸需为4的倍数，且宽高不超过4096。')
      return blob
    }
    const parseAppearanceFile = async file => {
      if (file.size > 16 * 1024 * 1024) throw new Error('角色外观包不能超过 16 MB。')
      const source = JSON.parse(await file.text())
      if (source?.kind !== 'dsh-battle-appearance' || source.schemaVersion !== 1 || typeof source.name !== 'string' || !source.name.trim() || source.name.length > 80 || source.texture?.mimeType !== 'image/png') throw new Error('需要 dsh-battle-appearance v1 外观包和 PNG 图集。')
      const data = source.texture.data
      if (typeof data !== 'string' || !data.length || data.length > 16 * 1024 * 1024 || data.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) throw new Error('外观包 PNG Base64 无效。')
      const binary = atob(data)
      if (binary.length > 12 * 1024 * 1024) throw new Error('外观包 PNG 不能超过 12 MB。')
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
      const rig = parseAtlasRig(source.rig)
      const texture = await validateRaster(new Blob([bytes], { type: 'image/png' }), true)
      return { name: source.name.trim(), texture, rig }
    }
    const DEFAULT_AVATARS = { 'starter-male': 'male', 'starter-female': 'female', 'jade-swordsman': 'male', 'crimson-duelist': 'female', 'frost-mage': 'female', 'iron-guardian': 'male', 'forest-ranger': 'female',
      'amber-monk': 'male', 'moonlit-spear-guard': 'female', 'ember-gunslinger': 'female', 'azure-healer': 'female',
      'mountain-exorcist': 'male', 'shadow-assassin': 'male', 'clockwork-knight': 'female', 'storm-lancer': 'male',
      'desert-falconer': 'female', 'beastkeeper': 'male', 'star-oracle': 'female', 'thunder-priest': 'male', 'lingxiao-cultivator': 'male',
      'dawn-paladin': 'male', 'bamboo-alchemist': 'male', 'dusk-ronin': 'male', 'scarlet-sorceress': 'female',
      'frost-archer': 'female', 'lotus-dancer': 'female', 'desert-sentinel': 'male', 'violet-assassin': 'female',
      'scholar-swordsman': 'male', 'sun-priestess': 'female', 'obsidian-brawler': 'male', 'jade-lancer': 'female',
      'moon-elf-archer': 'female', 'dwarven-artificer': 'male', 'pirate-captain': 'male', 'night-ninja': 'female',
      'vampire-duelist': 'male', 'wandering-bard': 'female',
      'silver-wolf': 'animal', 'ember-fox': 'animal', 'snow-tiger': 'animal', 'raven-scout': 'animal',
      'azure-eastern-dragon': 'animal', 'western-dragon': 'animal', qilin: 'animal', xuanwu: 'animal',
      'forest-fae': 'animal', phoenix: 'animal', pegasus: 'animal', griffin: 'animal', unicorn: 'animal',
      'nine-tail-fox': 'animal', thunderbird: 'animal', 'sea-serpent': 'animal',
      'desert-scorpion': 'animal', 'wild-bear': 'animal', 'savanna-lion': 'animal', 'giant-lizard': 'animal',
      'golden-staff-warrior': 'male', 'elder-staff-mage': 'male' }
    const explicitGender = actor => {
      const identity = `${actor?.gender || ''} ${actor?.sex || ''} ${actor?.appearance?.gender || ''}`
      return /female|woman|girl|女/i.test(identity) ? 'female' : /male|man|boy|男/i.test(identity) ? 'male' : ''
    }
    const defaultAvatar = (actor, catalog = DEFAULT_AVATARS) => {
      if (Object.hasOwn(catalog, actor?.avatarId)) return actor.avatarId
      const species = String(actor?.species || '').trim(), kind = String(actor?.kind || '').trim()
      const identity = `${actor?.name || ''} ${species}`
      const human = /^(?:human|person|humanoid|人类|人族|凡人|人形)$/i.test(kind) || /^(?:human|person|humanoid|人类|人族|凡人|人形)$/i.test(species)
      const animal = !human && (/(?:狼|狐|虎|猫|犬|狗|豹|鸟|鸦|鹰|鹿|蛇|蜥|蝎|蜘蛛|蟒|狮|龟|熊|龙|麒麟|玄武|凤凰|天马|飞马|狮鹫|独角兽|灵狐|神鸟|雷鸟|海蛇|蛟龙|精灵|仙子|花妖|妖精|wolf|fox|tiger|raven|crow|eagle|bear|lion|lizard|scorpion|deer|snake|dragon|qilin|phoenix|pegasus|griffin|unicorn|thunderbird|fairy|fae|beast|animal|creature|pet|monster|灵兽|妖兽|宠物|野兽)/i.test(identity)
        || /^(?:animal|beast|creature|pet|monster|灵兽|妖兽|宠物|野兽|动物)$/i.test(kind))
      if (animal) {
        const kinds = [[/(?:东方龙|青龙|东海龙|azure dragon|eastern dragon)/i, 'azure-eastern-dragon'],
          [/(?:西方龙|western dragon|red dragon|黑龙|金龙|赤龙)/i, 'western-dragon'], [/(?:麒麟|qilin)/i, 'qilin'],
          [/(?:玄武|龟蛇|xuanwu|tortoise)/i, 'xuanwu'], [/(?:凤凰|凤鸟|phoenix)/i, 'phoenix'],
          [/(?:天马|飞马|pegasus)/i, 'pegasus'], [/(?:狮鹫|griffin)/i, 'griffin'], [/(?:独角兽|unicorn)/i, 'unicorn'],
          [/(?:九尾狐|灵狐|狐妖|nine.?tail.?fox)/i, 'nine-tail-fox'], [/(?:雷鸟|雷云神鸟|thunderbird)/i, 'thunderbird'],
          [/(?:海蛇|蛟龙|海龙|sea serpent)/i, 'sea-serpent'], [/(?:森林精灵|萤森精灵|仙子|花妖|妖精|forest fae|fairy|fae)/i, 'forest-fae'],
          [/(?:狼|wolf)/i, 'silver-wolf'], [/(?:狐|fox)/i, 'ember-fox'], [/(?:虎|tiger)/i, 'snow-tiger'],
          [/(?:鸦|乌鸦|鸟|raven|crow|eagle)/i, 'raven-scout'], [/(?:蝎|scorpion)/i, 'desert-scorpion'],
          [/(?:熊|bear)/i, 'wild-bear'], [/(?:狮|lion)/i, 'savanna-lion'], [/(?:蜥|lizard)/i, 'giant-lizard'], [/(?:龙|dragon)/i, 'western-dragon']]
        const specific = kinds.slice(0, 12), common = kinds.slice(12, -1), generic = kinds.slice(-1)
        const match = specific.find(([pattern]) => pattern.test(species)) || specific.find(([pattern]) => pattern.test(actor?.name || ''))
          || common.find(([pattern]) => pattern.test(species)) || common.find(([pattern]) => pattern.test(actor?.name || ''))
          || generic.find(([pattern]) => pattern.test(species)) || generic.find(([pattern]) => pattern.test(actor?.name || ''))
        if (match && Object.hasOwn(catalog, match[1])) return match[1]
      }
      const categoryOf = id => typeof catalog[id] === 'string' ? catalog[id] === 'animal' ? 'animal' : 'human' : catalog[id]?.category || 'human'
      const genderOf = id => typeof catalog[id] === 'string' ? catalog[id] : catalog[id]?.gender
      const gender = explicitGender(actor), choices = Object.keys(catalog).filter(id => categoryOf(id) === (animal ? 'animal' : 'human') && (animal || !gender || genderOf(id) === gender))
      let hash = 0x811c9dc5
      for (const character of `${actor?.id || ''}\u0000${actor?.name || 'actor'}`) hash = Math.imul(hash ^ character.codePointAt(0), 0x01000193) >>> 0
      return choices[hash % choices.length]
    }
    const avatarAssetPath = avatarId => avatarId === 'starter-male' ? 'human/sprite/adventurer-male-actions-v1.png'
      : avatarId === 'starter-female' ? 'human/sprite/adventurer-female-actions-v1.png'
        : `human/sprite/defaults/${avatarId}-actions-v1.png`
    const paletteSeedFor = actor => {
      const seed = Number(actor?.avatarPaletteSeed)
      if (Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffff_ffff) return seed
      let value = 0x811c9dc5
      for (const character of `legacy-palette\u0000${actor?.id || ''}\u0000${actor?.name || ''}\u0000${actor?.avatarId || ''}\u0000${actor?.avatarHue ?? ''}`) value = Math.imul(value ^ character.codePointAt(0), 0x01000193) >>> 0
      return value || 0x9e3779b9
    }
    const prepareBattlePalettes = async (ctx, initial, onProgress = () => {}) => {
      const state = initial || {}, battle = state.battle || state, catalog = state.avatarCatalog || DEFAULT_AVATARS
      const party = array(battle.party).slice(0, 6).map(actor => ({ ...actor, avatarPaletteSeed: paletteSeedFor(actor) }))
      const enemies = array(battle.enemies).slice(0, 6).map(actor => ({ ...actor, avatarPaletteSeed: paletteSeedFor(actor) }))
      const activeIndexes = (roster, field, scalar) => array(field).length ? array(field).slice(0, 3) : [Number(scalar) || 0]
      const playerIndexes = activeIndexes(party, battle.activePlayers, battle.activePlayer)
      const enemyIndexes = activeIndexes(enemies, battle.activeEnemies, battle.activeEnemy)
      const rows = [
        ...playerIndexes.map(index => ({ actor: party[index], enemy: false })),
        ...enemyIndexes.map(index => ({ actor: enemies[index], enemy: true })),
      ].filter(({ actor }) => actor && (!battle.outcome || Number(actor.hp) > 0)).map(({ actor, enemy }) => {
        const id = actor.id || `${enemy ? 'enemy' : 'player'}:${actor.name}`
        const avatarId = defaultAvatar(actor, catalog)
        return { id, source: ctx.tavernUi.assetUrl(avatarAssetPath(avatarId)), seed: actor.avatarPaletteSeed, category: catalog[avatarId]?.category || 'human' }
      })
      const sprites = {}
      let completed = 0
      onProgress(0, rows.length)
      const ready = await Promise.allSettled(rows.map(async row => {
        try { return { ...row, url: await recolorDefaultAtlas(row.source, row.seed, row.category) } }
        finally { onProgress(++completed, rows.length) }
      }))
      for (const result of ready) if (result.status === 'fulfilled') {
        const row = result.value
        sprites[row.id] = { key: `${row.source}|${row.seed}|${row.category}`, url: row.url }
      }
      const preparedBattle = { ...battle, party, enemies }
      return { initial: state.battle ? { ...state, battle: preparedBattle } : preparedBattle, sprites }
    }
    const battleOverlays = new Map()
    const openBattleOverlay = async (ctx, gameId, initial) => {
      if (battleOverlays.has(gameId)) return
      const opening = {}
      const trigger = typeof document !== 'undefined' ? document.activeElement : null
      battleOverlays.set(gameId, opening)
      const release = () => { if (battleOverlays.get(gameId) === opening) { battleOverlays.delete(gameId); if (trigger?.isConnected) trigger.focus?.({ preventScroll: true }) } }
      try {
        ctx.tavernUi.openOverlay({ gameId, onClose: release, render: ({ gameId: overlayGameId, close }) => h(BattleGate, { ctx, gameId: overlayGameId, initial, close: () => { release(); close() } }) })
      } catch (error) {
        release()
        throw error
      }
    }
    function BattleGate({ ctx, gameId, initial, close }) {
      const [prepared, setPrepared] = useState(null)
      const [progress, setProgress] = useState({ done: 0, total: 0 })
      const [error, setError] = useState('')
      useEffect(() => {
        let active = true, owned = null
        const release = () => { for (const entry of Object.values(owned?.sprites || {})) URL.revokeObjectURL(entry.url) }
        const prepare = async () => {
          try {
            owned = await prepareBattlePalettes(ctx, initial, (done, total) => { if (active) setProgress({ done, total }) })
            if (!active) { release(); return }
            if (typeof Image !== 'undefined') {
              const image = new Image()
              image.src = battleScene(ctx, gameId, initial)
              try { await image.decode() } catch (_) { /* A missing backdrop must not hide combat controls. */ }
              if (!active) { release(); return }
            }
            const expected = initial?.battle || initial
            if (!expected.demo) {
              const latest = unpack(await routeCall(ctx.tavernUi, 'battle-state', { gameId }))
              if (latest?.battle?.id !== expected.id || latest.battle.seq !== expected.seq || (!expected.outcome && (latest.battle.readOnly || inProgress(latest)))) throw new Error('正文或战斗已更新，请返回正文，重新点击战斗入口。')
            }
            if (active) setPrepared(owned)
            else release()
          } catch (e) { release(); if (active) setError(e?.message || '场景准备失败，请返回正文后重试。') }
        }
        prepare()
        return () => { active = false; release() }
      }, [gameId, initial])
      if (prepared) return h(BattleOverlay, { ctx, gameId, initial: prepared.initial, initialPalettes: prepared.sprites, close })
      const battle = initial?.battle || initial || {}
      return h('div', { className: 'stg stg-overlay stg-battle-gate', 'aria-label': '准备战斗场景' }, h(Style),
        h('div', { className: 'stg-gate-art', style: { backgroundImage: `url("${battleScene(ctx, gameId, initial)}")` }, 'aria-hidden': true }),
        h('section', { className: 'stg-gate-card', 'aria-busy': !error }, h('small', null, battle.demo ? '战斗演练' : '剧情战斗'),
          h('h2', null, error ? '暂时无法进入' : '准备战斗场景'),
          h('p', null, array(battle.enemies).slice(0, 3).map(actor => actor.name).join('、')),
          error ? h('p', { role: 'alert', className: 'stg-gate-error' }, error) : h(React.Fragment, null,
            h('progress', { value: progress.done, max: progress.total || 1, 'aria-label': '角色外观准备进度' }),
            h('p', { role: 'status' }, progress.total && progress.done < progress.total ? `正在准备角色外观 ${progress.done}/${progress.total}` : '正在确认战场…')),
          h('button', { type: 'button', autoFocus: true, onClick: close }, '返回正文')))
    }
// SKELETON_BEGIN
const RIG_MODES = ['idle', 'attack', 'hit', 'cast', 'guard', 'dodge', 'down', 'victory'];
const rigImageSource = value => typeof value === 'string' && value.length <= 8_000_000 && (/^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/=\r\n]+$/.test(value) || /^blob:[^\s<>"']+$/.test(value));
const rigNumber = (value, fallback, min = 0, max = 1) => {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('骨架数值超出范围');
  return value;
};
function parseLayeredRig(input) {
  if (typeof input === 'string' && input.length > 10_000_000) throw new Error('骨架文件过大');
  const source = typeof input === 'string' ? JSON.parse(input) : input;
  if (!source || source.kind !== 'layered-rig' || source.schemaVersion !== 1) throw new Error('需要 layered-rig v1 模板');
  if (!Array.isArray(source.bones) || !source.bones.length || source.bones.length > 24 || !Array.isArray(source.parts) || !source.parts.length || source.parts.length > 32) throw new Error('骨骼限1—24个，图层限1—32个');
  const ids = new Set(), bones = source.bones.map(bone => {
    if (!bone || typeof bone.id !== 'string' || !/^[A-Za-z][\w-]{0,39}$/.test(bone.id) || ids.has(bone.id)) throw new Error('骨骼名称无效或重复');
    ids.add(bone.id);
    if (bone.parent !== undefined && typeof bone.parent !== 'string') throw new Error('父骨骼名称无效');
    return { id: bone.id, ...(bone.parent !== undefined ? { parent: bone.parent } : {}), x: rigNumber(bone.x, 0), y: rigNumber(bone.y, 0), length: rigNumber(bone.length, 0), angle: rigNumber(bone.angle, 0, -360, 360) };
  });
  const byId = Object.fromEntries(bones.map(bone => [bone.id, bone]));
  for (const bone of bones) {
    const seen = new Set(); let cursor = bone;
    while (cursor) {
      if (seen.has(cursor.id)) throw new Error('骨骼父子关系存在循环');
      seen.add(cursor.id);
      if (cursor.parent !== undefined && !ids.has(cursor.parent)) throw new Error('父骨骼不存在');
      cursor = cursor.parent === undefined ? null : byId[cursor.parent];
    }
  }
  const parts = source.parts.map(part => {
    if (!part || !ids.has(part.bone) || (part.src !== undefined && !rigImageSource(part.src))) throw new Error('图层骨骼或图片地址无效');
    const crop = part.crop ?? { x: 0, y: 0, width: 1, height: 1 };
    const c = { x: rigNumber(crop.x, 0), y: rigNumber(crop.y, 0), width: rigNumber(crop.width, 1, 0.0001), height: rigNumber(crop.height, 1, 0.0001) };
    if (c.x + c.width > 1.0000001 || c.y + c.height > 1.0000001) throw new Error('图层裁剪超出图片');
    return { bone: part.bone, ...(part.src ? { src: part.src } : {}), x: rigNumber(part.x, 0), y: rigNumber(part.y, 0), width: rigNumber(part.width, 0.2, 0.0001), height: rigNumber(part.height, 0.2, 0.0001), pivotX: rigNumber(part.pivotX, 0.5), pivotY: rigNumber(part.pivotY, 0), crop: c };
  });
  if (!source.clips || typeof source.clips !== 'object' || Array.isArray(source.clips) || !Object.keys(source.clips).length || Object.keys(source.clips).length > 8) throw new Error('动作限1—8个');
  const clips = {};
  for (const [name, clip] of Object.entries(source.clips)) {
    if (!RIG_MODES.includes(name) || !clip || !Array.isArray(clip.keyframes) || !clip.keyframes.length || clip.keyframes.length > 16 || (clip.loop !== undefined && typeof clip.loop !== 'boolean')) throw new Error('动作名称或关键帧无效');
    const duration = rigNumber(clip.duration, 1, 0.1, 10); let previous = -1;
    const keyframes = clip.keyframes.map(frame => {
      if (!frame || !frame.angles || typeof frame.angles !== 'object' || Array.isArray(frame.angles) || Object.keys(frame.angles).length > 24) throw new Error('动作角度无效');
      const time = rigNumber(frame.time, 0, 0, duration);
      if (time <= previous) throw new Error('关键帧时间必须递增'); previous = time;
      const angles = Object.create(null);
      for (const [id, angle] of Object.entries(frame.angles)) {
        if (!ids.has(id)) throw new Error('动作引用了未知骨骼');
        angles[id] = rigNumber(angle, 0, -360, 360);
      }
      return { time, angles };
    });
    clips[name] = { duration, loop: clip.loop ?? name === 'idle', keyframes };
  }
  return { kind: 'layered-rig', schemaVersion: 1, bones, parts, clips };
}
function makeRigPose(rig, mode = 'idle', seconds = 0) {
  const clip = (RIG_MODES.includes(mode) && rig.clips[mode]) || rig.clips.idle || Object.values(rig.clips)[0];
  const elapsed = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const time = clip.loop ? elapsed % clip.duration : Math.min(elapsed, clip.duration);
  let left = clip.keyframes[0], right = clip.keyframes.at(-1);
  if (time <= left.time) right = left;
  else if (time >= right.time) left = right;
  else for (let index = 1; index < clip.keyframes.length; index++) if (time <= clip.keyframes[index].time) { left = clip.keyframes[index - 1]; right = clip.keyframes[index]; break; }
  const fraction = left === right ? 0 : (time - left.time) / (right.time - left.time), matrices = Object.create(null);
  const byId = Object.fromEntries(rig.bones.map(bone => [bone.id, bone]));
  const build = bone => {
    if (matrices[bone.id]) return matrices[bone.id];
    const angle = (bone.angle + (left.angles[bone.id] ?? 0) * (1 - fraction) + (right.angles[bone.id] ?? 0) * fraction) * Math.PI / 180;
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const parent = bone.parent ? build(byId[bone.parent]) : [1, 0, 0, 1, 0, 0];
    const [a, b, c, d, e, f] = parent, y = bone.y + (bone.parent ? byId[bone.parent].length : 0);
    return matrices[bone.id] = [a * cosine + c * sine, b * cosine + d * sine, c * cosine - a * sine, d * cosine - b * sine, a * bone.x + c * y + e, b * bone.x + d * y + f];
  };
  for (const bone of rig.bones) build(bone);
  return matrices;
}
let rigFigureSequence = 0;
function RigFigure({ rig, texture, mode = 'idle', token = 0, speed = 1 }) {
  const groups = useRef([]), identity = useRef(null);
  if (!identity.current) identity.current = `stg-rig-${++rigFigureSequence}`;
  useEffect(() => {
    let request, start, stopped = false;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clip = (RIG_MODES.includes(mode) && rig.clips[mode]) || rig.clips.idle || Object.values(rig.clips)[0];
    const paint = now => {
      if (stopped) return;
      start ??= now;
      const seconds = reduced ? 0 : (now - start) / 1000 * (mode === 'idle' ? 1 : speed), pose = makeRigPose(rig, mode, seconds);
      rig.parts.forEach((part, index) => groups.current[index]?.setAttribute('transform', `matrix(${pose[part.bone].join(' ')})`));
      if (!reduced && (clip.loop || seconds < clip.duration)) request = requestAnimationFrame(paint);
    };
    request = requestAnimationFrame(paint);
    return () => { stopped = true; cancelAnimationFrame(request); };
  }, [rig, mode, token, speed]);
  const pose = makeRigPose(rig, mode, 0);
  return h('svg', { viewBox: '0 0 1 1', width: '100%', height: '100%', role: 'img', 'aria-label': '分层骨架角色', style: { overflow: 'visible' } }, rig.parts.map((part, index) => {
    const src = part.src || texture;
    if (!rigImageSource(src)) return null;
    const id = `${identity.current}-${index}`, x = part.x - part.width * part.pivotX, y = part.y - part.height * part.pivotY;
    return h('g', { key: index, ref: element => { groups.current[index] = element; }, transform: `matrix(${pose[part.bone].join(' ')})` },
      h('defs', null, h('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, h('rect', { x, y, width: part.width, height: part.height }))),
      h('image', { href: src, x: x - part.crop.x * part.width / part.crop.width, y: y - part.crop.y * part.height / part.crop.height, width: part.width / part.crop.width, height: part.height / part.crop.height, preserveAspectRatio: 'none', clipPath: `url(#${id})` }));
  }));
}
// A transparent atlas of separately drawn torso / upper arm / forearm occupies thirds.
// Crop rectangles alone cannot invent joints or artwork hidden in a flattened PNG.
function layeredRigTemplate() {
  return { kind: 'layered-rig', schemaVersion: 1,
    bones: [{ id: 'body', x: 0.5, y: 0.2, length: 0.1, angle: 0 }, { id: 'upper', parent: 'body', x: 0.09, y: 0, length: 0.18, angle: -20 }, { id: 'forearm', parent: 'upper', x: 0, y: 0, length: 0.16, angle: -10 }],
    parts: [{ bone: 'body', width: 0.22, height: 0.4, pivotX: 0.5, pivotY: 0, crop: { x: 0, y: 0, width: 1 / 3, height: 1 } }, { bone: 'upper', width: 0.08, height: 0.2, pivotX: 0.5, pivotY: 0, crop: { x: 1 / 3, y: 0, width: 1 / 3, height: 1 } }, { bone: 'forearm', width: 0.07, height: 0.18, pivotX: 0.5, pivotY: 0, crop: { x: 2 / 3, y: 0, width: 1 / 3, height: 1 } }],
    clips: { idle: { duration: 2, loop: true, keyframes: [{ time: 0, angles: { upper: 0 } }, { time: 1, angles: { upper: 5 } }, { time: 2, angles: { upper: 0 } }] }, attack: { duration: 0.5, loop: false, keyframes: [{ time: 0, angles: { upper: 0, forearm: 0 } }, { time: 0.2, angles: { upper: -90, forearm: 55 } }, { time: 0.5, angles: { upper: 0, forearm: 0 } }] } } };
}
// SKELETON_END
    const RIG_TEMPLATE = { schemaVersion: 1, columns: 4, rows: 4, fps: 8, clips: { idle: [0, 1, 2, 1], attack: [3, 4, 5, 7], cast: [8, 9, 7], guard: [10], hit: [11, 7], dodge: [12, 7], down: [13], victory: [14, 15] } }
    const rigFps = (rig) => rig?.fps == null || !Number.isFinite(Number(rig.fps)) ? 8 : cap(rig.fps, 1, 24)

    function CommandIcon({ name }) {
      const paths = { fight: ['M5 3l6 6-2 2-6-6V3h2zM19 3l-6 6 2 2 6-6V3h-2zM7 13l-4 4 4 4 4-4M17 13l4 4-4 4-4-4'], bag: ['M8 7V5a4 4 0 018 0v2M5 7h14l1 14H4L5 7zM8 12h8M12 10v5'], swap: ['M3 7h15l-4-4M21 17H6l4 4M18 7l-4 4M6 17l4-4'], flee: ['M14 4a2 2 0 110 4 2 2 0 010-4zM12 9l-3 5-5 1M12 9l4 4h5M10 13l5 3-2 6M4 7h5M2 11h4'] };
      return h('svg', { viewBox: '0 0 24 24', 'aria-hidden': true }, paths[name].map((d, i) => h('path', { key: i, d, strokeLinecap: 'round', strokeLinejoin: 'round' })))
    }
    function Style() { return h('style', null, CSS) }

    function AppearancePreview({ appearance }) {
      const [url, setUrl] = useState('')
      const [mode, setMode] = useState('idle')
      const [step, setStep] = useState(0)
      const [replay, setReplay] = useState(0)
      useEffect(() => {
        const objectUrl = URL.createObjectURL(appearance.texture); setUrl(objectUrl)
        return () => URL.revokeObjectURL(objectUrl)
      }, [appearance.texture])
      useEffect(() => {
        setStep(0)
        const frames = appearance.rig.clips[mode] || appearance.rig.clips.idle || [3]
        if (frames.length <= 1) return
        let timer, index = 0
        const advance = () => { index++; setStep(index); if (index < frames.length - 1) timer = setTimeout(advance, 1000 / appearance.rig.fps) }
        timer = setTimeout(advance, 1000 / appearance.rig.fps)
        return () => clearTimeout(timer)
      }, [appearance, mode, replay])
      const frames = appearance.rig.clips[mode] || appearance.rig.clips.idle || [3], frame = frames[Math.min(step, frames.length - 1)]
      return h('div', { className: 'stg-appearance-preview' },
        h('div', { className: 'stg-sprite', role: 'img', 'aria-label': `${appearance.name}动作预览`, 'data-frame': frame, style: { backgroundImage: `url("${url}")`, backgroundPosition: `${frame % 4 * 100 / 3}% ${Math.floor(frame / 4) * 100 / 3}%` } }),
        h('div', { className: 'stg-preview-actions' }, ...[['idle', '站立'], ['attack', '攻击'], ['kick', '踢击'], ['cast', '施法'], ['guard', '防御']].filter(([key]) => appearance.rig.clips[key]).map(([key, name]) => h('button', { key, type: 'button', onClick: () => { setMode(key); setStep(0); setReplay(value => value + 1) } }, name))))
    }

    function PartyCard({ actor, index, gameId, onSave, onDesign, busy, disabled, elementCatalog = [{ id: 'neutral', name: '无属性' }], avatarCatalog = {} }) {
      const [draft, setDraft] = useState(() => ({
        ...actor,
        skills: array(actor?.skills).map((skill) => ({ ...skill })),
      }))
      const [requirements, setRequirements] = useState('')
      const [designBusy, setDesignBusy] = useState(false)
      const [designWarnings, setDesignWarnings] = useState([])
      const [designError, setDesignError] = useState('')
      const [designStatus, setDesignStatus] = useState('')
      const [resourceStatus, setResourceStatus] = useState('')
      const [appearancePreview, setAppearancePreview] = useState(null)
      useEffect(() => setDraft({ ...actor, skills: array(actor?.skills).map((skill) => ({ ...skill })) }), [actor])
      const setField = (key, value) => setDraft((d) => ({ ...d, [key]: value }))
      const setStat = (key, value) => setDraft((d) => ({ ...d, [key]: value }))
      const setMaxHp = (value) => setDraft((d) => {
        const beforeMax = Math.max(1, Number(d.maxHp) || 1)
        const afterMax = Math.max(1, Number(value) || 1)
        const ratio = Math.max(0, Math.min(1, (Number(d.hp) || 0) / beforeMax))
        return { ...d, maxHp: value, hp: String(Math.round(ratio * afterMax)) }
      })
      const displayName = draft.name || `队友 ${index + 1}`
      return h('details', { className: 'stg-card' },
        h('summary', null, h('strong', null, displayName), h('span', null, `${actorHp(draft)} / ${Number(draft.maxHp) || 0} HP`)),
        h('div', { className: 'stg-edit' },
          h('label', null, '名称', h('input', { value: draft.name || '', maxLength: 40, onChange: (e) => setField('name', e.target.value) })),
          h('label', null, '当前 HP', h('input', { type: 'number', min: 0, max: Number(draft.maxHp) || 999999, value: draft.hp ?? '', onChange: (e) => setField('hp', e.target.value) })),
          h('label', null, '最大 HP', h('input', { type: 'number', min: 1, value: draft.maxHp ?? '', onChange: (e) => setMaxHp(e.target.value) })),
          ...['attack', 'defense', 'speed'].map((key) => h('label', { key }, ({ attack: '攻击', defense: '防御', speed: '速度' })[key], h('input', { type: 'number', value: draft[key] ?? 0, onChange: (e) => setStat(key, e.target.value) }))),
          ...[0, 1].map(slot => h('label', { key: `type-${slot}`, style: { gridColumn: 'span 2' } }, slot ? '副属性（可选）' : '主属性', h('select', { 'aria-label': slot ? '角色副属性' : '角色主属性', value: draft.types?.[slot] || (slot ? '' : 'neutral'), onChange: e => setDraft(previous => { const types = [...(previous.types || ['neutral'])]; types[slot] = e.target.value; return { ...previous, types: [...new Set(types.filter(Boolean))] } }) }, slot ? h('option', { value: '' }, '无副属性') : null, elementCatalog.map(type => h('option', { key: type.id, value: type.id }, type.name))))),
          h('details', { className: 'stg-skillfold' }, h('summary', null, 'AI 单独设计当前角色'),
            h('small', null, '只生成这名角色的可编辑草稿，不改其他队友或背包；检查后点本卡底部“保存”生效。'),
            h('label', null, '设计要求', h('textarea', { value: requirements, maxLength: 2000, rows: 2, style: { width: '100%', resize: 'vertical' }, placeholder: '描述角色定位、数值倾向或技能风格', onChange: e => setRequirements(e.target.value) })),
            h('button', { type: 'button', disabled: disabled || busy || designBusy || !requirements.trim(), onClick: async () => {
              setDesignBusy(true); setDesignWarnings([]); setDesignError(''); setDesignStatus('')
              try {
                const result = await onDesign(actor.id, requirements.trim(), false)
                if (result?.actor) {
                  setDraft({ ...result.actor, skills: array(result.actor.skills).map(skill => ({ ...skill })) })
                  setDesignWarnings(array(result.warnings)); setDesignStatus('当前角色草稿已更新；确认数值和技能后，点本卡底部“保存”。')
                }
              } catch (error) { setDesignError(failureText(error, 'AI 角色设计失败，原草稿已保留。')) }
              finally { setDesignBusy(false) }
            } }, designBusy ? '设计中…' : 'AI 设计本角色草稿'),
            designStatus ? h('small', { role: 'status' }, designStatus) : null,
            designError ? h('small', { role: 'alert', className: 'stg-error' }, designError) : null,
            designError && /模型|生成|JSON|截断|返回|MODEL_|TIMEOUT/i.test(designError) ? h('button', { type: 'button', disabled: disabled || busy || designBusy, onClick: async () => {
              setDesignBusy(true); setDesignWarnings([]); setDesignError(''); setDesignStatus('')
              try {
                const result = await onDesign(actor.id, requirements.trim(), true)
                if (result?.actor) {
                  setDraft({ ...result.actor, skills: array(result.actor.skills).map(skill => ({ ...skill })) })
                  setDesignWarnings(array(result.warnings)); setDesignStatus('精简草稿已更新；确认数值和技能后，点本卡底部“保存”。')
                }
              } catch (error) { setDesignError(failureText(error, 'AI 角色设计失败，原草稿已保留。')) }
              finally { setDesignBusy(false) }
            } }, '重试精简设计本角色') : null,
            ...designWarnings.map((warning, i) => h('small', { key: i }, warning))),
          h('details', { className: 'stg-skillfold' }, h('summary', null, `技能（${array(draft.skills).length}）`),
            h('div', { className: 'stg-skillrows' }, array(draft.skills).map((skill, skillIndex) => h('details', { key: skillIndex }, h('summary', null, skill.name || `技能 ${skillIndex + 1}`), h('label', null, '名称', h('input', {
              value: skill.name || '', maxLength: 40,
              onChange: (e) => setDraft((d) => ({ ...d, skills: d.skills.map((item, i) => i === skillIndex ? { ...item, name: e.target.value, id: undefined, baseId: undefined, mechanics: [], extraStatuses: [], sourceDescription: '' } : item) })),
            })), h('label', null, '技能属性', h('select', { 'aria-label': `技能${skillIndex + 1}属性`, value: skill.element || 'neutral', onChange: e => setDraft(d => ({ ...d, skills: d.skills.map((item, i) => i === skillIndex ? { ...item, element: e.target.value } : item) })) }, elementCatalog.map(type => h('option', { key: type.id, value: type.id }, type.name)))),
            h('label', null, '威力', h('input', { 'aria-label': `技能${skillIndex + 1}威力`, type: 'number', min: 0, max: 140, value: skill.power ?? 70, onChange: e => setDraft(d => ({ ...d, skills: d.skills.map((item, i) => i === skillIndex ? { ...item, power: Number(e.target.value) } : item) })) })),
            h('label', null, '原文效果', h('textarea', { value: skill.sourceDescription ?? '', maxLength: 400, rows: 2, style: { width: '100%', resize: 'vertical' }, placeholder: '例如：必定先攻、必中、必定暴击，并使目标中毒', onChange: (e) => setDraft((d) => ({ ...d, skills: d.skills.map((item, i) => i === skillIndex ? { ...item, id: undefined, baseId: undefined, mechanics: [], extraStatuses: [], sourceDescription: e.target.value, description: e.target.value } : item) })) })), h('small', null, '攻击威力20–140；辅助技能威力0。 ', skill.description || '保存后显示实际效果'))))),
          h('details', { className: 'stg-skillfold' }, h('summary', null, '角色外观'), h('div', { className: 'stg-appearance' },
            h('label', null, '内置外观', h('select', { 'aria-label': '角色内置外观', value: draft.avatarId || '', onChange: e => setField('avatarId', e.target.value) }, h('option', { value: '' }, '按角色特征自动匹配'), Object.entries(avatarCatalog).map(([id, avatar]) => h('option', { key: id, value: id }, avatar.name || id)))),
            h('small', null, '内置外观用通用职业和物种命名；个人导入的图片优先显示。'),
            h('label', null, '导入完整外观包（含动作）', h('input', { type: 'file', accept: '.json,application/json', 'aria-label': '导入完整外观包（含动作）', disabled: disabled || !actor?.id, onChange: async e => {
              const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
              try {
                const appearance = await parseAppearanceFile(file)
                const saved = await putMediaEntries(gameId, [[`${actor.id}:texture`, appearance.texture], [`${actor.id}:rig`, appearance.rig]])
                setAppearancePreview(appearance)
                setResourceStatus(saved ? `${appearance.name} 已保存到此角色，重新打开仍可使用。` : `${appearance.name} 已临时导入；本地存储不可用，关闭页面后需重新导入。`)
              } catch (error) { setResourceStatus(error?.message || '外观包无效。') }
            } })),
            h('small', null, '一个 JSON 包含角色 PNG 图集和动作，≤16 MB。'),
            appearancePreview ? h(AppearancePreview, { appearance: appearancePreview }) : null,
            h('details', { className: 'stg-import-category' }, h('summary', null, '单独导入图片 / 动作（高级）'),
            h('label', null, '角色图片 / 图集（≤12 MB）', h('input', { type: 'file', accept: 'image/*', disabled: disabled || !actor?.id, onChange: async e => {
              const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
              if (!file.type.startsWith('image/') || file.size > 12 * 1024 * 1024) { setResourceStatus('请选择不超过 12 MB 的图像。'); return }
              const saved = await putMedia(gameId, `${actor.id}:texture`, file); setResourceStatus(saved ? `${file.name} 已保存到此角色。` : `${file.name} 已临时导入；此浏览器未提供 IndexedDB。`)
            } })),
            h('label', null, '动作 / 骨架配置 JSON（≤256 KB）', h('input', { type: 'file', accept: '.json,application/json', disabled: disabled || !actor?.id, onChange: async e => {
              const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
              if (file.size > 256 * 1024) { setResourceStatus('动作配置不能超过 256 KB。'); return }
              try {
                const json = JSON.parse(await file.text())
                const value = json.kind === 'layered-rig' ? parseLayeredRig(json) : parseAtlasRig(json)
                const saved = await putMedia(gameId, `${actor.id}:rig`, value); setResourceStatus(saved ? `${file.name} 已保存到此角色。` : `${file.name} 已临时导入；此浏览器未提供 IndexedDB。`)
              } catch (error) { setResourceStatus(error?.message || '动作配置无效。') }
            } }))),
            resourceStatus ? h('small', { role: 'status' }, resourceStatus) : null)),
          h('button', { className: 'stg-save', disabled: busy || disabled, onClick: () => onSave(index, draft) }, busy ? '保存中…' : '保存')))
    }

    function GenerationModelPicker({ ctx, gameId, scope, label, selection, disabled, onSave }) {
      const [catalog, setCatalog] = useState(null)
      const [draft, setDraft] = useState(selection || {})
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState('')
      const sequence = useRef(0)
      useEffect(() => { setDraft(selection || {}) }, [selection?.provider, selection?.model, selection?.reasoningEffort])
      useEffect(() => () => { sequence.current++ }, [])
      const load = async (provider = draft.provider, model = draft.model) => {
        const token = ++sequence.current
        setLoading(true); setError('')
        try {
          const result = unpack(await routeCall(ctx.tavernUi, 'model-options', { gameId, scope, ...(provider ? { provider, model: model || '' } : {}) }))
          if (token !== sequence.current) return
          setCatalog(result)
          if (!provider && result.selection) setDraft(result.selection)
        } catch (e) { if (token === sequence.current) setError(e?.message || '模型列表读取失败。') }
        finally { if (token === sequence.current) setLoading(false) }
      }
      const models = array(catalog?.providers).find(group => group.provider === draft.provider)?.models || []
      return h('details', { className: 'stg-mediafold stg-generation-model', onToggle: e => { if (e.currentTarget.open && !catalog && !loading) load() } },
        h('summary', null, `${label} · ${selection?.model || '酒馆后台默认'}`),
        h('div', { className: 'stg-ai-model' },
          h('label', null, '提供方', h('select', { value: draft.provider || '', disabled: disabled || loading, onChange: e => { const provider = e.target.value; setDraft({ provider, model: '', reasoningEffort: '' }); load(provider, '') } }, h('option', { value: '' }, '选择提供方'), array(catalog?.providers).map(group => h('option', { key: group.provider, value: group.provider }, group.providerName || group.provider)))),
          h('label', null, '模型', h('select', { value: draft.model || '', disabled: disabled || loading || !models.length, onChange: e => { const model = e.target.value; setDraft(previous => ({ ...previous, model, reasoningEffort: '' })); load(draft.provider, model) } }, h('option', { value: '' }, '选择模型'), models.map(model => h('option', { key: model.id, value: model.id }, model.name || model.id)))),
          h('label', null, '推理强度', h('select', { value: draft.reasoningEffort || '', disabled: disabled || loading || !array(catalog?.efforts).length, onChange: e => setDraft(previous => ({ ...previous, reasoningEffort: e.target.value })) }, h('option', { value: '' }, '模型默认'), array(catalog?.efforts).map(effort => h('option', { key: effort.id, value: effort.id }, effort.name)))),
          h('div', { className: 'stg-actions' }, h('button', { disabled: disabled || loading, onClick: () => load() }, loading ? '读取中…' : '刷新列表'), h('button', { disabled: disabled || loading, onClick: () => onSave(null) }, '使用酒馆后台模型'), h('button', { disabled: disabled || loading || !draft.provider || !draft.model || !catalog?.preparationAvailable, onClick: () => onSave({ provider: draft.provider, model: draft.model, ...(draft.reasoningEffort ? { reasoningEffort: draft.reasoningEffort } : {}) }) }, '保存生成模型')),
          error ? h('small', { role: 'alert' }, error) : null))
    }

    function SetupPanel({ ctx, gameId, onBattle }) {
      const [state, setState] = useState(null)
      const [error, setError] = useState('')
      const [retryAction, setRetryAction] = useState('')
      const [busy, setBusy] = useState('')
      const [manualText, setManualText] = useState('')
      const [injectStory, setInjectStory] = useState(false)
      const [mediaNotice, setMediaNotice] = useState('')
      const [builtinScene, setBuiltinScene] = useState(() => sceneChoice(gameId))
      const [sourceOptions, setSourceOptions] = useState({ useContext: true, useMvu: true, useWorldbook: false, useLedger: false, historyRounds: 6, ledgerText: '' })
      const [modelOptions, setModelOptions] = useState(null)
      const [modelBusy, setModelBusy] = useState(false)
      const [aiDraft, setAiDraft] = useState({})
      const [updateInfo, setUpdateInfo] = useState(null)
      const [updateBusy, setUpdateBusy] = useState('')
      const [updateNote, setUpdateNote] = useState('')
      const [rollbackChoices, setRollbackChoices] = useState([])
      const [rollbackChoice, setRollbackChoice] = useState('')
      const modelRequest = useRef(0)
      const mounted = useRef(true)
      const op = useRef(0)
      useEffect(() => {
        mounted.current = true
        return () => { mounted.current = false; op.current++ }
      }, [])
      const request = async (name, args, pending) => {
        const token = ++op.current
        setBusy(pending || name)
        setError('')
        setRetryAction('')
        try {
          const result = await routeCall(ctx.tavernUi, name, { gameId, ...args })
          if (mounted.current && token === op.current) setState(unpack(result))
          return result
        } catch (e) {
          if (mounted.current && token === op.current) {
            setError(failureText(e, '操作失败，请重试。'))
            if (name === 'generate-party') setRetryAction('generate-party')
          }
          return null
        } finally {
          if (mounted.current && token === op.current) setBusy('')
        }
      }
      // Use the public game route on mount; keeping this separate makes errors visible.
      useEffect(() => {
        if (!gameId) return
        const token = ++op.current
        setBusy('callHost')
        routeCall(ctx.tavernUi, 'state', { gameId }).then((result) => {
          if (mounted.current && token === op.current) setState(unpack(result))
        }).catch((e) => {
          if (mounted.current && token === op.current) setError(failureText(e, '读取战斗状态失败。'))
        }).finally(() => { if (mounted.current && token === op.current) setBusy('') })
      }, [gameId])
      useEffect(() => {
        if (!gameId || typeof ctx.tavernUi.watchTurnState !== 'function') return
        let active = true
        const stop = ctx.tavernUi.watchTurnState(gameId, () => {
          const token = ++op.current
          routeCall(ctx.tavernUi, 'state', { gameId }).then((result) => {
            if (active && mounted.current && token === op.current) { setState(unpack(result)); setBusy('') }
          }).catch((e) => { if (active && mounted.current && token === op.current) setError(failureText(e, '刷新战斗状态失败。')) })
        })
        return () => { active = false; stop?.() }
      }, [gameId])

      const current = state || {}
      const packs = array(current.packs)
      const party = array(current.party)
      const locked = !!busy || inProgress(current)
      const optionsLocked = locked || (!!current.battle && !current.battle.outcome)
      const ticket = () => ({ turn: current.turnState?.turn, textVersion: current.turnState?.textVersion, baseRevision: current.revision })
      const defaultDifficulties = [
        { id: 'easy', name: '容易' }, { id: 'normal', name: '中等' }, { id: 'hard', name: '困难' },
        { id: 'expert', name: '极难' }, { id: 'hell', name: '地狱' }, { id: 'ai', name: 'AI决策' },
      ]
      const defaultEncounterDifficulties = [{ id: 'low', name: '低' }, { id: 'medium', name: '中' }, { id: 'high', name: '高' }]
      const difficulties = array(current.difficulties).length ? array(current.difficulties) : defaultDifficulties
      const encounterDifficulties = array(current.encounterDifficulties).length ? array(current.encounterDifficulties) : defaultEncounterDifficulties
      const refreshModelOptions = async (provider, model) => {
        const token = ++modelRequest.current
        setModelBusy(true)
        try {
          const response = await routeCall(ctx.tavernUi, 'model-options', { gameId, ...(provider ? { provider } : {}), ...(model ? { model } : {}) })
          const data = unpack(response)
          if (mounted.current && token === modelRequest.current) {
            setModelOptions(data)
            if (data?.selection) setAiDraft(previous => ({ ...previous, ...data.selection }))
          }
        } catch (e) {
          if (mounted.current && token === modelRequest.current) setError(e?.message || '读取 AI 模型选项失败。')
        } finally { if (mounted.current && token === modelRequest.current) setModelBusy(false) }
      }
      useEffect(() => { setAiDraft({ ...(current.aiModel || {}) }) }, [current.aiModel])
      useEffect(() => {
        if (current.difficulty === 'ai' && !modelOptions && !modelBusy) refreshModelOptions(current.aiModel?.provider, current.aiModel?.model)
      }, [current.difficulty, gameId])
      const saveOptions = (difficulty = current.difficulty || 'normal', encounterDifficulty = current.encounterDifficulty || 'medium', aiModel) =>
        request('select-options', { difficulty, encounterDifficulty, ...(aiModel ? { aiModel } : {}), ...ticket() }, 'options')
      const chooseDifficulty = value => {
        if (value === 'ai') setModelOptions(null)
        return saveOptions(value, current.encounterDifficulty || 'medium')
      }
      const selectedDifficulty = difficulties.find(item => item.id === (current.difficulty || 'normal'))
      const selectedProvider = array(modelOptions?.providers).find(item => item.provider === aiDraft.provider)
      const availableModels = array(selectedProvider?.models)
      const changeProvider = provider => {
        setAiDraft(previous => ({ ...previous, provider, model: '', reasoningEffort: '' }))
        refreshModelOptions(provider)
      }
      const changeModel = model => {
        setAiDraft(previous => ({ ...previous, model }))
        refreshModelOptions(aiDraft.provider, model)
      }
      const selectPack = (packId) => request('select-pack', { packId, ...ticket() }, 'pack')
      const generateParty = (compact = false) => request('generate-party', { compact: compact === true, sourceOptions: { ...sourceOptions, historyRounds: cap(sourceOptions.historyRounds, 0, 20), ledgerText: String(sourceOptions.ledgerText || '').slice(0, 4000) }, ...ticket() }, 'generate')
      const designActor = async (actorId, requirements, compact = false) => {
        const token = ++op.current
        setBusy('design'); setError(''); setRetryAction('')
        try {
          const response = await routeCall(ctx.tavernUi, 'design-actor', { gameId, actorId, requirements: String(requirements || '').slice(0, 2000), compact: compact === true, sourceOptions: { ...sourceOptions, historyRounds: cap(sourceOptions.historyRounds, 0, 20), ledgerText: String(sourceOptions.ledgerText || '').slice(0, 4000) }, ...ticket() })
          if (!mounted.current || token !== op.current) return null
          const data = unpack(response)
          return data?.actor ? data : null
        } catch (e) {
          if (mounted.current && token === op.current) setError(failureText(e, 'AI 角色设计失败。'))
          throw e
        }
        finally { if (mounted.current && token === op.current) setBusy('') }
      }
      const saveParty = (index, actor) => {
        const numeric = {}
        for (const key of ['hp', 'maxHp', 'attack', 'defense', 'speed']) {
          const raw = actor[key]
          if (raw === '' || raw == null || !Number.isFinite(Number(raw))) {
            setError(`请填写有效的${({ hp: '当前 HP', maxHp: '最大 HP', attack: '攻击', defense: '防御', speed: '速度' })[key]}。`)
            return null
          }
          numeric[key] = Number(raw)
        }
        if (numeric.hp < 0 || numeric.maxHp < 1 || numeric.hp > numeric.maxHp || numeric.attack < 0 || numeric.defense < 0 || numeric.speed < 0) {
          setError('HP 需在 0 至最大 HP 之间，属性不能小于 0。')
          return null
        }
        const nextParty = party.map((item, i) => i === index ? {
          ...item, ...actor, ...numeric,
          skills: array(actor.skills).map((skill) => ({ ...skill, name: String(skill.name || '').slice(0, 40) })),
        } : item)
        return request('save-party', { party: nextParty, ...ticket() }, 'save')
      }
      const start = async (demo) => {
        const result = await request(demo ? 'demo-start' : 'battle-state', {}, 'start')
        if (!result) return
        const data = unpack(result)
        if (data?.battle) await onBattle(data)
        else if (demo) await onBattle(data)
        else setError('当前没有进行中的战斗。')
      }
      const importPack = async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        if (file.size > 256 * 1024) { setError('玩法包文件不能超过 256 KB。'); return }
        try {
          const pack = JSON.parse(await file.text())
          await request('import-pack', { pack, ...ticket() }, 'pack')
        } catch (e) { setError(e?.message || '无法读取该 JSON 玩法包。') }
      }
      const importMedia = async (kind, event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        if (file.size > (kind === 'rig' ? 16 * 1024 : 12 * 1024 * 1024)) { setMediaNotice('文件过大。图像 / 音频上限 12 MB，动作配置上限 16 KB。'); return }
        try {
          let value = file
          if (kind === 'rig') {
            const rig = JSON.parse(await file.text())
            value = rig.kind === 'layered-rig' ? parseLayeredRig(rig) : parseAtlasRig(rig)
          } else if (kind === 'music' || kind === 'attack' || kind === 'hit') {
            if (!file.type.startsWith('audio/')) throw new Error('请选择音频文件。')
          } else if (kind === 'scene') { value = await validateRaster(file) }
          else if (!file.type.startsWith('image/')) throw new Error('请选择图像文件。')
          const persistent = await putMedia(gameId, kind, value)
          setMediaNotice(persistent ? `${file.name} 已保存在此游戏的本地外观数据中。` : `${file.name} 已导入当前页面；浏览器未提供 IndexedDB，关闭页面后需重新导入。`)
        } catch (e) { setMediaNotice(e?.message || '导入失败。') }
      }
      const downloadRigTemplate = (layered = false) => {
        try {
          const blob = new Blob([JSON.stringify(layered ? layeredRigTemplate() : RIG_TEMPLATE, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const anchor = document.createElement('a'); anchor.href = url; anchor.download = layered ? 'battle-layered-rig.json' : 'battle-atlas-rig.json'; anchor.click(); URL.revokeObjectURL(url)
        } catch (_) { setMediaNotice('当前环境无法下载动作配置模板。') }
      }
      const startManual = async () => {
        if (!manualText.trim()) { setError('请填写战斗描述。'); return }
        const result = await request('manual-start', { battleText: manualText.trim().slice(0, 2000), injectStory, ...ticket() }, 'start')
        const data = unpack(result)
        if (data?.battle) await onBattle(data)
      }
      const checkUpdate = async () => {
        if (updateBusy) return
        setUpdateBusy('check'); setUpdateNote('')
        try {
          const info = await ctx.tavernUi.callHost('dsh-tavern-game/check-update', { gameId })
          setUpdateInfo(info || null)
          if (!info?.updateAvailable) setUpdateNote(info?.notice || `已是最新版本（${info?.current || current.version || '未知'}）。`)
        } catch (e) { setUpdateNote(failureText(e, '检查更新失败。')) }
        finally { setUpdateBusy('') }
      }
      const loadBackups = async () => {
        if (updateBusy) return
        setUpdateBusy('backups'); setUpdateNote('')
        try { const result = await ctx.tavernUi.callHost('dsh-tavern-game/list-update-backups', { gameId }); const backups = array(result?.backups); setRollbackChoices(backups); setRollbackChoice(backups[0] || ''); if (!backups.length) setUpdateNote('没有可用的完整备份；旧版不完整备份不会用于回滚。') }
        catch (error) { setUpdateNote(failureText(error, '读取备份失败。')) }
        finally { setUpdateBusy('') }
      }
      const restoreBackup = async () => {
        if (updateBusy || !rollbackChoice) return
        if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm('恢复选中的完整插件备份？当前版本会先备份，完成后需要重启 DSH。')) return
        setUpdateBusy('rollback'); setUpdateNote('')
        try { const result = await ctx.tavernUi.callHost('dsh-tavern-game/rollback-update', { gameId, backup: rollbackChoice }); setUpdateNote(`已恢复 ${result.from} → ${result.to}，请重启 DSH 并刷新页面。`); setRollbackChoices([]); setRollbackChoice(''); setUpdateInfo(null) }
        catch (error) { setUpdateNote(failureText(error, '恢复失败，请保留备份目录并查看错误详情。')) }
        finally { setUpdateBusy('') }
      }
      const installUpdate = async () => {
        if (updateBusy || !updateInfo?.latest) return
        if (typeof window !== 'undefined' && typeof window.confirm === 'function'
          && !window.confirm(`用 ${updateInfo.latest} 覆盖当前插件的代码与资源？更新后需要重启 DSH。`)) return
        setUpdateBusy('install'); setUpdateNote('')
        try {
          const result = await ctx.tavernUi.callHost('dsh-tavern-game/install-update', { gameId, expected: updateInfo.latest })
          if (!result?.updated) { setUpdateNote(result?.notice || '当前磁盘上的插件已经是最新版本，请重启 DSH 加载。'); setUpdateInfo({ ...updateInfo, updateAvailable: false, current: result?.current || updateInfo.current }); return }
          setUpdateNote(`已更新 ${result.from} → ${result.to}（${result.written} 个文件），请重启 DSH 并刷新页面。`)
          setUpdateInfo({ ...updateInfo, updateAvailable: false, current: result.to })
        } catch (e) { setUpdateNote(failureText(e, '更新失败，请查看完整性检查或恢复提示。')) }
        finally { setUpdateBusy('') }
      }
      const selected = current.selectedPackId || current.packId || ''
      return h('div', { className: 'stg stg-setup', 'data-testid': 'battle-setup-scroll', tabIndex: 0, 'aria-label': '战斗准备，可向下滚动' }, h(Style), h('div', { className: 'stg-wrap' },
        h('header', { className: 'stg-head' }, h('h1', null, '战斗'), h('small', null, `回合制 · ${current.version || '0.1.0'}`),
          h('button', { style: { marginInlineStart: 'auto', minHeight: 24, padding: '2px 8px' }, disabled: !!updateBusy, onClick: checkUpdate }, updateBusy === 'check' ? '检查中…' : '检查更新')),
        updateInfo?.updateAvailable ? h('div', { className: 'stg-update', style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 8px', border: '1px solid #b8c9e6', borderRadius: 6, background: '#f5f8ff', color: '#193e82' } },
          `新版本 ${updateInfo.latest}（当前 ${updateInfo.current}）`,
          h('button', { style: { minHeight: 24, padding: '2px 8px' }, disabled: !!updateBusy, onClick: installUpdate }, updateBusy === 'install' ? '更新中…' : '立即更新')) : null,
        updateNote ? h('small', { role: 'status', style: { display: 'block', padding: '4px 2px' } }, updateNote) : null,
        h('details', { className: 'stg-mediafold' }, h('summary', null, '更新与恢复'),
          h('small', null, '更新先校验完整包并备份；失败会尝试恢复旧版本。恢复后需重启 DSH。'),
          h('button', { type: 'button', disabled: !!updateBusy, onClick: loadBackups }, updateBusy === 'backups' ? '读取备份…' : '查看完整备份'),
          rollbackChoices.length ? h('div', { className: 'stg-actions' }, h('select', { 'aria-label': '选择恢复备份', value: rollbackChoice, onChange: e => setRollbackChoice(e.target.value) }, rollbackChoices.map((id, index) => h('option', { key: id, value: id }, `备份 ${index + 1} · ${id.slice(0, 8)} ${id.slice(8, 10)}:${id.slice(10, 12)}`))), h('button', { disabled: !!updateBusy, onClick: restoreBackup }, updateBusy === 'rollback' ? '恢复中…' : '恢复此备份')) : null),
        h('div', { className: 'stg-controls' },
          h('label', null, '玩法包', h('select', { value: selected, disabled: locked, onChange: (e) => selectPack(e.target.value) },
            h('option', { value: '' }, '选择玩法包'), ...packs.map((pack) => h('option', { key: pack.id, value: pack.id }, pack.name)))),
          h('button', { className: 'stg-primary stg-mainbtn', disabled: !gameId || locked, onClick: generateParty }, busy === 'generate' ? 'AI正在生成…' : 'AI读取并生成角色和背包')),
        h(GenerationModelPicker, { ctx, gameId, scope: 'generationModel', label: 'AI生成模型（角色、背包、敌人）', selection: current.generationModel, disabled: optionsLocked, onSave: model => request('select-options', { generationModel: model, ...ticket() }, 'options') }),
        h('small', null, '一处选择，角色生成、背包、AI编辑角色、敌人生成与战果概括共用。'),
        h('details', { className: 'stg-mediafold' }, h('summary', null, '资料读取（高级）'),
          ...[['useContext', '读取当前上下文'], ['useMvu', '读取 MVU'], ['useWorldbook', '读取世界书'], ['useLedger', '读取台账']].map(([key, label]) => h('label', { key, style: { display: 'flex', gap: 6, alignItems: 'center' } }, h('input', { type: 'checkbox', checked: !!sourceOptions[key], onChange: e => setSourceOptions(previous => ({ ...previous, [key]: e.target.checked })) }), label)),
          h('label', null, '历史轮数（0–20）', h('input', { type: 'number', min: 0, max: 20, value: sourceOptions.historyRounds, onChange: e => setSourceOptions(previous => ({ ...previous, historyRounds: cap(e.target.value, 0, 20) })) })),
          h('label', null, '手动台账补充（≤4000字）', h('textarea', { rows: 3, maxLength: 4000, value: sourceOptions.ledgerText, style: { width: '100%', resize: 'vertical' }, placeholder: sourceOptions.useLedger && !current.ledgerAvailable ? '当前没有可用台账提供方；可粘贴台账内容作为补充' : '可选补充内容', onChange: e => setSourceOptions(previous => ({ ...previous, ledgerText: e.target.value.slice(0, 4000) })) })),
          sourceOptions.useLedger && !current.ledgerAvailable ? h('small', null, '没有可用台账提供方时，请手动粘贴需要读取的台账内容。') : null),
        h('section', { className: 'stg-options', 'aria-label': '战斗设置' },
          h('label', null, '决策难度', h('select', { value: current.difficulty || 'normal', disabled: optionsLocked, onChange: e => chooseDifficulty(e.target.value) }, difficulties.map(item => h('option', { key: item.id, value: item.id }, item.name)))),
          selectedDifficulty?.description ? h('small', { className: 'stg-option-help' }, selectedDifficulty.description) : null,
          h('label', null, '敌人强度', h('select', { value: current.encounterDifficulty || 'medium', disabled: optionsLocked, onChange: e => saveOptions(current.difficulty || 'normal', e.target.value) }, encounterDifficulties.map(item => h('option', { key: item.id, value: item.id }, item.name)))),
          h('small', { className: 'stg-option-help' }, '决策难度影响选招；敌人强度调整敌人数值。'),
          h('label', { style: { display: 'flex', alignItems: 'center', gap: 6, gridColumn: '1/-1' } }, h('input', { type: 'checkbox', checked: !!current.autoStoryUpdate, disabled: !!busy || inProgress(current), onChange: e => request('select-options', { autoStoryUpdate: e.target.checked, ...ticket() }, 'options') }), '数值随正文更新'),
          h('small', { className: 'stg-option-help' }, '每节正文结算时交给变量后台更新人物、技能和物品。'),
          current.difficulty === 'ai' ? h('div', { className: 'stg-ai-model' },
            h('div', { className: 'stg-ai-head' }, h('strong', null, 'AI 预选模型'), h('button', { type: 'button', disabled: modelBusy || optionsLocked, onClick: () => refreshModelOptions(aiDraft.provider, aiDraft.model) }, modelBusy ? '读取中…' : '刷新')),
            h('label', null, '提供方', h('select', { value: aiDraft.provider || '', disabled: modelBusy || optionsLocked || !array(modelOptions?.providers).length, onChange: e => changeProvider(e.target.value) },
              h('option', { value: '' }, '选择提供方'), ...array(modelOptions?.providers).map(item => h('option', { key: item.provider, value: item.provider }, item.providerName || item.provider)))),
            h('label', null, '模型', h('select', { value: aiDraft.model || '', disabled: modelBusy || optionsLocked || !availableModels.length, onChange: e => changeModel(e.target.value) },
              h('option', { value: '' }, '选择模型'), ...availableModels.map(item => h('option', { key: item.id, value: item.id }, item.name || item.id)))),
            h('label', null, '推理强度', h('select', { value: aiDraft.reasoningEffort || '', disabled: modelBusy || optionsLocked || !array(modelOptions?.efforts).length, onChange: e => setAiDraft(previous => ({ ...previous, reasoningEffort: e.target.value })) },
              h('option', { value: '' }, '模型默认'), ...array(modelOptions?.efforts).map(item => h('option', { key: item.id, value: item.id }, item.name || item.id)))),
            modelOptions?.preparationAvailable === false ? h('small', null, '此模型暂不可用。') : null,
            h('button', { type: 'button', disabled: optionsLocked || modelBusy || !aiDraft.provider || !aiDraft.model || modelOptions?.preparationAvailable === false, onClick: () => saveOptions('ai', current.encounterDifficulty || 'medium', { provider: aiDraft.provider, model: aiDraft.model, reasoningEffort: aiDraft.reasoningEffort }) }, '保存 AI 模型')) : null),
        h('details', { className: 'stg-mediafold' }, h('summary', null, '导入资源'),
          h('details', { className: 'stg-import-category' }, h('summary', null, '玩法包'), h('div', { className: 'stg-media-imports' },
            h('label', null, '导入自定义玩法包（JSON，≤256 KB）', h('input', { type: 'file', accept: '.json,application/json', disabled: locked, onChange: importPack })))),
          h('details', { className: 'stg-import-category' }, h('summary', null, '场景背景'), h('div', { className: 'stg-media-imports' },
            h('label', null, '内置战斗场景', h('select', { 'aria-label': '内置战斗场景', value: builtinScene, onChange: async e => { const id = e.target.value; setBuiltinScene(id); try { localStorage.setItem(sceneKey(gameId), id) } catch (_) {} await putMedia(gameId, 'scene', null); setMediaNotice('已切回内置场景；每场自动选择会保持到战斗结束。') } }, h('option', { value: '' }, '每场自动选择'), BUILTIN_SCENES.map(scene => h('option', { key: scene.id, value: scene.id }, scene.name)))),
            h('label', null, '导入场景图片（≤12 MB）', h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', 'aria-label': '导入场景图片', onChange: e => importMedia('scene', e) })))),
          h('details', { className: 'stg-import-category' }, h('summary', null, '声音'), h('div', { className: 'stg-media-imports' },
            ...[['attack', '攻击音效'], ['hit', '受击音效'], ['music', '战斗音乐']].map(([key, label]) => h('label', { key }, label, h('input', { type: 'file', accept: 'audio/*', onChange: e => importMedia(key, e) }))))),
          h('details', { className: 'stg-import-category' }, h('summary', null, '共享外观（高级）'), h('div', { className: 'stg-media-imports' },
            ...[['male-sprite', '男角色默认图片 / 图集'], ['female-sprite', '女角色默认图片 / 图集'], ['rig', '共享动作 / 骨架 JSON']].map(([key, label]) => h('label', { key }, label, h('input', { type: 'file', accept: key === 'rig' ? '.json,application/json' : 'image/*', onChange: e => importMedia(key, e) }))),
            h('button', { onClick: () => downloadRigTemplate(false) }, '下载16帧模板'), h('button', { onClick: () => downloadRigTemplate(true) }, '下载分层骨架模板'))),
          h('small', null, '单个角色的外观包在队友卡片内导入。资源保存在当前浏览器。'), mediaNotice ? h('small', { role: 'status' }, mediaNotice) : null),
        h('div', { className: 'stg-msg', 'data-error': !!error, role: 'status' }, error || (inProgress(current) ? '正文正在生成，完成后可编辑。' : busy === 'generate' || busy === 'design' ? 'AI正在生成，最多等待120秒；完成前保留已有数据。' : busy ? '正在读取…' : current.notice || '')),
        retryAction === 'generate-party' && error && /模型|生成|JSON|截断|返回/.test(error) ? h('button', { disabled: locked, onClick: () => generateParty(true) }, '重试精简生成队友和背包') : null,
        array(current.warnings).length ? h('details', { className: 'stg-msg' }, h('summary', null, `数值整理说明（${current.warnings.length}）`), array(current.warnings).slice(0, 12).map((text, i) => h('div', { key: i }, text))) : null,
        error === '状态已变化，请刷新状态后重试。' ? h('button', { disabled: !!busy, onClick: () => request('state', {}, 'refresh') }, '刷新状态') : null,
        h('details', { className: 'stg-mediafold' }, h('summary', null, `战斗背包（${array(current.inventory).filter(item => item.count > 0).length}）`),
          ...array(current.inventory).filter(item => item.count > 0).map((item, i) => h('div', { key: `${item.id || item.name}-${i}` }, `${item.name || item.id || '物品'} ×${item.count ?? 1}`, item.description ? h('small', null, ` · ${item.description}`) : null)),
          !array(current.inventory).some(item => item.count > 0) ? h('small', null, '只生成战斗可用的疗伤、回气与净化补给。') : null),
        h('section', { className: 'stg-section' }, h('div', { className: 'stg-sectionhead' }, h('h2', null, '队友'), h('small', null, `${party.length} / 6 · 每场最多3人上场 · 每人4招`)),
          party.length ? h('div', { className: 'stg-party' }, party.slice(0, 6).map((actor, i) => h(PartyCard, { key: actor.id || i, actor, index: i, gameId, elementCatalog: current.elementCatalog, avatarCatalog: current.avatarCatalog, onDesign: designActor, onSave: saveParty, busy: busy === 'save' || busy === 'design', disabled: locked }))) : h('div', { className: 'stg-empty' }, '队友为空。点击“AI读取并生成角色和背包”读取当前玩法包；敌人会随剧情自动出现。')),
        h('div', { className: 'stg-actions' },
          current.battle ? h('button', { disabled: !!busy, onClick: () => start(false) }, '返回战斗') : null,
          h('button', { disabled: !!busy || !selected, onClick: () => start(true) }, '本地演示')),
        h('details', { className: 'stg-manual' }, h('summary', null, '手动开战'),
          h('label', null, '战斗描述', h('textarea', { value: manualText, maxLength: 2000, rows: 3, style: { width: '100%', resize: 'vertical' }, placeholder: '与三名山贼战斗，头目会刀斩\n或：山贼*3 | 挥剑、格挡', onChange: e => setManualText(e.target.value.slice(0, 2000)) })),
          h('small', null, 'AI参考当前正文与最近两轮生成对手，共用上方生成模型；也可输入「敌人名*数量 | 技能」直接开战。'),
          h('label', { style: { display: 'flex', alignItems: 'center', gap: 6 } }, h('input', { type: 'checkbox', checked: injectStory, onChange: e => setInjectStory(e.target.checked) }), '将战果用于正文'),
          h('small', null, '关闭为独立演练；开启后可在战后填入续写，不自动发送。'),
          h('button', { disabled: !!busy || !selected, onClick: startManual }, '开始手动战斗'))))
    }

    function ActorHud({ actor, elementCatalog }) {
      const pct = hpPercent(actor)
      return h('div', { className: 'stg-hud' }, h('strong', null, actor?.name || '角色'),
        h('small', { className: 'stg-types' }, typesLabel(actor, elementCatalog)),
        h('div', { className: 'stg-hp', 'data-low': pct <= 25 }, h('span', { style: { width: `${pct}%` } })),
        h('small', null, `${actorHp(actor)} / ${Number(actor?.maxHp) || 0} HP · 资源 ${Number(actor?.resource) || 0}`),
        array(actor?.statuses).length ? h('small', null, array(actor.statuses).slice(0, 5).map(status => `${status.name} ${status.turns}`).join(' · ')) : null)
    }

    function BattleOverlay({ ctx, gameId, initial, initialPalettes = {}, close }) {
      const [view, setView] = useState(initial || {})
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const [summary, setSummary] = useState('')
      const [caption, setCaption] = useState('')
      const [sound, setSound] = useState(true)
      const soundWanted = useRef(true)
      soundWanted.current = sound
      const [musicState, setMusicState] = useState('starting')
      const musicStatus = useRef('starting')
      const reportMusic = status => { musicStatus.current = status; if (alive.current) setMusicState(status) }
      const [speed, setSpeed] = useState(1)
      const [speedMenuOpen, setSpeedMenuOpen] = useState(false)
      const [controlsOpen, setControlsOpen] = useState(true)
      const playbackRate = useRef(1)
      playbackRate.current = speed
      const [entering, setEntering] = useState(!(initial?.battle || initial)?.outcome && Number((initial?.battle || initial)?.seq || 0) === 0)
      const op = useRef(0)
      const alive = useRef(true)
      const actionLock = useRef(false)
      const sceneRef = useRef(null)
      const actorStageRef = useRef(null)
      const dockRef = useRef(null)
      const figureRefs = useRef(new Map())
      const pendingPauses = useRef(new Map())
      const impactSequence = useRef(0)
      const [camera, setCamera] = useState({ phase: 'wide', x: 0, y: 0, zoom: 1 })
      const [travel, setTravel] = useState({ actorId: '', x: 0, y: 0 })
      const [visualHp, setVisualHp] = useState({})
      const [impact, setImpact] = useState(null)
      const timers = useRef({ motion: null, caption: null, idle: null, entry: null, sequence: [] })
      const audio = useRef({ loop: null, sfx: [] })
      const battle = view.battle || view
      const avatarCatalog = view.avatarCatalog || DEFAULT_AVATARS
      const avatarFor = actor => defaultAvatar(actor, avatarCatalog)
      const turnState = view.turnState || initial?.turnState || {}
      const players = array(battle.party).slice(0, 6)
      const enemies = array(battle.enemies).slice(0, 6)
      const playerField = array(battle.activePlayers).length ? array(battle.activePlayers).slice(0, 3) : [Number(battle.activePlayer) || 0]
      const enemyField = array(battle.activeEnemies).length ? array(battle.activeEnemies).slice(0, 3) : [Number(battle.activeEnemy) || 0]
      const activePlayerIndex = Number.isInteger(Number(battle.activePlayer)) ? Number(battle.activePlayer) : 0
      const activeEnemyIndex = Number.isInteger(Number(battle.activeEnemy)) ? Number(battle.activeEnemy) : 0
      const [actingIndex, setActingIndex] = useState(activePlayerIndex)
      const [targetIndex, setTargetIndex] = useState(enemyField[0] ?? activeEnemyIndex)
      const [command, setCommand] = useState('fight')
      const [planned, setPlanned] = useState({})
      const availablePlayers = Array.isArray(battle.remainingPlayerActions) ? battle.remainingPlayerActions : playerField.filter(index => !array(battle.actedPlayers).includes(index))
      const actingFieldIndex = availablePlayers.includes(actingIndex) ? actingIndex : (availablePlayers[0] ?? playerField[0] ?? activePlayerIndex)
      const active = players[actingFieldIndex] || players[activePlayerIndex] || players[0]
      const chosenTargetIndex = enemyField.includes(targetIndex) && actorHp(enemies[targetIndex]) > 0 ? targetIndex : enemyField.find(index => actorHp(enemies[index]) > 0)
      const activeEnemy = enemies[chosenTargetIndex] || enemies[activeEnemyIndex] || enemies[0]
      const skills = array(active?.skills)
      const finished = !!battle.outcome
      useEffect(() => { setPlanned({}) }, [battle.id, battle.seq])
      const queueAction = action => {
        if (busy || finished) return
        if (action.type === 'item') {
          const used = Object.values(planned).filter(order => order.actorIndex !== action.actorIndex && order.type === 'item' && order.itemId === action.itemId).length
          if (used >= Number(array(battle.inventory).find(item => item.id === action.itemId)?.count || 0)) { setError('这件物品已分配给其他队友，请先修改该指令。'); return }
        }
        if (action.type === 'switch' && Object.values(planned).some(order => order.actorIndex !== action.actorIndex && order.type === 'switch' && order.index === action.index)) { setError('这名后备队友已安排上场，请选择其他人。'); return }
        const next = { ...planned, [action.actorIndex]: action }
        setPlanned(next); setError('')
        const nextActor = availablePlayers.find(index => !next[index])
        if (nextActor !== undefined) setActingIndex(nextActor)
        setCommand('fight')
      }
      const lastFields = useRef({ player: playerField, enemy: enemyField })
      if (!finished) lastFields.current = { player: playerField, enemy: enemyField }
      const [motion, setMotion] = useState({ actorId: '', frame: 0, mode: '' })
      const [idleFrame, setIdleFrame] = useState(3)
      const locked = busy || inProgress(battle) || inProgress(view) || turnState.busy || turnState.generating || turnState.settling

      useLayoutEffect(() => {
        const scene = sceneRef.current, dock = dockRef.current
        if (!scene || !dock) return
        let lastSpace = -1
        const measure = () => {
          const space = Math.ceil(scene.getBoundingClientRect().bottom - dock.getBoundingClientRect().top + 12)
          if (space !== lastSpace) { scene.style.setProperty('--stg-dock-space', `${space}px`); lastSpace = space }
        }
        measure()
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
        observer?.observe(dock); observer?.observe(scene)
        window.addEventListener?.('resize', measure)
        return () => { observer?.disconnect(); window.removeEventListener?.('resize', measure) }
      }, [])

      const stopAudio = () => {
        const a = audio.current
        if (a.loop) { a.loop.pause(); a.loop.currentTime = 0; a.loop = null }
        for (const item of a.sfx) item.pause()
        a.sfx = []
      }
      const play = (file, loop, force = false) => {
        if ((!soundWanted.current && !force) || !file) return null
        try {
          const soundKey = /battle-loop/.test(file) ? 'music' : /attack/.test(file) ? 'attack' : /hit/.test(file) ? 'hit' : ''
          const source = media[soundKey] || ctx.tavernUi.assetUrl(file)
          if (loop && audio.current.loop?.battleSource === source) return audio.current.loop
          if (loop && audio.current.loop) { audio.current.loop.pause(); audio.current.loop = null }
          const audioObj = new Audio(source)
          audioObj.loop = !!loop
          audioObj.volume = loop ? 0.2 : 0.42
          if (loop) {
            audio.current.loop = audioObj; audioObj.battleSource = source; reportMusic('starting')
            const failed = error => {
              if (audio.current.loop !== audioObj) return
              audioObj.pause(); audio.current.loop = null
              reportMusic(error?.name === 'NotAllowedError' ? 'blocked' : 'error')
            }
            audioObj.onerror = failed
            try {
              const promise = audioObj.play()
              Promise.resolve(promise).then(() => {
                if (audio.current.loop === audioObj && soundWanted.current) reportMusic('playing')
              }, failed)
            } catch (error) { failed(error) }
          }
          else {
            audioObj.play()?.catch?.(() => {})
            audio.current.sfx.push(audioObj)
            const remove = () => { audio.current.sfx = audio.current.sfx.filter((item) => item !== audioObj) }
            audioObj.onended = remove
            audioObj.addEventListener?.('ended', remove, { once: true })
          }
          return audioObj
        } catch (_) { if (loop) reportMusic('error'); return null }
      }
      const playNow = event => {
        if (event?.target?.closest?.('[aria-label="战斗音乐"]')) return
        if (soundWanted.current && musicStatus.current === 'blocked') play('human/audio/battle-loop.wav', true)
      }
      const [failedSprites, setFailedSprites] = useState({})
      const [media, setMedia] = useState({})
      const [mediaReady, setMediaReady] = useState(false)
      const mediaUrls = useRef([])
      const [paletteSprites, setPaletteSprites] = useState(initialPalettes)
      const paletteUrls = useRef(new Map(Object.entries(initialPalettes)))
      const paletteJobs = useRef(new Map())
      useEffect(() => {
        alive.current = true
        const first = view.battle || view
        const token = ++op.current
        if (first?.id && !first?.demo) routeCall(ctx.tavernUi, 'battle-state', { gameId }).then((next) => {
          if (alive.current && token === op.current && next) setView((prior) => ({ ...prior, ...next }))
        }).catch((e) => { if (alive.current) setError(e?.message || '读取战斗失败。') })
        return () => {
          alive.current = false
          op.current++
          clearTimeout(timers.current.motion)
          clearTimeout(timers.current.caption)
          clearTimeout(timers.current.idle)
          clearTimeout(timers.current.entry)
          timers.current.sequence.forEach(clearTimeout)
          timers.current.sequence = []
          for (const [timer, resolve] of pendingPauses.current) { clearTimeout(timer); resolve() }
          pendingPauses.current.clear()
          actionLock.current = false
          stopAudio()
        }
      }, [])
      useEffect(() => {
        timers.current.entry = setTimeout(() => { if (alive.current) setEntering(false) }, 700)
        return () => clearTimeout(timers.current.entry)
      }, [battle.id])
      const actorResourceIds = [...players, ...enemies].map(actor => actor.id).join('|')
      useEffect(() => {
        let active = true
        const keys = ['attack', 'hit', 'music', 'scene', 'male-sprite', 'female-sprite', 'rig', ...[...players, ...enemies].flatMap(actor => [`${actor.id}:texture`, `${actor.id}:rig`])]
        Promise.all(keys.map(async key => [key, await getMedia(gameId, key)])).then(entries => {
          if (!active) return
          const next = {}
          for (const [key, value] of entries) {
            if ((key === 'rig' || key.endsWith(':rig')) && value && typeof value === 'object') {
              try { next[key] = value.kind === 'layered-rig' ? parseLayeredRig(value) : parseAtlasRig(value) } catch (_) {}
            }
            else if (typeof Blob !== 'undefined' && value instanceof Blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
              next[key] = URL.createObjectURL(value)
              mediaUrls.current.push(next[key])
            }
          }
          setMedia(next)
          setMediaReady(true)
        }).catch(() => { if (active) setMediaReady(true) })
        return () => { active = false; mediaUrls.current.forEach(url => { if (typeof URL !== 'undefined') URL.revokeObjectURL(url) }); mediaUrls.current = [] }
      }, [gameId, actorResourceIds])
      useEffect(() => {
        if (sound && mediaReady) play('human/audio/battle-loop.wav', true)
      }, [sound, mediaReady, media.music])
      const paletteActorIndexes = [
        ...playerField.map(index => ({ actor: players[index], enemy: false })),
        ...enemyField.map(index => ({ actor: enemies[index], enemy: true })),
      ].filter(({ actor }) => actor && (!finished || actorHp(actor) > 0))
      const paletteRows = paletteActorIndexes.flatMap(({ actor, enemy }) => {
        const gender = explicitGender(actor) || (avatarCatalog[avatarFor(actor)]?.gender === 'female' ? 'female' : 'male')
        const standard = ctx.tavernUi.assetUrl(avatarAssetPath(avatarFor(actor)))
        const legacyAtlas = ctx.tavernUi.assetUrl(`human/sprite/adventurer-${gender}-actions-v1.png`)
        const legacyPortrait = ctx.tavernUi.assetUrl(`human/sprite/adventurer-${gender}-v2.png`)
        const personal = media[`${actor.id}:texture`], shared = media[`${gender}-sprite`]
        const source = personal || shared || (!failedSprites[standard] ? standard : !failedSprites[legacyAtlas] ? legacyAtlas : legacyPortrait)
        if (personal || shared || !/\/human\/sprite\/(?:defaults\/[^/]+-actions-v1|adventurer-(?:male|female)-(?:actions-v1|v2))\.png(?:$|[?#])/.test(source)) return []
        const id = actor.id || `${enemy ? 'enemy' : 'player'}:${actor.name}`
        const seed = paletteSeedFor(actor)
        return [{ id, actor, source, seed, category: avatarCatalog[avatarFor(actor)]?.category || 'human' }]
      })
      const paletteIdentity = paletteRows.map(row => `${row.id}:${row.source}:${row.seed}:${row.category}`).join('|')
      useEffect(() => {
        let active = true
        const wanted = new Set(paletteRows.map(row => row.id))
        for (const row of paletteRows) {
          const key = `${row.source}|${row.seed}|${row.category}`
          paletteJobs.current.set(row.id, key)
          const previous = paletteUrls.current.get(row.id)
          if (previous?.key === key) {
            setPaletteSprites(prior => prior[row.id]?.key === key ? prior : { ...prior, [row.id]: previous })
            continue
          }
          if (failedSprites[row.source]) continue
          recolorDefaultAtlas(row.source, row.seed, row.category).then(url => {
            if (!active || paletteJobs.current.get(row.id) !== key) { URL.revokeObjectURL(url); return }
            const old = paletteUrls.current.get(row.id)
            if (old?.url && old.url !== url) URL.revokeObjectURL(old.url)
            const ready = { key, url }
            paletteUrls.current.set(row.id, ready)
            setPaletteSprites(prior => ({ ...prior, [row.id]: ready }))
          }).catch(() => {
            if (active && paletteJobs.current.get(row.id) === key) {
              const old = paletteUrls.current.get(row.id)
              if (old?.key !== key) setPaletteSprites(prior => { const next = { ...prior }; delete next[row.id]; return next })
            }
          })
        }
        for (const [id, previous] of paletteUrls.current) if (!wanted.has(id)) {
          URL.revokeObjectURL(previous.url); paletteUrls.current.delete(id); paletteJobs.current.delete(id)
        }
        return () => { active = false }
      }, [gameId, paletteIdentity])
      useEffect(() => () => {
        for (const entry of paletteUrls.current.values()) URL.revokeObjectURL(entry.url)
        paletteUrls.current.clear(); paletteJobs.current.clear()
      }, [])
      useEffect(() => {
        // Built-in idle uses one consistent pose + compositor breathing, not rapid pose cuts.
        const frames = array(media.rig?.clips?.idle).length ? media.rig.clips.idle : [3]
        const fps = rigFps(media.rig)
        if (frames.length < 2 && !finished) { setIdleFrame(frames[0] ?? 3); return }
        let index = 0
        const tick = () => { setIdleFrame(finished ? index % 2 : frames[index % frames.length]); index++; timers.current.idle = setTimeout(tick, finished ? 1300 : 1000 / fps) }
        tick()
        return () => { clearTimeout(timers.current.idle); timers.current.idle = null }
      }, [media.rig, finished])
      const reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      const pause = (ms, minimum = 0) => new Promise(resolve => {
        if (reducedMotion || !alive.current) { resolve(); return }
        const timer = setTimeout(() => { pendingPauses.current.delete(timer); resolve() }, Math.max(minimum, ms * 1.35 / playbackRate.current))
        pendingPauses.current.set(timer, resolve)
      })
      const playClip = async (actorId, clipName, fallback, onFrame) => {
        const config = media[`${actorId}:rig`] || media.rig
        const frames = array(config?.clips?.[clipName]).length ? config.clips[clipName] : fallback
        const fps = rigFps(config)
        let index = 0
        for (const frame of reducedMotion ? [frames.at(-1)] : frames) {
          if (!alive.current) return
          onFrame?.(index++)
          setMotion({ actorId, frame, mode: clipName === 'kick' ? 'attack' : clipName })
          await pause(1000 / fps)
        }
      }
      const animateEvents = async (events) => {
        const sceneBox = actorStageRef.current?.getBoundingClientRect()
        const points = new Map()
        if (sceneBox?.width && sceneBox.height) for (const [id, node] of figureRefs.current) {
          const rect = node?.querySelector('.stg-visual')?.getBoundingClientRect()
          if (rect) points.set(id, { x: rect.left + rect.width / 2 - sceneBox.left, y: rect.top + rect.height * .53 - sceneBox.top, foot: rect.bottom - sceneBox.top, width: rect.width })
        }
        const shot = (phase, actorId, zoom) => {
          if (reducedMotion || !sceneBox?.width) return
          const point = points.get(actorId)
          if (!point) return
          const scale = 1 + (zoom - 1) * (playbackRate.current >= 10 ? .5 : 1)
          const limit = (scale - 1) * 49
          setCamera({ phase, zoom: scale, x: cap((.5 - point.x / sceneBox.width) * 70, -limit, limit), y: cap((.48 - point.y / sceneBox.height) * 60, -limit, limit) })
        }
        const resetTravel = () => setTravel({ actorId: '', x: 0, y: 0 })
        let movingActor = ''
        for (const event of events) {
          if (!alive.current) return
          const kind = String(event.kind || event.type || '')
          const label = event.text || event.name || ''
          if (kind === 'use' || kind === 'attack') {
            if (movingActor) { resetTravel(); await pause(120, 55); movingActor = '' }
            const name = String(event.name || label)
            // A spear technique (枪法) or sword art (剑术) is still a physical move.
            const spellName = name.replace(/(?:剑|刀|枪|棍|拳|体|身|武)(?:法|术)/g, '')
            const clip = /格挡|护盾|防御|guard|block/i.test(name) ? 'guard' : /术|法|咒|魔|火|冰|雷|光|暗|治愈|恢复|仙|召唤|箭|弓|射|枪击|开枪|火枪|步枪|手枪|铳|弹|投掷|御剑|剑气|飞剑|剑阵|cast|spell/i.test(spellName) || event.targetId === event.actorId ? 'cast' : /踢|腿|kick/i.test(name) ? 'kick' : 'attack'
            const fallback = clip === 'cast' ? [8, 9, 7] : clip === 'kick' ? [3, 4, 6, 7] : [3, 4, 5, 7]
            shot(clip === 'cast' ? 'cast' : 'windup', event.actorId, clip === 'cast' ? 1.16 : 1.12)
            const from = points.get(event.actorId), to = points.get(event.targetId)
            const melee = !reducedMotion && ['attack', 'kick'].includes(clip) && from && to && event.actorId !== event.targetId
            setCaption(label); play('human/audio/attack.wav', false)
            await playClip(event.actorId, clip, clip === 'guard' ? [10] : fallback, index => {
              if (index === 1 && melee) {
                const distance = to.x - from.x
                const reach = Math.max(0, Math.abs(distance) - Math.min(from.width, to.width) * .63)
                setTravel({ actorId: event.actorId, x: Math.sign(distance) * Math.min(reach, sceneBox.width * .32), y: cap((to.foot - from.foot) * .65, -sceneBox.height * .12, sceneBox.height * .12) })
                movingActor = event.actorId
              }
              if (index === 2) shot('strike', event.targetId || event.actorId, 1.13)
            })
          } else if (/^(?:guard|block|absorb)$/.test(kind)) {
            shot('guard', event.targetId || event.actorId, 1.12)
            setCaption(label); await playClip(event.targetId || event.actorId, 'guard', [10])
          } else if (/^(?:miss|dodge|evade)$/.test(kind)) {
            shot('dodge', event.targetId || event.actorId, 1.12)
            setCaption(label); await playClip(event.targetId || event.actorId, 'dodge', [12, 7])
          } else if (/^(?:damage|hit|hurt)$/.test(kind)) {
            shot('impact', event.targetId || event.actorId, 1.22)
            if (Number.isFinite(event.value)) {
              const target = [...players, ...enemies].find(actor => actor.id === event.targetId)
              if (target) setVisualHp(previous => ({ ...previous, [target.id]: Math.max(0, (previous[target.id] ?? target.hp) - event.value) }))
              setImpact({ actorId: event.targetId, text: `−${event.value}`, type: 'damage', key: ++impactSequence.current })
            }
            setCaption(label); play('human/audio/hit.wav', false); await playClip(event.targetId || event.actorId, 'hit', [11, 7])
          } else if (/heal|resource|cleanse|switch|item/i.test(kind)) {
            if (kind === 'heal' && Number.isFinite(event.value)) {
              const target = [...players, ...enemies].find(actor => actor.id === (event.targetId || event.actorId))
              if (target) { setVisualHp(previous => ({ ...previous, [target.id]: Math.min(target.maxHp, (previous[target.id] ?? target.hp) + event.value) })); setImpact({ actorId: target.id, text: `+${event.value}`, type: 'heal', key: ++impactSequence.current }) }
            }
            setCaption(label); setMotion({ actorId: event.actorId, frame: /switch|item/i.test(kind) ? 3 : 9, mode: 'clip' }); await pause(160)
          }
          if (label) {
            setCaption(label)
            await pause(/^(?:use|attack)$/.test(kind) ? 220 : Math.min(900, Math.max(380, label.length * 24)), 45)
          }
        }
        if (alive.current) {
          resetTravel(); setCamera({ phase: 'wide', x: 0, y: 0, zoom: 1 }); setMotion({ actorId: '', frame: 0, mode: '' }); setImpact(null); setCaption('')
          await pause(180, 75)
        }
      }
      const submitAction = async (action) => {
        if (actionLock.current || locked || finished) return
        actionLock.current = true
        const prior = battle
        const token = ++op.current
        setBusy(true); setError('')
        playNow()
        const args = { gameId, turn: turnState.turn, textVersion: turnState.textVersion, battleId: prior.id, seq: prior.seq, action }
        try {
          const response = await routeCall(ctx.tavernUi, 'battle-act', args)
          if (!alive.current || token !== op.current || !response) return
          const next = response.battle ? response : { ...view, battle: response }
          const nextBattle = next.battle || next
          if (action.type === 'switch' && Number.isInteger(Number(nextBattle.activePlayer))) setActingIndex(Number(nextBattle.activePlayer))
          const changes = array(nextBattle.events)
          const eventText = changes.map((event) => event.text || event.name || event.description).filter(Boolean).join(' · ').slice(0, 140)
          setCaption(eventText || (action.type === 'round' ? '本回合开始' : '尝试撤退'))
          setCommand('fight')
          await animateEvents(changes)
          if (alive.current && token === op.current) { setView(next); setVisualHp({}); setPlanned({}) }
        } catch (e) {
          if (alive.current && token === op.current) setError(failureText(e, '操作未完成，请重试。'))
        } finally { actionLock.current = false; if (alive.current && token === op.current) setBusy(false) }
      }
      const requestSummary = async () => {
        if (locked || actionLock.current) return
        actionLock.current = true
        const token = ++op.current
        setBusy(true); setError('')
        try {
          const result = await routeCall(ctx.tavernUi, 'summary', { gameId, turn: turnState.turn, textVersion: turnState.textVersion, battleId: battle.id, seq: battle.seq })
          if (alive.current && token === op.current) { setSummary(String(result?.text || '')); if (result?.notice) setError(result.notice) }
        } catch (e) { if (alive.current && token === op.current) setError(failureText(e, '读取战况失败。')) }
        finally { actionLock.current = false; if (alive.current && token === op.current) setBusy(false) }
      }
      const refreshBattle = async () => {
        const token = ++op.current
        setBusy(true); setError('')
        try {
          const next = await routeCall(ctx.tavernUi, 'battle-state', { gameId })
          if (alive.current && token === op.current) setView(next?.battle ? next : { ...view, battle: next })
        } catch (e) { if (alive.current && token === op.current) setError(failureText(e, '刷新战斗状态失败。')) }
        finally { if (alive.current && token === op.current) setBusy(false) }
      }
      const sendSummary = async () => {
        if (!summary.trim()) return
        const token = ++op.current
        setBusy(true); setError('')
        try {
          if (locked) return
          await ctx.tavernUi.setInput({ gameId, text: `\n\n${summary.trim()}` })
          if (alive.current && token === op.current) close()
        } catch (e) { if (alive.current && token === op.current) setError(failureText(e, '填入续写失败，请重试。')) }
        finally { if (alive.current && token === op.current) setBusy(false) }
      }
      const toggleSound = () => {
        if (soundWanted.current && ['playing', 'starting'].includes(musicStatus.current)) { soundWanted.current = false; setSound(false); reportMusic('off'); stopAudio(); return }
        soundWanted.current = true; setSound(true)
        play('human/audio/battle-loop.wav', true, true)
      }
      const scene = media.scene || battleScene(ctx, gameId, view)
      const spriteGender = actor => explicitGender(actor) || (avatarCatalog[avatarFor(actor)]?.gender === 'female' ? 'female' : 'male')
      const isPortrait = (actor, source) => (!!media[`${actor?.id}:texture`] && !media[`${actor?.id}:rig`]) || /\/adventurer-(?:male|female)-v2\.png(?:$|[?#])/.test(source)
      const spriteUrl = (actor, enemy = false) => {
        const personal = media[`${actor?.id}:texture`], shared = media[`${spriteGender(actor, enemy)}-sprite`]
        const gender = spriteGender(actor, enemy)
        const shipped = ctx.tavernUi.assetUrl(avatarAssetPath(avatarFor(actor)))
        const legacyAtlas = ctx.tavernUi.assetUrl(`human/sprite/adventurer-${gender}-actions-v1.png`)
        const legacyPortrait = ctx.tavernUi.assetUrl(`human/sprite/adventurer-${gender}-v2.png`)
        const base = personal || shared || (!failedSprites[shipped] ? shipped : !failedSprites[legacyAtlas] ? legacyAtlas : legacyPortrait)
        const row = paletteRows.find(item => item.id === (actor.id || `${enemy ? 'enemy' : 'player'}:${actor.name}`))
        const tinted = row ? paletteSprites[row.id] : null
        return row && tinted?.key === `${row.source}|${row.seed}|${row.category}` ? tinted.url : base
      }
      const visualStyle = () => undefined
      const frameFor = actor => {
        if (motion.actorId === actor?.id) return motion.frame
        if (actorHp(actor) <= 0) return 13
        if (battle.outcome?.winner === (players.includes(actor) ? 'player' : 'enemy')) {
          const victory = array(media.rig?.clips?.victory)
          return victory.length ? victory[idleFrame % victory.length] : [14, 15][idleFrame % 2]
        }
        const personal = media[`${actor?.id}:rig`]
        if (personal && personal.kind !== 'layered-rig') {
          const frames = array(personal.clips?.idle)
          return frames.length ? frames[0] : 0
        }
        return idleFrame
      }
      const modeFor = (actor) => motion.actorId === actor?.id ? motion.mode : actorHp(actor) <= 0 ? 'down' : battle.outcome?.winner === (players.includes(actor) ? 'player' : 'enemy') ? 'victory' : 'idle'
      const rigFor = (actor, enemy = false) => {
        const rig = media[`${actor?.id}:rig`] || media.rig
        return rig?.kind === 'layered-rig' && (media[`${actor?.id}:texture`] || media[`${spriteGender(actor, enemy)}-sprite`]) ? rig : null
      }
      const rigFigure = (actor, enemy = false) => h('div', { className: 'stg-rig-viewport', style: { width: '100%', aspectRatio: '1 / 1', transform: enemy ? 'scaleX(-1)' : undefined } }, h(RigFigure, { rig: rigFor(actor, enemy), texture: media[`${actor?.id}:texture`] || media[`${spriteGender(actor, enemy)}-sprite`], mode: modeFor(actor), token: battle.seq, speed }))
      const fieldActors = (roster, indices) => indices.map(index => roster[index]).filter(actor => actor && (finished || actorHp(actor) > 0))
      const playerActors = fieldActors(players, finished ? lastFields.current.player : playerField)
      const enemyActors = fieldActors(enemies, finished ? lastFields.current.enemy : enemyField)
      const livingPlayers = players.map((actor, index) => ({ actor, index })).filter(item => actorHp(item.actor) > 0)
      const livingFieldPlayers = livingPlayers.filter(item => playerField.includes(item.index))
      const livingEnemies = enemies.map((actor, index) => ({ actor, index })).filter(item => enemyField.includes(item.index) && actorHp(item.actor) > 0)
      const inventory = array(battle.inventory || battle.items)
      const presentActor = actor => Object.hasOwn(visualHp, actor.id) ? { ...actor, hp: visualHp[actor.id] } : actor
      const movingFigure = actor => ({
        ref: node => { if (node) figureRefs.current.set(actor.id, node); else figureRefs.current.delete(actor.id) },
        'data-travel': travel.actorId === actor.id ? 'approach' : 'rest',
        style: { '--move-x': `${travel.actorId === actor.id ? travel.x : 0}px`, '--move-y': `${travel.actorId === actor.id ? travel.y : 0}px` },
      })
      const impactNumber = actor => impact?.actorId === actor.id ? h('span', { key: impact.key, className: 'stg-impact-number', 'data-kind': impact.type, 'aria-hidden': true }, impact.text) : null
      const useItem = (item, target) => queueAction({ type: 'item', actorIndex: actingFieldIndex, itemId: item.id, targetIndex: target })
      const orderLabel = order => !order ? '等待选择' : order.type === 'switch' ? `换上 ${players[order.index]?.name || '队友'}`
        : order.type === 'item' ? `${inventory.find(item => item.id === order.itemId)?.name || '物品'} → ${players[order.targetIndex]?.name || ''}`
          : order.type === 'basic' ? `普通攻击 → ${enemies[order.targetIndex]?.name || '对手'}`
            : (() => { const skill = array(players[order.actorIndex]?.skills).find(skill => skill.id === order.skillId); return `${skill?.name || '技能'}${['heal', 'selfStatus', 'cleanse', 'revive', 'summon'].includes(skill?.kind) ? '' : ` → ${enemies[order.targetIndex]?.name || '对手'}`}` })()
      const plannedCount = availablePlayers.filter(index => planned[index]).length
      return h('div', { className: 'stg stg-overlay', onPointerDownCapture: playNow, onKeyDownCapture: playNow }, h(Style), h('div', { className: 'stg-battle', style: { '--playback-rate': speed }, 'data-entering': entering },
        h('section', { ref: sceneRef, className: 'stg-scene', 'data-shot': camera.phase, style: { backgroundImage: `url("${scene}")` }, onPointerDown: playNow },
          h('div', { className: 'stg-camera-stage', 'data-phase': camera.phase, style: { transform: `translate3d(${camera.x}%,${camera.y}%,0) scale(${camera.zoom})` } },
          h('div', { className: 'stg-camera-world', 'data-impact': camera.phase === 'impact' && speed < 10, style: { backgroundImage: `url("${scene}")` } },
          h('div', { ref: actorStageRef, className: 'stg-actor-stage' },
          h('div', { className: 'stg-fighters' },
            playerActors.length ? h('div', { className: 'stg-side', 'data-count': playerActors.length }, playerActors.map(actor => {
              const key = actor.id || actor.name
              const source = spriteUrl(actor)
              return h('div', { key, ...movingFigure(actor), className: 'stg-figure', 'data-avatar': media[`${actor.id}:texture`] ? 'imported' : avatarFor(actor), 'data-palette-seed': actor.avatarPaletteSeed ?? '', 'data-palette-ready': source.startsWith('blob:') ? 'true' : 'false', 'data-act': modeFor(actor), 'data-frame': frameFor(actor), 'data-down': actorHp(actor) <= 0 },
                h('div', { className: 'stg-visual', style: visualStyle(actor, source) }, isPortrait(actor, source) ? h('img', { src: source, alt: actor.name }) : rigFor(actor) ? rigFigure(actor) : h('div', { className: 'stg-sprite', 'data-frame': frameFor(actor), 'data-mode': '', style: { '--sheet': `url("${source}")` } },
                  h('img', { className: 'stg-sheet', src: source, alt: '', onError: () => setFailedSprites(previous => ({ ...previous, [source]: true })) }))), h(ActorHud, { actor: presentActor(actor), elementCatalog: view.elementCatalog }), impactNumber(actor))
            })) : null,
            enemyActors.length ? h('div', { className: 'stg-side', 'data-enemy': true, 'data-count': enemyActors.length }, enemyActors.map(actor => {
              const key = actor.id || actor.name
              const source = spriteUrl(actor, true)
              return h('div', { key, ...movingFigure(actor), className: 'stg-figure', 'data-avatar': media[`${actor.id}:texture`] ? 'imported' : avatarFor(actor), 'data-palette-seed': actor.avatarPaletteSeed ?? '', 'data-palette-ready': source.startsWith('blob:') ? 'true' : 'false', 'data-mirror': true, 'data-act': modeFor(actor), 'data-frame': frameFor(actor), 'data-down': actorHp(actor) <= 0 },
                h('div', { className: 'stg-visual', style: visualStyle(actor, source) }, isPortrait(actor, source) ? h('img', { src: source, alt: actor.name }) : rigFor(actor, true) ? rigFigure(actor, true) : h('div', { className: 'stg-sprite', 'data-frame': frameFor(actor), 'data-mode': '', style: { '--sheet': `url("${source}")` } },
                  h('img', { className: 'stg-sheet', src: source, alt: '', onError: () => setFailedSprites(previous => ({ ...previous, [source]: true })) }))), h(ActorHud, { actor: presentActor(actor), elementCatalog: view.elementCatalog }), impactNumber(actor))
            })) : null)))),
          entering ? h('div', { className: 'stg-entry', role: 'status' }, h('strong', null, battle.demo ? '战斗演练' : '战斗开始'), h('span', null, enemies.map(actor => actor.name).slice(0, 3).join('、'))) : null,
          caption ? h('div', { key: caption, className: 'stg-caption' }, caption) : null),
        h('section', { ref: dockRef, className: 'stg-controls-battle stg-control-dock' },
          h('div', { className: 'stg-dock-header' },
            h('div', { className: 'stg-round' }, h('strong', null, finished ? '战斗结束' : `第 ${Number(battle.round) || 1} 回合`), h('span', null, active?.name || ''), h('small', null, error || (inProgress(view) ? '状态正在更新。' : busy ? '行动演出中…' : battle.aiNotice || '')), error === '状态已变化，请刷新状态后重试。' ? h('button', { disabled: busy, onClick: refreshBattle }, '刷新状态') : null),
            h('div', { className: 'stg-controlbar' },
            h('div', { className: 'stg-speedcontrol' },
              h('button', { type: 'button', className: 'stg-speedtrigger', 'aria-label': '战斗倍速', 'aria-expanded': speedMenuOpen, 'aria-controls': 'stg-speed-options', onClick: () => setSpeedMenuOpen(open => !open) }, `${speed}× ▾`),
              speedMenuOpen ? h('div', { id: 'stg-speed-options', className: 'stg-speedmenu', role: 'group', 'aria-label': '战斗倍速选项' },
                [1, 2, 3, 10].map(value => h('button', { key: value, type: 'button', 'aria-pressed': speed === value, onClick: () => { setSpeed(value); setSpeedMenuOpen(false) } }, `${value}×`))) : null),
            h('button', { className: 'stg-toolbutton', onClick: toggleSound, 'aria-label': '战斗音乐', 'aria-pressed': musicState === 'playing', title: musicState === 'blocked' ? '浏览器阻止了自动播放，点击或操作战斗即可开启' : musicState === 'error' ? '音频未能加载，点击重试或重新导入音乐' : '开启或关闭战斗音乐' }, !sound ? '音乐关' : musicState === 'playing' ? '音乐开' : musicState === 'starting' ? '音乐加载中' : musicState === 'blocked' ? '开启音乐' : '音乐重试'),
            !finished ? h('button', { className: 'stg-dock-toggle', type: 'button', 'aria-label': controlsOpen ? '收起操作区' : '展开操作区', 'aria-expanded': controlsOpen, 'aria-controls': 'stg-command-workspace', title: controlsOpen ? '收起操作区，看完整场景' : '展开操作区，继续选择行动', onClick: () => { setControlsOpen(open => !open); setSpeedMenuOpen(false) } }, h('svg', { viewBox: '0 0 24 24', 'aria-hidden': true }, h('path', { d: 'm6 9 6 6 6-6' }))) : null,
            h('button', { className: 'stg-toolbutton', onClick: close, 'aria-label': '关闭战斗', title: '关闭战斗' }, '关闭'))),
          finished ? h('div', { className: 'stg-result' }, `${battle.outcome.winner === 'player' ? '战斗胜利' : battle.outcome.winner === 'enemy' ? '战斗失败' : '战斗结束'}${battle.outcome.reason ? ` · ${battle.outcome.reason}` : ''}`) : null,
          !finished ? h('div', { className: 'stg-command-workspace', id: 'stg-command-workspace', hidden: !controlsOpen },
            h('div', { className: 'stg-commandrow' },
              h('button', { disabled: locked, 'aria-expanded': command === 'fight', onClick: () => setCommand('fight') }, h(CommandIcon, { name: 'fight' }), '战斗'),
              h('button', { disabled: locked, 'aria-expanded': command === 'bag', onClick: () => setCommand(command === 'bag' ? 'fight' : 'bag') }, h(CommandIcon, { name: 'bag' }), '背包'),
              h('button', { disabled: locked, 'aria-expanded': command === 'swap', onClick: () => setCommand(command === 'swap' ? 'fight' : 'swap') }, h(CommandIcon, { name: 'swap' }), '换人'),
              h('button', { disabled: locked, 'aria-expanded': command === 'flee', onClick: () => setCommand('flee') }, h(CommandIcon, { name: 'flee' }), '逃离')),
            command === 'fight' ? h('div', { className: 'stg-commandpanel stg-commandpanel-fight' },
              h('div', { className: 'stg-targets' }, h('label', null, '行动角色 ', h('select', { disabled: locked, value: actingFieldIndex, onChange: e => setActingIndex(Number(e.target.value)) }, livingFieldPlayers.map(({ actor, index }) => h('option', { key: actor.id || index, value: index, disabled: !availablePlayers.includes(index) }, `${actor.name || `队友${index + 1}`}${availablePlayers.includes(index) ? '' : '（已行动）'}`)))),
                h('label', null, '攻击目标 ', h('select', { disabled: locked, value: chosenTargetIndex, onChange: e => { const index = Number(e.target.value); setTargetIndex(index); if (['skill', 'basic'].includes(planned[actingFieldIndex]?.type)) setPlanned(previous => ({ ...previous, [actingFieldIndex]: { ...previous[actingFieldIndex], targetIndex: index } })) } }, livingEnemies.map(({ actor, index }) => h('option', { key: actor.id || index, value: index }, actor.name || `敌人${index + 1}`))))),
              h('div', { className: 'stg-skills' }, h('button', { key: 'basic', className: 'stg-skill-basic', disabled: locked, 'aria-pressed': planned[actingFieldIndex]?.type === 'basic', title: '不消耗资源或特殊技能次数的基础攻击', onClick: () => queueAction({ type: 'basic', actorIndex: actingFieldIndex, targetIndex: chosenTargetIndex }) }, h('strong', null, '普通攻击'), h('small', null, '基础行动 · 无消耗')), skills.slice(0, 4).map((skill) => {
              const cost = Math.ceil(Number(skill.resourceCost ?? skill.cost ?? 0) * (array(active?.statuses).some(status => status.id === 'exhaustion') ? 1.5 : 1))
              const available = Number(active?.resource)
              const lacksResource = cost > 0 && (!Number.isFinite(available) || available < cost)
              const restricted = array(active?.statuses).some(status => ['taunt', 'disarm'].includes(status.id)) && skill.id !== `${packId}-0-0`
              const silenced = array(active?.statuses).some(status => status.id === 'silence') && skill.kind && !['damage', 'areaDamage'].includes(skill.kind)
              const disabled = locked || skill.usesLeft <= 0 || skill.cooldownLeft > 0 || lacksResource || restricted || silenced
              return h('button', { key: skill.id, disabled, 'aria-pressed': planned[actingFieldIndex]?.skillId === skill.id, title: skill.description || '', onClick: () => queueAction({ type: 'skill', actorIndex: actingFieldIndex, targetIndex: chosenTargetIndex, skillId: skill.id }) }, h('strong', null, skill.name || '技能'), h('small', { className: 'stg-matchup' }, `${elementLabel(skill.element, view.elementCatalog)} · ${Number(skill.power) > 0 ? `威力 ${skill.power}` : '辅助'}${skillMatchup(skill, activeEnemy, view.elementChart) ? ` · ${skillMatchup(skill, activeEnemy, view.elementChart)}` : ''}`), h('small', null, `${skill.usesLeft == null ? '' : `剩余 ${skill.usesLeft} 次`}${cost ? ` · 消耗 ${cost}` : ''}${skill.cooldownLeft > 0 ? ` · 冷却 ${skill.cooldownLeft}` : ''}${skill.description ? ` · ${skill.description.slice(0, 105)}${skill.description.length > 105 ? '…' : ''}` : ''}`))
            }))) : null,
            command === 'bag' ? h('div', { className: 'stg-commandpanel' }, inventory.some(item => Number(item.count) > 0) ? inventory.filter(item => Number(item.count) > 0).map(item => h('div', { key: item.id, className: 'stg-inventory' }, h('strong', null, `${item.name || item.id} ×${item.count}`),
              h('small', null, item.description || ({ 'healing-potion': '恢复25%最大生命，消耗一次行动。', 'resource-potion': '恢复30点资源，消耗一次行动。', cleanse: '清除负面状态，消耗一次行动。' })[item.id]),
              ...livingPlayers.map(({ actor: member, index }) => h('button', { key: member.id || index, disabled: locked || (item.id === 'healing-potion' ? member.hp >= member.maxHp : item.id === 'resource-potion' ? member.resource >= member.maxResource : !array(member.statuses).length), onClick: () => useItem(item, index) }, `给 ${member.name || `队友${index + 1}`}${playerField.includes(index) ? '' : '（后备）'}`)))) : h('small', null, '背包里没有可用物品。')) : null,
            command === 'swap' ? h('div', { className: 'stg-commandpanel' }, livingPlayers.some(({ index }) => !playerField.includes(index)) ? livingPlayers.filter(({ index }) => !playerField.includes(index)).map(({ actor: member, index }) => h('button', { key: member.id || index, disabled: locked, onClick: () => queueAction({ type: 'switch', actorIndex: actingFieldIndex, index }) }, `换上 ${member.name || `队友${index + 1}`}`)) : h('small', null, '没有可换上的后备队友。')) : null,
            command === 'flee' ? h('div', { className: 'stg-commandpanel' }, h('p', null, '退出当前战斗？'), h('button', { disabled: locked, onClick: () => submitAction({ type: 'flee', actorIndex: actingFieldIndex }) }, '确认逃离')) : null,
            h('div', { className: 'stg-round-plan', 'aria-label': '本回合指令' }, availablePlayers.map(index => h('button', { key: players[index]?.id || index, disabled: locked, 'aria-pressed': actingFieldIndex === index, onClick: () => { setActingIndex(index); if (planned[index]?.targetIndex !== undefined) setTargetIndex(planned[index].targetIndex); setCommand('fight') } }, h('strong', null, players[index]?.name || '队友'), h('small', null, orderLabel(planned[index]))))),
            h('div', { className: 'stg-round-confirm' }, h('small', { role: 'status' }, busy ? '本回合演出中…' : `${plannedCount}/${availablePlayers.length} 人已选 · ${plannedCount === availablePlayers.length ? '指令已齐，可修改后确认' : `请为${availablePlayers.filter(index => !planned[index]).map(index => players[index]?.name).join('、')}选择行动`}`), h('button', { disabled: locked || !plannedCount, onClick: () => setPlanned({}) }, '清空'), h('button', { className: 'stg-confirm-round', disabled: locked || plannedCount !== availablePlayers.length || !plannedCount, onClick: () => submitAction({ type: 'round', commands: availablePlayers.map(index => planned[index]) }) }, '确认本回合'))) : null,
          array(battle.log).length ? h('div', { className: 'stg-log' }, array(battle.log).slice(-4).map((line, i) => h('div', { key: i }, typeof line === 'string' ? line : line.text || line.message || ''))) : null,
          finished ? h(React.Fragment, null,
            !battle.demo && summary ? h('textarea', { className: 'stg-summary', value: summary, onChange: (e) => setSummary(e.target.value), 'aria-label': '战况摘要' }) : null,
            h('div', { className: 'stg-return' }, !battle.demo ? h('button', { disabled: locked, onClick: requestSummary }, '生成战况') : null, !battle.demo && summary ? h('button', { className: 'stg-primary', disabled: locked, onClick: sendSummary }, '填入续写') : null, h('button', { onClick: close }, battle.demo ? '返回' : '返回'))
          ) : null)))
    }

    const storyEntryRequests = new Map()
    const encounterSlots = new Map()
    let encounterSequence = 0
    const storyBattleReady = (ctx, gameId, turn, textVersion) => {
      const key = `${gameId}:${turn}:${textVersion}`
      if (storyEntryRequests.has(key)) return storyEntryRequests.get(key)
      const request = (async () => {
        for (const delay of [0, 120, 240, 400, 700, 900]) {
          if (delay) await new Promise(resolve => setTimeout(resolve, delay))
          const state = unpack(await routeCall(ctx.tavernUi, 'battle-state', { gameId }))
          const fight = state?.battle
          if (state?.turnState && (state.turnState.turn !== turn || state.turnState.textVersion !== textVersion || state.turnState.generating || state.turnState.settling)) return null
          if (fight?.id?.startsWith('story-') && fight.turn === turn && fight.textVersion === textVersion && !fight.readOnly) return state
        }
        return null
      })().finally(() => storyEntryRequests.delete(key))
      storyEntryRequests.set(key, request)
      return request
    }
    function EncounterBadge({ ctx, gameId, turn, streaming, match }) {
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const natural = typeof match === 'string' && !/^<dsh_battle>|^battle###|^\{\s*"enemies"\s*:/i.test(match)
      const [encounter, setEncounter] = useState(null)
      const [ownsEntry, setOwnsEntry] = useState(false)
      const markerId = useRef(null)
      if (markerId.current === null) markerId.current = ++encounterSequence
      const alive = useRef(true)
      const requestId = useRef(0)
      const checkId = useRef(0)
      const latestHead = useRef(null)
      const overlayOpening = useRef(false)
      useEffect(() => { alive.current = true; return () => { alive.current = false; requestId.current++ } }, [])
      useEffect(() => {
        if (!Number.isSafeInteger(turn) || streaming) return
        const key = `${gameId}:${turn}`
        let slot = encounterSlots.get(key)
        if (!slot) { slot = new Map(); encounterSlots.set(key, slot) }
        const publish = () => { const first = slot.keys().next().value; for (const [id, setOwner] of slot) setOwner(id === first) }
        slot.set(markerId.current, setOwnsEntry); publish()
        return () => { slot.delete(markerId.current); publish(); if (!slot.size) encounterSlots.delete(key) }
      }, [gameId, turn, streaming])
      useEffect(() => {
        if (!ownsEntry || !Number.isSafeInteger(turn) || streaming || typeof ctx.tavernUi.watchTurnState !== 'function') { setEncounter(null); return }
        let active = true
        const check = async head => {
          latestHead.current = head
          if (!active) return
          const token = ++checkId.current
          if (head?.turn !== turn || !head.settled || head.generating || head.settling || head.busy) { setEncounter(null); return }
          try {
            const state = await storyBattleReady(ctx, gameId, turn, head.textVersion)
            const fight = state?.battle
            if (!active || token !== checkId.current || latestHead.current?.turn !== turn || latestHead.current?.textVersion !== head.textVersion || latestHead.current?.generating || latestHead.current?.settling || latestHead.current?.busy) return
            setEncounter(fight ? state : null)
          } catch (_) { /* Ordinary prose remains unchanged when no encounter is ready. */ }
        }
        const stop = ctx.tavernUi.watchTurnState(gameId, check)
        return () => { active = false; stop?.() }
      }, [gameId, turn, streaming, ownsEntry])
      const enter = async () => {
        if (busy || overlayOpening.current || !encounter) return
        const token = ++requestId.current
        overlayOpening.current = true; setBusy(true); setError('')
        try {
          const state = unpack(await routeCall(ctx.tavernUi, 'battle-state', { gameId }))
          const head = state?.turnState
          if (!state?.battle || state.battle.id !== encounter.battle.id || state.battle.turn !== turn || state.battle.textVersion !== encounter.battle.textVersion || head?.turn !== turn || head?.textVersion !== encounter.battle.textVersion || state.battle.readOnly || head.generating || head.settling || head.busy || head.settled === false) {
            setEncounter(null)
            throw new Error('正文已更新，请使用当前正文的战斗入口。')
          }
          if (!alive.current || token !== requestId.current) return
          await openBattleOverlay(ctx, gameId, state)
        } catch (e) { if (alive.current && token === requestId.current) setError(e?.message || '无法进入战斗。') }
        finally { overlayOpening.current = false; if (alive.current && token === requestId.current) setBusy(false) }
      }
      const battle = encounter?.battle
      const names = array(battle?.enemies).slice(0, 3).map(actor => actor.name).join('、')
      return h('span', { className: 'stg-story-marker' }, natural ? match : null,
        ownsEntry && !streaming && battle ? h('span', { className: 'stg stg-encounter', 'data-inline': natural, role: 'group', 'aria-label': '剧情战斗入口' }, h(Style),
          h('span', { className: 'stg-encounter-copy' }, h('strong', null, battle.outcome ? '战斗已结束' : Number(battle.seq) > 0 ? '战斗进行中' : '战斗已就绪'),
            h('small', { title: names }, names || '剧情对手')),
          h('button', { type: 'button', disabled: busy, onClick: enter, title: names ? `对手：${names}` : undefined }, busy ? '正在进入…' : battle.outcome ? '查看战果' : Number(battle.seq) > 0 ? '继续战斗' : '进入战斗')) : null,
        error ? h('small', { className: 'stg-story-entry-error', role: 'alert' }, error) : null)
    }

    return {
      name: PLUGIN,
      inject: ['tavernUi'],
      apply(ctx) {
        ctx.tavernUi.registerPanel({ id: 'simple', title: '战斗', render: ({ gameId }) => h(SetupPanel, { ctx, gameId, onBattle: initial => openBattleOverlay(ctx, gameId, initial) }) })
        ctx.tavernUi.registerTextMarker({
          pattern: /<dsh_battle>[\s\S]*?<\/dsh_battle>|battle###[\s\S]*?###|\{\s*"enemies"\s*:(?:(?!\n\s*\n)[\s\S])*\}|决斗|对战|交战|战斗|切磋|比武|开战|迎战/g,
          render: ({ gameId, turn, streaming, match }) => h(EncounterBadge, { ctx, gameId, turn, streaming, match }),
        })
      },
    }
  },
})
