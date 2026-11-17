import { compilePoses } from "./metrics.js";

const RAW_POSES = [
  {
    id: "downdog",
    dbId: 1,
    name: "下犬式 Adho Mukha Svanasana",
    rules: [
      { label: "髋部充分折叠", metric: "hipFold", target: 85, tol: 18, unit: "°",
        weight: 3, joints: [23, 24, 25, 26],
        cueBelow: "把坐骨再往上推，髋部顶高",
        cueAbove: "髋部别塌下来，尾骨向上" },
      { label: "双膝伸直", metric: "kneeAvg", target: 172, tol: 12, unit: "°",
        weight: 2.5, joints: [25, 26, 27, 28],
        cueBelow: "腿后侧紧就先微屈膝，再慢慢蹬直" },
      { label: "手掌落地", metric: "armRaise", target: 0.35, tol: 0.15, unit: "",
        weight: 2, joints: [15, 16],
        cue: "手掌压实地面，肩膀在手腕正上方" },
      { label: "背部延展", metric: "torsoTilt", target: 55, tol: 20, unit: "°",
        weight: 1.5, joints: [11, 23],
        cue: "从髋部折叠，让背部保持一条直线" }
    ]
  },
  {
    id: "warrior1",
    dbId: 2,
    name: "战士一式 Virabhadrasana I",
    rules: [
      { label: "前腿屈膝约 90°", metric: "kneeMin", target: 95, tol: 15, unit: "°",
        weight: 3, joints: [25, 26],
        cueBelow: "前腿再弯一点，膝盖对准脚踝",
        cueAbove: "前腿别弯过头，小腿垂直地面" },
      { label: "后腿伸直", metric: "kneeMax", target: 174, tol: 10, unit: "°",
        weight: 2.5, joints: [27, 28],
        cueBelow: "后腿膝盖伸直，脚跟踩实" },
      { label: "躯干垂直", metric: "torsoTilt", target: 2, tol: 8, unit: "°",
        weight: 2.5, joints: [11, 12, 23, 24],
        cueAbove: "上身别前倾，胸口向上提" },
      { label: "双臂上举过头", metric: "armOverHead", target: -0.2, tol: 0.14, unit: "",
        weight: 2, joints: [13, 14, 15, 16],
        cue: "双臂向上伸直，掌心相对" }
    ]
  },
  {
    id: "tree",
    dbId: 3,
    name: "树式 Vrksasana",
    rules: [
      { label: "支撑腿伸直", metric: "kneeMax", target: 176, tol: 10, unit: "°",
        weight: 3, joints: [25, 26, 27, 28],
        cueBelow: "把站立的那条腿再伸直一些" },
      { label: "抬腿屈膝", metric: "kneeMin", target: 50, tol: 22, unit: "°",
        weight: 2.5, joints: [25, 26],
        cueBelow: "脚掌贴到支撑腿大腿内侧，膝盖再弯一点",
        cueAbove: "抬起的腿放松些，不必贴得太紧" },
      { label: "骨盆水平", metric: "hipTilt", target: 0, tol: 6, unit: "°",
        weight: 2, joints: [23, 24],
        cueAbove: "抬起腿一侧的髋部别往上翻，保持骨盆水平" },
      { label: "双手上举过头", metric: "armOverHead", target: -0.18, tol: 0.12, unit: "",
        weight: 1.5, joints: [13, 14, 15, 16],
        cue: "双手向上伸展，合十过头顶" }
    ]
  },
  {
    id: "triangle",
    dbId: 4,
    name: "三角式 Trikonasana",
    rules: [
      { label: "双腿伸直", metric: "kneeAvg", target: 174, tol: 10, unit: "°",
        weight: 3, joints: [25, 26, 27, 28],
        cueBelow: "两条腿都伸直，别屈膝" },
      { label: "躯干侧倾", metric: "torsoTilt", target: 38, tol: 18, unit: "°",
        weight: 2.5, joints: [11, 12, 23, 24],
        cueBelow: "身体向侧方再倾一点",
        cueAbove: "侧倾别过头，保持脊柱延展" },
      { label: "双臂连成一线", metric: "armSpreadY", target: 0.5, tol: 0.2, unit: "",
        weight: 2.5, joints: [13, 14, 15, 16],
        cue: "一手指天，一手指地，双臂成一条直线" },
      { label: "骨盆侧倾", metric: "hipTilt", target: 12, tol: 12, unit: "°",
        weight: 1.5, joints: [23, 24],
        cue: "髋部向上翻开，别塌下去" }
    ]
  },
  {
    id: "child",
    dbId: 5,
    name: "婴儿式 Child's Pose",
    rules: [
      { label: "双膝收拢", metric: "kneeAvg", target: 70, tol: 20, unit: "°",
        weight: 3, joints: [25, 26, 27, 28],
        cueBelow: "臀部再往脚跟方向坐下去",
        cueAbove: "别把小腿压得太死，微微放松" },
      { label: "躯干前屈", metric: "torsoTilt", target: 70, tol: 20, unit: "°",
        weight: 3, joints: [11, 12, 23, 24],
        cueBelow: "上身再往前趴，让额头靠近地面",
        cueAbove: "上身别抬起来，放松下沉" },
      { label: "手臂前伸", metric: "armRaise", target: 0.25, tol: 0.2, unit: "",
        weight: 2, joints: [13, 14, 15, 16],
        cue: "双臂向前伸直，掌心贴地" }
    ]
  },
  {
    id: "bridge",
    dbId: 6,
    name: "桥式 Bridge Pose",
    rules: [
      { label: "屈膝踩地", metric: "kneeAvg", target: 100, tol: 15, unit: "°",
        weight: 3, joints: [25, 26, 27, 28],
        cueBelow: "脚跟再往臀部靠近一些",
        cueAbove: "膝盖别收太近，小腿接近垂直" },
      { label: "髋部顶起", metric: "hipFold", target: 165, tol: 15, unit: "°",
        weight: 3, joints: [23, 24, 25, 26],
        cueBelow: "臀部再往上顶，髋部打开",
        cueAbove: "别顶得太高，肋骨不要外翻" },
      { label: "双臂贴地", metric: "armRaise", target: 0.3, tol: 0.15, unit: "",
        weight: 2, joints: [13, 14, 15, 16],
        cue: "双臂放在身体两侧，掌心向下" }
    ]
  },
  {
    id: "mountain",
    dbId: 7,
    name: "山式 Tadasana",
    rules: [
      { label: "双膝伸直", metric: "kneeAvg", target: 176, tol: 8, unit: "°",
        weight: 3, joints: [25, 26, 27, 28],
        cueBelow: "膝盖还弯着，慢慢把双腿伸直",
        cueAbove: "别把膝盖锁死向后顶，微收一点" },
      { label: "躯干垂直", metric: "torsoTilt", target: 2, tol: 6, unit: "°",
        weight: 3, joints: [11, 12, 23, 24],
        cueAbove: "身体有点歪，收腹、把重心放回脚掌中间" },
      { label: "双肩齐平", metric: "shoulderTilt", target: 2, tol: 5, unit: "°",
        weight: 1.5, joints: [11, 12],
        cueAbove: "放松高的一侧肩膀，让两肩齐平" },
      { label: "手臂垂于体侧", metric: "armRaise", target: 0.34, tol: 0.16, unit: "",
        weight: 1, joints: [13, 14, 15, 16],
        cue: "手臂放松垂在身体两侧，掌心朝内" }
    ]
  },
  {
    id: "pigeon",
    dbId: 8,
    name: "鸽子式 Pigeon Pose",
    rules: [
      { label: "前腿屈膝", metric: "kneeMin", target: 85, tol: 20, unit: "°",
        weight: 3, joints: [25, 26],
        cueBelow: "前腿再屈一点，小腿横放在身前",
        cueAbove: "前腿别折太紧，慢慢来" },
      { label: "后腿伸直", metric: "kneeMax", target: 165, tol: 20, unit: "°",
        weight: 3, joints: [27, 28],
        cueBelow: "后腿向后伸直，膝盖贴地" },
      { label: "躯干直立", metric: "torsoTilt", target: 10, tol: 12, unit: "°",
        weight: 2.5, joints: [11, 12, 23, 24],
        cueBelow: "上身再立起来一些，胸口向上",
        cueAbove: "别往后仰，保持脊柱中立" },
      { label: "骨盆摆正", metric: "hipTilt", target: 12, tol: 12, unit: "°",
        weight: 2, joints: [23, 24],
        cue: "两侧坐骨均匀落地，髋部朝向正前方" }
    ]
  },
  {
    id: "warrior2",
    name: "战士二式 Virabhadrasana II",
    rules: [
      { label: "前腿屈膝约 90°", metric: "kneeMin", target: 95, tol: 15, unit: "°",
        weight: 3, joints: [25, 26],
        cueBelow: "前腿再弯一点，膝盖对准脚踝正上方",
        cueAbove: "前腿别弯太多，小腿垂直地面就好" },
      { label: "后腿伸直", metric: "kneeMax", target: 174, tol: 10, unit: "°",
        weight: 2.5, joints: [27, 28],
        cueBelow: "后腿膝盖伸直，脚跟踩实地面" },
      { label: "双臂平举", metric: "armHorizontal", target: 0, tol: 14, unit: "°",
        weight: 2.5, joints: [13, 14, 15, 16],
        cue: "双臂抬到与地面平行，指尖向两端延展" },
      { label: "躯干垂直", metric: "torsoTilt", target: 0, tol: 8, unit: "°",
        weight: 2, joints: [11, 12, 23, 24],
        cueAbove: "上身别前倾，重心落在两腿之间" }
    ]
  },
  {
    id: "chair",
    name: "幻椅式 Utkatasana",
    rules: [
      { label: "屈膝约 100°", metric: "kneeAvg", target: 100, tol: 15, unit: "°",
        weight: 3, joints: [25, 26],
        cueBelow: "臀部再往后坐，像要坐上椅子",
        cueAbove: "膝盖别超过脚尖太多，重心后移" },
      { label: "躯干前倾约 30°", metric: "torsoTilt", target: 30, tol: 10, unit: "°",
        weight: 2.5, joints: [11, 12, 23, 24],
        cueBelow: "胸口再往前送一点，背部延展",
        cueAbove: "上身别趴下去，收腹提胸" },
      { label: "双臂上举过头", metric: "armRaise", target: -0.32, tol: 0.18, unit: "",
        weight: 2, joints: [13, 14, 15, 16],
        cue: "双臂举过头顶，尽量贴近耳朵" }
    ]
  }
];

export const POSES = compilePoses(RAW_POSES);
