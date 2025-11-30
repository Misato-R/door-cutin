// 未来会包含：为单扇门配置图片、检定开关与 DC 的表单；以及测试播放按钮
console.log("door-cutin | ui placeholder loaded");


// ui.js —— Door Cut-in 的墙体配置 UI
// 稳定方案：直接在“门选项”下面插一个大块

// ui.js —— Door Cut-in 的墙体配置 UI
// 稳定方案：直接在“门选项”下面插一个大块

Hooks.on("renderWallConfig", (app, html, data) => {
  const wall = app.object;
  // 只对“门”生效
  if (wall.door === 0) return;

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
  // 软开门默认：成功后关闭，失败后也关闭（保持你现在的行为）
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
  // 踹门默认：成功后关闭，失败后不关闭（也保持你现在的行为）
  const hardCloseOnSuccess = cfg.hardCloseOnSuccess !== false;
  const hardCloseOnFail    = !!cfg.hardCloseOnFail;

  //离开配置
  const leaveEnabled  = cfg.enableLeave !== false;
  const leaveLabel    = cfg.leaveLabel  || "转身离开";

  const leaveVideo    = cfg.videoLeave  || "";
  const leaveSound    = cfg.soundLeave  || "";

  const leaveSuccessText = cfg.leaveSuccessText || "";
  const leaveFailText    = cfg.leaveFailText    || "";

  // 默认：离开时成功/失败都不关闭 Door-Cutin（以后你想改再调）
  const leaveCloseOnSuccess = !!cfg.leaveCloseOnSuccess;
  const leaveCloseOnFail    = !!cfg.leaveCloseOnFail;



  const form = html.find("form");
  if (!form.length) return;

  // 找一个合适的锚点（门选项 fieldset 或 ds 下拉）
  let anchor = html.find("fieldset.door-options");
  if (!anchor.length) {
    anchor = html.find('select[name="ds"]').closest(".form-group");
  }
  if (!anchor.length) {
    anchor = form.children().last();
  }

  // 防止重复插入
  if (html.find(".door-cutin-ui-block").length) return;

  const block = $(`
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
          <!-- ① 按钮文字 -->
          <input type="text"
                 name="doorcutin-soft-label"
                 value="${softLabel}"
                 style="flex:1;">

          <!-- ② 启用开关 -->
          <label style="white-space:nowrap;">
            <input type="checkbox" name="doorcutin-soft-enabled" ${softEnabled ? "checked" : ""}>
            启用此按钮
          </label>

          <!-- ③ 检定设置（类型 + key） -->
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

          <!-- ④ DC -->
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
          <!-- ① 按钮文字 -->
          <input type="text"
                 name="doorcutin-hard-label"
                 value="${hardLabel}"
                 style="flex:1;">

          <!-- ② 启用开关 -->
          <label style="white-space:nowrap;">
            <input type="checkbox" name="doorcutin-hard-enabled" ${hardEnabled ? "checked" : ""}>
            启用此按钮
          </label>

          <!-- ③ 检定设置 -->
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

          <!-- ④ DC -->
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
  `);

  // FilePicker：复用 Foundry 的 FilePicker
  block.find(".file-picker").on("click", (event) => {
    const button = event.currentTarget;
    const inputName = button.dataset.target;
    const input = block.find(`[name="${inputName}"]`);

    new FilePicker({
      type: button.dataset.type || "image",
      current: input.val(),
      callback: (path) => input.val(path)
    }).render(true);
  });

  // 插入到门选项之后
  anchor.after(block);

  try {
    const win = html.closest(".app.window-app");
    const minWidth = 780;        // 你可以改成 800 / 900 看效果

    if (win.length && win.width() < minWidth) {
      win.css("width", minWidth + "px");
    }
  } catch (e) {
    console.warn("door-cutin | adjust WallConfig width failed:", e);
  }

  // 统一保存逻辑
  form.off("submit.doorcutin-save");

  // 统一保存逻辑
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
    const dcSoft = dcSoftRaw !== null && dcSoftRaw !== ""
      ? Number(dcSoftRaw)
      : undefined;
    const dcHard = dcHardRaw !== null && dcHardRaw !== ""
      ? Number(dcHardRaw)
      : undefined;

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








