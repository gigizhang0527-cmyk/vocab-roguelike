# 词域探险 - Word Realm Roguelike (Web Port)

一个基于背单词的 Roguelike 网页游戏。玩家在不同主题房间中移动、瞄准、发射中文释义词块，击败身上显示英文单词的怪物。

## 致谢 / Attribution

本项目基于 [Cross-yanzheng/vocab-roguelike](https://github.com/Cross-yanzheng/vocab-roguelike) 移植而来。

- **原作者**：[Cross-yanzheng](https://github.com/Cross-yanzheng)
- **原项目**：Windows 桌面版（C# + Windows Forms + GDI+）
- **本项目**：HTML5 Canvas 网页版移植，新增移动端触控支持和小学词库

感谢原作者的创意和实现！

## 在线试玩

👉 [https://gigizhang0527-cmyk.github.io/vocab-roguelike/](https://gigizhang0527-cmyk.github.io/vocab-roguelike/)

## 词库难度

| 难度 | 词汇 | 说明 |
|---|---|---|
| 小学 | PEP人教版 | 1047词，基础入门 |
| 初中 | 高中词汇 | 基础词优先，压力较低 |
| 普通 | 四六级 | 更高难度，推进更快 |
| 困难 | 雅思 | 高阶词，精英怪更多 |

## 操作方式

**键盘（PC）：**
- WASD / 方向键：移动
- 鼠标瞄准 + 左键：发射词块
- E：拾取 / 开箱 / 下一房间
- Space：闪避
- Q：护盾药剂
- Tab：记忆书
- Esc：暂停

**触屏（手机/平板）：**
- 左侧虚拟摇杆：移动
- 右侧点击：瞄准 + 发射
- 右侧按钮：拾取(E) / 护盾(Q)

## 技术栈

- HTML5 Canvas 2D
- 原生 JavaScript（无框架）
- Web Audio API（音效）
- localStorage（存档）

## 部署

纯静态文件，可部署到任何静态托管：
- GitHub Pages ✅
- Vercel / Netlify / Cloudflare Pages
- 本地 `python3 -m http.server`

## License

本项目未指定开源许可证。原项目 [Cross-yanzheng/vocab-roguelike](https://github.com/Cross-yanzheng/vocab-roguelike) 同样未指定许可证。
如原作者希望添加许可证或要求本项目下架，请联系处理。
