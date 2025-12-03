// Door-Cutin: 复制当前选中 Tile 的 ID 到剪贴板

// 1. 取得当前选中的 Tile
const tiles = canvas.tiles.controlled;
if (!tiles.length) {
  ui.notifications.warn("请先选中一个图块（Tile）再点击宏。");
  return;
}
if (tiles.length > 1) {
  ui.notifications.warn("一次只能复制一个图块的 ID，请只选中一个 Tile。");
  return;
}

const tile = tiles[0];
const id = tile.id;

// 2. 复制到剪贴板
if (navigator.clipboard && navigator.clipboard.writeText) {
  navigator.clipboard.writeText(id).then(() => {
    ui.notifications.info(`Tile ID 已复制到剪贴板：${id}`);
  }).catch(err => {
    console.error("复制到剪贴板失败：", err);
    ui.notifications.error(`复制到剪贴板失败，请手动复制：${id}`);
    // 退一步，弹出对话框方便手动复制
    new Dialog({
      title: "Tile ID",
      content: `<p>无法直接写入剪贴板，请手动复制：</p>
                <input type="text" value="${id}" style="width:100%;" readonly
                       onfocus="this.select();" />`,
      buttons: { ok: { label: "好的" } }
    }).render(true);
  });
} else {
  // 浏览器不支持 clipboard API，直接给个对话框让人手动复制
  ui.notifications.warn("此环境不支持自动写入剪贴板，已弹出对话框供手动复制。");
  new Dialog({
    title: "Tile ID",
    content: `<p>请手动复制下面的 Tile ID：</p>
              <input type="text" value="${id}" style="width:100%;" readonly
                     onfocus="this.select();" />`,
    buttons: { ok: { label: "好的" } }
  }).render(true);
}
