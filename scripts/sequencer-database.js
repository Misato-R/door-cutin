;(() => {
  const MOD_ID = "door-cutin";
  const BASE_PATH = "modules/door-cutin/assets"; // 扫描起点目录

  // 想被当成“动画/图片/音效”的扩展名
  const VALID_EXTENSIONS = [
    ".webm", ".mp4", ".m4v",
    ".webp", ".png", ".jpg", ".jpeg",
    ".ogg", ".mp3", ".wav", ".aac"
  ];

  // 小工具：取文件/文件夹名 & 去掉扩展名
  function getNameFromPath(path) {
    const parts = path.split("/");
    return parts[parts.length - 1];
  }

  function stripExtension(filename) {
    return filename.replace(/\.[^/.]+$/, "");
  }

  /**
   * 递归扫描某个目录，构建数据库对象
   * node 形如 { videos: { opendoor: [ "path" ] } }
   */
  async function buildDbFromFolder(path) {
    const node = {};

    // 用 FilePicker 向服务器请求该目录下的文件和子目录
    const result = await FilePicker.browse("data", path);

    // 先处理子目录
    for (const dir of result.dirs) {
      const folderName = getNameFromPath(dir);
      // 递归构建子树
      node[folderName] = await buildDbFromFolder(dir);
    }

    // 再处理文件
    for (const file of result.files) {
      const filename = getNameFromPath(file);
      const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();

      // 只收我们需要的类型
      if (!VALID_EXTENSIONS.includes(ext)) continue;

      const key = stripExtension(filename); // 去扩展名作为 key

      // 同名文件（比如 webm/mp4 双格式）就收进同一个数组
      if (!node[key]) node[key] = [];
      node[key].push(file);
    }

    return node;
  }

  Hooks.once("sequencerReady", async () => {
    if (!globalThis.Sequencer?.Database) {
      console.warn(`${MOD_ID} | Sequencer not found, database not registered`);
      return;
    }

    try {
      console.log(`${MOD_ID} | Building Sequencer database from`, BASE_PATH);
      const dbRoot = await buildDbFromFolder(BASE_PATH);

      // dbRoot 大概长这样：
      // {
      //   images: { door: ["modules/door-cutin/assets/cutin/images/door.jpg"] },
      //   videos: { opendoor: [...], p5-cutin: [...], ... },
      //   effects: { fireball: [...], ... },
      //   sfx: { door: { doorkick: [...], opendoor: [...] }, p5: [...] }
      // }

      Sequencer.Database.registerEntries(MOD_ID, dbRoot);
      console.log(`${MOD_ID} | Sequencer database registered`, dbRoot);
    } catch (err) {
      console.error(`${MOD_ID} | Failed to build Sequencer database`, err);
    }
  });
})();
