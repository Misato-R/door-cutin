// modules/door-cutin/scripts/ui-tile.js
// 在 TileConfig 里添加 “Door Cut-in 陷阱” 设置面板

;(() => {
  const MOD_ID = "door-cutin";

  function debugEnabled() {
    try {
      return game.settings.get(MOD_ID, "debug");
    } catch {
      return false;
    }
  }

  function log(...args) {
    if (debugEnabled()) console.log(`${MOD_ID} | ui-tile |`, ...args);
  }

  Hooks.once("init", () => {
    log("ui-tile loaded");
  });

  Hooks.once("ready", () => {
    if (!game.user.isGM) return;

    Hooks.on("renderTileConfig", (app, html, data) => {
      try {
        // 放大 TileConfig 窗口
        const win = html.closest(".app");
        // 宽一点
        win.css("width", "600px");
        // 内容区域高一点，少滚动
        win.find(".window-content").css("max-height", "900px");
        injectTrapConfig(app, html, data);
        activateFilePickers(app, html);
      } catch (e) {
        console.error("door-cutin | ui-tile render error:", e);
      }
    });
  });

  function injectTrapConfig(app, html, data) {
    const doc = app.object ?? app.document;
    if (!doc) return;

    const cfg = doc.getFlag(MOD_ID, "tileTrap") ?? {};

    const enabled     = cfg.enabled ?? false;
    const mode        = cfg.mode ?? "once";     // once / repeat
    const armed       = cfg.armed ?? true;

    // 两个 ground 特效槽
    const fx1 = cfg.fx1 ?? {};
    const fx2 = cfg.fx2 ?? {};

    const fx1Path = fx1.path ?? "";
    const fx1Loop = !!fx1.loop;
    const fx1Size = Number.isFinite(Number(fx1.size)) ? Number(fx1.size) : 5;

    const fx2Path = fx2.path ?? "";
    const fx2Loop = !!fx2.loop;
    const fx2Size = Number.isFinite(Number(fx2.size)) ? Number(fx2.size) : 5;

    // 兼容旧字段 groundFx（如果 UI 还没配 fx1，就显示出来）
    const legacyGroundFx = cfg.groundFx ?? "";
    const showLegacy = !fx1Path && legacyGroundFx;

    const video       = cfg.video ?? "";
    const sound       = cfg.sound ?? "";
    const saveAbility = cfg.saveAbility ?? "dex";
    const saveDc      = Number.isFinite(cfg.saveDc) ? cfg.saveDc : 15;
    const promptText  = cfg.promptText  ?? "";
    const successText = cfg.successText ?? "";
    const failText    = cfg.failText    ?? "";
    const preview     = cfg.preview     ?? "";

    // 多个宏：既兼容数组，也兼容 {0:"id",1:"id2"} 这种对象
    const rawMacros = cfg.macros ?? [];
    let macros = [];
    if (Array.isArray(rawMacros)) {
      macros = rawMacros.slice();
    } else if (rawMacros && typeof rawMacros === "object") {
      macros = Object.keys(rawMacros)
        .sort((a, b) => Number(a) - Number(b))
        .map(k => rawMacros[k])
        .filter(v => typeof v === "string" && v.length > 0);
    }

    log("renderTileConfig for tile", doc.id, cfg);

    const form = html.find("form");

    // 避免重复注入
    form.find("fieldset.door-cutin-tile-trap").closest(".door-cutin-tile-trap-tab").remove();

    const abilities = [
      { key: "str", label: "STR 力量" },
      { key: "dex", label: "DEX 敏捷" },
      { key: "con", label: "CON 体质" },
      { key: "int", label: "INT 智力" },
      { key: "wis", label: "WIS 感知" },
      { key: "cha", label: "CHA 魅力" }
    ];

    const abilityOptions = abilities.map(a => {
      const sel = a.key === saveAbility ? "selected" : "";
      return `<option value="${a.key}" ${sel}>${a.label}</option>`;
    }).join("");

    // ---------- 宏下拉选项构造函数 ----------
    const scriptMacros = game.macros.contents.filter(m => m.type === "script");
    function buildMacroOptions(selectedId = "") {
      let opts = `<option value="">（不触发宏）</option>`;
      for (const m of scriptMacros) {
        const sel = (m.id === selectedId) ? "selected" : "";
        opts += `<option value="${m.id}" ${sel}>${m.name}</option>`;
      }
      return opts;
    }

    // 已有宏槽的 HTML
    let macroRowsHtml = "";
    for (let i = 0; i < macros.length; i++) {
      const id = macros[i];
      macroRowsHtml += `
        <div class="macro-row" data-index="${i}" style="display:flex;gap:4px;margin-bottom:4px;">
          <select name="flags.${MOD_ID}.tileTrap.macros.${i}" style="flex:1;">
            ${buildMacroOptions(id)}
          </select>
          <button type="button"
                  class="macro-remove"
                  data-index="${i}"
                  title="删除"
                  style="flex:0 0 auto;padding:0 4px;width:22px;min-width:22px;text-align:center;">
            <i class="fas fa-trash"></i>
          </button>
        </div>`;
    }

    // 整个 Door-Cutin 表单块
    const htmlBlock = `
      <fieldset class="door-cutin-tile-trap">
        <legend><i class="fas fa-skull-crossbones"></i> Door Cut-in 陷阱</legend>

        <div class="form-group">
          <label>启用此 Tile 为陷阱</label>
          <input type="checkbox"
                name="flags.${MOD_ID}.tileTrap.enabled"
                ${enabled ? "checked" : ""}>
          <p class="hint">
            勾选后，当角色从 Tile 外踏入此区域时，将触发陷阱逻辑。
          </p>
        </div>

        <div class="form-group">
          <label>触发模式</label>
          <div class="form-fields">
            <select name="flags.${MOD_ID}.tileTrap.mode">
              <option value="once"   ${mode === "once"   ? "selected" : ""}>一次性（触发一次后失效）</option>
              <option value="repeat" ${mode === "repeat" ? "selected" : ""}>重复（每次从外踏入都会触发）</option>
            </select>
          </div>
          <p class="hint">
            “一次性” 模式下，可通过下方“已上弦”复选框重新武装。
          </p>
        </div>

        <div class="form-group">
          <label>已上弦（一次性陷阱）</label>
          <input type="checkbox"
                name="flags.${MOD_ID}.tileTrap.armed"
                ${armed ? "checked" : ""}>
          <p class="hint">
            仅对一次性陷阱生效；不勾选时不会再触发。
          </p>
        </div>

        <hr>

        ${showLegacy ? `
        <div class="form-group">
          <label>旧版脚下特效（只读）</label>
          <input type="text" readonly value="${legacyGroundFx}">
          <p class="hint">
            这是旧版本的 groundFx 字段，新配置请使用下面的特效 1 / 特效 2。
          </p>
        </div>` : ""}

        <div class="form-group">
          <label>特效 1 视频（可选）</label>
          <div class="form-fields">
            <input type="text"
                  name="flags.${MOD_ID}.tileTrap.fx1.path"
                  value="${fx1Path}">
            <button type="button"
                    class="file-picker"
                    data-type="video"
                    data-target="flags.${MOD_ID}.tileTrap.fx1.path">
              <i class="fas fa-file-import"></i>
            </button>
          </div>
          <p class="hint">
            在角色脚下播放的第一个特效，例如火球爆炸。留空则不使用特效 1。
          </p>
          <div class="form-fields" style="margin-top: 4px;">
            <label style="flex:0 0 auto;">循环播放：</label>
            <input type="checkbox"
                  name="flags.${MOD_ID}.tileTrap.fx1.loop"
                  ${fx1Loop ? "checked" : ""}>
            <label style="flex:0 0 auto; margin-left:8px;">边长（格数 x×x）：</label>
            <input type="number"
                  name="flags.${MOD_ID}.tileTrap.fx1.size"
                  value="${fx1Size}"
                  min="1"
                  style="width: 5em;">
          </div>
        </div>

        <div class="form-group">
          <label>特效 2 视频（可选）</label>
          <div class="form-fields">
            <input type="text"
                  name="flags.${MOD_ID}.tileTrap.fx2.path"
                  value="${fx2Path}">
            <button type="button"
                    class="file-picker"
                    data-type="video"
                    data-target="flags.${MOD_ID}.tileTrap.fx2.path">
              <i class="fas fa-file-import"></i>
            </button>
          </div>
          <p class="hint">
            第二个叠加特效，例如烟雾、残留火焰等。留空则不使用特效 2。
          </p>
          <div class="form-fields" style="margin-top: 4px;">
            <label style="flex:0 0 auto;">循环播放：</label>
            <input type="checkbox"
                  name="flags.${MOD_ID}.tileTrap.fx2.loop"
                  ${fx2Loop ? "checked" : ""}>
            <label style="flex:0 0 auto; margin-left:8px;">边长（格数 x×x）：</label>
            <input type="number"
                  name="flags.${MOD_ID}.tileTrap.fx2.size"
                  value="${fx2Size}"
                  min="1"
                  style="width: 5em;">
          </div>
        </div>

        <hr>

        <div class="form-group">
          <label>（可选）全屏 Cut-in 视频</label>
          <div class="form-fields">
            <input type="text"
                  name="flags.${MOD_ID}.tileTrap.video"
                  value="${video}">
            <button type="button"
                    class="file-picker"
                    data-type="video"
                    data-target="flags.${MOD_ID}.tileTrap.video">
              <i class="fas fa-file-import"></i>
            </button>
          </div>
          <p class="hint">
            如果填写，则在脚下特效之外再播放一段全屏 Cut-in。
          </p>
        </div>

        <div class="form-group">
          <label>（可选）全屏音效</label>
          <div class="form-fields">
            <input type="text"
                  name="flags.${MOD_ID}.tileTrap.sound"
                  value="${sound}">
            <button type="button"
                    class="file-picker"
                    data-type="audio"
                    data-target="flags.${MOD_ID}.tileTrap.sound">
              <i class="fas fa-file-import"></i>
            </button>
          </div>
        </div>

        <hr>

        <div class="form-group">
          <label>豁免属性 / DC</label>
          <div class="form-fields">
            <select name="flags.${MOD_ID}.tileTrap.saveAbility">
              ${abilityOptions}
            </select>
            <input type="number"
                  name="flags.${MOD_ID}.tileTrap.saveDc"
                  value="${saveDc}"
                  style="width: 5em;">
          </div>
          <p class="hint">
            仅用于弹窗中的 D&D5e 豁免检定（例如 DEX 豁免 DC 15）。
          </p>
        </div>

        <div class="form-group">
          <label>提示文本</label>
          <textarea name="flags.${MOD_ID}.tileTrap.promptText"
                    rows="2"
                    style="resize: vertical;">${promptText}</textarea>
          <p class="hint">
            第一次弹出的提示，例如：“一颗火球在你脚下爆炸！请进行一次敏捷豁免检定。”
          </p>
        </div>

        <!-- 陷阱图片（可选） -->
        <div class="form-group">
          <label>陷阱图片</label>
          <div class="form-fields">
            <input type="text"
                  name="flags.${MOD_ID}.tileTrap.preview"
                  value="${preview}"
                  placeholder="选择一张图片，作为陷阱弹窗插图">
            <button type="button"
                    class="file-picker"
                    data-type="image"
                    data-target="flags.${MOD_ID}.tileTrap.preview"
                    title="从文件中选择图片">
              <i class="fas fa-file-import"></i>
            </button>
          </div>
          <p class="hint">（可选）这张图片会显示在陷阱豁免弹窗的顶部。</p>
        </div>

        <!-- 触发脚本宏（可选，多条） -->
        <div class="form-group">
          <label>触发宏</label>
          <div class="form-fields" style="flex-direction:column;align-items:flex-start;">
            <div class="macro-list" style="width:100%;">
              ${macroRowsHtml}
            </div>
            <button type="button" class="macro-add" style="margin-top:4px;">
              <i class="fas fa-plus"></i> 添加宏
            </button>
          </div>
          <p class="hint">陷阱触发时会从上到下依次执行这些宏。</p>
        </div>

        <div class="form-group">
          <label>豁免成功文本</label>
          <textarea name="flags.${MOD_ID}.tileTrap.successText"
                    rows="2"
                    style="resize: vertical;">${successText}</textarea>
        </div>

        <div class="form-group">
          <label>豁免失败文本</label>
          <textarea name="flags.${MOD_ID}.tileTrap.failText"
                    rows="2"
                    style="resize: vertical;">${failText}</textarea>
        </div>
      </fieldset>
    `;

    // ========= 关键部分：塞进 Tab =========

    const hasTabs = html.find(".sheet-tabs.tabs").length > 0;
    const contentRoot = html.find(".sheet-body").length
      ? html.find(".sheet-body")
      : form;

    // 我们自己的 tab 容器
    const trapTab = $(`
      <div class="tab door-cutin-tile-trap-tab" data-tab="doorcutin-trap">
        ${htmlBlock}
      </div>`);

    if (hasTabs) {
      // 已经有 Tabs（比如 Monks Active Tiles）
      const nav = html.find(".sheet-tabs.tabs");
      if (!nav.find('[data-tab="doorcutin-trap"]').length) {
        nav.append(
          $(`<a class="item" data-tab="doorcutin-trap">
              <i class="fas fa-skull-crossbones"></i> 陷阱
            </a>`)
        );
      }

      contentRoot.append(trapTab);

      const el = html[0];
      app._tabs = app._createTabHandlers();
      app._tabs.forEach(t => t.bind(el));
    } else {
      // 没有 Tabs：自己造 Basic + 陷阱
      let root = form.length ? form : html;

      const basicTab = $('<div class="tab" data-tab="basic"></div>');
      $('> *:not(button):not(footer)', root).each(function () {
        basicTab.append(this);
      });

      const nav = $(`
        <nav class="sheet-tabs tabs">
          <a class="item active" data-tab="basic">
            <i class="fas fa-image"></i> 基础
          </a>
          <a class="item" data-tab="doorcutin-trap">
            <i class="fas fa-skull-crossbones"></i> 陷阱
          </a>
        </nav>`);

      $(root)
        .prepend(nav)
        .prepend(trapTab)
        .prepend(basicTab);

      app.options.tabs = [{ navSelector: ".tabs", contentSelector: "form", initial: "basic" }];
      app.options.height = "auto";
      const el = html[0];
      app._tabs = app._createTabHandlers();
      app._tabs.forEach(t => t.bind(el));
      app.setPosition();
    }

    // ---------- 绑定宏添加/删除按钮（改成在 trapTab 里找） ----------
    const fieldset = trapTab.find("fieldset.door-cutin-tile-trap");
    const macroListDiv = fieldset.find(".macro-list");

    function bindRemoveHandlers(scope) {
      scope.find("button.macro-remove").each((i, btn) => {
        $(btn).off(".doorcutin").on("click.doorcutin", ev => {
          ev.preventDefault();

          const row   = $(ev.currentTarget).closest(".macro-row");
          const index = row.data("index");
          const formEl = form[0];

          $(`<input type="hidden"
                    name="flags.${MOD_ID}.tileTrap.macros.-=${index}"
                    value="1">`).appendTo(formEl);

          row.remove();
        });
      });
    }

    bindRemoveHandlers(macroListDiv);

    fieldset.find("button.macro-add").off(".doorcutin").on("click.doorcutin", ev => {
      ev.preventDefault();
      const currentCount = macroListDiv.find(".macro-row").length;
      const newIndex = currentCount;
      const newRow = $(`
        <div class="macro-row" data-index="${newIndex}" style="display:flex;gap:4px;margin-bottom:4px;">
          <select name="flags.${MOD_ID}.tileTrap.macros.${newIndex}" style="flex:1;">
            ${buildMacroOptions("")}
          </select>
          <button type="button"
                  class="macro-remove"
                  data-index="${newIndex}"
                  title="删除此宏"
                  style="flex:0 0 auto;padding:0 6px;white-space:nowrap;max-width:4.5rem;">
            <i class="fas fa-trash"></i><span style="margin-left:2px;">删除</span>
          </button>
        </div>
      `);
      macroListDiv.append(newRow);
      bindRemoveHandlers(newRow);
    });
  }



  /**
   * FilePicker 绑定：所有 class="file-picker" + data-target 的按钮通用
   */
  function activateFilePickers(app, html) {
    html.find("button.file-picker").each((i, btn) => {
      const $btn = $(btn);
      const type   = $btn.data("type")   || "video";
      const target = $btn.data("target") || "";
      if (!target) return;

      $btn.off(".doorcutin").on("click.doorcutin", ev => {
        ev.preventDefault();

        const input = html.find(`input[name="${target}"]`);
        const current = input.val();

        const fp = new FilePicker({
          type,
          current,
          callback: path => {
            input.val(path);
            input.trigger("change");
          },
          top: app.position.top + 40,
          left: app.position.left + 10
        });

        fp.browse();
      });
    });
  }
})();
