import { createApp, type App as VueApp } from 'vue';
import { createScriptIdDiv, teleportStyle } from '@util/script';
import WorldbookAssistantApp from './App.vue';

const MENU_ID = 'wb-assistant-menu-item';
const PANEL_ID = 'wb-assistant-panel';
const PANEL_STYLE_ID = 'wb-assistant-panel-style';
const PANEL_BODY_ID = 'wb-assistant-panel-body';
const EVENT_NS = '.wbAssistantMenu';
const DIRTY_STATE_KEY = '__WB_ASSISTANT_HAS_UNSAVED_CHANGES__';

let app: VueApp<Element> | null = null;
let panelRoot: JQuery<HTMLDivElement> | null = null;
let destroyTeleport: (() => void) | null = null;
let menuObserver: MutationObserver | null = null;
let menuRetryTimer: number | null = null;
let isPanelVisible = false;

function getHostWindow(): Window {
  return window.parent || window;
}

function getHostDocument(): Document {
  return getHostWindow().document;
}

function ensurePanelStyle(): void {
  const doc = getHostDocument();
  if (doc.getElementById(PANEL_STYLE_ID)) {
    return;
  }
  const style = doc.createElement('style');
  style.id = PANEL_STYLE_ID;
  style.textContent = `
#${PANEL_ID} {
  position: fixed;
  z-index: 10020;
  left: 60px;
  top: 8px;
  width: min(1280px, calc(100vw - 120px));
  height: calc(100vh - 16px);
  min-width: 920px;
  min-height: 560px;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);
  display: none;
  border: 1px solid #334155;
  border-radius: 10px;
  background: #0b1220;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  resize: both;
}

#${PANEL_ID}.active {
  display: flex;
  flex-direction: column;
}

#${PANEL_ID} .wb-assistant-header {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 0 12px;
  background: #111827;
  border-bottom: 1px solid #334155;
  cursor: move;
  user-select: none;
}

#${PANEL_ID} .wb-assistant-header-title {
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 600;
}

#${PANEL_ID} .wb-assistant-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

#${PANEL_ID} .wb-assistant-tool {
  width: 30px;
  height: 30px;
  border: 1px solid #475569;
  border-radius: 6px;
  background: #1f2937;
  color: #e2e8f0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

#${PANEL_ID} .wb-assistant-tool:hover {
  border-color: #22d3ee;
}

#${PANEL_ID} .wb-assistant-save:hover {
  border-color: #60a5fa;
}

#${PANEL_ID} .wb-assistant-close {
  width: 30px;
  height: 30px;
  border: 1px solid #475569;
  border-radius: 6px;
  background: #1f2937;
  color: #e2e8f0;
  cursor: pointer;
}

#${PANEL_ID} .wb-assistant-close:hover {
  border-color: #f43f5e;
}

#${PANEL_BODY_ID} {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

#${MENU_ID}.active {
  background-color: rgba(56, 189, 248, 0.18) !important;
}
`;
  doc.head.append(style);
}

function mountAppIntoPanel(): void {
  if (panelRoot?.length) {
    return;
  }
  const doc = getHostDocument();
  const body = doc.getElementById(PANEL_BODY_ID);
  if (!body) {
    return;
  }

  panelRoot = createScriptIdDiv().appendTo(body as unknown as JQuery);
  destroyTeleport = teleportStyle().destroy;
  app = createApp(WorldbookAssistantApp);
  app.mount(panelRoot[0]);
}

function ensurePanelElement(): JQuery {
  const doc = getHostDocument();
  let $panel = $(`#${PANEL_ID}`, doc);
  if ($panel.length) {
    return $panel;
  }

  ensurePanelStyle();
  const panelHtml = `
<div id="${PANEL_ID}">
  <div class="wb-assistant-header">
    <div class="wb-assistant-header-title">世界书助手</div>
    <div class="wb-assistant-header-actions">
      <button type="button" class="wb-assistant-tool wb-assistant-refresh" title="刷新">↻</button>
      <button type="button" class="wb-assistant-tool wb-assistant-save" title="保存">💾</button>
      <button type="button" class="wb-assistant-close" title="关闭">×</button>
    </div>
  </div>
  <div id="${PANEL_BODY_ID}"></div>
</div>
`;
  $('body', doc).append(panelHtml);
  $panel = $(`#${PANEL_ID}`, doc);

  enablePanelDrag($panel[0] as HTMLDivElement);
  $panel.off(`click${EVENT_NS}`, '.wb-assistant-refresh').on(`click${EVENT_NS}`, '.wb-assistant-refresh', () => {
    window.dispatchEvent(new Event('wb-helper:refresh'));
  });
  $panel.off(`click${EVENT_NS}`, '.wb-assistant-save').on(`click${EVENT_NS}`, '.wb-assistant-save', () => {
    window.dispatchEvent(new Event('wb-helper:save'));
  });
  $panel.off(`click${EVENT_NS}`, '.wb-assistant-close').on(`click${EVENT_NS}`, '.wb-assistant-close', () => {
    hidePanel();
  });

  return $panel;
}

function enablePanelDrag(panel: HTMLDivElement): void {
  const hostWin = getHostWindow();
  const handle = panel.querySelector('.wb-assistant-header') as HTMLDivElement | null;
  if (!handle) {
    return;
  }

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const onMouseMove = (event: MouseEvent) => {
    if (!dragging) {
      return;
    }
    const rect = panel.getBoundingClientRect();
    const maxLeft = Math.max(8, hostWin.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, hostWin.innerHeight - rect.height - 8);
    const nextLeft = Math.min(maxLeft, Math.max(8, event.clientX - offsetX));
    const nextTop = Math.min(maxTop, Math.max(8, event.clientY - offsetY));
    panel.style.left = `${nextLeft}px`;
    panel.style.top = `${nextTop}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  };

  const onMouseUp = () => {
    if (!dragging) {
      return;
    }
    dragging = false;
    hostWin.document.removeEventListener('mousemove', onMouseMove, true);
    hostWin.document.removeEventListener('mouseup', onMouseUp, true);
  };

  handle.addEventListener('mousedown', event => {
    if (event.button !== 0) {
      return;
    }
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }
    const rect = panel.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    dragging = true;
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    hostWin.document.addEventListener('mousemove', onMouseMove, true);
    hostWin.document.addEventListener('mouseup', onMouseUp, true);
    event.preventDefault();
  });
}

function setMenuActive(active: boolean): void {
  const doc = getHostDocument();
  const $menuItem = $(`#${MENU_ID}`, doc);
  if (!$menuItem.length) {
    return;
  }
  $menuItem.toggleClass('active', active);
}

function showPanel(): void {
  const doc = getHostDocument();
  const $panel = ensurePanelElement();
  mountAppIntoPanel();
  $panel.addClass('active');
  isPanelVisible = true;
  setMenuActive(true);
  // 打开面板后主动触发一次刷新
  window.dispatchEvent(new Event('wb-helper:refresh'));
  $(`#${MENU_ID}`, doc).blur();
}

function hasUnsavedChanges(): boolean {
  const current = window as unknown as Record<string, unknown>;
  const host = getHostWindow() as unknown as Record<string, unknown>;
  return current[DIRTY_STATE_KEY] === true || host[DIRTY_STATE_KEY] === true;
}

function shouldClosePanel(): boolean {
  if (!hasUnsavedChanges()) {
    return true;
  }
  return confirm('当前有未保存修改，确认关闭世界书助手吗？');
}

function hidePanel(): boolean {
  const hadUnsavedChanges = hasUnsavedChanges();
  if (!shouldClosePanel()) {
    return false;
  }
  if (hadUnsavedChanges) {
    window.dispatchEvent(new Event('wb-helper:discard'));
    const current = window as unknown as Record<string, unknown>;
    const host = getHostWindow() as unknown as Record<string, unknown>;
    current[DIRTY_STATE_KEY] = false;
    host[DIRTY_STATE_KEY] = false;
  }
  const doc = getHostDocument();
  $(`#${PANEL_ID}`, doc).removeClass('active');
  isPanelVisible = false;
  setMenuActive(false);
  return true;
}

function togglePanel(): void {
  if (isPanelVisible) {
    void hidePanel();
  } else {
    showPanel();
  }
}

function ensureMenuItem(): boolean {
  const doc = getHostDocument();
  const $menu = $('#extensionsMenu', doc);
  if (!$menu.length) {
    return false;
  }

  const $existing = $(`#${MENU_ID}`, doc);
  if ($existing.length && !$existing.closest('#extensionsMenu').length) {
    $existing.remove();
  }
  if (!$(`#${MENU_ID}`, doc).length) {
    const menuHtml = `
<div id="${MENU_ID}" class="list-group-item flex-container flexGap5 interactable" title="世界书助手" tabIndex="0">
  <i class="fa-solid fa-book-open"></i>
  <span>世界书助手</span>
</div>
`;
    $menu.append(menuHtml);
  }
  setMenuActive(isPanelVisible);
  return true;
}

function startMenuObserver(): void {
  const doc = getHostDocument();
  if (menuObserver) {
    return;
  }
  menuObserver = new MutationObserver(() => {
    ensureMenuItem();
  });
  menuObserver.observe(doc.body, { childList: true, subtree: true });
}

function stopMenuObserver(): void {
  menuObserver?.disconnect();
  menuObserver = null;
}

function ensureMenuRetry(): void {
  if (menuRetryTimer !== null) {
    return;
  }
  menuRetryTimer = window.setInterval(() => {
    if (ensureMenuItem()) {
      window.clearInterval(menuRetryTimer as number);
      menuRetryTimer = null;
    }
  }, 1000);
}

function stopMenuRetry(): void {
  if (menuRetryTimer === null) {
    return;
  }
  window.clearInterval(menuRetryTimer);
  menuRetryTimer = null;
}

function init(): void {
  // 不使用聊天框上方脚本按钮
  replaceScriptButtons([]);

  const doc = getHostDocument();
  $(doc).off(`click${EVENT_NS}`, `#${MENU_ID}`).on(`click${EVENT_NS}`, `#${MENU_ID}`, event => {
    event.preventDefault();
    togglePanel();
  });

  ensurePanelElement();
  if (!ensureMenuItem()) {
    ensureMenuRetry();
  }
  startMenuObserver();
  toastr.success('世界书助手已挂载到魔法棒菜单', 'Worldbook Assistant');
}

function cleanup(): void {
  const doc = getHostDocument();
  stopMenuRetry();
  stopMenuObserver();
  $(doc).off(EVENT_NS);
  $(`#${MENU_ID}`, doc).remove();
  $(`#${PANEL_ID}`, doc).remove();
  doc.getElementById(PANEL_STYLE_ID)?.remove();

  app?.unmount();
  app = null;
  panelRoot?.remove();
  panelRoot = null;
  destroyTeleport?.();
  destroyTeleport = null;
}

$(() => {
  errorCatched(init)();
});

$(window).on('pagehide', () => {
  cleanup();
});
