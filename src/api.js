/* 本地账号 & 记录存储（不需要服务器） */

const USERS_KEY = "yoga_users";
const SESSION_KEY = "user";
const recKey = (uid) => `yoga_rec_${uid}`;

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); } catch { return {}; }
}
function saveUsers(obj) {
  localStorage.setItem(USERS_KEY, JSON.stringify(obj));
}
function enc(p) { return btoa(unescape(encodeURIComponent(p))); }

/* 首次打开时预置测试账号 */
(function seed() {
  if (localStorage.getItem(USERS_KEY)) return;
  saveUsers({
    test01: {
      username: "test01",
      nick_name: "学员小A",
      password: enc("123456"),
      gender: "F",
      age: 22,
      height: 162,
      weight: 52
    }
  });
})();

/* ---------------- 注册 / 登录 ---------------- */
export async function register(username, password, nickName) {
  const u = username.trim().toLowerCase();
  if (u.length < 3) throw new Error("账号至少 3 个字符");
  if (password.length < 6) throw new Error("密码至少 6 位");

  const users = loadUsers();
  if (users[u]) throw new Error("该账号已被注册");

  users[u] = {
    username: u,
    nick_name: nickName || u,
    password: enc(password),
    gender: null, age: null, height: null, weight: null
  };
  saveUsers(users);
}

export async function login(username, password) {
  const u = username.trim().toLowerCase();
  const users = loadUsers();
  const rec = users[u];
  if (!rec || rec.password !== enc(password)) throw new Error("账号或密码错误");

  const info = {
    id: u,
    username: rec.username,
    nick_name: rec.nick_name || rec.username,
    gender: rec.gender ?? null,
    age: rec.age ?? null,
    height: rec.height ?? null,
    weight: rec.weight ?? null
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(info));
  return info;
}

export function currentUser() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

/* ---------------- 资料修改 ---------------- */
export async function updateProfile(patch) {
  const me = currentUser();
  if (!me) throw new Error("未登录");

  const users = loadUsers();
  const rec = users[me.id];
  if (!rec) throw new Error("用户不存在");

  if (patch.nick_name != null) rec.nick_name = patch.nick_name;
  if (patch.gender != null) rec.gender = patch.gender;
  if (patch.age != null) rec.age = patch.age;
  if (patch.height != null) rec.height = patch.height;
  if (patch.weight != null) rec.weight = patch.weight;
  saveUsers(users);

  const merged = { ...me, ...patch };
  localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
  return merged;
}

export async function changePassword(newPassword) {
  const me = currentUser();
  if (!me) throw new Error("未登录");
  if (newPassword.length < 6) throw new Error("新密码至少 6 位");

  const users = loadUsers();
  if (!users[me.id]) throw new Error("用户不存在");
  users[me.id].password = enc(newPassword);
  saveUsers(users);
}

/* ---------------- 练习记录 ---------------- */
export async function submitPractice({ poseId, poseName, score, cues, duration }) {
  const me = currentUser();
  if (!me) return;

  const list = JSON.parse(localStorage.getItem(recKey(me.id)) || "[]");
  list.unshift({
    id: Date.now(),
    pose_id: poseId ?? null,
    pose_name: poseName,
    score: Math.round(score * 100),
    feedback: (cues || []).join("；") || null,
    duration: Math.round(duration || 0),
    practice_time: new Date().toISOString()
  });
  localStorage.setItem(recKey(me.id), JSON.stringify(list.slice(0, 300)));
}

export async function fetchHistory() {
  const me = currentUser();
  if (!me) return [];
  try {
    return JSON.parse(localStorage.getItem(recKey(me.id)) || "[]");
  } catch { return []; }
}
