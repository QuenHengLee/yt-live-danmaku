(() => {
  'use strict';

  const SOURCE = 'yt-live-danmaku';

  const DEFAULTS = {
    enabled: true,
    fontSize: 26,   // px
    speed: 200,     // px / second
    opacity: 85,    // %
    area: 75,       // % of player height used for danmaku
    showAuthor: false
  };

  const settings = { ...DEFAULTS };

  function loadSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get(DEFAULTS, (v) => {
          Object.assign(settings, v);
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });
  }

  function watchSettings(onChange) {
    try {
      chrome.storage.onChanged.addListener((changes, ns) => {
        if (ns !== 'sync') return;
        for (const [key, change] of Object.entries(changes)) {
          if (key in settings) settings[key] = change.newValue;
        }
        if (onChange) onChange();
      });
    } catch (e) { /* extension context gone; ignore */ }
  }

  /* ================= 聊天室 iframe 端 ================= */

  function chatMain() {
    const seenIds = new Set();
    let ready = false; // 跳過聊天室載入時灌進來的舊留言

    function extractMessage(node) {
      const msgEl = node.querySelector('#message');
      if (!msgEl) return '';
      let out = '';
      for (const n of msgEl.childNodes) {
        if (n.nodeType === Node.TEXT_NODE) out += n.textContent;
        else if (n.tagName === 'IMG') out += n.alt || ''; // emoji 圖片用 alt 還原
        else out += n.textContent || '';
      }
      return out.replace(/\s+/g, ' ').trim();
    }

    function rememberId(id) {
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      if (seenIds.size > 3000) {
        const it = seenIds.values();
        for (let i = 0; i < 1000; i++) seenIds.delete(it.next().value);
      }
      return true;
    }

    function handleNode(node) {
      if (!(node instanceof HTMLElement)) return;
      const tag = node.tagName.toLowerCase();
      let kind = null;
      if (tag === 'yt-live-chat-text-message-renderer') kind = 'normal';
      else if (tag === 'yt-live-chat-paid-message-renderer') kind = 'paid';
      else if (tag === 'yt-live-chat-membership-item-renderer') kind = 'member';
      if (!kind) return;

      if (node.id && !rememberId(node.id)) return;

      let text = extractMessage(node);
      const author = node.querySelector('#author-name')?.textContent?.trim() || '';

      if (kind === 'paid') {
        const amount = node.querySelector('#purchase-amount')?.textContent?.trim() || '';
        text = [amount, text].filter(Boolean).join(' ') || 'Super Chat';
      } else if (kind === 'member' && !text) {
        text = node.querySelector('#header-subtext')?.textContent?.trim() || '加入會員';
      }

      if (!text) return;
      window.top.postMessage({ source: SOURCE, kind, text, author }, '*');
    }

    function attach(items) {
      const mo = new MutationObserver((muts) => {
        if (!ready) return;
        for (const m of muts) {
          for (const n of m.addedNodes) handleNode(n);
        }
      });
      mo.observe(items, { childList: true });
      setTimeout(() => { ready = true; }, 1200);
    }

    const timer = setInterval(() => {
      const items = document.querySelector('yt-live-chat-item-list-renderer #items');
      if (items) {
        clearInterval(timer);
        attach(items);
      }
    }, 500);
  }

  /* ================= 播放器(頂層頁面)端 ================= */

  function playerMain() {
    let overlay = null;
    const lanes = []; // 每條彈道下一次可用的時間 (performance.now() 基準)
    const MAX_ACTIVE = 80;

    function ensureOverlay() {
      const player = document.querySelector('#movie_player');
      if (!player) return null;
      if (overlay && overlay.isConnected && overlay.parentElement === player) return overlay;
      if (overlay) overlay.remove();
      overlay = document.createElement('div');
      overlay.id = 'ytdm-overlay';
      player.appendChild(overlay);
      applyOverlayStyle();
      return overlay;
    }

    function applyOverlayStyle() {
      if (!overlay) return;
      overlay.style.opacity = settings.opacity / 100;
      overlay.style.height = settings.area + '%';
      overlay.style.display = settings.enabled ? '' : 'none';
      if (!settings.enabled) clearAll();
    }

    function clearAll() {
      if (!overlay) return;
      overlay.textContent = '';
      lanes.length = 0;
    }

    function fire(msg) {
      if (!settings.enabled) return;
      if (!ensureOverlay()) return;
      if (overlay.childElementCount >= MAX_ACTIVE) return; // 過載保護

      const el = document.createElement('div');
      el.className = 'ytdm-item ytdm-' + msg.kind;
      el.style.fontSize = settings.fontSize + 'px';
      el.textContent = settings.showAuthor && msg.author
        ? msg.author + ': ' + msg.text
        : msg.text;
      overlay.appendChild(el);

      const w = el.offsetWidth;
      const pw = overlay.clientWidth;
      if (!pw) { el.remove(); return; }

      const speed = Math.max(50, settings.speed);
      const duration = ((pw + w) / speed) * 1000;
      const now = performance.now();

      // 彈道分配:找一條「上一則的尾巴已完全進場」的彈道,避免重疊
      const laneH = Math.round(settings.fontSize * 1.4);
      const laneCount = Math.max(1, Math.floor(overlay.clientHeight / laneH));
      if (lanes.length > laneCount) lanes.length = laneCount;

      let lane = -1, fallback = 0, fallbackFree = Infinity;
      for (let i = 0; i < laneCount; i++) {
        const free = lanes[i] || 0;
        if (free <= now) { lane = i; break; }
        if (free < fallbackFree) { fallbackFree = free; fallback = i; }
      }
      if (lane === -1) {
        if (fallbackFree - now > 3000) { el.remove(); return; } // 太擠就丟棄
        lane = fallback;
      }
      lanes[lane] = now + (w / speed) * 1000 + 300; // 尾巴進場時間 + 間距

      el.style.top = (lane * laneH) + 'px';

      const anim = el.animate(
        [
          { transform: `translateX(${pw}px)` },
          { transform: `translateX(${-w}px)` }
        ],
        { duration, easing: 'linear', fill: 'forwards' }
      );
      const video = document.querySelector('#movie_player video');
      if (video && video.paused) anim.pause();
      anim.onfinish = () => el.remove();
      anim.oncancel = () => el.remove();
    }

    function setAnimations(action) {
      if (!overlay) return;
      for (const el of overlay.querySelectorAll('.ytdm-item')) {
        for (const a of el.getAnimations()) a[action]();
      }
    }

    // 影片暫停/播放時,彈幕跟著停/走(media 事件不冒泡,用捕獲階段)
    document.addEventListener('pause', (e) => {
      if (e.target instanceof HTMLVideoElement && e.target.closest('#movie_player')) {
        setAnimations('pause');
      }
    }, true);
    document.addEventListener('play', (e) => {
      if (e.target instanceof HTMLVideoElement && e.target.closest('#movie_player')) {
        setAnimations('play');
      }
    }, true);

    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || d.source !== SOURCE || typeof d.text !== 'string') return;
      fire({
        kind: typeof d.kind === 'string' ? d.kind : 'normal',
        text: d.text.slice(0, 120),
        author: typeof d.author === 'string' ? d.author.slice(0, 50) : ''
      });
    });

    // YouTube 是 SPA,換頁後重新掛 overlay
    window.addEventListener('yt-navigate-finish', () => {
      clearAll();
      ensureOverlay();
    });
    setInterval(() => {
      if (document.querySelector('#movie_player')) ensureOverlay();
    }, 2000);

    watchSettings(applyOverlayStyle);
  }

  /* ================= 進入點 ================= */

  loadSettings().then(() => {
    if (location.pathname.startsWith('/live_chat')) {
      // 內嵌聊天室 iframe(含 /live_chat_replay)
      chatMain();
      watchSettings();
    } else if (window.top === window) {
      playerMain();
    }
  });
})();
