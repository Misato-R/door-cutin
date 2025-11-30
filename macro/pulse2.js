// Door-Cutin 通用激光连发宏（支持固定炮台 + Token/Tile 通吃）

const MODULE_ID = "door-cutin";
const FLAG_KEY  = "laser-loop-state-2";

// 改成你的炮台 Tile 的 id（canvas.tiles.get("<id>") 能取到就行）
const FIXED_TURRET_TILE_ID = "lVD0NnMlUOrybrhu";

// 激光素材路径
const LASER_PATH  = "modules/door-cutin/assets/effects/lazer.webm";
// 两发之间间隔（毫秒）
const INTERVAL_MS = 1300;

// 必须有 Sequencer
if (!game.modules.get("sequencer")?.active) {
  ui.notifications.error("需要 Sequencer 模块（Sequencer）才能播放激光特效。");
  return;
}

/* ---------- 1. 获取 Door-Cutin 陷阱上下文（如果有） ---------- */

const rawArgs = typeof args !== "undefined" ? args : [];
console.log("laser-loop macro rawArgs = >", rawArgs);

let ctx = rawArgs[0] ?? null;

// 兜底：从 window.DoorCutin.lastTrapCtx 取
if (!ctx && window.DoorCutin?.lastTrapCtx) {
  console.log("laser-loop macro using DoorCutin.lastTrapCtx");
  ctx = window.DoorCutin.lastTrapCtx;
}

/* ---------- 2. 选定 source / target ---------- */

function pickSourceAndTarget() {
  // 0）优先：由 Door-Cutin 陷阱调用
  if (ctx) {
    // 触发陷阱的 token：优先用 tokenId，再退到 ctx.token.id
    const triggerToken =
      (ctx.tokenId && canvas.tokens.get(ctx.tokenId)) ||
      (ctx.token   && canvas.tokens.get(ctx.token.id)) ||
      null;

    // 炮台 tile：优先用固定 id，再退到 ctx.tileId / ctx.tile.id
    let sourceTile = null;

    if (FIXED_TURRET_TILE_ID) {
      sourceTile = canvas.tiles.get(FIXED_TURRET_TILE_ID) || null;
    }
    if (!sourceTile && ctx.tileId) {
      sourceTile = canvas.tiles.get(ctx.tileId) || null;
    }
    if (!sourceTile && ctx.tile) {
      sourceTile = canvas.tiles.get(ctx.tile.id) || null;
    }

    console.log("laser-loop ctx pair:", { triggerToken, sourceTile, ctx });

    if (sourceTile && triggerToken) {
      return {
        source: sourceTile,
        target: triggerToken,
        kind:   FIXED_TURRET_TILE_ID ? "fixed-turret" : "trap-tile-token",
        sourceType: "tile",
        targetType: "token"
      };
    }
  }

  // ====== 以下是“手动点宏”的逻辑：和你的测试版一致 ======
  const selectedTokens = canvas.tokens.controlled;
  const selectedTiles  = canvas.tiles.controlled;
  const targets        = [...game.user.targets];

  // 1) 2+ tokens → token-token
  if (selectedTokens.length >= 2) {
    const [s, t] = selectedTokens;
    return { source: s, target: t, kind: "token-token", sourceType: "token", targetType: "token" };
  }

  // 2) 1 token + ≥1 target token → 选中作为 source，目标作为 target
  if (selectedTokens.length === 1 && targets.length >= 1) {
    const s = selectedTokens[0];
    const t = targets[0];
    return { source: s, target: t, kind: "token-token-target", sourceType: "token", targetType: "token" };
  }

  // 3) 2+ tiles → tile-tile
  if (selectedTiles.length >= 2) {
    const [s, t] = selectedTiles;
    return { source: s, target: t, kind: "tile-tile", sourceType: "tile", targetType: "tile" };
  }

  // 4) 1 tile + ≥1 target token → tile-token
  if (selectedTiles.length === 1 && targets.length >= 1) {
    const s = selectedTiles[0];
    const t = targets[0];
    return { source: s, target: t, kind: "tile-token", sourceType: "tile", targetType: "token" };
  }

  return null;
}

/* ---------- 3. 已在连发 → 关掉 ---------- */

const currentState = await game.user.getFlag(MODULE_ID, FLAG_KEY);
if (currentState) {
  await game.user.unsetFlag(MODULE_ID, FLAG_KEY);
  ui.notifications.info("激光连发：已关闭");
  return;
}

/* ---------- 4. 否则开启新的连发 ---------- */

const pair = pickSourceAndTarget();
if (!pair) {
  ui.notifications.warn(
    "激光连发：无法确定起点和终点。\n" +
    "从陷阱调用时会自动使用“炮台 Tile → 触发者 Token”；\n" +
    "手动使用时，可选中两个 Token / Tile 或 1 Tile + 1 目标 Token。"
  );
  return;
}

const { source, target, kind, sourceType, targetType } = pair;
ui.notifications.info(`激光连发：已开启（${kind}）`);

await game.user.setFlag(MODULE_ID, FLAG_KEY, {
  sourceId:   source.id,
  targetId:   target.id,
  sourceType,       // "token" / "tile"
  targetType,       // "token" / "tile"
  kind
});

/* ---------- 5. 循环开火 ---------- */

async function fireLoop() {
  const state = await game.user.getFlag(MODULE_ID, FLAG_KEY);
  if (!state) return; // 已被关闭

  let srcObj = null;
  let tgtObj = null;

  // 根据显式的 sourceType / targetType 判断，而不是靠 kind 字符串猜
  srcObj = state.sourceType === "token"
    ? canvas.tokens.get(state.sourceId)
    : canvas.tiles.get(state.sourceId);

  tgtObj = state.targetType === "token"
    ? canvas.tokens.get(state.targetId)
    : canvas.tiles.get(state.targetId);

  console.log("laser-loop fireLoop state =", state, "src =", srcObj, "tgt =", tgtObj);

  if (!srcObj || !tgtObj) {
    await game.user.unsetFlag(MODULE_ID, FLAG_KEY);
    ui.notifications.warn("激光连发已停止：起点或终点已不存在。");
    return;
  }

  const seq = new Sequence()
    .effect()
      .file(LASER_PATH)
      .attachTo(srcObj)
      .stretchTo(tgtObj);

  await seq.play();

  await new Promise(r => setTimeout(r, INTERVAL_MS));
  fireLoop();
}

// 启动第一轮
fireLoop();