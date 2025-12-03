const MOD_ID = "door-cutin";

Hooks.once("init", () => {
  console.log(`${MOD_ID} | init`);

  // 注册设置
  game.settings.register(MOD_ID, "debug", {
    name: "DoorCutin Debug",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MOD_ID, "trapNotifyMode", {
    name: "陷阱触发通知模式",
    hint: "玩家踩到陷阱后如何通知",
    scope: "world",
    config: true,
    default: "gm",
    type: String,
    choices: {
      gm: "仅 GM",
      all: "通知所有人（chat）",
      none: "完全不通知"
    }
  });


  // 新增：广播范围设置（只给GM，或给所有人）
  game.settings.register(MOD_ID, "notifyScope", {
    name: "Door Cut-in 广播范围",
    hint: "玩家与门互动时，提示信息发送给谁？",
    scope: "world",
    config: true,
    type: String,
    choices: {
      gm: "仅 DM/GM 可见",
      all: "所有其他玩家和 DM 可见"
    },
    default: "gm"
  });

  // 创建全局命名空间
  window.DoorCutin = {
    MOD_ID,
    log: (...args) => {
      if (game.settings.get(MOD_ID, "debug")) {
        console.log(`${MOD_ID} |`, ...args);
      }
    },
    testLocal: null,
    testForEveryone: null
  };
});


Hooks.once("ready", () => {
  console.log(`${MOD_ID} | ready`);

  // 检查 sequencer
  if (!game.modules.get("sequencer")?.active) {
    ui.notifications.error("DoorCutin requires Sequencer module.");
    return;
  }

  window.DoorCutin.log("Sequencer detected.");

  // 绑定测试函数
  window.DoorCutin.testLocal = testCutinLocal;
  window.DoorCutin.testForEveryone = testCutinForEveryone;

  // 安装 Tile 点击触发器
  installTileClickTrigger();

  // 安装 socket 监听，用于接收玩家门操作广播
  game.socket.on(`module.${MOD_ID}`, data => {
    if (!data || !data.type) return;

    if (data.type === "door-choice") {
      handleDoorChoiceNotification(data);
    } else if (data.type === "trap-trigger") {
      handleTrapNotification(data);
    }
  });

  // 只给 GM 增加一个墙体工具栏按钮：批量启用/禁用选中门的 DoorCutin
  if (game.user.isGM) {
    Hooks.on("getSceneControlButtons", addDoorCutinWallTool);
  }

  window.DoorCutin.enableSelectedDoor = async function() {
    const wall = canvas.walls.controlled[0]?.document;
    if (!wall) return ui.notifications.warn("DoorCutin：请先选中一扇门。");
    const cfg = wall.getFlag(MOD_ID, "doorCutin") ?? {};
    const newCfg = foundry.utils.duplicate(cfg);
    newCfg.enabled = true;
    await wall.setFlag(MOD_ID, "doorCutin", newCfg);
    ui.notifications.info("已为选中门重新启用 DoorCutin。");
  };

  window.DoorCutin.disableSelectedDoor = async function() {
    const wall = canvas.walls.controlled[0]?.document;
    if (!wall) return ui.notifications.warn("DoorCutin：请先选中一扇门。");
    const cfg = wall.getFlag(MOD_ID, "doorCutin") ?? {};
    const newCfg = foundry.utils.duplicate(cfg);
    newCfg.enabled = false;
    await wall.setFlag(MOD_ID, "doorCutin", newCfg);
    ui.notifications.info("已为选中门禁用 DoorCutin（变回普通门）。");
  };
});

/* ================= Door Interaction ================= */

Hooks.on("preUpdateWall", (wallDoc, change, options, userId) => {
  console.log("door-cutin | preUpdateWall fired:", {
    wallId: wallDoc.id,
    doorMode: wallDoc.door,
    currentDs: wallDoc.ds,
    change,
    options
  });

  // 不是门就不管
  if (wallDoc.door === 0) return;

  // 我们自己触发的 update，直接放行
  if (options?.doorCutinBypass) {
    console.log("door-cutin | bypass doorCutin for this update");
    return;
  }

  if (!("ds" in change)) return;

  const targetState = change.ds;

  // 关门直接放行
  if (targetState === 0) {
    console.log("door-cutin | door is being closed, skip cutin");
    return;
  }

  // 读取配置
  const cfg = wallDoc.getFlag(MOD_ID, "doorCutin");
  console.log("door-cutin | doorCutin flag:", cfg);

  if (!cfg || !cfg) {
    console.log("door-cutin | door has no doorCutin config, skip");
    return;
  }

  // 关键：如果 enabled === false，则完全当普通门处理
  if (cfg.enabled === false) {
    console.log("door-cutin | cutin disabled for this door, skip");
    return;
  }

  if (userId !== game.user.id) {
    console.log("door-cutin | update from other user, skip local UI");
    return;
  }

  window.DoorCutin.log("[DoorCutin] Door interaction detected, cfg:", cfg);

  handleDoorInteraction(wallDoc, targetState, cfg);

  console.log("door-cutin | blocking door open (waiting for choice)");
  return false;
});


/**
 *
 * @param {WallDocument} wallDoc         这扇门的文档
 * @param {number} targetState           这次点击本来要去的 ds（打开状态）
 * @param {object} cfg                   doorCutin flag 配置
 * 处理门的交互：
 * - 先弹出带图片的对话框
 * - 按钮对应不同检定：轻推=Stealth，一脚踹开=Strength
 * - 成功：播放对应特写 + 打开门
 * - 失败：弹出“失败”提示，不开门，不播视频
 * - 离开：播放离开特写，不开门
 *
 * cfg 支持字段（都可选）：
 *   preview        // 弹窗里的静态图
 *   video / sound  // 通用特写
 *   videoSoft / soundSoft   // 轻推成功特写
 *   videoHard / soundHard   // 踹门成功特写
 *   videoLeave / soundLeave // 离开特写
 *   dcSoft, dcHard          // 检定 DC（不填默认 15）
 */
async function handleDoorInteraction(wallDoc, targetState, cfg) {
  const token = canvas.tokens.controlled[0];
  const actor = token?.actor;
  if (!actor) {
    ui.notifications.warn("DoorCutin：请先选中一个角色 Token 再尝试开门。");
    return;
  }

  const enableSoft  = cfg.enableSoft  !== false;
  const enableHard  = cfg.enableHard  !== false;
  const enableLeave = cfg.enableLeave !== false;

  if (!enableSoft && !enableHard && !enableLeave) {
    console.log("door-cutin | no actions enabled, open door normally");
    await setDoorCutinEnabled(wallDoc, false);
    await wallDoc.update({ ds: targetState }, { doorCutinBypass: true });
    return;
  }

  const dcSoft = Number.isFinite(cfg.dcSoft) ? cfg.dcSoft : 15;
  const dcHard = Number.isFinite(cfg.dcHard) ? cfg.dcHard : 15;

  const softLabel    = cfg.softLabel    || "轻轻推开（潜行）";
  const softRollType = cfg.softRollType || "skill";
  const softRollKey  = cfg.softRollKey  || "ste";

  const hardLabel    = cfg.hardLabel    || "一脚踹开（力量）";
  const hardRollType = cfg.hardRollType || "ability";
  const hardRollKey  = cfg.hardRollKey  || "str";

  const leaveLabel   = cfg.leaveLabel   || "转身离开";

  const softVideo  = cfg.videoSoft  || cfg.video;
  const softSound  = cfg.soundSoft  || cfg.sound || null;
  const hardVideo  = cfg.videoHard  || cfg.video;
  const hardSound  = cfg.soundHard  || cfg.sound || null;
  const leaveVideo = cfg.videoLeave || cfg.video;
  const leaveSound = cfg.soundLeave || cfg.sound || null;

  const softSuccessText = cfg.softSuccessText || `${softLabel} 成功。`;
  const softFailText    = cfg.softFailText    || `${softLabel} 失败（DC ${dcSoft}）。`;
  const hardSuccessText = cfg.hardSuccessText || `${hardLabel} 成功。`;
  const hardFailText    = cfg.hardFailText    || `${hardLabel} 失败（DC ${dcHard}）。`;

  const softCloseOnSuccess = cfg.softCloseOnSuccess !== false; // 默认 true
  const softCloseOnFail    = cfg.softCloseOnFail    !== false; // 默认 true
  const hardCloseOnSuccess = cfg.hardCloseOnSuccess !== false; // 默认 true
  const hardCloseOnFail    = !!cfg.hardCloseOnFail;            // 默认 false

  const preview = cfg.preview || "";
  const imgHtml = preview
    ? `<img src="${preview}" style="width:100%;max-height:360px;object-fit:cover;border-radius:8px;margin-bottom:8px;">`
    : "";

  const bodyText = (cfg.description && cfg.description.trim())
    ? cfg.description.trim()
    : "这扇门看起来有点可疑……";

  const hintLines = [];
  if (enableSoft)  hintLines.push(`${softLabel}：DC ${dcSoft}`);
  if (enableHard)  hintLines.push(`${hardLabel}：DC ${dcHard}`);
  if (enableLeave) hintLines.push(`${leaveLabel}：悄悄离开这里。`);
  const hintHtml = hintLines.length
    ? `<p style="font-size:0.9em;color:#ccc;">${hintLines.join("<br>")}</p>`
    : "";

  return new Promise(resolve => {
    const content = `
      <div style="max-height:480px;overflow-y:auto;">
        ${imgHtml}
        <p>${bodyText}</p>
        ${hintHtml}
      </div>
    `;

    const buttons = {};

    // 轻推
    if (enableSoft) {
      buttons.soft = {
        label: softLabel,
        callback: async () => {
          notifyDoorChoice("soft", actor, softLabel);

          let success = true;
          if (softRollType !== "none") {
            success = await rollDoorCheck(actor, {
              type: softRollType === "skill" ? "skill" : "ability",
              key: softRollKey,
              dc: dcSoft,
              label: softLabel
            });
          }

          if (success) {
            if (softVideo) testCutinLocal(softVideo, softSound);
            if (softSuccessText) {
              await showDoorMessageDialog("你成功了", softSuccessText);
            }

            if (softCloseOnSuccess) {
              await setDoorCutinEnabled(wallDoc, false);
            }

            // 轻推成功：规则上仍视为门是关着（方便 Perceptive 控角度）
          } else {
            const msg = softFailText || `${softLabel} 失败（DC ${dcSoft}）。`;
            await showDoorMessageDialog("你失败了", msg);

            // 失败依旧：推门失败但门还是开了 + 可选关闭 DoorCutin
            if (softCloseOnFail) {
              await setDoorCutinEnabled(wallDoc, false);
            }
            await wallDoc.update({ doorCutinBypass: true }); //{ ds: targetState },
          }

          resolve("soft");
        }
      };
    }

    // 踹门
    if (enableHard) {
      buttons.hard = {
        label: hardLabel,
        callback: async () => {
          notifyDoorChoice("hard", actor, hardLabel);

          let success = true;
          if (hardRollType !== "none") {
            success = await rollDoorCheck(actor, {
              type: hardRollType === "skill" ? "skill" : "ability",
              key: hardRollKey,
              dc: dcHard,
              label: hardLabel
            });
          }

          if (success) {
            if (hardVideo) testCutinLocal(hardVideo, hardSound);
            if (hardSuccessText) {
              await showDoorMessageDialog("你成功了", hardSuccessText);
            }

            if (hardCloseOnSuccess) {
              await setDoorCutinEnabled(wallDoc, false);
            }
            await wallDoc.update({ ds: targetState }, { doorCutinBypass: true });
          } else {
            const msg = hardFailText || `${hardLabel} 失败（DC ${dcHard}）。`;
            await showDoorMessageDialog("你失败了", msg);

            if (hardCloseOnFail) {
              await setDoorCutinEnabled(wallDoc, false);
            }
            // 失败时保留原逻辑：门不打开
          }

          resolve("hard");
        }
      };
    }

    // 离开
    if (enableLeave) {
      buttons.leave = {
        label: leaveLabel,
        callback: () => {
          notifyDoorChoice("leave", actor, leaveLabel);
          if (leaveVideo) testCutinLocal(leaveVideo, leaveSound);
          resolve("leave");
        }
      };
    }

    const d = new Dialog({
      id: "door-cutin-dialog",
      title: "你打算怎么开门？",
      content,
      buttons,
      default: enableSoft ? "soft" : (enableHard ? "hard" : "leave"),
      close: () => resolve("close")
    },{
      width: "auto",      // 或 640 / 700 都行，看你喜好
      height: "auto",  // 高度自适应
      resizable: true  // 允许你手动拖拽
    });

    d.render(true);
  });
}




/**
 * 玩家做门的选择时，通过 socket 广播给 DM / 其他玩家
 * choice: "soft" | "hard" | "leave"
 */
function notifyDoorChoice(choice, actor, label) {
  try {
    game.socket.emit(`module.${MOD_ID}`, {
      type: "door-choice",
      choice,
      label,
      actorName: actor?.name || game.user.name,
      userId: game.user.id
    });
  } catch (e) {
    console.error("door-cutin | notifyDoorChoice error:", e);
  }
}


/**
 * 做一次检定：
 *  - type: "skill" 用 rollSkill；"ability" 用 rollAbilityTest
 *  - key:  技能键（如 "ste"）或能力键（如 "str"）
 *  返回：true=成功，false=失败
 */
async function rollDoorCheck(actor, { type, key, dc, label }) {
  let roll;

  try {
    if (game.system.id === "dnd5e") {
      if (type === "skill" && actor.rollSkill) {
        roll = await actor.rollSkill(key, { fastForward: true });
      } else if (type === "ability" && actor.rollAbilityTest) {
        roll = await actor.rollAbilityTest(key, { fastForward: true });
      }
    }

    // 其他系统 / 兼容兜底：1d20 检定
    if (!roll) {
      roll = await (new Roll("1d20")).roll({ async: true });
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: `DoorCutin 检定: ${label}`
      });
    }
  } catch (e) {
    console.error("DoorCutin | rollDoorCheck error:", e);
    return true; // 出错就当成功，避免卡死
  }

  const total = roll.total ?? 999;
  return total >= dc;
}

/**
 * 简单“失败了”提示对话框
 */
async function showDoorMessageDialog(title, message) {
  return new Promise(resolve => {
    new Dialog({
      title,
      content: `<p>${message}</p>`,
      buttons: {
        ok: {
          label: "OK",
          callback: () => resolve(true)
        }
      },
      default: "ok"
    }).render(true);
  });
}

// 兼容旧调用
async function showDoorFailDialog(message) {
  return showDoorMessageDialog("你失败了", message);
}


async function setDoorCutinEnabled(wallDoc, enabled) {
  const cfg = wallDoc.getFlag(MOD_ID, "doorCutin") ?? {};
  const newCfg = foundry.utils.mergeObject(cfg, { enabled }, { inplace: false });
  console.log("door-cutin | setDoorCutinEnabled:", wallDoc.id, enabled, newCfg);
  await wallDoc.setFlag(MOD_ID, "doorCutin", newCfg);
}

/*
 * 本地播放特写（视频 + 可选音效）
 * @param {string} videoFile  视频路径
 * @param {string|null} soundFile  音效路径（可选）
 */
function testCutinLocal(videoFile, soundFile = null) {
  if (!videoFile) return ui.notifications.warn("No video path given.");

  window.DoorCutin.log("Play LOCAL cut-in:", videoFile, "sound:", soundFile);

  const seq = new Sequence()
    .effect()
      .file(videoFile)
      .screenSpace(true)
      .fadeIn(300)
      .fadeOut(300)
      .zIndex(99999);

  if (soundFile) {
    seq.sound()
      .file(soundFile)
      .volume(0.8)        // 音量你可以自己调
      .fadeInAudio(200)
      .fadeOutAudio(200);
  }

  seq.play({ broadcast: false });   // 只自己看、自己听
}

/**
 * 向所有在线玩家播放特写（视频 + 可选音效）
 * @param {string} videoFile
 * @param {string|null} soundFile
 */
function testCutinForEveryone(videoFile, soundFile = null) {
  if (!videoFile) return ui.notifications.warn("No video path given.");

  window.DoorCutin.log("Broadcast cut-in to EVERYONE:", videoFile, "sound:", soundFile);

  const seq = new Sequence()
    .effect()
      .file(videoFile)
      .screenSpace(true)
      .fadeIn(300)
      .fadeOut(300)
      .zIndex(99999)
    .forEveryone();

  if (soundFile) {
    seq.sound()
      .file(soundFile)
      .volume(0.8)
      .fadeInAudio(200)
      .fadeOutAudio(200);
  }

  seq.play();
}

/**
 * 给所有 Tile 装上 click 事件，如果该 Tile 带有我们的 flag，就播放 Cut-in
 */
/* ================= Step2: Tile 点击触发 ================= */

function installTileClickTrigger() {
  // 给当前场景里已经存在的所有 Tile 绑定事件
  if (canvas?.tiles) {
    console.log("door-cutin | installing tile triggers for",
      canvas.tiles.placeables.length, "tiles");
    for (const tile of canvas.tiles.placeables) {
      makeTileClickable(tile);
    }
  } else {
    console.log("door-cutin | no canvas.tiles found");
  }

  // 对之后新绘制的 Tile 也绑定一次
  Hooks.on("drawTile", tile => {
    console.log("door-cutin | drawTile -> make clickable", tile.id);
    makeTileClickable(tile);
  });
}

function makeTileClickable(tile) {
  // 让 Tile 能接收指针事件
  tile.interactive = true;
  tile.cursor = "pointer";

  // 先解绑旧的，再绑新的，避免重复
  tile.off("pointerdown", onTilePointerDown);
  tile.on("pointerdown", onTilePointerDown);

  console.log("door-cutin | tile clickable:", tile.id);
}

function onTilePointerDown(event) {
  const doc = this.document;
  const cfg = doc.getFlag(MOD_ID, "clickCutin");

  console.log("door-cutin | pointerdown on tile", doc.id, "cfg:", cfg);

  if (!cfg || !cfg.video) return;  // 没配置就啥也不干

  testCutinLocal(cfg.video, cfg.sound || null);  // 只给当前点击者播放
}

/*
 * 在 "Walls" 控制组中增加一个按钮：切换选中门的 DoorCutin 开关
 */
function addDoorCutinWallTool(controls) {
  const walls = controls.find(c => c.name === "walls" || c.id === "walls");
  if (!walls) return;

  walls.tools.push({
    name: "doorcutin-toggle",
    title: "切换 Door Cut-in（启用/禁用选中门）",
    icon: "fas fa-film",
    visible: game.user.isGM,
    onClick: () => {
      const selected = canvas.walls.controlled;
      if (!selected.length) {
        return ui.notifications.warn("DoorCutin：请先在墙体工具中选中至少一扇门。");
      }

      for (const w of selected) {
        const doc = w.document;
        if (doc.door === 0) continue;  // 只管门

        const cfg = doc.getFlag(MOD_ID, "doorCutin") ?? {};
        const currentEnabled = cfg.enabled !== false;   // 未设置时视为启用

        const newCfg = foundry.utils.duplicate(cfg);
        newCfg.enabled = !currentEnabled;

        doc.setFlag(MOD_ID, "doorCutin", newCfg);
      }

      ui.notifications.info("DoorCutin：已切换选中门的启用状态。");
    }
  });
}

/*
 * 处理“某玩家正在对门做什么”的广播提示
 * data: { type: "door-choice", choice, actorName, userId }
 */
function handleDoorChoiceNotification(data) {
  const scope = game.settings.get(MOD_ID, "notifyScope") || "gm";

  // 发起者自己就不用再弹一遍（已经知道自己点了什么）
  if (data.userId === game.user.id) return;

  // 只给 GM 的模式
  if (scope === "gm" && !game.user.isGM) return;

  // choice -> 文案
  let actionText;
  if (data.label) {
    actionText = `选择了【${data.label}】`;
  } else {
    // 兼容旧配置 / 保险兜底
    switch (data.choice) {
      case "soft":
        actionText = "正在尝试轻轻推开这扇门";
        break;
      case "hard":
        actionText = "正在尝试用力撞开这扇门";
        break;
      case "leave":
        actionText = "选择转身离开这扇门";
        break;
      default:
        actionText = "正在对一扇门进行操作";
    }
  }

  const content = `<p><b>${data.actorName}</b> ${actionText}。</p>`;

  new Dialog({
    title: "门边的动静",
    content,
    buttons: {
      ok: {
        label: "知道了",
        callback: () => {}
      }
    },
    default: "ok"
  }, {
    width: 360
  }).render(true);
}

/* ================= 广播陷阱触发 ================= */

// ========== 播放陷阱触发特写，并广播给 GM / 所有人 ==========

/**
 * 处理“某玩家踩到了陷阱”的广播提示
 * data: { type: "trap-trigger", actorName, tileName, mode, userId }
 */
function handleTrapNotification(data) {
  const scope = game.settings.get(MOD_ID, "notifyScope") || "gm";

  // 自己触发的就不用再提示自己了
  if (data.userId === game.user.id) return;

  // 只给 GM 的模式
  if (scope === "gm" && !game.user.isGM) return;

  let actionText = "";
  if (data.mode === "repeat") {
    actionText = "触发了一个可重复的陷阱";
  } else {
    actionText = "触发了一个陷阱";
  }

  const tilePart = data.tileName ? `（${data.tileName}）` : "";
  const content = `<p><b>${data.actorName}</b> ${actionText}${tilePart}。</p>`;

  new Dialog({
    title: "陷阱被触发",
    content,
    buttons: {
      ok: {
        label: "知道了",
        callback: () => {}
      }
    },
    default: "ok"
  }, {
    width: 360
  }).render(true);
}



