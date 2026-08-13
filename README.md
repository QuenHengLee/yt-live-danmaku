# YouTube 直播彈幕 (Danmaku)

一個 Chrome 擴充功能,把 YouTube 直播聊天室的留言變成 Bilibili 風格的滾動彈幕,直接飄過影片畫面。

A Chrome extension that turns YouTube live chat messages into Bilibili-style scrolling danmaku over the video.

## 功能

- 🎬 聊天室留言即時轉為彈幕,從右往左飄過播放器(全螢幕也支援)
- 🛤️ 彈道系統:自動分軌、防重疊,過載時自動丟棄
- ⏸️ 影片暫停時彈幕同步暫停
- 💰 Super Chat 金色顯示(含金額)、會員訊息綠色顯示
- 😀 支援 emoji(自動還原成文字)
- 🔁 支援直播回放的聊天重播(live chat replay)
- 🙈 自動隱藏原聊天室面板,避免畫面出現重複內容(iframe 仍在背景讀取留言,可於設定關閉)
- ⚙️ 設定面板即時生效:開關、顯示留言者名稱、隱藏原聊天室、字體大小、速度、不透明度、顯示範圍

## 安裝

1. 下載或 clone 這個 repo
2. 開啟 Chrome,前往 `chrome://extensions`
3. 開啟右上角「開發人員模式」
4. 點「載入未封裝項目」,選擇本專案資料夾
5. 打開任一有聊天室的 YouTube 直播即可

## 運作原理

YouTube 的直播聊天室是獨立的 iframe,content script 會同時注入兩邊:

- **聊天室端**:用 `MutationObserver` 監聽新留言(跳過載入時的舊留言、以留言 ID 去重),透過 `postMessage` 傳給上層頁面
- **播放器端**:在 `#movie_player` 內掛透明 overlay,用 Web Animations API 讓彈幕滾動;overlay 在播放器內部,所以全螢幕正常顯示

## 已知限制

- 聊天室「彈出」成獨立視窗時收不到彈幕(與播放器不在同一分頁),請使用預設內嵌聊天室
- YouTube 改版時 DOM 結構可能變動,屆時需調整 `content.js` 中的 selector

## License

MIT
