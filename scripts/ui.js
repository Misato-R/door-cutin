// ui.js —— Door Cut-in 的墙体配置 UI（Tab 版）

Hooks.on("renderWallConfig", (app, html, data) => {
  const wall = app.object ?? app.document;
  // 只对“门”生效
  if (!wall || wall.door === 0) return;

  console.log("door-cutin | renderWallConfig");

  const cfg = wall.getFlag("door-cutin", "doorCutin") ?? {};

  const preview      = cfg.preview      || "";
  const desc         = cfg.description  || "";

  // 轻推配置
  const softEnabled  = cfg.enableSoft  !== false;  // 默认启用
  const softVideo    = cfg.videoSoft   || "";
  const softSound    = cfg.soundSoft   || "";
  const softDc       = Number.isFinite(cfg.dcSoft) ? cfg.dcSoft : "";
  const softLabel    = cfg.softLabel   || "轻轻推开（潜行）";
  const softRollType = cfg.softRollType || "skill"; // none | skill | ability
  const softRollKey  = cfg.softRollKey  || "ste";

  const softSuccessText = cfg.softSuccessText || "";
  const softFailText    = cfg.softFailText    || "";
  const softCloseOnSuccess = cfg.softCloseOnSuccess !== false;
  const softCloseOnFail    = cfg.softCloseOnFail    !== false;

  // 踹门配置
  const hardEnabled  = cfg.enableHard  !== false;
  const hardVideo    = cfg.videoHard   || "";
  const hardSound    = cfg.soundHard   || "";
  const hardDc       = Number.isFinite(cfg.dcHard) ? cfg.dcHard : "";
  const hardLabel    = cfg.hardLabel   || "一脚踹开（力量）";
  const hardRollType = cfg.hardRollType || "ability";
  const hardRollKey  = cfg.hardRollKey  || "str";

  const hardSuccessText = cfg.hardSuccessText || "";
  const hardFailText    = cfg.hardFailText    || "";
  const hardCloseOnSuccess = cfg.hardCloseOnSuccess !== false;
  const hardCloseOnFail    = !!cfg.hardCloseOnFail;

  // 离开配置
  const leaveEnabled  = cfg.enableLeave !== false;
  const leaveLabel    = cfg.leaveLabel  || "转身离开";
  const leaveVideo    = cfg.videoLeave  || "";
  const leaveSound    = cfg.soundLeave  || "";
  const leaveSuccessText = cfg.leaveSuccessText || "";
  const leaveFailText    = cfg.leaveFailText    || "";
  const leaveCloseOnSuccess = !!cfg.leaveCloseOnSuccess;
  const leaveCloseOnFail    = !!cfg.leaveCloseOnFail;

  const form = html.find("form");
  if (!form.length) return;

  // 如果已经有 Door-Cutin tab，避免重复注入
  if (html.find(".door-cutin-wall-tab").length) return;

  // ===== Door-Cutin 整个表单块 HTML =====
  const blockHtml = `
    <fieldset class="door-cutin-ui-block">
      <legend>
        <i class="fas fa-film"></i>
        Door Cut-in
      </legend>

      <!-- 预览图片路径 -->
      <div class="form-group">
        <label>特写预览图片路径</label>
        <div class="form-fields">
          <input type="text"
                 name="doorcutin-preview"
                 value="${preview}"
                 style="flex:1;">
          <button type="button"
                  class="file-picker"
                  data-type="imagevideo"
                  data-target="doorcutin-preview">
            <i class="fas fa-file-import"></i>
          </button>
        </div>
        <p class="hint">
          Door-Cutin 弹窗顶部显示的图片，例如：<br>
          <code>modules/door-cutin/assets/cutin/images/door_preview.jpg</code>
        </p>
      </div>

      <!-- 描述文本 -->
      <div class="form-group">
        <label>弹窗描述文本</label>
        <div class="form-fields">
          <textarea name="doorcutin-description"
                    rows="3"
                    style="width:100%;resize:vertical;">${desc}</textarea>
        </div>
        <p class="hint">
          显示在 Door-Cutin 对话框中的说明文字，可写气氛描述、提示等。<br>
          若留空，则使用默认文本：“这扇门看起来有点可疑……”
        </p>
      </div>

      <hr>

      <!-- 轻轻推开 -->
      <div class="form-group">
        <label>动作：轻轻推开</label>
        <div class="form-fields" style="display:flex;align-items:center;gap:0.5em;">
          <input type="text"
                 name="doorcutin-soft-label"
                 value="${softLabel}"
                 style="flex:1;">

          <label style="white-space:nowrap;">
            <input type="checkbox" name="doorcutin-soft-enabled" ${softEnabled ? "checked" : ""}>
            启用此按钮
          </label>

          <div style="display:flex;align-items:center;gap:0.25em;">
            <select name="doorcutin-soft-rollType">
              <option value="none"   ${softRollType === "none"   ? "selected" : ""}>不检定</option>
              <option value="skill"  ${softRollType === "skill"  ? "selected" : ""}>技能检定</option>
              <option value="ability"${softRollType === "ability"? "selected" : ""}>属性检定</option>
            </select>
            <input type="text"
                   name="doorcutin-soft-rollKey"
                   value="${softRollKey}"
                   style="width:5em;"
                   placeholder="ste / str 等">
          </div>

          <label style="white-space:nowrap;">
            DC：
            <input type="number"
                   name="doorcutin-soft-dc"
                   value="${softDc}"
                   style="width:4em;">
          </label>
        </div>
      </div>

      <!-- 轻推：成功设置 -->
      <div class="form-group">
        <label>轻推成功时</label>
        <div class="form-fields" style="flex-direction:column;gap:0.25em;">
          <div style="display:flex;align-items:center;gap:0.5em;">
            <span style="white-space:nowrap;">特写视频</span>
            <input type="text"
                   name="doorcutin-soft-video"
                   value="${softVideo}"
                   style="flex:1;">
            <button type="button"
                    class="file-picker"
                    data-type="video"
                    data-target="doorcutin-soft-video">
              <i class="fas fa-file-import"></i>
            </button>
          </div>

          <div style="display:flex;align-items:center;gap:0.5em;">
            <span style="white-space:nowrap;">成功音效</span>
            <input type="text"
                   name="doorcutin-soft-sound"
                   value="${softSound}"
                   style="flex:1;">
            <button type="button"
                    class="file-picker"
                    data-type="audio"
                    data-target="doorcutin-soft-sound">
              <i class="fas fa-file-import"></i>
            </button>
          </div>

          <textarea name="doorcutin-soft-successText"
                    rows="2"
                    style="width:100%;resize:vertical;"
                    placeholder="成功后弹窗内容（可留空，使用默认提示）">${softSuccessText}</textarea>

          <label style="margin-top:0.25em;">
            <input type="checkbox"
                   name="doorcutin-soft-closeOnSuccess"
                   ${softCloseOnSuccess ? "checked" : ""}>
            成功后关闭本门的 Door-Cutin（变成普通门）
          </label>
        </div>
      </div>

      <!-- 轻推：失败设置 -->
      <div class="form-group">
        <label>轻推失败时</label>
        <div class="form-fields" style="flex-direction:column;gap:0.25em;">
          <textarea name="doorcutin-soft-failText"
                    rows="2"
                    style="width:100%;resize:vertical;"
                    placeholder="失败后弹窗内容（可留空，使用默认提示）">${softFailText}</textarea>

          <label>
            <input type="checkbox"
                   name="doorcutin-soft-closeOnFail"
                   ${softCloseOnFail ? "checked" : ""}>
            失败后关闭本门的 Door-Cutin
          </label>
        </div>
      </div>

      <hr>

      <!-- 一脚踹开 -->
      <div class="form-group">
        <label>动作：一脚踹开</label>
        <div class="form-fields" style="display:flex;align-items:center;gap:0.5em;">
          <input type="text"
                 name="doorcutin-hard-label"
                 value="${hardLabel}"
                 style="flex:1;">

          <label style="white-space:nowrap;">
            <input type="checkbox" name="doorcutin-hard-enabled" ${hardEnabled ? "checked" : ""}>
            启用此按钮
          </label>

          <div style="display:flex;align-items:center;gap:0.25em;">
            <select name="doorcutin-hard-rollType">
              <option value="none"   ${hardRollType === "none"   ? "selected" : ""}>不检定</option>
              <option value="skill"  ${hardRollType === "skill"  ? "selected" : ""}>技能检定</option>
              <option value="ability"${hardRollType === "ability"? "selected" : ""}>属性检定</option>
            </select>
            <input type="text"
                   name="doorcutin-hard-rollKey"
                   value="${hardRollKey}"
                   style="width:5em;"
                   placeholder="str / ath 等">
          </div>

          <label style="white-space:nowrap;">
            DC：
            <input type="number"
                   name="doorcutin-hard-dc"
                   value="${hardDc}"
                   style="width:4em;">
          </label>
        </div>
      </div>

      <!-- 踹门：成功设置 -->
      <div class="form-group">
        <label>踹门成功时</label>
        <div class="form-fields" style="flex-direction:column;gap:0.25em;">
          <div style="display:flex;align-items:center;gap:0.5em;">
            <span style="white-space:nowrap;">特写视频</span>
            <input type="text"
                   name="doorcutin-hard-video"
                   value="${hardVideo}"
                   style="flex:1;">
            <button type="button"
                    class="file-picker"
                    data-type="video"
                    data-target="doorcutin-hard-video">
              <i class="fas fa-file-import"></i>
            </button>
          </div>

          <div style="display:flex;align-items:center;gap:0.5em;">
            <span style="white-space:nowrap;">成功音效</span>
            <input type="text"
                   name="doorcutin-hard-sound"
                   value="${hardSound}"
                   style="flex:1;">
            <button type="button"
                    class="file-picker"
                    data-type="audio"
                    data-target="doorcutin-hard-sound">
              <i class="fas fa-file-import"></i>
            </button>
          </div>

          <textarea name="doorcutin-hard-successText"
                    rows="2"
                    style="width:100%;resize:vertical;"
                    placeholder="成功后弹窗内容（可留空，使用默认提示）">${hardSuccessText}</textarea>

          <label style="margin-top:0.25em;">
            <input type="checkbox"
                   name="doorcutin-hard-closeOnSuccess"
                   ${hardCloseOnSuccess ? "checked" : ""}>
            成功后关闭本门的 Door-Cutin（后续视作普通门）
          </label>
        </div>
      </div>

      <!-- 踹门：失败设置 -->
      <div class="form-group">
        <label>踹门失败时</label>
        <div class="form-fields" style="flex-direction:column;gap:0.25em;">
          <textarea name="doorcutin-hard-failText"
                    rows="2"
                    style="width:100%;resize:vertical;"
                    placeholder="失败后弹窗内容（可留空，使用默认提示）">${hardFailText}</textarea>

          <label>
            <input type="checkbox"
                   name="doorcutin-hard-closeOnFail"
                   ${hardCloseOnFail ? "checked" : ""}>
            失败后关闭本门的 Door-Cutin
          </label>
        </div>
      </div>

      <hr>

      <!-- 转身离开 -->
      <div class="form-group">
        <label>动作：转身离开</label>
        <div class="form-fields">
          <label style="white-space:nowrap;">
            <input type="checkbox" name="doorcutin-leave-enabled" ${leaveEnabled ? "checked" : ""}>
            启用此按钮
          </label>
        </div>

        <div class="form-group">
          <label>按钮文字</label>
          <div class="form-fields">
            <input type="text"
                   name="doorcutin-leave-label"
                   value="${leaveLabel}"
                   style="width:100%;">
          </div>
        </div>

        <p class="hint">
          选择“转身离开”时，不会改变门的状态，可选播放一个“离开”特写。
        </p>

        <div class="form-group">
          <label>离开特写视频（可选）</label>
          <div class="form-fields">
            <input type="text"
                   name="doorcutin-leave-video"
                   value="${leaveVideo}"
                   style="flex:1;">
            <button type="button"
                    class="file-picker"
                    data-type="video"
                    data-target="doorcutin-leave-video">
              <i class="fas fa-file-import"></i>
            </button>
          </div>
        </div>

        <div class="form-group">
          <label>离开音效（可选）</label>
          <div class="form-fields">
            <input type="text"
                   name="doorcutin-leave-sound"
                   value="${leaveSound}"
                   style="flex:1;">
            <button type="button"
                    class="file-picker"
                    data-type="audio"
                    data-target="doorcutin-leave-sound">
              <i class="fas fa-file-import"></i>
            </button>
          </div>
        </div>
      </div>
    </fieldset>
  `;

  // ===== 把 blockHtml 塞进一个 Tab 里 =====
  const hasTabs = html.find(".sheet-tabs.tabs").length > 0;
  const contentRoot = html.find(".sheet-body").length
    ? html.find(".sheet-body")
    : form;

  // 追加 Door Cut-in 按钮
  const doorcutinTab = $(`
    <div class="tab door-cutin-wall-tab" data-tab="doorcutin">
      ${blockHtml}
    </div>`);

  if (hasTabs) {
    // 原来在底部的 nav（包含 Basic / Perceptive / Triggers）
    const navBottom = html.find("nav.sheet-tabs").first();

    // 克隆一份作为顶部 nav
    const navTop = navBottom.clone();

    // 给顶部 nav 加上 Door Cut-in 按钮（如果还没有）
    if (!navTop.find('[data-tab="doorcutin"]').length) {
      navTop.append(
        $(`<a class="item" data-tab="doorcutin">
            <i class="fas fa-film"></i> Door Cut-in
          </a>`)
      );
    }

    // 把原来的底部 nav 隐藏，并从 Tab 选择器中移除
    navBottom
      .removeClass("tabs")                 // 这样 .tabs 只会匹配顶部这一份
      .addClass("doorcutin-nav-bottom")
      .hide();

    // 顶部 nav 插到内容区域前面（窗口上半部分）
    if (contentRoot.length) {
      navTop.insertBefore(contentRoot);
    } else {
      form.prepend(navTop);
    }

    // Door-Cutin 的 tab 内容插到内容容器里
    contentRoot.append(doorcutinTab);

    // 重新绑定 tabs，沿用原来的 contentSelector / initial
    const el = html[0];
    const oldTabs = app.options.tabs?.[0] ?? {};
    const contentSelector = oldTabs.contentSelector || "form";
    const initial = oldTabs.initial || "basic";

    app.options.tabs = [{ navSelector: ".tabs", contentSelector, initial }];
    app._tabs = app._createTabHandlers();
    app._tabs.forEach(t => t.bind(el));
  } else {
    // 没有 tabs：Basic + Door-Cutin
    let root = form.length ? form : html;

    const basicTab = $('<div class="tab" data-tab="basic"></div>');
    $('> *:not(button):not(footer)', root).each(function () {
      basicTab.append(this);
    });

    const nav = $(`
      <nav class="sheet-tabs tabs">
        <a class="item active" data-tab="basic">
          <i class="fas fa-university"></i> 基础
        </a>
        <a class="item" data-tab="doorcutin">
          <i class="fas fa-film"></i> Door Cut-in
        </a>
      </nav>`);

    $(root)
      .prepend(nav)
      .prepend(doorcutinTab)
      .prepend(basicTab);

    app.options.tabs = [{ navSelector: ".tabs", contentSelector: "form", initial: "basic" }];
    app.options.height = "auto";
    const el = html[0];
    app._tabs = app._createTabHandlers();
    app._tabs.forEach(t => t.bind(el));
    app.setPosition();
  }

  // ===== FilePicker 按钮（只绑定 Door-Cutin tab 里的） =====
  doorcutinTab.find(".file-picker").on("click.doorcutin", (event) => {
    event.preventDefault();
    const button = event.currentTarget;
    const inputName = button.dataset.target;
    const input = doorcutinTab.find(`[name="${inputName}"]`);

    new FilePicker({
      type: button.dataset.type || "image",
      current: input.val(),
      callback: (path) => input.val(path)
    }).render(true);
  });

  // 调整窗口宽度
  try {
    const win = html.closest(".app.window-app");
    const minWidth = 780;
    if (win.length && win.width() < minWidth) {
      win.css("width", minWidth + "px");
    }
  } catch (e) {
    console.warn("door-cutin | adjust WallConfig width failed:", e);
  }

  // ===== 统一保存逻辑（保持你原来的这一段） =====
  form.off("submit.doorcutin-save");
  form.on("submit.doorcutin-save", async (ev) => {
    const fd = new FormData(ev.currentTarget);

    const preview     = String(fd.get("doorcutin-preview")     || "").trim();
    const description = String(fd.get("doorcutin-description") || "").trim();

    const enableSoft  = fd.get("doorcutin-soft-enabled")  === "on";
    const enableHard  = fd.get("doorcutin-hard-enabled")  === "on";
    const enableLeave = fd.get("doorcutin-leave-enabled") === "on";

    const dcSoftRaw = fd.get("doorcutin-soft-dc");
    const dcHardRaw = fd.get("doorcutin-hard-dc");
    const dcSoft = dcSoftRaw !== null && dcSoftRaw !== "" ? Number(dcSoftRaw) : undefined;
    const dcHard = dcHardRaw !== null && dcHardRaw !== "" ? Number(dcHardRaw) : undefined;

    const softLabel    = String(fd.get("doorcutin-soft-label")  || "").trim();
    const softRollType = String(fd.get("doorcutin-soft-rollType") || "none");
    const softRollKey  = String(fd.get("doorcutin-soft-rollKey")  || "").trim();
    const softSuccessText = String(fd.get("doorcutin-soft-successText") || "").trim();
    const softFailText    = String(fd.get("doorcutin-soft-failText")    || "").trim();
    const softCloseOnSuccess = fd.get("doorcutin-soft-closeOnSuccess") === "on";
    const softCloseOnFail    = fd.get("doorcutin-soft-closeOnFail")    === "on";

    const hardLabel    = String(fd.get("doorcutin-hard-label")  || "").trim();
    const hardRollType = String(fd.get("doorcutin-hard-rollType") || "none");
    const hardRollKey  = String(fd.get("doorcutin-hard-rollKey")  || "").trim();
    const hardSuccessText = String(fd.get("doorcutin-hard-successText") || "").trim();
    const hardFailText    = String(fd.get("doorcutin-hard-failText")    || "").trim();
    const hardCloseOnSuccess = fd.get("doorcutin-hard-closeOnSuccess") === "on";
    const hardCloseOnFail    = fd.get("doorcutin-hard-closeOnFail")    === "on";

    const leaveLabel   = String(fd.get("doorcutin-leave-label") || "").trim();

    const videoSoft  = String(fd.get("doorcutin-soft-video")  || "").trim();
    const soundSoft  = String(fd.get("doorcutin-soft-sound")  || "").trim();
    const videoHard  = String(fd.get("doorcutin-hard-video")  || "").trim();
    const soundHard  = String(fd.get("doorcutin-hard-sound")  || "").trim();
    const videoLeave = String(fd.get("doorcutin-leave-video") || "").trim();
    const soundLeave = String(fd.get("doorcutin-leave-sound") || "").trim();

    const oldCfg = wall.getFlag("door-cutin", "doorCutin") ?? {};

    const newCfg = foundry.utils.mergeObject(
      oldCfg,
      {
        preview,
        description,
        enableSoft,
        enableHard,
        enableLeave,
        dcSoft,
        dcHard,

        softLabel,
        softRollType,
        softRollKey,
        softSuccessText,
        softFailText,
        softCloseOnSuccess,
        softCloseOnFail,

        hardLabel,
        hardRollType,
        hardRollKey,
        hardSuccessText,
        hardFailText,
        hardCloseOnSuccess,
        hardCloseOnFail,

        leaveLabel,
        videoSoft,
        soundSoft,
        videoHard,
        soundHard,
        videoLeave,
        soundLeave
      },
      { inplace: false }
    );

    console.log("door-cutin | save doorCutin config:", newCfg);
    await wall.setFlag("door-cutin", "doorCutin", newCfg);
  });
});
