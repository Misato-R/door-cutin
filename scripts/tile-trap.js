// modules/door-cutin/scripts/tile-trap.js
// 负责“踩 Tile 陷阱 播放特写 + 广播给 GM/所有人 + GM 一键清除特效”

const MOD_ID = "door-cutin";

// 统一判断“这个陷阱现在是否上弦”
// - armed 没设：默认 true（新建时方便测试）
// - false / "false" / 0 / "0"：视为未上弦
// - 其他都当成已上弦
function isTrapArmed(cfg) {
  const v = cfg.armed;

  if (v === undefined || v === null) return true;

  if (v === false || v === "false" || v === 0 || v === "0") {
    return false;
  }

  return true;
}



/** 读取模块里的 debug 开关 */
function debugEnabled() {
  try {
    return game.settings.get(MOD_ID, "debug");
  } catch {
    return false;
  }
}

function trapLog(...args) {
  if (debugEnabled()) {
    console.log(`${MOD_ID} | trap |`, ...args);
  }
}

Hooks.once("ready", () => {
  trapLog("tile trap system ready");
  game.socket.on(`module.${MOD_ID}`, data => {
    if (!data) return;

    // 不是陷阱消息
    if (data.type !== "trap-trigger") return;

    const actorName = data.actorName ?? "Unknown";
    const tileName  = data.tileName  ?? "";
    const mode      = data.mode ?? "";

    const notifyMode = game.settings.get(MOD_ID, "trapNotifyMode") || "gm";

    // 只有 GM 知道
    if (notifyMode === "gm") {
      if (game.user.isGM) {
        ui.notifications.info(`${actorName} 触发了陷阱「${tileName}」 (${mode})`);
      }
      return;
    }

    // 所有人都知道
    if (notifyMode === "all") {
      ChatMessage.create({
        speaker: { alias: "陷阱系统" },
        content: `<b>${actorName}</b> 触发了陷阱：<b>${tileName}</b> (${mode})`
      });
      return;
    }

    // none → 完全静默
  });
});

Hooks.on("canvasReady", () => {
  trapLog("tile trap | canvasReady");
});

/**
 * 使用 preUpdateToken：
 * 用 tokenDoc 的旧坐标 和 change 里的新坐标，判断
 * “这一脚是不是从 tile 外 → tile 内（发生矩形相交）”
 */
Hooks.on("preUpdateToken", (tokenDoc, change, options, userId) => {
  if (!canvas?.scene) return;

  // 没有真的移动就不处理
  if (!("x" in change) && !("y" in change)) return;

  // 只让发起这次移动的客户端去算陷阱
  if (userId !== game.user.id) return;

  const gridSize = canvas.grid.size ?? 100;
  const w = (tokenDoc.width  ?? 1) * gridSize;
  const h = (tokenDoc.height ?? 1) * gridSize;

  // 旧位置（这一步开始前）
  const fromRect = {
    x: tokenDoc.x,
    y: tokenDoc.y,
    w,
    h
  };

  // 新位置（这一步走到哪）
  const toRect = {
    x: change.x ?? tokenDoc.x,
    y: change.y ?? tokenDoc.y,
    w,
    h
  };

  trapLog("preUpdateToken move", {
    tokenId: tokenDoc.id,
    from: { x: fromRect.x, y: fromRect.y },
    to:   { x: toRect.x,   y: toRect.y }
  });

  // 遍历所有配置了陷阱的 Tile
  for (const tile of canvas.tiles.placeables) {
    const cfg = tile.document.getFlag(MOD_ID, "tileTrap");
    if (!cfg || cfg.enabled === false) continue;

    const mode  = cfg.mode || "once";
    const armed = isTrapArmed(cfg);

    // 所有模式都尊重 armed；未上弦就不触发
    if (!armed) {
      trapLog("trap | skip (disarmed)", {
        tileId: tile.id,
        tileName: tile.document.name,
        mode,
        rawArmed: cfg.armed
      });
      continue;
    }


    const wasInside = rectIntersectsTile(fromRect, tile);
    const insideNow = rectIntersectsTile(toRect,   tile);

    trapLog("trap | check tile", {
      tileId: tile.id,
      tileName: tile.document.name,
      wasInside,
      insideNow
    });

    // ✅ 只有“上一格不相交 & 这一格相交”时才触发
    if (!wasInside && insideNow) {
      handleTrapTrigger(tile, cfg, tokenDoc, userId);
    }
  }
});


/** 判断 token 矩形是否与 tile 矩形相交 */
function rectIntersectsTile(tokenRect, tile) {
  const tx = tile.document.x;
  const ty = tile.document.y;
  const tw = tile.document.width;
  const th = tile.document.height;

  const tRight  = tx + tw;
  const tBottom = ty + th;

  const aLeft   = tokenRect.x;
  const aTop    = tokenRect.y;
  const aRight  = tokenRect.x + tokenRect.w;
  const aBottom = tokenRect.y + tokenRect.h;

  const separated =
    aRight  <= tx      || // token 在 tile 左
    aLeft   >= tRight  || // token 在 tile 右
    aBottom <= ty      || // token 在 tile 上
    aTop    >= tBottom;   // token 在 tile 下

  return !separated;
}

/**
 * 真正处理陷阱触发：
 *  - once 模式：armed -> false
 *  - 脚下 Sequencer 特效（支持两个 fx，loop + size，带命名）
 *  - （可选）全屏 cut-in
 *  - 豁免弹窗
 *  - 广播
 */
// 真正处理陷阱触发：
//  - once 模式：armed -> false
//  - 脚下 Sequencer 特效（支持两个 fx，loop + size）
//  - （可选）全屏 cut-in
//  - 触发多个 Script 宏（带上下文）
//  - 豁免弹窗
//  - 广播
async function handleTrapTrigger(tile, cfg, tokenDoc, userId) {
  const mode  = cfg.mode  || "once";   // 'once' / 'repeat'
  const video = cfg.video || null;     // 可选：全屏 cut-in
  const sound = cfg.sound || null;
  const actor = tokenDoc.actor;

  trapLog("handleTrapTrigger", {
    tileId: tile.id,
    tileName: tile.document.name,
    mode,
    cfg,
    actor: actor?.name
  });

  // 1 一次性陷阱：触发后 disarm
  if (mode === "once") {
    const newCfg = foundry.utils.mergeObject(
      cfg,
      { armed: false },
      { inplace: false }
    );
    await tile.document.setFlag(MOD_ID, "tileTrap", newCfg);
    trapLog("trap disarmed (once mode)", { tileId: tile.id });
  }

  const tokenObj = canvas.tokens.get(tokenDoc.id);

  // 2 脚下爆炸 / 特效（fx1 / fx2 + loop + size）
  if (userId === game.user.id && typeof Sequence !== "undefined" && tokenObj) {
    const fxList = [];

    if (cfg.fx1?.path) {
      fxList.push({
        index: 1,
        path : cfg.fx1.path,
        loop : !!cfg.fx1.loop,
        size : Number(cfg.fx1.size) || 5
      });
    }
    if (cfg.fx2?.path) {
      fxList.push({
        index: 2,
        path : cfg.fx2.path,
        loop : !!cfg.fx2.loop,
        size : Number(cfg.fx2.size) || 5
      });
    }

    // 兼容旧字段 groundFx：当 fx1/fx2 都没配时用它
    if (!fxList.length && cfg.groundFx) {
      fxList.push({
        index: 1,
        path : cfg.groundFx,
        loop : false,
        size : 5
      });
    }

    if (fxList.length) {
      try {
        for (const fx of fxList) {
          const size = fx.size || 5;
          const loop = !!fx.loop;
          const path = fx.path;
          if (!path) continue;

          const effectName = `doorcutin-tilefx-${tile.id}-${fx.index}`;

          // 循环特效先结束旧的，避免叠加
          if (loop && typeof Sequencer !== "undefined" && Sequencer.EffectManager) {
            await Sequencer.EffectManager.endEffects({ name: effectName });
          }

          const seq = new Sequence();
          let eff = seq.effect()
            .file(path)
            .atLocation(tokenObj)
            .scaleToObject(size)      // 约等于 size×size 格
            .belowTokens(false);

          if (loop) {
            eff = eff
              .name(effectName)
              .persist();
          }

          await seq.play({ broadcast: false });
        }
      } catch (e) {
        console.error("door-cutin | ground fx error:", e);
      }
    }
  }

  // 3 可选：全屏 Cut-in
  if (userId === game.user.id && window.DoorCutin?.testLocal && video) {
    window.DoorCutin.testLocal(video, sound);
  }

  // 4 执行用户选中的 Script 宏（支持多个）
  const macroIds = [];

  // 新字段：macros 数组（UI 里的「触发宏（无限个）」）
  if (Array.isArray(cfg.macros)) {
    macroIds.push(...cfg.macros.filter(Boolean));
  } else if (cfg.macros && typeof cfg.macros === "object") {
    const arr = Object.keys(cfg.macros)
      .sort((a, b) => Number(a) - Number(b))
      .map(k => cfg.macros[k])
      .filter(Boolean);
    macroIds.push(...arr);
  }

  // 兼容旧字段：macroId / macro1 / macro2 / macro3
  if (cfg.macroId) macroIds.push(cfg.macroId);
  if (cfg.macro1)  macroIds.push(cfg.macro1);
  if (cfg.macro2)  macroIds.push(cfg.macro2);
  if (cfg.macro3)  macroIds.push(cfg.macro3);

  // 去重，避免同一个宏被选了两次
  const uniqueMacroIds = [...new Set(macroIds)];

  // 把本次陷阱上下文挂到全局，给宏 / 激光脚本用
  window.DoorCutin = window.DoorCutin || {};
  window.DoorCutin.lastTrapCtx = {
    tile,
    tileId:   tile.id,
    tileUuid: tile.document.uuid,

    token:    tokenObj || null,
    tokenId:  tokenDoc.id,
    tokenUuid: tokenDoc.uuid,

    cfg,
    mode,
    userId
  };

  for (const mid of uniqueMacroIds) {
    const macro = game.macros.get(mid);
    if (!macro) {
      console.warn(`door-cutin | macroId=${mid} 未找到对应宏`);
      continue;
    }

    try {
      trapLog("trap | executing macro", { macroId: mid, macroName: macro.name });

      // 作为 args[0] 传进去，同时宏也可以从 window.DoorCutin.lastTrapCtx 读取
      await macro.execute(window.DoorCutin.lastTrapCtx);

    } catch (e) {
      console.error("door-cutin | trap macro error:", e);
    }
  }

  // 5 弹出“豁免 / 说明”对话框
  if (userId === game.user.id && actor) {
    await showTrapSaveDialog(actor, cfg);
  }

  // 6 广播给 GM / 其他玩家
  notifyTrapTriggered(actor, tile, mode);
}



/**
 * 弹出第一次提示对话框：
 *   - 文案：cfg.promptText
 *   - 按钮：进行豁免检定
 * 之后根据检定结果，再弹出成功/失败的结果对话框。
 */
async function showTrapSaveDialog(actor, cfg) {
  const saveAbility = cfg.saveAbility || "dex";    
  const saveDc      = Number(cfg.saveDc) || 15;
  const promptText  = cfg.promptText  || "一颗火球在你脚下爆炸！请进行一次敏捷豁免检定。";
  const successText = cfg.successText || "你敏捷地闪到一旁，只受到了极小的伤害。";
  const failText    = cfg.failText    || "你被火焰吞没，感到一阵剧痛！（伤害由 DM 掷骰）";
  const preview     = cfg.preview     || null;  // 图片路径

  // 图片区域
  const imgHtml = preview
    ? `<div style="text-align:center;margin-bottom:8px;">
         <img src="${preview}" style="max-width:100%;max-height:350px;object-fit:cover;border-radius:6px;">
       </div>`
    : "";

  // 有图就高一点，没有图就矮一点
  const dialogWidth  = preview ? 450 : 380;
  const dialogHeight = preview ? 450 : 200;

  return new Promise(resolve => {
    // 第一层：提示+按钮
    const d = new Dialog({
      title: "陷阱触发！",
      content: `
        <div style="max-height:100%;overflow-y:auto;">
          ${imgHtml}
          <p>${promptText}</p>
        </div>
      `,
      buttons: {
        save: {
          label: `进行豁免检定 (DC ${saveDc})`,
          callback: async () => {
            const success = await rollTrapSave(actor, { ability: saveAbility, dc: saveDc });

            const msg = success ? successText : failText;
            const resultTitle = success ? "豁免成功" : "豁免失败";

            // 第二层：结果弹窗
            new Dialog({
              title: resultTitle,
              content: `
                <div style="max-height:100%;overflow-y:auto;">
                  ${imgHtml}
                  <p>${msg}</p>
                </div>
              `,
              buttons: {
                ok: {
                  label: "确定",
                  callback: () => resolve(success)
                }
              },
              default: "ok"
            }, {
              width: dialogWidth,
              height: dialogHeight
            }).render(true);
          }
        }
      },
      default: "save"
    }, {
      width: dialogWidth,
      height: dialogHeight
    });

    d.render(true);
  });
}


/**
 * 进行一次 D&D5e 能力豁免检定：
 *   - ability: "dex" / "str" / "con" ...
 *   - dc: 难度
 * 返回 true=成功, false=失败
 */
async function rollTrapSave(actor, { ability, dc }) {
  let roll = null;

  try {
    if (game.system.id === "dnd5e" && actor.rollAbilitySave) {
      roll = await actor.rollAbilitySave(ability, { fastForward: true });
    }

    // 兜底：如果系统不是 dnd5e 或方法不存在，就用 1d20
    if (!roll) {
      roll = await (new Roll("1d20")).roll({ async: true });
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: `Trap Save (${ability.toUpperCase()})`
      });
    }
  } catch (e) {
    console.error("door-cutin | rollTrapSave error:", e);
    // 出错时为了不卡死流程，直接当成功
    return true;
  }

  const total = roll.total ?? 999;
  return total >= dc;
}

/** 通过 socket 广播“某某触发了陷阱” */
function notifyTrapTriggered(actor, tile, mode) {
  try {
    game.socket.emit(`module.${MOD_ID}`, {
      type: "trap-trigger",
      actorName: actor?.name || game.user.name,
      tileName: tile.document.name || "",
      mode,
      userId: game.user.id
    });
  } catch (e) {
    console.error("door-cutin | trap notify error:", e);
  }
}

/**
 * GM 工具用：清除一个 Tile 上所有 DoorCutin 循环特效
 * 会结束名字为 doorcutin-tilefx-<tileId>-1/2/... 的特效
 */
async function clearTileDoorCutinFX(tileDoc) {
  if (typeof Sequencer === "undefined" || !Sequencer?.EffectManager) {
    ui.notifications.warn("Sequencer 未加载，无法结束特效。");
    return;
  }

  const tileId = tileDoc.id;
  let total = 0;

  // 目前我们支持 fx1 / fx2，就按 1、2 两个名字去清理
  for (let i = 1; i <= 2; i++) {
    const name = `doorcutin-tilefx-${tileId}-${i}`;
    const existing = Sequencer.EffectManager.getEffects({ name }) || [];
    if (existing.length) {
      await Sequencer.EffectManager.endEffects({ name });
      total += existing.length;
    }
  }

  if (total === 0) {
    ui.notifications.info("当前 Tile 上没有 DoorCutin 循环特效。");
  } else {
    ui.notifications.info(`已清除当前 Tile 上 ${total} 个 DoorCutin 循环特效。`);
  }
}

/**
 * 在 Tiles 工具栏增加一个按钮：
 *   GM 选中一个或多个 Tile → 点击按钮 → 清除这些 Tile 上的 DoorCutin FX
 */
Hooks.on("getSceneControlButtons", controls => {
  if (!game.user.isGM) return;

  const tiles = controls.find(c => c.name === "tiles" || c.id === "tiles");
  if (!tiles) return;

  tiles.tools.push({
    name: "doorcutin-clear-tile-fx",
    title: "清除选中 Tile 的 DoorCutin 特效",
    icon: "fas fa-burst",
    visible: true,
    button: true,
    onClick: async () => {
      const selected = canvas.tiles.controlled;
      if (!selected.length) {
        return ui.notifications.warn("DoorCutin：请先选中至少一个 Tile。");
      }

      for (const t of selected) {
        await clearTileDoorCutinFX(t.document);
      }
    }
  });
});
