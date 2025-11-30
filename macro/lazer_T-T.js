// Door-Cutin 通用激光连发宏（Token / Tile 通吃）
// - 支持：Token→Token、Tile→Tile、Tile→Token
// - 点一次：开始连发；再点一次：停止连发

const MODULE_ID = "door-cutin";
const FLAG_KEY  = "laser-loop-state";

// 换成你的激光素材路径
const LASER_PATH = "modules/door-cutin/assets/effects/lazer.webm";

// 两发之间的间隔（毫秒）
const INTERVAL_MS = 1300;

// 需要 Sequencer
if (!game.modules.get("sequencer")?.active) {
  ui.notifications.error("需要 Sequencer 模块（Sequencer）才能播放激光特效。");
  return;
}

/**
 * 从当前场景中，根据“选中 + 目标”自动推断 source / target：
 *
 *  优先级：
 *   1) 如果有 ≥2 个已选 Token：用前两个 Token
 *   2) 否则如果有 1 个已选 Token + 至少 1 个目标 Token：source = 选中，target = 第一个目标
 *   3) 否则如果有 ≥2 个已选 Tile：用前两个 Tile（在 Tiles 图层框选两个）
 *   4) 否则如果有 1 个已选 Tile + 至少 1 个目标 Token：source = Tile，target = 第一个目标 Token
 */
function pickSourceAndTarget() {
  const selectedTokens = canvas.tokens.controlled;
  const selectedTiles  = canvas.tiles.controlled;
  const targets        = [...game.user.targets];

  // 1) 2+ tokens 直接当作 token→token
  if (selectedTokens.length >= 2) {
    const [s, t] = selectedTokens;
    return { source: s, target: t, kind: "token-token" };
  }

  // 2) 1 token + 至少 1 target（target 一定是 token）
  if (selectedTokens.length === 1 && targets.length >= 1) {
    const s = selectedTokens[0];
    const t = targets[0]; // Token
    return { source: s, target: t, kind: "token-token-target" };
  }

  // 3) 2+ tiles → tile→tile（在 Tiles 工具里框选）
  if (selectedTiles.length >= 2) {
    const [s, t] = selectedTiles;
    return { source: s, target: t, kind: "tile-tile" };
  }

  // 4) 1 tile + 目标 token → tile→token
  if (selectedTiles.length === 1 && targets.length >= 1) {
    const s = selectedTiles[0];
    const t = targets[0]; // Token
    return { source: s, target: t, kind: "tile-token" };
  }

  return null;
}

// 先看看是不是已经在连发 → 如果是，就当成“关闭连发”
const currentState = await game.user.getFlag(MODULE_ID, FLAG_KEY);
if (currentState) {
  await game.user.unsetFlag(MODULE_ID, FLAG_KEY);
  ui.notifications.info("激光连发：已关闭");
  return;
}

// 否则准备开启：自动选 source / target
const pair = pickSourceAndTarget();
if (!pair) {
  ui.notifications.warn(
    "激光连发：无法确定起点和终点。\n" +
    "用法示例：\n" +
    " ① 选中两个 Token → Token→Token\n" +
    " ② 选中一个 Token + 目标另一个 Token → Token→Token\n" +
    " ③ 在 Tiles 图层选中两个 Tile → Tile→Tile\n" +
    " ④ 在 Tiles 图层选中一个 Tile + 目标一个 Token → Tile→Token"
  );
  return;
}

const { source, target, kind } = pair;
ui.notifications.info(`激光连发：已开启（${kind}）`);

// 把“连发状态”存到 user flag 上，方便下次点击关闭，同时支持刷新后仍能关
await game.user.setFlag(MODULE_ID, FLAG_KEY, {
  sourceId: source.id,
  targetId: target.id,
  kind
});

// 循环开火函数
async function fireLoop() {
  const state = await game.user.getFlag(MODULE_ID, FLAG_KEY);
  if (!state) return; // 被关掉了

  // 根据种类，重新从场景里取对象（防止被删）
  let srcObj = null;
  let tgtObj = null;

  if (state.kind.startsWith("token")) {
    // 起点是 token（kind: token-token / token-token-target）
    srcObj = canvas.tokens.get(state.sourceId);
  } else {
    // 起点是 tile
    srcObj = canvas.tiles.get(state.sourceId);
  }

  if (state.kind.endsWith("token")) {
    // 终点是 token（包括 token-token、tile-token 等）
    tgtObj = canvas.tokens.get(state.targetId);
  } else {
    // 终点是 tile（tile-tile）
    tgtObj = canvas.tiles.get(state.targetId);
  }

  // 任意一端找不到，就自动停止
  if (!srcObj || !tgtObj) {
    await game.user.unsetFlag(MODULE_ID, FLAG_KEY);
    ui.notifications.warn("激光连发已停止：起点或终点已不存在。");
    return;
  }

  // 播放一次激光：attachTo + stretchTo 对 Token / Tile 都适用
  const seq = new Sequence()
    .effect()
      .file(LASER_PATH)
      .attachTo(srcObj)   // 附着在起点（移动时一起动）
      .stretchTo(tgtObj); // 拉到终点的中心

  await seq.play();

  // 间隔一段时间，再来一发
  await new Promise(r => setTimeout(r, INTERVAL_MS));

  // 继续下一轮
  fireLoop();
}

// 启动第一轮
fireLoop();