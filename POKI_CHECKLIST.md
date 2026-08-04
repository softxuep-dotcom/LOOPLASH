# Poki 技术与提交检查表

> 项目：**LOOPLASH**  
> 文档状态：设计基线 v1.0  
> 规则核对日期：2026-08-04  
> 来源政策：本文件涉及 Poki 规则的内容只采用 Poki 官方开发者文档。带“项目内控”标记的数字是本项目主动设定的质量预算，不是 Poki 官方门槛。通过检查不等于 Poki 一定接受投稿；Poki 是人工策展平台，最终还会评估玩家适配、质量和原创性。

## 1. Poki 设计约束清单

### 1.1 平台偏好的体验

- [ ] 不把 Poki 理解成固定品类白名单。官方没有列出“推荐投稿的若干游戏类型”，而是强调原创、Web-first、精致呈现、响应及时、全年龄与包容性。
- [ ] 核心玩法能用一句话说明，并在实际游戏画面中直接呈现，不靠标题或说明文字补救。
- [ ] 不是热门作品的一比一复制；玩法目标、输入、关卡、成长、UI、角色、缩略图均建立独立身份。
- [ ] 第一可玩画面以操作为中心，减少启动菜单和介绍屏。
- [ ] 教学以动作演示、目标高亮、即时反馈为主；无不可跳过的开场或过场。
- [ ] 视觉、动画、反馈、UI 风格一致；不提交模板感强、资源拼贴或明显未完成的版本。
- [ ] 主题全年龄、友善、无赌博、烟酒、露骨内容、霸凌、歧视、持续恐怖或图形化暴力。
- [ ] 为不能方便使用 WASD 的玩家提供鼠标单独操作、触屏和可重映射键位。

依据：[Poki Quality Guidelines](https://sdk.poki.com/poki-quality-guidelines)、[Requirements](https://sdk.poki.com/new-requirements)。

### 1.2 设备、画布与输入

- [ ] 桌面、手机和平板均可完整游玩。
- [ ] 标准横屏实现以 16:9 为基准，并通过 640×360、836×470、1031×580 等比例缩放检查。
- [ ] 游戏画布覆盖可用区域，不让父页面滚动、方向键或空格触发页面跳动。
- [ ] 手机至少完整支持一种方向；本项目额外实现横屏与竖屏两种原生布局。
- [ ] 平板自动使用移动控制方案，不错误展示桌面键盘提示。
- [ ] UI、触控热区、安全区和相机在 4:3、16:9、19.5:9、超宽屏、9:16 下无关键内容遮挡。
- [ ] 横竖屏切换时安全结束当前手势、暂停模拟、完成重排，再等待玩家输入恢复。
- [ ] 桌面支持鼠标、键盘；移动端支持单指完成全部核心玩法，不强制双指或多点手势。
- [ ] ESC 或空格可暂停/恢复键盘模式，并正确触发 SDK 生命周期。
- [ ] 控制提示按当前设备和最后输入方式动态切换。

依据：[Requirements](https://sdk.poki.com/new-requirements)、[HTML5 SDK](https://sdk.poki.com/html5)、[Quality Guidelines](https://sdk.poki.com/poki-quality-guidelines)。

### 1.3 加载、资源与运行性能

- [ ] **Poki 官方目标：初始下载低于 8 MB。**
- [ ] **项目内控：首个可玩包不高于 4.5 MB（传输压缩后），P95 首次可操作时间不高于 5 秒。**
- [ ] **项目内控：完整内容传输体积不高于 30 MB；官方当前页面没有给出固定的总资源硬上限，只要求初始和完整体积尽可能小。**
- [ ] 只把首场教学、基础 UI、核心音效和第一生态区放进初始包；后续生态区和音乐分包延迟加载。
- [ ] `gameLoadingFinished()` 只在首个可玩画面、首场必需资源和输入系统确实就绪后调用一次。
- [ ] 发布包移除 debug 模式、分析覆盖层、源映射、测试素材、编辑器工具和日志噪声。
- [ ] 不从 Google Fonts、公共 CDN 或第三方图床/音频站加载资源；库和资源随构建托管在 Poki 允许的来源。
- [ ] 通过 Inspector 检查加载时间、文件大小、图像压缩和外部请求告警。
- [ ] **官方性能基线：最低 30 FPS，目标 60 FPS；以 3G 或更好网络、近三年中端手机及现代桌面浏览器为代表环境。**
- [ ] **项目内控：30 FPS 帧耗时 P95 ≤ 30 ms、60 FPS 目标设备 P95 ≤ 16.7 ms、移动峰值内存 ≤ 220 MB。**

依据：[Requirements](https://sdk.poki.com/new-requirements)、[Deal Types / Minimum Game Performance Requirements](https://sdk.poki.com/deals)、[Poki Inspector](https://sdk.poki.com/poki-inspector)、[External Resources](https://sdk.poki.com/external-resources)。

### 1.4 SDK 初始化与生命周期

- [ ] 使用官方 Poki SDK；Phaser 路线优先采用官方 `@poki/phaser-3` 插件，并在实施时锁定已验证版本。
- [ ] SDK 尽早初始化；初始化失败或 Promise reject 时游戏仍继续加载和可玩。
- [ ] `gameLoadingFinished()` 只触发一次。
- [ ] `gameplayStart()` **不在页面加载或资源加载完成时触发**；第一次必须对应玩家首个真实操作。
- [ ] `gameplayStart()` 用于进入玩法、从暂停恢复、广告后真正恢复控制。
- [ ] `gameplayStop()` 用于死亡、关卡结束、暂停、打开阻断式菜单、过场和任何玩法中断。
- [ ] 不连续发送两个 `gameplayStart()`，也不连续发送两个 `gameplayStop()`。
- [ ] 广告播放期间禁止触发任何其他 SDK 生命周期事件。
- [ ] 以单一生命周期状态机做去重，而不是由多个场景各自直接调用 SDK。
- [ ] `measure()` 的 `start → complete|fail` 成对；同一次尝试只发送 `complete` 或 `fail` 之一。
- [ ] 广告展示和完成由 SDK 自动统计，不用 `measure()` 重复上报广告曝光。

依据：[Requirements](https://sdk.poki.com/new-requirements)、[SDK General Info](https://sdk.poki.com/sdk-documentation)、[Phaser 3 SDK](https://sdk.poki.com/phaser)、[Game Events](https://sdk.poki.com/game-events)。

#### LOOPLASH 生命周期状态表

| 游戏状态/动作 | 调用顺序 | 设计要求 |
|---|---|---|
| 加载完成、等待第一笔 | `gameLoadingFinished()` | 不调用 `gameplayStart()`；屏幕上的三只目标已可交互 |
| 第一笔拖拽 | `gameplayStart()` | 在接受该 Pointer/Touch/Keyboard 动作的同一状态转换中调用 |
| 生态区内无阻断式升级 | 无 Stop/Start | 时间仍流动，升级是场内环绕选择，不算菜单 |
| 玩家暂停、失焦或页面隐藏 | `gameplayStop()` | 冻结固定步进、静音、清空持续输入；页面隐藏处理是本项目用于落实“玩法中断”的实现策略 |
| 玩家按恢复 | `commercialBreak()` → `gameplayStart()` | 只有在广告 Promise 结束且游戏真正恢复控制后 Start |
| 玩家死亡 | `gameplayStop()` | 先停止，再显示结算；不在结算出现时请求广告 |
| 玩家按绿色“再来一局” | `commercialBreak()` → `gameplayStart()` | 这是从自然暂停点回到玩法的明确意图 |
| 玩家主动选择激励复苏 | `rewardedBreak()` → 成功则发奖励 → `gameplayStart()` | 未完整观看不发奖励；失败后仍可选标准重开 |
| 完成一轮并进入阻断式结算 | `gameplayStop()` | 下一轮由玩家点击后再请求商业广告机会 |

> 官方明确要求广告时暂停音频与键盘输入，并要求所有玩法中断调用 `gameplayStop()`。官方页面未单列 `visibilitychange` API 规则；本项目把页面隐藏、窗口失焦和系统来电视为“玩法中断”，是对上述生命周期语义的保守实现，不冒充额外官方条款。

### 1.5 商业广告与激励广告

- [ ] 只使用 Poki 广告系统，不集成其他广告、内购、去广告购买或货币购买入口。
- [ ] `commercialBreak()` 只在自然暂停点、且玩家明确准备回到玩法时请求；不在战斗中、刚受击时或离开玩法去菜单时调用。
- [ ] 不实现自己的广告倒计时或频控；把合适的机会交给 Poki 决定是否实际展示。
- [ ] 广告期间固定步进、动画驱动的游戏逻辑、音频、键盘、鼠标与触屏输入全部停用。
- [ ] 广告结束后恢复玩家原本的静音偏好，不无条件打开声音。
- [ ] 激励广告在点击前明确显示影片图标和奖励内容，完全自愿。
- [ ] 每个奖励最多一段广告；只有 Promise 返回成功才发奖，且同一动作不得重复发奖。
- [ ] 标准继续按钮和激励按钮同时出现；标准按钮为绿色、尺寸不小于激励按钮，并位于其上方或旁边；激励按钮不用绿色。
- [ ] 广告拦截器存在时核心玩法仍完整可玩，不显示自制“请关闭广告拦截器”消息，不给未完成的激励奖励。
- [ ] LOOPLASH 不在第一分钟制造广告节点；自然机会限定为死亡后重开、长暂停恢复、完整远征/大生态门完成后继续。

依据：[Requirements / Advertisement Integration](https://sdk.poki.com/new-requirements)、[HTML5 SDK](https://sdk.poki.com/html5)、[Game Events](https://sdk.poki.com/game-events)。

### 1.6 声音、暂停与后台

- [ ] 首次用户手势后才解锁 Web Audio；加载阶段不强制播放声音。
- [ ] 暂停、广告、页面隐藏、窗口失焦时停止模拟并淡出或静音所有声道。
- [ ] 恢复时重新同步节拍与循环音轨，避免多个音源叠播；必须由玩家操作恢复。
- [ ] 广告期间禁用输入，防止按键穿透广告后立刻触发一次套索或菜单选择。
- [ ] 暂停时保存可序列化的运行状态；不保存声音节点、Tween、粒子等渲染对象。
- [ ] 页面切换回来后显示清晰的暂停覆盖层，不让游戏在后台补算大量时间或瞬间判定死亡。

官方依据为广告静音/禁用输入及玩法中断的生命周期要求：[HTML5 SDK](https://sdk.poki.com/html5)、[Requirements](https://sdk.poki.com/new-requirements)。页面可见性和恢复细节属于本项目的实现验收策略。

### 1.7 存档、账号、隐私与数据

- [ ] 不要求账号登录；首局无需输入姓名、邮箱或任何个人信息。
- [ ] 本地存档访问包裹在 `try/catch` 中；localStorage/IndexedDB 不可用时自动进入本次会话内存存档，游戏仍可玩。
- [ ] 存档包含 schema 版本、设置、Atlas 解锁、成绩和未完成远征快照；不保存渲染对象。
- [ ] 存档失败时以非阻断图标说明“仅本次会话”，不弹出长篇警告。
- [ ] 不使用 Google Analytics；首发版不使用第三方分析、外部账号、聊天、UGC 或未经批准的服务器。
- [ ] 所有字体、图片、音频和代码库随游戏构建提供，不做不必要的第三方请求。
- [ ] 若未来加入排行榜、外部服务器或第三方分析，先在 P4D 的 Custom Content Security Policy 申请，提供可公开访问且在游戏内可打开的隐私政策；审批前不得上线该请求。
- [ ] 未来如启用 Poki User Accounts，只能由明确用户操作调用登录，不能自动弹出；账号仍不是核心玩法前提。
- [ ] 分享挑战仅编码关卡种子、规则版本和目标分，不放个人信息或原始存档。

依据：[Requirements](https://sdk.poki.com/new-requirements)、[External Resources](https://sdk.poki.com/external-resources)、[HTML5 User Accounts](https://sdk.poki.com/html5)。

### 1.8 本地化与无障碍

- [ ] 文本集中在独立 locale 资源中，不散落在玩法代码或贴图内。
- [ ] 默认根据浏览器语言选择，设置内可随时切换。
- [ ] 投稿版覆盖 EFIGS（英语、法语、意大利语、德语、西班牙语），并按受众规划土耳其语、巴西葡萄牙语、俄语、简体中文、日语、韩语。
- [ ] 布局容纳至少 40% 文本膨胀，CJK 字体按语言延迟加载；不用外部 Google Fonts。
- [ ] 核心敌人标签以形状＋图案＋颜色三重编码，色觉差异不影响配方判断。
- [ ] 提供减少闪烁、减少镜头震动、减少粒子、较粗套索线、高对比度、音量分轨和键位重映射。
- [ ] 所有核心玩法可用鼠标单独完成；触屏核心玩法只需单指。

依据：[Building for Localization](https://sdk.poki.com/localization)、[Quality Guidelines / alternative controls](https://sdk.poki.com/poki-quality-guidelines)。

### 1.9 品牌、缩略图与外链

- [ ] 不放独立启动 splash；工作室标志若使用，只融合进加载画面。
- [ ] 游戏内无未经批准的外链和其他广告。
- [ ] Web Fit Test 前提供静态缩略图；全球发布前同时提供静态和动态缩略图。
- [ ] 静态图在小尺寸仍清楚，避免细碎 UI、边框、留白和依赖文字；与 Poki 页面背景色 `#83FFE7` 有明显对比。
- [ ] 动态缩略图 1:1、1080×1080 或更高、50 FPS 以上、4–6 秒、MP4、静音、最大 100 MB；展示 2–3 个核心瞬间且无鼠标光标。
- [ ] LOOPLASH 缩略图必须看到：深靛背景、珊瑚色大套索、被圈住的彩色群体、即将收紧的亮黄色双星；不放标题文字。

依据：[Game Thumbnail](https://sdk.poki.com/game-thumbnail)、[Animated Thumbnails](https://sdk.poki.com/animated-thumbnails)、[Requirements](https://sdk.poki.com/new-requirements)。

## 2. Poki Inspector 上线前检查

- [ ] 构建根目录存在可直接启动的 `index.html`。
- [ ] 使用 Inspector 直接拖入完整构建，或从 P4D Versions 打开预载构建。
- [ ] 完成每一个 QA Module；人工未通过项不得留空或用备注代替。
- [ ] Event Log 验证所有下列路径：首次输入、暂停/恢复、菜单、死亡/重开、完整关卡、商业广告占位、激励成功、激励失败、广告拦截。
- [ ] Event Log 无重复 Start/Stop、无广告中事件、无加载时 Start。
- [ ] Game Details 记录初始体积、完整体积和加载时间；与 CI 构建预算一致。
- [ ] Desktop Mode 完成鼠标、键盘、暂停、重映射测试。
- [ ] Mobile Mode 扫码在真实 iOS/Android 设备完成触屏、音频解锁、旋转、后台恢复和安全区测试。
- [ ] Scaling Tests 覆盖官方 16:9 尺寸以及项目的 4:3、超宽、9:16 补充矩阵。
- [ ] Warnings 中 External Resources、Image Optimization、Unexpected Behavior 均为零；任何例外都有 Poki 书面批准。
- [ ] 无父页面滚动、空格/方向键页面跳动、长按选中文字、双击页面缩放或触控手势穿透。

依据：[Poki Inspector](https://sdk.poki.com/poki-inspector)。

## 3. Playtest 与提交流程检查

### Level 1：添加游戏

- [ ] 通过 Poki for Developers 上传版本；设置标题、描述和最多四个建议分类。
- [ ] 上传前确认开发者条款；理解 P4D/测试工具为有限访问，投稿并不保证获得账号或接受。
- [ ] Versions 中的 Preview 与实际嵌入页面表现一致。

### Level 2：反馈与 Playtesting

- [ ] 每个测试只设一个主要假设：核心乐趣、教学、难度或兼容性。
- [ ] 桌面、Android、iOS 分层请求真实玩家录屏；每次 Playtest 返回 10 份录屏、输入、控制台、时长、国家与设备信息。
- [ ] 团队逐帧看完全部录屏；至少观看 5 份是解锁下一阶段的前置条件之一。
- [ ] 记录首次输入时间、首次成功、首次受伤、首次退出、失败后是否重开，以及玩家是否误触 UI。

依据：[Poki Playtesting](https://sdk.poki.com/playtesting)。

### Level 3：Player Fit Test

- [ ] 已观看至少 5 份 Level 2 录屏。
- [ ] 选择正确受众分类与移动方向，向约 500 名玩家测试。
- [ ] 重点观察玩家在各时长桶的分布，尤其 3–5 分钟和 5 分钟以上；未达标先迭代，不把一次失败当作平台承诺。

依据：[Player Fit Test](https://sdk.poki.com/player-fit)。

### Level 4：Web Fit Test

- [ ] 已通过 Player Fit Test，并有静态缩略图。
- [ ] `gameplayStart()` 已正确实现，因为 Conversion to Play 依赖它。
- [ ] 测试规模约 10,000 名玩家，预计 3–5 天；开始后不能自行停止。
- [ ] 同时评估 CTR、Average Time on Page、Conversion to Play，三项同等重要；按测试分类的动态基准比较，不使用一个脱离分类的万能目标。
- [ ] 广告事件在此阶段可以后置；若已接入只会出现占位广告且不产生收入。
- [ ] 未通过时根据数据迭代，可在仍符合质量指南的前提下重新申请测试。

依据：[Web Fit Test](https://sdk.poki.com/web-fit-test)。

### Level 5：Final Poki Review 与发布

- [ ] 通过 Web Fit 只代表具有潜在适配，不代表必然发布。
- [ ] 最终审核检查质量指南与分类内原创性，官方给出的审核时间为 1–2 周。
- [ ] 审核通过后再进入签约与发布安排；未通过则当前作品不能在 Poki 发布。
- [ ] 发布流程准备好技术测试（如 Poki 要求）、强制 Soft Release、Global Release 和上线后监控。
- [ ] Soft Release 期间监控 C2P、参与时长、错误、反馈和广告结构，能快速上传新版本并请求审核。
- [ ] 全球发布前动态缩略图通过审核；全球发布后继续监控错误和内容表现。

依据：[Final Poki Review](https://sdk.poki.com/final-review)、[Release Process](https://sdk.poki.com/releaseprocess)。

## 4. LOOPLASH 投稿 Go / No-Go 总表

以下任一项失败即 **No-Go**：

- [ ] 首包 ≤ 4.5 MB 项目目标，且绝不超过 Poki 的 8 MB 初始下载目标。
- [ ] 官方 16:9 三个尺寸、真实手机横竖屏、平板和隐身模式全部可玩。
- [ ] 首次真实输入 ≤ 加载完成后 2 秒，且该输入准确触发第一次 `gameplayStart()`。
- [ ] 第一成功套圈中位数 ≤ 8 秒，前 60 秒至少出现一次五目标连捕与一次精英破结。
- [ ] 失败结算到接受下一局输入 ≤ 3 秒（不含 Poki 实际播放的广告时长）。
- [ ] 单指、鼠标、键盘三种方案均能完成教程、精英和 Boss，不存在某种输入的结构性劣势。
- [ ] 30 FPS 最低目标设备通过 20 分钟压力运行，无崩溃、无限加载、输入锁死或进度丢失。
- [ ] SDK 事件 Inspector 全路径通过，广告中音频和输入完全停止。
- [ ] 隐身模式存档失败时退化为会话存档，核心玩法与全部内容仍可进入。
- [ ] 无未批准外部请求、其他广告、内购、强制账号或个人信息收集。
- [ ] 静态图在 96 px 尺寸仍能辨认“发光套索圈住敌群”，动态缩略图满足官方规格。
- [ ] 至少三轮外部 Playtest 后，所有 P0/P1 问题归零；再申请 Player Fit、Web Fit 与最终审核。

## 5. 官方来源索引

- [Poki Requirements](https://sdk.poki.com/new-requirements)
- [Poki Quality Guidelines](https://sdk.poki.com/poki-quality-guidelines)
- [Poki SDK General Info](https://sdk.poki.com/sdk-documentation)
- [Poki HTML5 SDK](https://sdk.poki.com/html5)
- [Poki Phaser 3 SDK](https://sdk.poki.com/phaser)
- [Poki External Resources](https://sdk.poki.com/external-resources)
- [Poki Localization](https://sdk.poki.com/localization)
- [Poki Game Events](https://sdk.poki.com/game-events)
- [Poki Inspector](https://sdk.poki.com/poki-inspector)
- [Poki Playtesting](https://sdk.poki.com/playtesting)
- [Poki Player Fit Test](https://sdk.poki.com/player-fit)
- [Poki Web Fit Test](https://sdk.poki.com/web-fit-test)
- [Poki Final Review](https://sdk.poki.com/final-review)
- [Poki Release Process](https://sdk.poki.com/releaseprocess)
- [Poki Game Thumbnail](https://sdk.poki.com/game-thumbnail)
- [Poki Animated Thumbnails](https://sdk.poki.com/animated-thumbnails)
- [Poki Minimum Game Performance Requirements](https://sdk.poki.com/deals)
