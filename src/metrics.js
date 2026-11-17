import { angleAt, avgOf, mid, torsoTilt, shoulderTilt, hipTilt } from "./angles.js";

const kneeL = lm => angleAt(lm[23], lm[25], lm[27]);
const kneeR = lm => angleAt(lm[24], lm[26], lm[28]);
const wristMidY = lm => mid(lm[15], lm[16]).y;
const shoulderMidY = lm => mid(lm[11], lm[12]).y;

export const METRICS = {
  kneeAvg:       () => lm => avgOf(kneeL(lm), kneeR(lm)),
  kneeMax:       () => lm => Math.max(kneeL(lm), kneeR(lm)),
  kneeMin:       () => lm => Math.min(kneeL(lm), kneeR(lm)),
  torsoTilt:     () => lm => torsoTilt(lm),
  shoulderTilt:  () => lm => shoulderTilt(lm),
  hipTilt:       () => lm => hipTilt(lm),
  armRaise:      () => lm => wristMidY(lm) - shoulderMidY(lm),
  armOverHead:   () => lm => wristMidY(lm) - lm[0].y,
  armSpreadY:    () => lm => Math.abs(lm[15].y - lm[16].y),
  armHorizontal: () => lm => avgOf(
    angleAt(lm[11], lm[15], { x: lm[15].x + 1, y: lm[15].y }),
    angleAt(lm[12], lm[16], { x: lm[16].x + 1, y: lm[16].y })
  ),
  hipFold: () => lm => avgOf(
    angleAt(lm[11], lm[23], lm[27]),
    angleAt(lm[12], lm[24], lm[28])
  ),
};

export function compilePose(p) {
  return {
    ...p,
    rules: p.rules.map(r => {
      const f = METRICS[r.metric];
      if (!f) console.warn("未知 metric:", r.metric, "于", p.id);
      return { ...r, calc: f ? f(r) : (() => NaN) };
    })
  };
}

export const compilePoses = (list) => list.map(compilePose);
