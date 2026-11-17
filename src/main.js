import { unlockVoice, preloadVoice, cue, sayPhrase, stopVoice } from "./voice.js";
import { createPoseLandmarker, openCamera } from "./pose.js";
import { POSES } from "./poses.js";
import { LandmarkSmoother, Ema, repairLandmarks } from "./smoothing.js";
import { evaluate, detectBestPose } from "./scorer.js";
import { Overlay, paintSkeleton } from "./overlay.js";
import { CastSender } from "./cast.js";
import { connectHeartRate, bleSupported } from "./ble.js";
import { VoiceCoach } from "./speech.js";
import { SnapshotBook } from "./history.js";
import {
  currentUser, logout, submitPractice, fetchHistory,
  updateProfile, changePassword
} from "./api.js";

const $ = (id) => document.getElementById(id);

const me = currentUser();
if (!me) { location.replace("./login.html"); throw new Error("未登录"); }

/* ---------------- 主题 ---------------- */
const THEMES = {
  forest: {
    label: "森林绿",
    bg:"#071510", card:"#0d2018", line:"#1b3a2c", fg:"#dff3e8", dim:"#7fa694",
    ok:"#3ddc97", warn:"#ffb020", bad:"#ff5d5d", gradA:"#1f6f4a", gradB:"#2fae74",
    stage:"#ffffff", splash:"rgba(7,21,16,.94)", hud:"rgba(7,21,16,.62)",
    cueBg:"rgba(255,176,32,.16)", cueFg:"#ffdca8", cueBorder:"#ffb020", overlay:"rgba(3,8,6,.78)"
  },
  ocean: {
    label: "深海蓝",
    bg:"#061422", card:"#0b2233", line:"#183c58", fg:"#dcecf8", dim:"#7fa0b8",
    ok:"#4db8ff", warn:"#ffc457", bad:"#ff6b6b", gradA:"#155a8a", gradB:"#2f8fd0",
    stage:"#ffffff", splash:"rgba(6,20,34,.94)", hud:"rgba(6,20,34,.62)",
    cueBg:"rgba(77,184,255,.16)", cueFg:"#bfe4ff", cueBorder:"#4db8ff", overlay:"rgba(3,9,16,.78)"
  },
  violet: {
    label: "暮光紫",
    bg:"#12091f", card:"#1d1230", line:"#362453", fg:"#eee6ff", dim:"#a493c4",
    ok:"#b18cff", warn:"#ffc457", bad:"#ff6b8b", gradA:"#5a3d9a", gradB:"#8b6fd6",
    stage:"#ffffff", splash:"rgba(18,9,31,.94)", hud:"rgba(18,9,31,.62)",
    cueBg:"rgba(177,140,255,.16)", cueFg:"#e0d2ff", cueBorder:"#b18cff", overlay:"rgba(8,4,15,.78)"
  },
  sunset: {
    label: "落日橙",
    bg:"#170d07", card:"#251407", line:"#472a12", fg:"#fbecdf", dim:"#c0a08a",
    ok:"#ff9f5a", warn:"#ffc457", bad:"#ff6b6b", gradA:"#8a4a1f", gradB:"#d07a3a",
    stage:"#ffffff", splash:"rgba(23,13,7,.94)", hud:"rgba(23,13,7,.62)",
    cueBg:"rgba(255,159,90,.16)", cueFg:"#ffd9b8", cueBorder:"#ff9f5a", overlay:"rgba(10,6,3,.78)"
  },
  mono: {
    label: "石墨灰",
    bg:"#101215", card:"#1b1f24", line:"#333a42", fg:"#e8ecf1", dim:"#94a0ad",
    ok:"#c8d3e0", warn:"#f0c060", bad:"#ff7070", gradA:"#3a4553", gradB:"#5d6b7d",
    stage:"#ffffff", splash:"rgba(16,18,21,.94)", hud:"rgba(16,18,21,.62)",
    cueBg:"rgba(200,211,224,.16)", cueFg:"#dbe4ee", cueBorder:"#c8d3e0", overlay:"rgba(6,7,9,.78)"
  },
  light: {
    label: "白昼",
    bg:"#eef2f7", card:"#ffffff", line:"#d2dce8", fg:"#16202d", dim:"#5d6f84",
    ok:"#0f9d63", warn:"#c07d00", bad:"#d83a3a", gradA:"#1f8f5f", gradB:"#3ddc97",
    stage:"#ffffff", splash:"rgba(255,255,255,.96)", hud:"rgba(255,255,255,.85)",
    cueBg:"rgba(192,125,0,.12)", cueFg:"#8a5a00", cueBorder:"#c07d00", overlay:"rgba(230,236,244,.85)"
  }
};

function applyTheme(name) {
  const t = THEMES[name] || THEMES.forest;
  const r = document.documentElement.style;
  const set = (k, v) => r.setProperty(k, v);
  set("--bg", t.bg); set("--card", t.card); set("--line", t.line);
  set("--fg", t.fg); set("--dim", t.dim); set("--ok", t.ok);
  set("--warn", t.warn); set("--bad", t.bad);
  set("--grad-a", t.gradA); set("--grad-b", t.gradB);
  set("--stage", t.stage); set("--splash", t.splash); set("--hud", t.hud);
  set("--cue-bg", t.cueBg); set("--cue-fg", t.cueFg); set("--cue-border", t.cueBorder);
  set("--overlay", t.overlay);
  localStorage.setItem("theme", name);
  document.querySelectorAll(".swatch").forEach(el => {
    el.classList.toggle("active", el.dataset.theme === name);
  });
}

function buildSwatches() {
  const box = $("swatches");
  const cur = localStorage.getItem("theme") || "forest";
  box.innerHTML = Object.entries(THEMES).map(([k, t]) => `
    <div class="swatch ${k === cur ? "active" : ""}" data-theme="${k}"
      style="background:linear-gradient(135deg,${t.gradA},${t.gradB})"
      title="${t.label}"><span>${t.label}</span></div>`).join("");
  box.querySelectorAll(".swatch").forEach(el => {
    el.addEventListener("click", () => applyTheme(el.dataset.theme));
  });
}

applyTheme(localStorage.getItem("theme") || "forest");
buildSwatches();

/* ---------------- 显示选项 ---------------- */
let showScore = localStorage.getItem("showScore") !== "0";
let showPoseCard = localStorage.getItem("showPoseCard") !== "0";

function applyVisibility() {
  $("hud").style.display = showScore ? "" : "none";
  $("poseCard").hidden = !showPoseCard;
  $("showScore").checked = showScore;
  $("showPoseCard").checked = showPoseCard;
}

$("showScore").addEventListener("change", (e) => {
  showScore = e.target.checked;
  localStorage.setItem("showScore", showScore ? "1" : "0");
  applyVisibility();
});
$("showPoseCard").addEventListener("change", (e) => {
  showPoseCard = e.target.checked;
  localStorage.setItem("showPoseCard", showPoseCard ? "1" : "0");
  applyVisibility();
});

/* ---------------- 头像 ---------------- */
function setAvatar(dataUrl) {
  const el = $("avatar"), lg = $("avatarLg");
  const initial = (me.nick_name || me.username || "U").slice(0, 1).toUpperCase();
  [el, lg].forEach(node => {
    if (!node) return;
    if (dataUrl) {
      node.style.backgroundImage = `url(${dataUrl})`;
      node.textContent = "";
    } else {
      node.style.backgroundImage = "none";
      node.textContent = initial;
    }
  });
}
setAvatar(localStorage.getItem("avatar") || "");

function resizeImage(file, size = 160) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas");
      const s = Math.min(img.width, img.height);
      c.width = c.height = size;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

$("pickAvatar").addEventListener("click", () => $("avatarFile").click());
$("avatarFile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const dataUrl = await resizeImage(file);
    localStorage.setItem("avatar", dataUrl);
    setAvatar(dataUrl);
    toast("头像已更新");
  } catch { toast("图片处理失败"); }
  e.target.value = "";
});
$("removeAvatar").addEventListener("click", () => {
  localStorage.removeItem("avatar");
  setAvatar("");
  toast("头像已移除");
});

/* ---------------- 用户区 ---------------- */
$("userName").textContent = me.nick_name || me.username;

$("logoutBtn").addEventListener("click", () => {
  if (!confirm("退出登录？")) return;
  logout();
  location.replace("./login.html");
});

/* ---------------- 个人资料 ---------------- */
const pm = $("profileModal");

$("profileBtn").addEventListener("click", () => {
  const u = currentUser() || {};
  $("pNick").value = u.nick_name || "";
  $("pGender").value = u.gender || "F";
  $("pAge").value = u.age ?? "";
  $("pHeight").value = u.height ?? "";
  $("pWeight").value = u.weight ?? "";
  $("pOld").value = "";
  $("pNew").value = "";
  applyVisibility();
  pm.hidden = false;
});

$("profileClose").addEventListener("click", () => { pm.hidden = true; });

$("saveProfile").addEventListener("click", async () => {
  const patch = {};
  const nick = $("pNick").value.trim();
  if (nick) patch.nick_name = nick;
  patch.gender = $("pGender").value;
  if ($("pAge").value) patch.age = Number($("pAge").value);
  if ($("pHeight").value) patch.height = Number($("pHeight").value);
  if ($("pWeight").value) patch.weight = Number($("pWeight").value);

  try {
    const merged = await updateProfile(patch);
    $("userName").textContent = merged.nick_name || merged.username;
    if (patch.nick_name && !localStorage.getItem("avatar")) setAvatar("");
    toast("资料已保存");
    pm.hidden = true;
  } catch (e) {
    toast("保存失败：" + e.message);
  }
});

$("savePass").addEventListener("click", async () => {
  const n = $("pNew").value;
  if (!n) { toast("请输入新密码"); return; }
  if (n.length < 6) { toast("新密码至少 6 位"); return; }
  try {
    await changePassword(n);
    toast("密码已修改");
    $("pOld").value = "";
    $("pNew").value = "";
  } catch (e) {
    toast("修改失败：" + e.message);
  }
});

/* ---------------- DOM ---------------- */
const video = $("video"), canvas = $("overlay");
const splash = $("splash"), splashHint = $("splashHint"), startBtn = $("startBtn");
const poseSelect = $("poseSelect"), qualitySel = $("qualitySel");
const gradeEl = $("grade"), scoreEl = $("score"), cuesEl = $("cues");
const holdEl = $("hold"), fpsEl = $("fps"), ruleList = $("ruleList");
const hrBox = $("hrBox"), hrEl = $("hr");
const statLine = $("statLine"), suggestEl = $("suggest");
const gallery = $("gallery"), galleryList = $("galleryList");

const overlay = new Overlay(canvas);
const cast = new CastSender();
const voice = new VoiceCoach({ rate: 1.05 });
const snaps = new SnapshotBook();
const fullCache = new Map();

const QUALITY = {
  speed:    { quality: "lite", width: 640,  height: 480, fps: 15, strict: 1.25 },
  balanced: { quality: "lite", width: 960,  height: 540, fps: 18, strict: 1.0 },
  accurate: { quality: "full", width: 1280, height: 720, fps: 12, strict: 0.85 }
};

const state = {
  running: false, landmarker: null, stream: null, facing: "user",
  pose: POSES[0], quality: "balanced",
  smoother: new LandmarkSmoother(), ema: new Ema(0.25),
  frameInterval: 1000 / 18, lastDetectAt: 0, lastVideoTime: -1,
  hold: 0, lastTick: 0,
  voiceOn: true, lastVoiceAt: 0,
  lastDetectPoseAt: 0, suggest: null,
  last: null, scores: [], startedAt: 0
};

/* ---------------- 右上角动作要点卡 ---------------- */
function updatePoseCard() {
  const p = state.pose;
  $("poseCardName").textContent = p.name;
  $("poseCardTips").innerHTML = p.rules.map(r => `<li>${r.label}</li>`).join("");

  const img = $("poseImg");
  img.src = `./assets/poses/${p.id}.png`;
  img.onload = () => { img.style.display = "block"; };
  img.onerror = () => { img.style.display = "none"; };
}

/* ---------------- UI 初始化 ---------------- */
await snaps.ready();

POSES.forEach((p, i) => {
  const o = document.createElement("option");
  o.value = i; o.textContent = p.name;
  poseSelect.appendChild(o);
});

updatePoseCard();
applyVisibility();
renderGallery();

poseSelect.addEventListener("change", () => {
  state.pose = POSES[+poseSelect.value];
  state.smoother.reset(); state.ema.reset();
  state.hold = 0; state.scores = [];
  renderRules(null); cuesEl.innerHTML = "";
  hideSuggest();
  updatePoseCard();
  voice.speak("已切换到" + state.pose.name.split(" ")[0]);
});

qualitySel.addEventListener("change", async () => {
  state.quality = qualitySel.value;
  const q = QUALITY[state.quality];
  state.frameInterval = 1000 / q.fps;
  toast("已切换画质：" + (state.quality === "accurate" ? "精细" : state.quality === "speed" ? "流畅" : "均衡"));
  if (state.running) await restartPipeline();
});

/* ---------------- 启动 ---------------- */
startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  voice.unlock();
  try {
    await bootPipeline();
    splash.classList.add("hide");
    $("dot").classList.add("on");
    state.running = true;
    state.startedAt = performance.now();
    state.lastTick = performance.now();
    video.requestVideoFrameCallback(tick);
    voice.speak("开始练习");
  } catch (e) {
    console.error(e);
    splashHint.textContent = "启动失败：" + (e?.message || e);
    startBtn.disabled = false;
  }
});

async function bootPipeline() {
  const q = QUALITY[state.quality];
  splashHint.textContent = "正在加载模型…";
  state.landmarker = await createPoseLandmarker({ quality: q.quality });

  splashHint.textContent = "正在打开摄像头…";
  state.stream = await openCamera({ facing: state.facing, width: q.width, height: q.height });
  video.srcObject = state.stream;
  await video.play();
  await new Promise((r) =>
    video.readyState >= 2 ? r() : video.addEventListener("loadeddata", r, { once: true }));

  overlay.resize(video.videoWidth, video.videoHeight);
}

async function restartPipeline() {
  const wasRunning = state.running;
  state.running = false;
  try {
    state.stream?.getTracks().forEach((t) => t.stop());
    state.smoother.reset(); state.ema.reset();
    await bootPipeline();
  } catch (e) { toast("切换失败：" + e.message); }
  state.running = wasRunning;
  if (wasRunning) {
    state.lastTick = performance.now();
    video.requestVideoFrameCallback(tick);
  }
}

/* ---------------- 主循环 ---------------- */
let fpsCount = 0, fpsAt = performance.now();
let autoSnap = false;
let lastAutoAt = 0;

function tick() {
  if (!state.running) return;
  video.requestVideoFrameCallback(tick);

  const now = performance.now();
  const dt = now - state.lastTick;
  state.lastTick = now;

  if (now - state.lastDetectAt < state.frameInterval) return;
  state.lastDetectAt = now;
  if (video.readyState < 2 || video.currentTime === state.lastVideoTime) return;
  state.lastVideoTime = video.currentTime;

  let res;
  try { res = state.landmarker.detectForVideo(video, now); }
  catch (e) { console.warn(e); return; }

  const raw = res?.landmarks?.[0];
  if (!raw) { onNoPose(); return; }

  const lm = state.smoother.update(repairLandmarks(raw, 0.35));
  const { strict } = QUALITY[state.quality];
  const out = evaluate(state.pose, lm, { strict });
  const score = state.ema.push(out.score);

  if (score >= 0.78) state.hold += dt; else state.hold = 0;
  state.last = { lm, out, score };

  if (video.videoWidth && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
    overlay.resize(video.videoWidth, video.videoHeight);
  }
  overlay.draw(lm, out.badJoints);
  updateUI(score, out);
  pushScore(score);

  if (autoSnap && score >= 0.90 && state.hold >= 2000 && now - lastAutoAt > 15000) {
    lastAutoAt = now;
    takeSnapshot(true);
  }

  if (state.voiceOn && now - state.lastVoiceAt > 4000) {
    if (out.cues.length) { voice.coach(out.cues, score); state.lastVoiceAt = now; }
    else if (score >= 0.93) { voice.speak("很好"); state.lastVoiceAt = now; }
  }

  if (now - state.lastDetectPoseAt > 1500) {
    state.lastDetectPoseAt = now;
    const best = detectBestPose(POSES, lm);
    if (best && best.pose !== state.pose && best.score > 0.72 && best.score - out.score > 0.12) {
      showSuggest(best.pose, best.score);
    } else hideSuggest();
  }

  if (cast.connected) {
    cast.send({
      score, hold: state.hold, pose: state.pose.name, cues: out.cues,
      lm: lm.map((p) => [+p.x.toFixed(4), +p.y.toFixed(4), +(p.visibility ?? 1).toFixed(2)])
    });
  }

  fpsCount++;
  if (now - fpsAt > 1000) {
    fpsEl.textContent = fpsCount + " fps";
    fpsCount = 0; fpsAt = now;
  }
}

function onNoPose() {
  overlay.clear();
  state.ema.reset(); state.hold = 0; state.last = null;
  scoreEl.textContent = "0";
  gradeEl.textContent = "--";
  cuesEl.innerHTML = `<div class="cue">请后退一步，让全身进入画面</div>`;
  holdEl.textContent = "保持 0.0s";
  renderRules(null);
}

function pushScore(s) {
  state.scores.push(s);
  if (state.scores.length > 3000) state.scores.shift();
}

/* ---------------- UI ---------------- */
function updateUI(score, out) {
  const s = Math.round(score * 100);
  scoreEl.textContent = s;
  const [g, c] =
    s >= 90 ? ["优秀", "#3ddc97"] :
    s >= 75 ? ["良好", "#a8e6a1"] :
    s >= 60 ? ["及格", "#ffb020"] : ["需调整", "#ff5d5d"];
  gradeEl.textContent = g;
  gradeEl.style.color = c;
  scoreEl.style.color = c;

  holdEl.textContent = `保持 ${(state.hold / 1000).toFixed(1)}s`;
  cuesEl.innerHTML = (out.cues || []).slice(0, 3)
    .map((x) => `<div class="cue">${x}</div>`).join("");

  renderRules(out);
  renderStats();
}

function renderRules(out) {
  ruleList.innerHTML = state.pose.rules.map((r) => {
    const res = out?.results.find((x) => x.rule === r);
    const st = !res ? "idle" : res.missing ? "bad" : res.s >= 0.85 ? "ok" : res.s >= 0.5 ? "warn" : "bad";
    const pct = res && !res.missing ? Math.round(res.s * 100) : 0;
    return `<li class="rule ${st}">
      <span class="bar"><i style="width:${pct}%"></i></span>
      <span class="lb">${r.label}${res?.missing ? "（未识别）" : ""}</span>
    </li>`;
  }).join("");
}

function renderStats() {
  if (!state.scores.length) { statLine.textContent = "—"; return; }
  const avg = state.scores.reduce((a, b) => a + b, 0) / state.scores.length;
  const max = Math.max(...state.scores);
  const min = Math.min(...state.scores);
  const dur = Math.round((performance.now() - state.startedAt) / 1000);
  statLine.textContent =
    `平均 ${Math.round(avg * 100)} · 最高 ${Math.round(max * 100)} · 最低 ${Math.round(min * 100)} · 时长 ${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, "0")}`;
}

function showSuggest(pose, score) {
  state.suggest = pose;
  suggestEl.hidden = false;
  suggestEl.textContent = `看起来你在做「${pose.name}」（${Math.round(score * 100)} 分）—— 点这里切换`;
}
function hideSuggest() { state.suggest = null; suggestEl.hidden = true; }

suggestEl.addEventListener("click", () => {
  if (!state.suggest) return;
  state.pose = state.suggest;
  poseSelect.value = String(POSES.indexOf(state.suggest));
  state.smoother.reset(); state.ema.reset(); state.hold = 0;
  renderRules(null);
  hideSuggest();
  updatePoseCard();
  voice.speak("已切换到" + state.pose.name.split(" ")[0]);
});

/* ---------------- 定格 ---------------- */
$("snapBtn").addEventListener("click", () => takeSnapshot(false));

$("autoSnapBtn").addEventListener("click", (e) => {
  autoSnap = !autoSnap;
  e.currentTarget.classList.toggle("on", autoSnap);
  toast(autoSnap ? "自动定格已开启：动作标准保持 2 秒自动拍照" : "自动定格已关闭");
});

function takeSnapshot(isAuto) {
  const s = state.last;
  if (!s?.lm) {
    if (!isAuto) toast("还没检测到人体，先站进画面");
    return;
  }
  if (!video.videoWidth) {
    if (!isAuto) toast("视频还没就绪");
    return;
  }

  const W = video.videoWidth, H = video.videoHeight;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");

  g.save();
  g.translate(W, 0); g.scale(-1, 1);
  g.drawImage(video, 0, 0, W, H);
  g.restore();

  paintSkeleton(g, s.lm, s.out.badJoints, W, H, true);

  const pad = Math.round(W * 0.03);
  g.font = `600 ${Math.round(W / 22)}px -apple-system,"PingFang SC",sans-serif`;
  g.textBaseline = "top";
  g.fillStyle = "rgba(0,0,0,.45)";
  g.fillRect(pad, pad, W * 0.42, H * 0.13);
  g.fillStyle = "#3ddc97";
  g.fillText(`${Math.round(s.score * 100)} 分`, pad * 1.6, pad * 1.4);
  g.fillStyle = "#e9eef5";
  g.font = `400 ${Math.round(W / 40)}px -apple-system,"PingFang SC",sans-serif`;
  g.fillText(state.pose.name, pad * 1.6, pad * 1.4 + W / 22 + 8);

  const full = c.toDataURL("image/jpeg", 0.92);

  const t = document.createElement("canvas");
  const tw = 360, th = Math.round((tw * H) / W);
  t.width = tw; t.height = th;
  t.getContext("2d").drawImage(c, 0, 0, tw, th);
  const thumb = t.toDataURL("image/jpeg", 0.7);

  const item = snaps.add({
    thumb,
    pose: state.pose.name,
    poseId: state.pose.id,
    score: s.score,
    cues: s.out.cues || [],
    auto: !!isAuto
  });
  fullCache.set(item.id, full);

  toast((isAuto ? "自动定格 " : "已定格 ") + Math.round(s.score * 100) + " 分");
  voice.speak("已定格，" + Math.round(s.score * 100) + " 分", { force: true });
  renderGallery();

  submitPractice({
    poseId: state.pose.dbId ?? null,
    poseName: state.pose.name,
    score: s.score,
    cues: s.out.cues,
    duration: (performance.now() - state.startedAt) / 1000
  }).catch(() => {});
}

/* ---------------- 记录抽屉：图片 + 说明 ---------------- */
function renderGallery() {
  const items = snaps.all;
  if (!items.length) {
    galleryList.innerHTML = `<div class="empty">还没有定格。<br>练习时点「📸 定格」或打开「🤖 自动」，会自动保存姿势截图、分数和纠正建议。</div>`;
    return;
  }

  galleryList.innerHTML = items.map((it) => {
    const s = Math.round(it.score * 100);
    const color = s >= 90 ? "#3ddc97" : s >= 75 ? "#a8e6a1" : s >= 60 ? "#ffb020" : "#ff5d5d";
    const cues = (it.cues || []).filter(Boolean);
    return `<figure class="snap">
      <img src="${it.thumb}" alt="">
      <figcaption>
        <b style="color:${color}">${s} 分</b>
        <span>${it.pose}${it.auto ? " · 自动" : ""}</span>
        <time>${new Date(it.ts).toLocaleString("zh-CN", { hour12: false })}</time>
        ${cues.length
          ? `<ul class="snap-cues">${cues.slice(0, 3).map(c => `<li>${c}</li>`).join("")}</ul>`
          : `<div style="color:var(--ok)">姿势标准，没有需要调整的地方</div>`}
        <div class="snap-btns">
          <button data-dl="${it.id}">下载</button>
          <button data-del="${it.id}">删除</button>
        </div>
      </figcaption>
    </figure>`;
  }).join("");
}

galleryList.addEventListener("click", (e) => {
  const dl = e.target.dataset?.dl;
  const del = e.target.dataset?.del;
  if (dl) {
    const it = snaps.all.find((i) => i.id === dl);
    if (!it) return;
    const a = document.createElement("a");
    a.href = fullCache.get(dl) || it.thumb;
    a.download = `yoga-${it.pose}-${Math.round(it.score * 100)}-${dl}.jpg`;
    a.click();
  }
  if (del) { snaps.remove(del); fullCache.delete(del); renderGallery(); }
});

$("galleryBtn").addEventListener("click", () => { renderGallery(); gallery.hidden = false; });
$("galleryClose").addEventListener("click", () => { gallery.hidden = true; });
$("galleryClear").addEventListener("click", () => {
  if (!snaps.all.length) return;
  if (confirm("清空全部定格记录？")) { snaps.clear(); fullCache.clear(); renderGallery(); }
});

/* ---------------- 语音开关 ---------------- */
$("voiceBtn").addEventListener("click", (e) => {
  state.voiceOn = !state.voiceOn;
  voice.setEnabled(state.voiceOn);
  e.target.classList.toggle("on", state.voiceOn);
  e.target.textContent = state.voiceOn ? "🔊 语音" : "🔇 静音";
  toast(state.voiceOn ? "语音已开启" : "语音已关闭");
});

/* ---------------- 投屏 ---------------- */
$("castBtn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  if (cast.connected) { cast.stop(); btn.classList.remove("on"); toast("已断开投屏"); return; }
  try {
    await cast.startPresentation();
    btn.classList.add("on"); toast("已投屏到第二屏");
    return;
  } catch {}

  const proto = location.protocol === "https:" ? "wss" : "ws";
  try {
    await cast.startWebSocket(`${proto}://${location.host}/ws`);
    btn.classList.add("on");
    toast("投屏通道已开，另一台设备打开 /cast.html");
  } catch {
    cast.startBroadcast();
    btn.classList.add("on");
    toast("同机投屏：新窗口打开 /cast.html");
  }
});

/* ---------------- 蓝牙 ---------------- */
$("bleBtn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  if (!bleSupported()) { toast("此浏览器不支持蓝牙，请用安卓 Chrome"); return; }
  try {
    await connectHeartRate((bpm) => { hrBox.hidden = false; hrEl.textContent = bpm ?? "--"; });
    btn.classList.add("on");
    toast("心率带已连接");
  } catch (err) { toast("蓝牙失败：" + (err?.message || err)); }
});

/* ---------------- 镜头切换 ---------------- */
$("flipBtn").addEventListener("click", async () => {
  state.facing = state.facing === "user" ? "environment" : "user";
  if (!state.stream) return;
  await restartPipeline();
});

/* ---------------- 提示条 ---------------- */
let toastTimer;
function toast(msg, ms = 2600) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

/* ---------------- PWA ---------------- */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
