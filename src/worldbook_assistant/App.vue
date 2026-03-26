<template>
  <div class="wb-assistant-root">
          <section class="wb-toolbar">
            <label class="toolbar-label">
              世界书
              <select v-model="selectedWorldbookName" class="toolbar-select">
                <option v-for="name in selectableWorldbookNames" :key="name" :value="name">
                  {{ name }}
                </option>
              </select>
            </label>
            <button class="btn" type="button" @click="createNewWorldbook">新建</button>
            <button class="btn" type="button" :disabled="!selectedWorldbookName" @click="duplicateWorldbook">
              另存为
            </button>
            <button class="btn danger" type="button" :disabled="!selectedWorldbookName" @click="deleteCurrentWorldbook">
              删除
            </button>
            <button class="btn" type="button" :disabled="!selectedWorldbookName" @click="exportCurrentWorldbook">
              导出
            </button>
            <button class="btn" type="button" @click="triggerImport">导入</button>
            <input
              ref="importFileInput"
              class="hidden-input"
              type="file"
              accept=".json,application/json"
              @change="onImportChange"
            />
          </section>

          <section class="wb-bindings">
            <div class="wb-history-shortcuts">
              <button
                class="btn history-btn utility-btn"
                type="button"
                :class="{ active: globalWorldbookMode }"
                @click="toggleGlobalMode"
              >
                🌐 全局模式
              </button>
              <button class="btn history-btn" type="button" :disabled="!selectedEntry" @click="openEntryHistoryModal">
                🕰️ 条目时光机
              </button>
              <button
                class="btn history-btn"
                type="button"
                :disabled="!selectedWorldbookName"
                @click="openWorldbookHistoryModal"
              >
                ⏪ 整本时光机
              </button>
              <button
                class="btn history-btn utility-btn"
                type="button"
                :class="{ active: floatingPanels.find.visible }"
                :disabled="!draftEntries.length"
                @click="toggleFloatingPanel('find')"
              >
                🔎 查找与替换
              </button>
              <button
                class="btn history-btn utility-btn"
                type="button"
                :class="{ active: floatingPanels.activation.visible }"
                @click="toggleFloatingPanel('activation')"
              >
                📡 激活监控
              </button>
            </div>
            <div v-if="globalWorldbookMode" class="global-mode-panel">
              <div class="global-mode-head">
                <span class="global-mode-title">全局世界书（{{ bindings.global.length }}）</span>
                <button class="btn mini danger" type="button" :disabled="!bindings.global.length" @click="clearGlobalWorldbooks">
                  清空全局
                </button>
              </div>
              <div class="global-mode-grid">
                <div class="global-mode-column">
                  <label class="field">
                    <span>搜索并添加常驻世界书</span>
                    <input
                      v-model="globalAddSearchText"
                      type="text"
                      class="text-input"
                      placeholder="搜索并添加常驻世界书..."
                      @keydown.enter.prevent="addFirstGlobalCandidate"
                    />
                  </label>
                  <div class="global-mode-list">
                    <button
                      v-for="name in globalAddCandidates"
                      :key="`add-${name}`"
                      class="global-mode-item add"
                      type="button"
                      @click="addGlobalWorldbook(name)"
                    >
                      <span class="global-mode-item-name">{{ name }}</span>
                      <span class="global-mode-item-action">添加</span>
                    </button>
                    <div v-if="!globalAddCandidates.length" class="empty-note">没有可添加的世界书</div>
                  </div>
                </div>
                <div class="global-mode-column">
                  <label class="field">
                    <span>筛选常驻世界书</span>
                    <input
                      v-model="globalFilterText"
                      type="text"
                      class="text-input"
                      placeholder="筛选常驻世界书..."
                    />
                  </label>
                  <div class="global-mode-list">
                    <button
                      v-for="name in filteredGlobalWorldbooks"
                      :key="`global-${name}`"
                      class="global-mode-item active"
                      type="button"
                      @click="removeGlobalWorldbook(name)"
                    >
                      <span class="global-mode-item-name">{{ name }}</span>
                      <span class="global-mode-item-action">移除</span>
                    </button>
                    <div v-if="!filteredGlobalWorldbooks.length" class="empty-note">
                      {{ bindings.global.length ? '没有匹配结果' : '暂无常驻世界书' }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="global-mode-actions">
                <button class="btn" type="button" :disabled="!selectedWorldbookName" @click="toggleGlobalBinding">
                  {{ isGlobalBound ? '移出全局' : '加入全局' }}
                </button>
              </div>
            </div>
          </section>

          <section ref="mainLayoutRef" class="wb-main-layout" :style="mainLayoutStyle">
            <aside class="wb-entry-list">
              <div class="list-search">
                <input v-model="searchText" type="text" class="text-input" placeholder="搜索名称 / 内容 / 关键词" />
                <label class="checkbox-inline">
                  <input v-model="onlyEnabled" type="checkbox" />
                  <span>仅启用</span>
                </label>
              </div>
              <div class="list-summary">
                条目 {{ filteredEntries.length }} / {{ draftEntries.length }} | 启用 {{ enabledEntryCount }}
              </div>
              <div class="list-scroll">
                <button
                  v-for="entry in filteredEntries"
                  :key="entry.uid"
                  type="button"
                  class="entry-item"
                  :data-status="getEntryVisualStatus(entry)"
                  :class="{
                    selected: entry.uid === selectedEntryUid,
                    disabled: !entry.enabled,
                  }"
                  @click="selectEntry(entry.uid)"
                >
                  <div class="entry-item-head">
                    <span class="entry-status-dot" :data-status="getEntryVisualStatus(entry)"></span>
                    <div class="entry-item-title">{{ entry.name || `条目 ${entry.uid}` }}</div>
                    <span class="entry-chip uid">#{{ entry.uid }}</span>
                  </div>
                  <div class="entry-item-tags">
                    <span class="entry-chip status" :data-status="getEntryVisualStatus(entry)">
                      {{ getEntryStatusLabel(entry) }}
                    </span>
                    <span class="entry-chip">🔑 {{ entry.strategy.keys.length }}</span>
                    <span class="entry-chip">🎯 {{ entry.probability }}</span>
                    <span class="entry-chip mono">#{{ entry.position.order }}</span>
                  </div>
                  <div class="entry-item-preview">{{ getEntryKeyPreview(entry) }}</div>
                </button>
              </div>
              <div class="list-actions">
                <button class="btn" type="button" :disabled="!selectedWorldbookName" @click="addEntry">新增</button>
                <button class="btn" type="button" :disabled="!selectedEntry" @click="duplicateSelectedEntry">
                  复制
                </button>
                <button class="btn danger" type="button" :disabled="!selectedEntry" @click="removeSelectedEntry">
                  删除
                </button>
                <button class="btn" type="button" :disabled="!selectedEntry" @click="moveSelectedEntry(-1)">
                  上移
                </button>
                <button class="btn" type="button" :disabled="!selectedEntry" @click="moveSelectedEntry(1)">下移</button>
              </div>
            </aside>
            <div
              class="wb-resize-handle main"
              :class="{ dragging: paneResizeState?.key === 'main' }"
              @pointerdown="startPaneResize('main', $event)"
            ></div>

            <main class="wb-editor">
              <template v-if="selectedEntry">
                <div ref="editorShellRef" class="wb-editor-shell" :style="editorShellStyle">
                  <section class="editor-center">
                    <header class="editor-head">
                      <label class="field editor-comment">
                        <span>备注 (COMMENT)</span>
                        <input v-model="selectedEntry.name" type="text" class="text-input" />
                      </label>
                      <div class="editor-badges">
                        <span class="editor-badge" :class="selectedEntry.enabled ? 'on' : 'off'">
                          {{ selectedEntry.enabled ? 'EN' : 'OFF' }}
                        </span>
                        <span class="editor-badge strategy" :data-status="getEntryVisualStatus(selectedEntry)">
                          {{ getEntryStatusLabel(selectedEntry) }}
                        </span>
                        <span class="editor-badge mono">#{{ selectedEntry.uid }}</span>
                        <span class="editor-badge mono">Chars {{ selectedContentChars }}</span>
                        <span class="editor-badge mono">~{{ selectedTokenEstimate }}T</span>
                      </div>
                    </header>

                    <section class="editor-grid two-cols editor-keyword-grid">
                      <label class="field">
                        <span>主要关键词 (KEYS)</span>
                        <textarea v-model="selectedKeysText" class="text-area compact"></textarea>
                      </label>
                      <label class="field">
                        <span>次要关键词 (SECONDARY)</span>
                        <textarea v-model="selectedSecondaryKeysText" class="text-area compact"></textarea>
                      </label>
                    </section>

                    <section class="editor-content-block">
                      <div class="editor-content-title">世界观设定 / 内容 (CONTENT)</div>
                      <textarea v-model="selectedEntry.content" class="text-area large editor-content-area"></textarea>
                    </section>

                    <details class="editor-advanced">
                      <summary>高级字段 / extra JSON</summary>
                      <label class="field">
                        <span>extra JSON（未知字段）</span>
                        <textarea v-model="selectedExtraText" class="text-area compact" placeholder="{ ... }"></textarea>
                      </label>
                      <div class="field-actions">
                        <button class="btn" type="button" @click="applyExtraJson">应用 extra</button>
                        <button class="btn" type="button" @click="clearExtra">清空 extra</button>
                      </div>
                    </details>
                  </section>
                  <div
                    class="wb-resize-handle editor"
                    :class="{ dragging: paneResizeState?.key === 'editor' }"
                    @pointerdown="startPaneResize('editor', $event)"
                  ></div>

                  <aside class="editor-side">
                    <article class="editor-card">
                      <h4>触发策略 (STRATEGY)</h4>
                      <label class="field checkbox-inline">
                        <input v-model="selectedEntry.enabled" type="checkbox" />
                        <span>启用条目</span>
                      </label>
                      <div class="strategy-switch">
                        <button
                          type="button"
                          class="strategy-pill constant"
                          :class="{ active: selectedEntry.strategy.type === 'constant' }"
                          @click="selectedEntry.strategy.type = 'constant'"
                        >
                          🔵 常驻 (Constant)
                        </button>
                        <button
                          type="button"
                          class="strategy-pill vector"
                          :class="{ active: selectedEntry.strategy.type === 'vectorized' }"
                          @click="selectedEntry.strategy.type = 'vectorized'"
                        >
                          📎 向量化 (Vector)
                        </button>
                        <button
                          type="button"
                          class="strategy-pill selective"
                          :class="{ active: selectedEntry.strategy.type === 'selective' }"
                          @click="selectedEntry.strategy.type = 'selective'"
                        >
                          🟢 关键词 (Selective)
                        </button>
                      </div>
                      <details class="editor-advanced">
                        <summary>高级设置</summary>
                        <label class="field">
                          <span>次要逻辑 (LOGIC)</span>
                          <select v-model="selectedEntry.strategy.keys_secondary.logic" class="text-input">
                            <option v-for="item in secondaryLogicOptions" :key="item" :value="item">
                              {{ getSecondaryLogicLabel(item) }}
                            </option>
                          </select>
                        </label>
                        <label class="field">
                          <span>扫描深度</span>
                          <input
                            v-model="selectedScanDepthText"
                            type="text"
                            class="text-input"
                            placeholder="留空或 same_as_global"
                          />
                        </label>
                        <label class="field">
                          <span>概率(0-100)</span>
                          <input
                            v-model.number="selectedEntry.probability"
                            type="number"
                            class="text-input"
                            min="0"
                            max="100"
                            step="1"
                          />
                        </label>
                      </details>
                    </article>

                    <article class="editor-card">
                      <h4>插入设置 (INSERTION)</h4>
                      <label class="field">
                        <span>位置 (Position)</span>
                        <select
                          v-model="selectedEntry.position.type"
                          class="text-input"
                          @change="handleSelectedPositionTypeChanged"
                        >
                          <option v-for="item in positionTypeOptions" :key="item" :value="item">
                            {{ getPositionTypeLabel(item) }}
                          </option>
                        </select>
                      </label>
                      <label class="field">
                        <span>权重 (Order)</span>
                        <input v-model.number="selectedEntry.position.order" type="number" class="text-input" step="1" />
                      </label>
                      <div class="editor-grid two-cols">
                        <label class="field" :class="{ disabled: selectedEntry.position.type !== 'at_depth' }">
                          <span>at_depth role</span>
                          <select
                            v-model="selectedEntry.position.role"
                            class="text-input"
                            :disabled="selectedEntry.position.type !== 'at_depth'"
                          >
                            <option value="system">system</option>
                            <option value="assistant">assistant</option>
                            <option value="user">user</option>
                          </select>
                        </label>
                        <label class="field" :class="{ disabled: selectedEntry.position.type !== 'at_depth' }">
                          <span>at_depth depth</span>
                          <input
                            v-model.number="selectedEntry.position.depth"
                            type="number"
                            class="text-input"
                            min="1"
                            step="1"
                            :disabled="selectedEntry.position.type !== 'at_depth'"
                          />
                        </label>
                      </div>
                    </article>

                    <article class="editor-card">
                      <h4>递归与效果 (RECURSION)</h4>
                      <label class="field checkbox-inline">
                        <input v-model="selectedEntry.recursion.prevent_incoming" type="checkbox" />
                        <span>不可递归命中 (Exclude Incoming)</span>
                      </label>
                      <label class="field checkbox-inline">
                        <input v-model="selectedEntry.recursion.prevent_outgoing" type="checkbox" />
                        <span>阻止后续递归 (Prevent Outgoing)</span>
                      </label>
                      <label class="field">
                        <span>递归延迟层级</span>
                        <input
                          v-model="selectedRecursionDelayText"
                          type="text"
                          class="text-input"
                          placeholder="留空表示 null"
                        />
                      </label>
                      <div class="editor-grid two-cols">
                        <label class="field">
                          <span>sticky</span>
                          <input
                            v-model="selectedStickyText"
                            type="text"
                            class="text-input"
                            placeholder="留空表示 null"
                          />
                        </label>
                        <label class="field">
                          <span>cooldown</span>
                          <input
                            v-model="selectedCooldownText"
                            type="text"
                            class="text-input"
                            placeholder="留空表示 null"
                          />
                        </label>
                      </div>
                      <label class="field">
                        <span>delay</span>
                        <input
                          v-model="selectedEffectDelayText"
                          type="text"
                          class="text-input"
                          placeholder="留空表示 null"
                        />
                      </label>
                    </article>
                  </aside>
                </div>
              </template>
              <template v-else>
                <div class="empty-block">请选择或新增一个条目后开始编辑。</div>
              </template>
            </main>
          </section>

          <footer class="wb-status">
            <span>{{ isBusy ? '加载中...' : statusMessage }}</span>
            <span>
              当前条目: {{ draftEntries.length }} | 内容字符: {{ totalContentChars }} |
              {{ hasUnsavedChanges ? '存在未保存修改' : '已同步' }}
            </span>
          </footer>

          <div v-if="showEntryHistoryModal" class="wb-modal-backdrop" @click.self="showEntryHistoryModal = false">
            <div class="wb-history-modal">
              <div class="wb-history-modal-header">
                <div>
                  <strong>🕰️ 条目时光机</strong>
                  <span>{{ entryHistorySummary }}</span>
                </div>
                <div class="wb-history-modal-actions">
                  <button class="btn mini" type="button" :disabled="!selectedEntry" @click="createManualEntrySnapshot">
                    记录条目
                  </button>
                  <button
                    class="btn mini danger"
                    type="button"
                    :disabled="!entrySnapshotsForSelected.length"
                    @click="clearCurrentEntrySnapshots"
                  >
                    清空条目历史
                  </button>
                  <button class="btn mini" type="button" @click="showEntryHistoryModal = false">关闭</button>
                </div>
              </div>

              <div class="wb-history-modal-main">
                <aside class="wb-history-versions">
                  <div class="wb-history-versions-title">版本列表（L/R）</div>
                  <div class="wb-history-versions-scroll">
                    <div v-for="ver in entryVersionViews" :key="ver.id" class="wb-history-version-item">
                      <div class="wb-history-version-line">
                        <strong>{{ formatHistoryOptionLabel(ver.label, ver.ts, ver.isCurrent) }}</strong>
                        <div class="wb-history-lr">
                          <button class="mini-lr" :class="{ active: entryHistoryLeftId === ver.id }" @click="entryHistoryLeftId = ver.id">L</button>
                          <button class="mini-lr" :class="{ active: entryHistoryRightId === ver.id }" @click="entryHistoryRightId = ver.id">R</button>
                        </div>
                      </div>
                      <span>{{ ver.name }}</span>
                    </div>
                    <div v-if="entryVersionViews.length <= 1" class="empty-note">暂无历史条目版本</div>
                  </div>
                </aside>

                <section class="wb-history-diff-wrap">
                  <div class="wb-history-diff-head">
                    <div>
                      Left: {{ selectedEntryHistoryLeft ? formatHistoryOptionLabel(selectedEntryHistoryLeft.label, selectedEntryHistoryLeft.ts, selectedEntryHistoryLeft.isCurrent) : '-' }}
                      |
                      Right: {{ selectedEntryHistoryRight ? formatHistoryOptionLabel(selectedEntryHistoryRight.label, selectedEntryHistoryRight.ts, selectedEntryHistoryRight.isCurrent) : '-' }}
                    </div>
                    <button class="btn mini" type="button" :disabled="!canRestoreEntryFromLeft" @click="restoreEntryFromLeftHistory">
                      恢复到 Left
                    </button>
                  </div>
                  <div class="wb-history-diff-grid">
                    <div>
                      <div class="wb-history-diff-title">Left</div>
                      <div class="wb-history-diff-body" v-html="entryHistoryDiff.leftHtml"></div>
                    </div>
                    <div>
                      <div class="wb-history-diff-title">Right</div>
                      <div class="wb-history-diff-body" v-html="entryHistoryDiff.rightHtml"></div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>

          <div v-if="showWorldbookHistoryModal" class="wb-modal-backdrop" @click.self="showWorldbookHistoryModal = false">
            <div class="wb-history-modal">
              <div class="wb-history-modal-header">
                <div>
                  <strong>⏪ 时光机（整本回滚）</strong>
                  <span>{{ getWorldbookVersionDiffSummary(selectedWorldbookHistoryLeft, selectedWorldbookHistoryRight) }}</span>
                </div>
                <div class="wb-history-modal-actions">
                  <button class="btn mini" type="button" :disabled="!selectedWorldbookName" @click="createManualSnapshot">
                    创建整本快照
                  </button>
                  <button
                    class="btn mini danger"
                    type="button"
                    :disabled="!snapshotsForCurrent.length"
                    @click="clearCurrentSnapshots"
                  >
                    清空整本快照
                  </button>
                  <button class="btn mini" type="button" @click="showWorldbookHistoryModal = false">关闭</button>
                </div>
              </div>

              <div class="wb-history-modal-main">
                <aside class="wb-history-versions">
                  <div class="wb-history-versions-title">版本列表（L/R）</div>
                  <div class="wb-history-versions-scroll">
                    <div v-for="ver in worldbookVersionViews" :key="ver.id" class="wb-history-version-item">
                      <div class="wb-history-version-line">
                        <strong>{{ formatHistoryOptionLabel(ver.label, ver.ts, ver.isCurrent) }}</strong>
                        <div class="wb-history-lr">
                          <button class="mini-lr" :class="{ active: worldbookHistoryLeftId === ver.id }" @click="worldbookHistoryLeftId = ver.id">L</button>
                          <button class="mini-lr" :class="{ active: worldbookHistoryRightId === ver.id }" @click="worldbookHistoryRightId = ver.id">R</button>
                        </div>
                      </div>
                      <span>entries: {{ ver.entries.length }}</span>
                    </div>
                  </div>
                </aside>

                <section class="wb-history-diff-wrap">
                  <div class="wb-history-diff-head">
                    <div>
                      Left: {{ selectedWorldbookHistoryLeft ? formatHistoryOptionLabel(selectedWorldbookHistoryLeft.label, selectedWorldbookHistoryLeft.ts, selectedWorldbookHistoryLeft.isCurrent) : '-' }}
                      |
                      Right: {{ selectedWorldbookHistoryRight ? formatHistoryOptionLabel(selectedWorldbookHistoryRight.label, selectedWorldbookHistoryRight.ts, selectedWorldbookHistoryRight.isCurrent) : '-' }}
                    </div>
                    <button
                      class="btn mini"
                      type="button"
                      :disabled="!canRestoreWorldbookFromLeft"
                      @click="restoreWorldbookFromLeftHistory"
                    >
                      恢复到 Left
                    </button>
                  </div>
                  <div class="wb-history-diff-grid">
                    <div>
                      <div class="wb-history-diff-title">Left</div>
                      <div class="wb-history-diff-body" v-html="worldbookHistoryDiff.leftHtml"></div>
                    </div>
                    <div>
                      <div class="wb-history-diff-title">Right</div>
                      <div class="wb-history-diff-body" v-html="worldbookHistoryDiff.rightHtml"></div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>

          <div
            v-if="floatingPanels.find.visible"
            class="wb-floating-window find-window"
            :style="getFloatingPanelStyle('find')"
            @pointerdown="bringFloatingToFront('find')"
          >
            <div class="wb-floating-header" @pointerdown="startFloatingDrag('find', $event)">
              <strong>🔎 查找与替换</strong>
              <div class="wb-floating-header-actions">
                <button
                  class="btn mini"
                  type="button"
                  :disabled="!draftEntries.length"
                  @pointerdown.stop
                  @click="findFirstMatch"
                >
                  查找
                </button>
                <button
                  class="btn mini"
                  type="button"
                  :disabled="!draftEntries.length"
                  @pointerdown.stop
                  @click="findPreviousMatch"
                >
                  上一个
                </button>
                <button
                  class="btn mini"
                  type="button"
                  :disabled="!draftEntries.length"
                  @pointerdown.stop
                  @click="findNextMatch"
                >
                  下一个
                </button>
                <button
                  class="btn mini"
                  type="button"
                  :disabled="!draftEntries.length"
                  @pointerdown.stop
                  @click="applyBatchReplace"
                >
                  替换全部
                </button>
                <button class="btn mini danger" type="button" @pointerdown.stop @click="closeFloatingPanel('find')">
                  关闭
                </button>
              </div>
            </div>
            <div class="wb-floating-body">
              <div class="tool-line stacked">
                <input v-model="batchFindText" type="text" class="text-input" placeholder="查找文本 / 正则" />
                <input v-model="batchReplaceText" type="text" class="text-input" placeholder="替换为" />
                <div class="find-scope-line">
                  <label class="checkbox-inline">
                    <input v-model="batchSearchScope" type="radio" value="all" />
                    <span>全部条目</span>
                  </label>
                  <label class="checkbox-inline">
                    <input v-model="batchSearchScope" type="radio" value="current" :disabled="!selectedEntry" />
                    <span>当前条目</span>
                  </label>
                  <span class="find-summary-text">{{ findHitSummaryText }}</span>
                </div>
                <input
                  v-model="batchExcludeText"
                  type="text"
                  class="text-input"
                  placeholder="排除项：条目名关键词 / #UID（逗号或换行）"
                />
                <div v-if="activeFindHit" class="find-active-hit">
                  <strong>#{{ activeFindHit.entryUid }} {{ activeFindHit.entryName || `条目 ${activeFindHit.entryUid}` }}</strong>
                  <span>{{ getFindFieldLabel(activeFindHit.field) }} · {{ activeFindHit.preview }}</span>
                </div>
                <div class="batch-exclude-note">示例: `#12, name:世界观, 吸血鬼`（命中名称或关键词即排除）</div>
                <div v-if="batchExcludeTokensPreview.length" class="batch-exclude-chips">
                  <span v-for="token in batchExcludeTokensPreview" :key="token" class="exclude-chip">{{ token }}</span>
                </div>
                <div class="find-flags">
                  <label class="checkbox-inline">
                    <input v-model="batchUseRegex" type="checkbox" />
                    <span>正则模式</span>
                  </label>
                  <label class="checkbox-inline">
                    <input v-model="batchInName" type="checkbox" />
                    <span>名称</span>
                  </label>
                  <label class="checkbox-inline">
                    <input v-model="batchInContent" type="checkbox" />
                    <span>内容</span>
                  </label>
                  <label class="checkbox-inline">
                    <input v-model="batchInKeys" type="checkbox" />
                    <span>关键词</span>
                  </label>
                </div>
              </div>
              <details class="tool-details">
                <summary>附加批处理工具</summary>
                <div class="tool-line">
                  <button class="btn" type="button" :disabled="!draftEntries.length" @click="normalizeAllEntries">
                    标准化全部
                  </button>
                  <button class="btn" type="button" :disabled="!draftEntries.length" @click="sortEntriesByOrderDesc">
                    按 order 排序
                  </button>
                </div>
                <div class="tool-line">
                  <button class="btn" type="button" :disabled="!draftEntries.length" @click="setEnabledForAll(true)">
                    全部启用
                  </button>
                  <button class="btn" type="button" :disabled="!draftEntries.length" @click="setEnabledForAll(false)">
                    全部禁用
                  </button>
                </div>
              </details>
            </div>
          </div>

          <div
            v-if="floatingPanels.activation.visible"
            class="wb-floating-window activation-window"
            :style="getFloatingPanelStyle('activation')"
            @pointerdown="bringFloatingToFront('activation')"
          >
            <div class="wb-floating-header" @pointerdown="startFloatingDrag('activation', $event)">
              <strong>📡 激活监控（WORLD_INFO_ACTIVATED）</strong>
              <div class="wb-floating-header-actions">
                <button
                  class="btn mini danger"
                  type="button"
                  :disabled="!activationLogs.length"
                  @pointerdown.stop
                  @click="clearActivationLogs"
                >
                  清空
                </button>
                <button
                  class="btn mini danger"
                  type="button"
                  @pointerdown.stop
                  @click="closeFloatingPanel('activation')"
                >
                  关闭
                </button>
              </div>
            </div>
            <div class="wb-floating-body">
              <div class="tool-scroll">
                <div v-for="log in activationLogs" :key="log.id" class="activation-item">
                  <div class="activation-main">
                    <strong>{{ log.world }}</strong>
                    <span>#{{ log.uid }} · {{ log.name }}</span>
                  </div>
                  <div class="activation-sub">
                    <span>{{ formatDateTime(log.time) }}</span>
                    <span>{{ log.contentPreview }}</span>
                  </div>
                </div>
                <div v-if="!activationLogs.length" class="empty-note">暂无激活记录</div>
              </div>
            </div>
          </div>
  </div>
</template>

<script setup lang="ts">
import { diffLines } from 'https://testingcf.jsdelivr.net/npm/diff/+esm';
import { klona } from 'klona';

type StrategyType = WorldbookEntry['strategy']['type'];
type SecondaryLogic = WorldbookEntry['strategy']['keys_secondary']['logic'];
type PositionType = WorldbookEntry['position']['type'];
type RoleType = WorldbookEntry['position']['role'];
type EntryVisualStatus = 'constant' | 'vector' | 'normal' | 'disabled';
type FloatingPanelKey = 'find' | 'activation';
type PaneResizeKey = 'main' | 'editor';
type BatchSearchScope = 'all' | 'current';
type FindFieldKey = 'name' | 'content' | 'keys';

interface FloatingPanelState {
  visible: boolean;
  x: number;
  y: number;
  z: number;
  width: number;
}

interface PaneResizeState {
  key: PaneResizeKey;
  pointerId: number;
  doc: Document;
  win: Window;
}

interface WorldbookSnapshot {
  id: string;
  label: string;
  ts: number;
  entries: WorldbookEntry[];
}

interface EntrySnapshot {
  id: string;
  label: string;
  ts: number;
  uid: number;
  name: string;
  entry: WorldbookEntry;
}

interface EntryVersionView {
  id: string;
  label: string;
  ts: number;
  name: string;
  entry: WorldbookEntry;
  isCurrent: boolean;
}

interface WorldbookVersionView {
  id: string;
  label: string;
  ts: number;
  entries: WorldbookEntry[];
  isCurrent: boolean;
}

interface PersistedState {
  last_worldbook: string;
  history: Record<string, WorldbookSnapshot[]>;
  entry_history: Record<string, Record<string, EntrySnapshot[]>>;
}

interface ActivationLog {
  id: string;
  time: number;
  world: string;
  uid: number | string;
  name: string;
  contentPreview: string;
}

interface ImportedPayload {
  name: string;
  entries: WorldbookEntry[];
}

interface EventSubscription {
  stop: () => void;
}

interface FindHit {
  entryUid: number;
  entryName: string;
  field: FindFieldKey;
  start: number;
  end: number;
  matchedText: string;
  preview: string;
}

const STORAGE_KEY = 'worldbook_assistant_state_v1';
const DIRTY_STATE_KEY = '__WB_ASSISTANT_HAS_UNSAVED_CHANGES__';
const HISTORY_LIMIT = 12;
const ENTRY_HISTORY_LIMIT = 7;
const ACTIVATION_LOG_LIMIT = 120;
const RESIZE_HANDLE_SIZE = 10;
const MAIN_PANE_MIN = 220;
const MAIN_EDITOR_MIN = 540;
const EDITOR_SIDE_MIN = 280;
const EDITOR_CENTER_MIN = 420;

const strategyTypeOptions: StrategyType[] = ['constant', 'selective', 'vectorized'];
const secondaryLogicOptions: SecondaryLogic[] = ['and_any', 'and_all', 'not_all', 'not_any'];
const positionTypeOptions: PositionType[] = [
  'before_character_definition',
  'after_character_definition',
  'before_example_messages',
  'after_example_messages',
  'before_author_note',
  'after_author_note',
  'at_depth',
];

const worldbookNames = ref<string[]>([]);
const selectedWorldbookName = ref('');
const globalWorldbookMode = ref(false);
const originalEntries = ref<WorldbookEntry[]>([]);
const draftEntries = ref<WorldbookEntry[]>([]);
const selectedEntryUid = ref<number | null>(null);

const searchText = ref('');
const onlyEnabled = ref(false);
const importFileInput = ref<HTMLInputElement | null>(null);
const selectedExtraText = ref('');
const globalAddSearchText = ref('');
const globalFilterText = ref('');

const batchFindText = ref('');
const batchReplaceText = ref('');
const batchExcludeText = ref('');
const batchUseRegex = ref(false);
const batchInName = ref(true);
const batchInContent = ref(true);
const batchInKeys = ref(false);
const batchSearchScope = ref<BatchSearchScope>('all');
const findHits = ref<FindHit[]>([]);
const findHitIndex = ref(-1);

const statusMessage = ref('就绪');
const isBusy = ref(false);
const isSaving = ref(false);
const showEntryHistoryModal = ref(false);
const showWorldbookHistoryModal = ref(false);
const entryHistoryLeftId = ref('');
const entryHistoryRightId = ref('');
const worldbookHistoryLeftId = ref('');
const worldbookHistoryRightId = ref('');
const floatingZCounter = ref(10005);
const floatingPanels = reactive<Record<FloatingPanelKey, FloatingPanelState>>({
  find: { visible: false, x: 420, y: 170, z: 10006, width: 500 },
  activation: { visible: false, x: 760, y: 230, z: 10008, width: 480 },
});
const activeFloatingDrag = ref<{
  key: FloatingPanelKey;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  doc: Document;
  win: Window;
} | null>(null);
const floatingPanelKeys: FloatingPanelKey[] = ['find', 'activation'];
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1440);
const mainLayoutRef = ref<HTMLElement | null>(null);
const editorShellRef = ref<HTMLElement | null>(null);
const mainPaneWidth = ref(320);
const editorSideWidth = ref(360);
const paneResizeState = ref<PaneResizeState | null>(null);
const hostResizeWindow = ref<Window | null>(null);

const bindings = reactive({
  global: [] as string[],
  charPrimary: null as string | null,
  charAdditional: [] as string[],
  chat: null as string | null,
});

const activationLogs = ref<ActivationLog[]>([]);
const persistedState = ref<PersistedState>(createDefaultPersistedState());

const subscriptions: EventSubscription[] = [];

const selectedEntry = computed(() => {
  if (selectedEntryUid.value === null) {
    return null;
  }
  return draftEntries.value.find(entry => entry.uid === selectedEntryUid.value) ?? null;
});

const selectedEntryIndex = computed(() => {
  if (!selectedEntry.value) {
    return -1;
  }
  return draftEntries.value.findIndex(entry => entry.uid === selectedEntry.value?.uid);
});

const filteredEntries = computed(() => {
  const keyword = searchText.value.trim().toLowerCase();
  return draftEntries.value.filter(entry => {
    if (onlyEnabled.value && !entry.enabled) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    const keysJoined = entry.strategy.keys.map(stringifyKeyword).join(' ').toLowerCase();
    return (
      entry.name.toLowerCase().includes(keyword) ||
      entry.content.toLowerCase().includes(keyword) ||
      keysJoined.includes(keyword)
    );
  });
});

const enabledEntryCount = computed(() => draftEntries.value.filter(entry => entry.enabled).length);

const totalContentChars = computed(() =>
  draftEntries.value.reduce((sum, entry) => {
    return sum + entry.content.length;
  }, 0),
);

const hasUnsavedChanges = computed(() => JSON.stringify(draftEntries.value) !== JSON.stringify(originalEntries.value));
const isCompactLayout = computed(() => viewportWidth.value <= 1100);

const mainLayoutStyle = computed<Record<string, string> | undefined>(() => {
  if (isCompactLayout.value) {
    return undefined;
  }
  return {
    gridTemplateColumns: `minmax(${MAIN_PANE_MIN}px, min(${mainPaneWidth.value}px, calc(100% - ${MAIN_EDITOR_MIN + RESIZE_HANDLE_SIZE}px))) ${RESIZE_HANDLE_SIZE}px minmax(0, 1fr)`,
  };
});

const editorShellStyle = computed<Record<string, string> | undefined>(() => {
  if (isCompactLayout.value) {
    return undefined;
  }
  return {
    gridTemplateColumns: `minmax(0, 1fr) ${RESIZE_HANDLE_SIZE}px minmax(${EDITOR_SIDE_MIN}px, min(${editorSideWidth.value}px, calc(100% - ${EDITOR_CENTER_MIN + RESIZE_HANDLE_SIZE}px)))`,
  };
});

const selectableWorldbookNames = computed(() => {
  if (!globalWorldbookMode.value) {
    return worldbookNames.value;
  }
  return bindings.global.filter(name => worldbookNames.value.includes(name));
});

const globalAddCandidates = computed(() => {
  const keyword = globalAddSearchText.value.trim().toLowerCase();
  return worldbookNames.value.filter(name => {
    if (bindings.global.includes(name)) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    return name.toLowerCase().includes(keyword);
  });
});

const filteredGlobalWorldbooks = computed(() => {
  const keyword = globalFilterText.value.trim().toLowerCase();
  if (!keyword) {
    return bindings.global;
  }
  return bindings.global.filter(name => name.toLowerCase().includes(keyword));
});

const isGlobalBound = computed(() => {
  if (!selectedWorldbookName.value) {
    return false;
  }
  return bindings.global.includes(selectedWorldbookName.value);
});

const snapshotsForCurrent = computed(() => {
  if (!selectedWorldbookName.value) {
    return [];
  }
  return persistedState.value.history[selectedWorldbookName.value] ?? [];
});

const entrySnapshotsForSelected = computed(() => {
  if (!selectedWorldbookName.value || !selectedEntry.value) {
    return [];
  }
  const byWorldbook = persistedState.value.entry_history[selectedWorldbookName.value] ?? {};
  return byWorldbook[String(selectedEntry.value.uid)] ?? [];
});

const entryVersionViews = computed<EntryVersionView[]>(() => {
  if (!selectedEntry.value) {
    return [];
  }
  const baselineEntry = originalEntries.value.find(item => item.uid === selectedEntry.value?.uid) ?? null;
  const current: EntryVersionView = {
    id: '__current__',
    label: '当前版本',
    ts: Date.now(),
    name: selectedEntry.value.name,
    entry: selectedEntry.value,
    isCurrent: true,
  };
  const baseline = baselineEntry
    ? ({
        id: '__baseline__',
        label: '加载基线',
        ts: 0,
        name: baselineEntry.name,
        entry: baselineEntry,
        isCurrent: false,
      } satisfies EntryVersionView)
    : null;
  const history = entrySnapshotsForSelected.value.map(item => ({
    id: item.id,
    label: item.label,
    ts: item.ts,
    name: item.name,
    entry: item.entry,
    isCurrent: false,
  }));
  return [current, ...(baseline ? [baseline] : []), ...history];
});

const selectedEntryHistoryLeft = computed(() => {
  return entryVersionViews.value.find(item => item.id === entryHistoryLeftId.value) ?? null;
});

const selectedEntryHistoryRight = computed(() => {
  return entryVersionViews.value.find(item => item.id === entryHistoryRightId.value) ?? null;
});

const canRestoreEntryFromLeft = computed(() => {
  return Boolean(selectedEntry.value && selectedEntryHistoryLeft.value && !selectedEntryHistoryLeft.value.isCurrent);
});

const worldbookVersionViews = computed<WorldbookVersionView[]>(() => {
  if (!selectedWorldbookName.value) {
    return [];
  }
  const current: WorldbookVersionView = {
    id: '__current__',
    label: '当前草稿',
    ts: Date.now(),
    entries: draftEntries.value,
    isCurrent: true,
  };
  const baseline: WorldbookVersionView | null = {
    id: '__baseline__',
    label: '加载基线',
    ts: 0,
    entries: originalEntries.value,
    isCurrent: false,
  };
  const history = snapshotsForCurrent.value.map(item => ({
    id: item.id,
    label: item.label,
    ts: item.ts,
    entries: item.entries,
    isCurrent: false,
  }));
  return [current, ...(originalEntries.value.length ? [baseline] : []), ...history];
});

const selectedWorldbookHistoryLeft = computed(() => {
  return worldbookVersionViews.value.find(item => item.id === worldbookHistoryLeftId.value) ?? null;
});

const selectedWorldbookHistoryRight = computed(() => {
  return worldbookVersionViews.value.find(item => item.id === worldbookHistoryRightId.value) ?? null;
});

const canRestoreWorldbookFromLeft = computed(() => {
  return Boolean(selectedWorldbookHistoryLeft.value && !selectedWorldbookHistoryLeft.value.isCurrent);
});

const batchExcludeTokensPreview = computed(() => parseBatchExcludeTokens(batchExcludeText.value));

const activeFindHit = computed(() => {
  if (findHitIndex.value < 0 || findHitIndex.value >= findHits.value.length) {
    return null;
  }
  return findHits.value[findHitIndex.value] ?? null;
});

const findHitSummaryText = computed(() => {
  if (!batchFindText.value.trim()) {
    return '输入查找文本后可定位';
  }
  if (!findHits.value.length) {
    return '暂无匹配';
  }
  if (!activeFindHit.value) {
    return `匹配 0 / ${findHits.value.length}`;
  }
  return `匹配 ${findHitIndex.value + 1} / ${findHits.value.length}`;
});

const entryHistoryDiff = computed(() => {
  return buildDiffHtml(
    serializeEntryVersionForDiff(selectedEntryHistoryLeft.value),
    serializeEntryVersionForDiff(selectedEntryHistoryRight.value),
  );
});

const entryHistorySummary = computed(() => {
  return getEntryVersionDiffSummary(selectedEntryHistoryLeft.value, selectedEntryHistoryRight.value);
});

const worldbookHistoryDiff = computed(() => {
  return buildDiffHtml(
    serializeWorldbookVersionForDiff(selectedWorldbookHistoryLeft.value),
    serializeWorldbookVersionForDiff(selectedWorldbookHistoryRight.value),
  );
});

const selectedKeysText = computed({
  get: () => {
    if (!selectedEntry.value) {
      return '';
    }
    return selectedEntry.value.strategy.keys.map(stringifyKeyword).join(', ');
  },
  set: (value: string) => {
    if (!selectedEntry.value) {
      return;
    }
    selectedEntry.value.strategy.keys = parseKeywordsFromText(value);
  },
});

const selectedSecondaryKeysText = computed({
  get: () => {
    if (!selectedEntry.value) {
      return '';
    }
    return selectedEntry.value.strategy.keys_secondary.keys.map(stringifyKeyword).join(', ');
  },
  set: (value: string) => {
    if (!selectedEntry.value) {
      return;
    }
    selectedEntry.value.strategy.keys_secondary.keys = parseKeywordsFromText(value);
  },
});

const selectedScanDepthText = computed({
  get: () => {
    if (!selectedEntry.value) {
      return '';
    }
    const depth = selectedEntry.value.strategy.scan_depth;
    return typeof depth === 'number' ? String(depth) : 'same_as_global';
  },
  set: (value: string) => {
    if (!selectedEntry.value) {
      return;
    }
    selectedEntry.value.strategy.scan_depth = normalizeScanDepth(value);
  },
});

const selectedRecursionDelayText = computed({
  get: () => (selectedEntry.value ? nullableNumberToText(selectedEntry.value.recursion.delay_until) : ''),
  set: (value: string) => {
    if (!selectedEntry.value) {
      return;
    }
    selectedEntry.value.recursion.delay_until = parseNullableInteger(value);
  },
});

const selectedStickyText = computed({
  get: () => (selectedEntry.value ? nullableNumberToText(selectedEntry.value.effect.sticky) : ''),
  set: (value: string) => {
    if (!selectedEntry.value) {
      return;
    }
    selectedEntry.value.effect.sticky = parseNullableInteger(value);
  },
});

const selectedCooldownText = computed({
  get: () => (selectedEntry.value ? nullableNumberToText(selectedEntry.value.effect.cooldown) : ''),
  set: (value: string) => {
    if (!selectedEntry.value) {
      return;
    }
    selectedEntry.value.effect.cooldown = parseNullableInteger(value);
  },
});

const selectedEffectDelayText = computed({
  get: () => (selectedEntry.value ? nullableNumberToText(selectedEntry.value.effect.delay) : ''),
  set: (value: string) => {
    if (!selectedEntry.value) {
      return;
    }
    selectedEntry.value.effect.delay = parseNullableInteger(value);
  },
});

const selectedContentChars = computed(() => {
  return selectedEntry.value?.content.length ?? 0;
});

const selectedTokenEstimate = computed(() => {
  const chars = selectedContentChars.value;
  if (chars <= 0) {
    return 0;
  }
  return Math.max(1, Math.round(chars / 3.6));
});

watch(selectedWorldbookName, name => {
  if (!name) {
    draftEntries.value = [];
    originalEntries.value = [];
    selectedEntryUid.value = null;
    return;
  }
  updatePersistedState(state => {
    state.last_worldbook = name;
  });
  void loadWorldbook(name);
});

watch(
  () => selectedEntryUid.value,
  () => {
    syncExtraTextWithSelection();
  },
);

watch(
  [
    batchFindText,
    batchReplaceText,
    batchExcludeText,
    batchUseRegex,
    batchInName,
    batchInContent,
    batchInKeys,
    batchSearchScope,
    selectedEntryUid,
  ],
  () => {
    resetFindState();
  },
);

watch(
  entryVersionViews,
  views => {
    if (!views.length) {
      entryHistoryLeftId.value = '';
      entryHistoryRightId.value = '';
      return;
    }

    const ids = new Set(views.map(item => item.id));
    if (!ids.has(entryHistoryRightId.value)) {
      entryHistoryRightId.value = '__current__';
    }
    if (!ids.has(entryHistoryLeftId.value)) {
      const fallback = views.find(item => !item.isCurrent) ?? views[0];
      entryHistoryLeftId.value = fallback.id;
    }
    if (entryHistoryLeftId.value === entryHistoryRightId.value && views.length > 1) {
      const fallback = views.find(item => item.id !== entryHistoryRightId.value);
      if (fallback) {
        entryHistoryLeftId.value = fallback.id;
      }
    }
  },
  { immediate: true },
);

watch(
  worldbookVersionViews,
  views => {
    if (!views.length) {
      worldbookHistoryLeftId.value = '';
      worldbookHistoryRightId.value = '';
      return;
    }

    const ids = new Set(views.map(item => item.id));
    if (!ids.has(worldbookHistoryRightId.value)) {
      worldbookHistoryRightId.value = '__current__';
    }
    if (!ids.has(worldbookHistoryLeftId.value)) {
      const fallback = views.find(item => !item.isCurrent) ?? views[0];
      worldbookHistoryLeftId.value = fallback.id;
    }
    if (worldbookHistoryLeftId.value === worldbookHistoryRightId.value && views.length > 1) {
      const fallback = views.find(item => item.id !== worldbookHistoryRightId.value);
      if (fallback) {
        worldbookHistoryLeftId.value = fallback.id;
      }
    }
  },
  { immediate: true },
);

watch(
  () => selectedEntry.value?.position.type,
  () => {
    if (!selectedEntry.value) {
      return;
    }
    if (selectedEntry.value.position.type !== 'at_depth') {
      selectedEntry.value.position.role = 'system';
      selectedEntry.value.position.depth = 4;
    }
  },
);

watch(
  hasUnsavedChanges,
  dirty => {
    const target = window as unknown as Record<string, unknown>;
    target[DIRTY_STATE_KEY] = dirty;
  },
  { immediate: true },
);

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function toStringSafe(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

function toNumberSafe(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseNullableInteger(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' && !value.trim()) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.floor(parsed));
}

function nullableNumberToText(value: number | null): string {
  return value === null ? '' : String(value);
}

function stringifyKeyword(value: string | RegExp): string {
  return value instanceof RegExp ? value.toString() : value;
}

function parseKeywordToken(token: string): string | RegExp {
  const trimmed = token.trim();
  if (!trimmed) {
    return '';
  }
  const regexMatch = trimmed.match(/^\/(.+)\/([dgimsuy]*)$/);
  if (!regexMatch) {
    return trimmed;
  }
  try {
    return new RegExp(regexMatch[1], regexMatch[2]);
  } catch {
    return trimmed;
  }
}

function normalizeKeywordList(value: unknown): (string | RegExp)[] {
  const sourceList = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,]/g) : [];
  const normalized: (string | RegExp)[] = [];
  const seen = new Set<string>();

  for (const item of sourceList) {
    const token = item instanceof RegExp ? item : parseKeywordToken(toStringSafe(item).trim());
    const tokenString = stringifyKeyword(token);
    if (!tokenString) {
      continue;
    }
    const dedupeKey = tokenString.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    normalized.push(token);
  }

  return normalized;
}

function parseKeywordsFromText(value: string): (string | RegExp)[] {
  return normalizeKeywordList(value.split(/[\n,]/g));
}

function getStrategyTypeLabel(type: StrategyType): string {
  if (type === 'constant') {
    return '🔵 常驻 (constant)';
  }
  if (type === 'vectorized') {
    return '📎 向量化 (vectorized)';
  }
  return '🟢 关键词 (selective)';
}

function getSecondaryLogicLabel(logic: SecondaryLogic): string {
  const map: Record<SecondaryLogic, string> = {
    and_any: '任一命中 (and_any)',
    and_all: '全部命中 (and_all)',
    not_all: '不全命中 (not_all)',
    not_any: '全部不命中 (not_any)',
  };
  return map[logic];
}

function getPositionTypeLabel(type: PositionType): string {
  const map: Record<PositionType, string> = {
    before_character_definition: '角色设定前',
    after_character_definition: '角色设定后',
    before_example_messages: '示例消息前',
    after_example_messages: '示例消息后',
    before_author_note: '作者注释前',
    after_author_note: '作者注释后',
    at_depth: '指定深度插入',
  };
  return map[type];
}

function getEntryVisualStatus(entry: WorldbookEntry): EntryVisualStatus {
  if (!entry.enabled) {
    return 'disabled';
  }
  if (entry.strategy.type === 'constant') {
    return 'constant';
  }
  if (entry.strategy.type === 'vectorized') {
    return 'vector';
  }
  return 'normal';
}

function getEntryStatusLabel(entry: WorldbookEntry): string {
  const status = getEntryVisualStatus(entry);
  if (status === 'disabled') {
    return '⚫ 禁用';
  }
  if (status === 'constant') {
    return '🔵 常驻';
  }
  if (status === 'vector') {
    return '📎 向量化';
  }
  return '🟢 关键词';
}

function getEntryKeyPreview(entry: WorldbookEntry): string {
  const rendered = entry.strategy.keys
    .slice(0, 3)
    .map(key => stringifyKeyword(key))
    .join(' / ');
  if (!rendered) {
    return '无关键词';
  }
  if (entry.strategy.keys.length > 3) {
    return `${rendered} ...`;
  }
  return rendered;
}

function normalizeSecondaryLogic(value: unknown): SecondaryLogic {
  if (typeof value === 'string' && secondaryLogicOptions.includes(value as SecondaryLogic)) {
    return value as SecondaryLogic;
  }
  if (typeof value === 'number') {
    const map: SecondaryLogic[] = ['and_any', 'and_all', 'not_all', 'not_any'];
    return map[value] ?? 'and_any';
  }
  return 'and_any';
}

function normalizeStrategyType(
  raw: Record<string, unknown>,
  strategyRecord: Record<string, unknown> | null,
): StrategyType {
  const directType = strategyRecord?.type;
  if (typeof directType === 'string' && strategyTypeOptions.includes(directType as StrategyType)) {
    return directType as StrategyType;
  }
  if (raw.constant) {
    return 'constant';
  }
  if (raw.vectorized) {
    return 'vectorized';
  }
  return 'selective';
}

function normalizePositionType(value: unknown): PositionType {
  if (typeof value === 'string') {
    if (positionTypeOptions.includes(value as PositionType)) {
      return value as PositionType;
    }
    const depthMatch = value.match(/^at_depth_as_(system|assistant|user)$/);
    if (depthMatch) {
      return 'at_depth';
    }
  }
  if (typeof value === 'number') {
    const map: Record<number, PositionType> = {
      0: 'before_character_definition',
      1: 'after_character_definition',
      2: 'before_example_messages',
      3: 'after_example_messages',
      4: 'before_author_note',
      5: 'after_author_note',
      6: 'at_depth',
    };
    return map[value] ?? 'after_character_definition';
  }
  return 'after_character_definition';
}

function normalizeRole(value: unknown): RoleType {
  if (value === 'assistant' || value === 'user' || value === 'system') {
    return value;
  }
  if (typeof value === 'number') {
    const map: Record<number, RoleType> = {
      0: 'system',
      1: 'assistant',
      2: 'user',
    };
    return map[value] ?? 'system';
  }
  if (typeof value === 'string') {
    if (value.includes('assistant')) {
      return 'assistant';
    }
    if (value.includes('user')) {
      return 'user';
    }
  }
  return 'system';
}

function normalizeScanDepth(value: unknown): 'same_as_global' | number {
  if (value === 'same_as_global') {
    return 'same_as_global';
  }
  const numeric = Math.floor(toNumberSafe(value, NaN));
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }
  return 'same_as_global';
}

function createDefaultEntry(uid: number): WorldbookEntry {
  return {
    uid,
    name: `条目 ${uid}`,
    enabled: true,
    strategy: {
      type: 'selective',
      keys: [],
      keys_secondary: {
        logic: 'and_any',
        keys: [],
      },
      scan_depth: 'same_as_global',
    },
    position: {
      type: 'after_character_definition',
      role: 'system',
      depth: 4,
      order: 100,
    },
    content: '',
    probability: 100,
    recursion: {
      prevent_incoming: false,
      prevent_outgoing: false,
      delay_until: null,
    },
    effect: {
      sticky: null,
      cooldown: null,
      delay: null,
    },
  };
}

function collectExtraFields(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  const known = new Set([
    'uid',
    'id',
    'name',
    'comment',
    'enabled',
    'disable',
    'strategy',
    'position',
    'content',
    'probability',
    'recursion',
    'effect',
    'extra',
    'keys',
    'key',
    'secondary_keys',
    'keysecondary',
    'filters',
    'logic',
    'selectiveLogic',
    'scan_depth',
    'constant',
    'vectorized',
    'selective',
    'insertion_order',
    'order',
    'role',
    'depth',
    'preventRecursion',
    'excludeRecursion',
    'delayUntilRecursion',
    'sticky',
    'cooldown',
    'delay',
    'useProbability',
  ]);

  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!known.has(key)) {
      extra[key] = value;
    }
  }
  if (Object.keys(extra).length === 0) {
    return undefined;
  }
  return extra;
}

function normalizeEntry(rawInput: unknown, fallbackUid: number): WorldbookEntry {
  const raw = asRecord(rawInput) ?? {};
  const base = createDefaultEntry(fallbackUid);
  const strategyRecord = asRecord(raw.strategy);
  const positionRecord = asRecord(raw.position);
  const recursionRecord = asRecord(raw.recursion);
  const effectRecord = asRecord(raw.effect);
  const secondaryRecord = asRecord(strategyRecord?.keys_secondary);

  const uid = Math.max(0, Math.floor(toNumberSafe(raw.uid ?? raw.id, fallbackUid)));
  const name = toStringSafe(raw.name ?? raw.comment, `条目 ${uid}`).trim() || `条目 ${uid}`;
  const strategyType = normalizeStrategyType(raw, strategyRecord);
  const keys = normalizeKeywordList(strategyRecord?.keys ?? raw.keys ?? raw.key);
  const secondaryKeys = normalizeKeywordList(
    secondaryRecord?.keys ?? raw.secondary_keys ?? raw.keysecondary ?? raw.filters,
  );
  const secondaryLogic = normalizeSecondaryLogic(secondaryRecord?.logic ?? raw.logic ?? raw.selectiveLogic);
  const positionType = normalizePositionType(positionRecord?.type ?? raw.position);
  const role = normalizeRole(positionRecord?.role ?? raw.role);
  const depth = Math.max(1, Math.floor(toNumberSafe(positionRecord?.depth ?? raw.depth, 4)));
  const order = Math.floor(toNumberSafe(positionRecord?.order ?? raw.insertion_order ?? raw.order, 100));
  const probability = clampNumber(toNumberSafe(raw.probability, 100), 0, 100);

  const preventIncoming = recursionRecord?.prevent_incoming ?? raw.preventRecursion;
  const preventOutgoing = recursionRecord?.prevent_outgoing ?? raw.excludeRecursion;

  const entry: WorldbookEntry = {
    ...base,
    uid,
    name,
    enabled: raw.enabled === undefined ? raw.disable !== true : raw.enabled,
    strategy: {
      type: strategyType,
      keys,
      keys_secondary: {
        logic: secondaryLogic,
        keys: secondaryKeys,
      },
      scan_depth: normalizeScanDepth(strategyRecord?.scan_depth ?? raw.scan_depth),
    },
    position: {
      type: positionType,
      role: positionType === 'at_depth' ? role : 'system',
      depth: positionType === 'at_depth' ? depth : 4,
      order,
    },
    content: toStringSafe(raw.content),
    probability,
    recursion: {
      prevent_incoming: Boolean(preventIncoming),
      prevent_outgoing: Boolean(preventOutgoing),
      delay_until: parseNullableInteger(recursionRecord?.delay_until ?? raw.delayUntilRecursion),
    },
    effect: {
      sticky: parseNullableInteger(effectRecord?.sticky ?? raw.sticky),
      cooldown: parseNullableInteger(effectRecord?.cooldown ?? raw.cooldown),
      delay: parseNullableInteger(effectRecord?.delay ?? raw.delay),
    },
  };

  const directExtra = asRecord(raw.extra);
  if (directExtra && Object.keys(directExtra).length > 0) {
    entry.extra = klona(directExtra);
  } else {
    const extras = collectExtraFields(raw);
    if (extras) {
      entry.extra = klona(extras);
    }
  }

  return entry;
}

function normalizeEntryList(rawEntries: unknown[]): WorldbookEntry[] {
  const result: WorldbookEntry[] = [];
  const uidSet = new Set<number>();

  for (let index = 0; index < rawEntries.length; index += 1) {
    const rawRecord = asRecord(rawEntries[index]);
    let uid = Math.max(0, Math.floor(toNumberSafe(rawRecord?.uid ?? rawRecord?.id, index)));
    while (uidSet.has(uid)) {
      uid += 1;
    }
    uidSet.add(uid);
    result.push(normalizeEntry(rawEntries[index], uid));
  }

  return result;
}

function getNextUid(entries: WorldbookEntry[]): number {
  if (entries.length === 0) {
    return 0;
  }
  return Math.max(...entries.map(entry => entry.uid)) + 1;
}

function createDefaultPersistedState(): PersistedState {
  return {
    last_worldbook: '',
    history: {},
    entry_history: {},
  };
}

function normalizePersistedState(input: unknown): PersistedState {
  const root = asRecord(input);
  if (!root) {
    return createDefaultPersistedState();
  }

  const historyRoot = asRecord(root.history) ?? {};
  const history: Record<string, WorldbookSnapshot[]> = {};
  for (const [name, rawSnapshots] of Object.entries(historyRoot)) {
    if (!Array.isArray(rawSnapshots)) {
      continue;
    }
    history[name] = rawSnapshots
      .map(item => {
        const record = asRecord(item);
        if (!record) {
          return null;
        }
        const entriesRaw = Array.isArray(record.entries) ? record.entries : [];
        return {
          id: toStringSafe(record.id, createId('snapshot')),
          label: toStringSafe(record.label, '快照'),
          ts: toNumberSafe(record.ts, Date.now()),
          entries: normalizeEntryList(entriesRaw),
        } satisfies WorldbookSnapshot;
      })
      .filter((item): item is WorldbookSnapshot => item !== null)
      .slice(0, HISTORY_LIMIT);
  }

  const entryHistoryRoot = asRecord(root.entry_history) ?? {};
  const entryHistory: Record<string, Record<string, EntrySnapshot[]>> = {};
  for (const [worldbookName, rawByUid] of Object.entries(entryHistoryRoot)) {
    const uidRecord = asRecord(rawByUid);
    if (!uidRecord) {
      continue;
    }
    const normalizedByUid: Record<string, EntrySnapshot[]> = {};
    for (const [uidKey, rawItems] of Object.entries(uidRecord)) {
      if (!Array.isArray(rawItems)) {
        continue;
      }
      const uidNumber = Math.max(0, Math.floor(toNumberSafe(uidKey, 0)));
      normalizedByUid[uidKey] = rawItems
        .map(item => {
          const record = asRecord(item);
          if (!record) {
            return null;
          }
          return {
            id: toStringSafe(record.id, createId('entry-snapshot')),
            label: toStringSafe(record.label, '条目快照'),
            ts: toNumberSafe(record.ts, Date.now()),
            uid: uidNumber,
            name: toStringSafe(record.name, `条目 ${uidNumber}`),
            entry: normalizeEntry(record.entry, uidNumber),
          } satisfies EntrySnapshot;
        })
        .filter((item): item is EntrySnapshot => item !== null)
        .slice(0, ENTRY_HISTORY_LIMIT);
    }
    if (Object.keys(normalizedByUid).length > 0) {
      entryHistory[worldbookName] = normalizedByUid;
    }
  }

  return {
    last_worldbook: toStringSafe(root.last_worldbook),
    history,
    entry_history: entryHistory,
  };
}

function readPersistedState(): PersistedState {
  const vars = getVariables({ type: 'script', script_id: getScriptId() });
  return normalizePersistedState(vars[STORAGE_KEY]);
}

function writePersistedState(state: PersistedState): void {
  const vars = getVariables({ type: 'script', script_id: getScriptId() });
  vars[STORAGE_KEY] = state;
  replaceVariables(vars, { type: 'script', script_id: getScriptId() });
  persistedState.value = state;
}

function updatePersistedState(mutator: (state: PersistedState) => void): void {
  const state = readPersistedState();
  mutator(state);
  writePersistedState(state);
}

function setStatus(message: string): void {
  statusMessage.value = message;
}

function syncExtraTextWithSelection(): void {
  if (!selectedEntry.value || !selectedEntry.value.extra) {
    selectedExtraText.value = '';
    return;
  }
  selectedExtraText.value = JSON.stringify(selectedEntry.value.extra, null, 2);
}

function formatDateTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return String(timestamp);
  }
}

function formatHistoryOptionLabel(label: string, ts: number, isCurrent: boolean): string {
  if (isCurrent) {
    return 'Current（当前）';
  }
  if (label === '加载基线' || ts <= 0) {
    return label;
  }
  return `${label} · ${formatDateTime(ts)}`;
}

function getEntryVersionPreview(view: EntryVersionView | null): string {
  if (!view) {
    return '';
  }
  const content = toStringSafe(view.entry.content).replace(/\s+/g, ' ').trim();
  if (!content) {
    return '(空内容)';
  }
  return content.slice(0, 160);
}

function getWorldbookVersionDiffSummary(
  left: WorldbookVersionView | null,
  right: WorldbookVersionView | null,
): string {
  if (!left || !right) {
    return '请选择左右版本进行对比';
  }
  const leftMap = new Map<number, WorldbookEntry>();
  const rightMap = new Map<number, WorldbookEntry>();
  left.entries.forEach(entry => leftMap.set(entry.uid, entry));
  right.entries.forEach(entry => rightMap.set(entry.uid, entry));

  let added = 0;
  let removed = 0;
  let changed = 0;

  for (const [uid, rightEntry] of rightMap) {
    const leftEntry = leftMap.get(uid);
    if (!leftEntry) {
      added += 1;
      continue;
    }
    if (JSON.stringify(leftEntry) !== JSON.stringify(rightEntry)) {
      changed += 1;
    }
  }
  for (const uid of leftMap.keys()) {
    if (!rightMap.has(uid)) {
      removed += 1;
    }
  }

  return `新增 ${added} / 修改 ${changed} / 删除 ${removed}`;
}

function getEntryVersionDiffSummary(left: EntryVersionView | null, right: EntryVersionView | null): string {
  if (!left || !right) {
    return '请在左侧选择两个版本进行比对';
  }
  const leftText = serializeEntryVersionForDiff(left);
  const rightText = serializeEntryVersionForDiff(right);
  const parts = diffLines(leftText, rightText) as Array<{ value: string; added?: boolean; removed?: boolean }>;
  let addLines = 0;
  let delLines = 0;
  for (const part of parts) {
    const lines = part.value.split('\n');
    if (lines.length && lines[lines.length - 1] === '') {
      lines.pop();
    }
    if (part.added) {
      addLines += lines.length;
    } else if (part.removed) {
      delLines += lines.length;
    }
  }
  const changed = Math.min(addLines, delLines);
  const added = Math.max(0, addLines - changed);
  const removed = Math.max(0, delLines - changed);
  return `新增行 ${added} / 修改行 ${changed} / 删除行 ${removed}`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function serializeEntryVersionForDiff(view: EntryVersionView | null): string {
  if (!view) {
    return '';
  }
  const entry = view.entry;
  const payload = {
    uid: entry.uid,
    name: entry.name,
    enabled: entry.enabled,
    strategy: entry.strategy,
    position: entry.position,
    probability: entry.probability,
    recursion: entry.recursion,
    effect: entry.effect,
    content: entry.content,
    extra: entry.extra ?? null,
  };
  return JSON.stringify(payload, null, 2);
}

function serializeWorldbookVersionForDiff(view: WorldbookVersionView | null): string {
  if (!view) {
    return '';
  }
  const entries = view.entries
    .map(entry => ({
      uid: entry.uid,
      name: entry.name,
      enabled: entry.enabled,
      type: entry.strategy.type,
      keys: entry.strategy.keys.map(stringifyKeyword),
      position: entry.position,
      probability: entry.probability,
      content: entry.content,
    }))
    .sort((left, right) => left.uid - right.uid);
  return JSON.stringify({ entries }, null, 2);
}

function buildDiffHtml(leftText: string, rightText: string): { leftHtml: string; rightHtml: string } {
  const leftRendered: string[] = [];
  const rightRendered: string[] = [];
  let leftLineNo = 1;
  let rightLineNo = 1;
  const parts = diffLines(leftText, rightText);

  for (const part of parts as Array<{ value: string; added?: boolean; removed?: boolean }>) {
    const lines = part.value.split('\n');
    if (lines.length && lines[lines.length - 1] === '') {
      lines.pop();
    }
    if (!lines.length) {
      continue;
    }

    if (part.added) {
      for (const line of lines) {
        leftRendered.push(`<div class="diff-row empty"><span class="line-no"></span><span class="line-text">&nbsp;</span></div>`);
        rightRendered.push(
          `<div class="diff-row add"><span class="line-no">${rightLineNo}</span><span class="line-text">${escapeHtml(line) || '&nbsp;'}</span></div>`,
        );
        rightLineNo += 1;
      }
      continue;
    }

    if (part.removed) {
      for (const line of lines) {
        leftRendered.push(
          `<div class="diff-row del"><span class="line-no">${leftLineNo}</span><span class="line-text">${escapeHtml(line) || '&nbsp;'}</span></div>`,
        );
        rightRendered.push(`<div class="diff-row empty"><span class="line-no"></span><span class="line-text">&nbsp;</span></div>`);
        leftLineNo += 1;
      }
      continue;
    }

    for (const line of lines) {
      const safe = escapeHtml(line) || '&nbsp;';
      leftRendered.push(`<div class="diff-row"><span class="line-no">${leftLineNo}</span><span class="line-text">${safe}</span></div>`);
      rightRendered.push(`<div class="diff-row"><span class="line-no">${rightLineNo}</span><span class="line-text">${safe}</span></div>`);
      leftLineNo += 1;
      rightLineNo += 1;
    }
  }

  return {
    leftHtml: leftRendered.join(''),
    rightHtml: rightRendered.join(''),
  };
}

function parseBatchExcludeTokens(value: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const raw of value.split(/[\n,]/g)) {
    const token = raw.trim().toLowerCase();
    if (!token || seen.has(token)) {
      continue;
    }
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function shouldExcludeEntryForBatch(entry: WorldbookEntry, tokens: string[]): boolean {
  if (!tokens.length) {
    return false;
  }
  const name = entry.name.toLowerCase();
  const keys = entry.strategy.keys.map(key => stringifyKeyword(key).toLowerCase()).join(' ');

  for (const token of tokens) {
    const uidMatch = token.match(/^(?:#|uid:)?(\d+)$/);
    if (uidMatch && Number(uidMatch[1]) === entry.uid) {
      return true;
    }

    const plain = token.replace(/^name:/, '').trim();
    if (plain && (name.includes(plain) || keys.includes(plain))) {
      return true;
    }
  }
  return false;
}

function getFindFieldLabel(field: FindFieldKey): string {
  if (field === 'name') {
    return '名称';
  }
  if (field === 'content') {
    return '内容';
  }
  return '关键词';
}

function resolveBatchRegex(findText: string): RegExp | null {
  if (!batchUseRegex.value) {
    return null;
  }
  try {
    return new RegExp(findText, 'g');
  } catch (error) {
    toastr.error(`正则表达式无效: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function getBatchTargetEntries(): WorldbookEntry[] {
  if (batchSearchScope.value === 'current') {
    return selectedEntry.value ? [selectedEntry.value] : [];
  }
  return draftEntries.value;
}

function getEnabledFindFields(): FindFieldKey[] {
  const fields: FindFieldKey[] = [];
  if (batchInName.value) {
    fields.push('name');
  }
  if (batchInContent.value) {
    fields.push('content');
  }
  if (batchInKeys.value) {
    fields.push('keys');
  }
  return fields;
}

function getEntryFieldText(entry: WorldbookEntry, field: FindFieldKey): string {
  if (field === 'name') {
    return entry.name;
  }
  if (field === 'content') {
    return entry.content;
  }
  return entry.strategy.keys.map(key => stringifyKeyword(key)).join(', ');
}

function collectMatchIndexes(text: string, findText: string, regex: RegExp | null): Array<{ start: number; end: number; matchedText: string }> {
  const hits: Array<{ start: number; end: number; matchedText: string }> = [];
  if (!text || !findText) {
    return hits;
  }

  if (!regex) {
    let cursor = 0;
    while (cursor <= text.length) {
      const start = text.indexOf(findText, cursor);
      if (start < 0) {
        break;
      }
      const end = start + findText.length;
      hits.push({
        start,
        end,
        matchedText: text.slice(start, end),
      });
      cursor = Math.max(end, start + 1);
    }
    return hits;
  }

  const runtime = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  let result: RegExpExecArray | null = null;
  while ((result = runtime.exec(text)) !== null) {
    const matched = result[0] ?? '';
    if (!matched) {
      runtime.lastIndex += 1;
      continue;
    }
    const start = result.index;
    const end = start + matched.length;
    hits.push({
      start,
      end,
      matchedText: matched,
    });
  }
  return hits;
}

function buildFindPreview(text: string, start: number, end: number): string {
  const left = Math.max(0, start - 18);
  const right = Math.min(text.length, end + 22);
  const prefix = left > 0 ? '...' : '';
  const suffix = right < text.length ? '...' : '';
  return `${prefix}${text.slice(left, right).replace(/\s+/g, ' ')}${suffix}`;
}

function collectFindHits(findText: string, regex: RegExp | null, excludeTokens: string[]): FindHit[] {
  const fields = getEnabledFindFields();
  if (!fields.length) {
    return [];
  }
  const entries = getBatchTargetEntries();
  const hits: FindHit[] = [];

  for (const entry of entries) {
    if (shouldExcludeEntryForBatch(entry, excludeTokens)) {
      continue;
    }
    for (const field of fields) {
      const text = getEntryFieldText(entry, field);
      const indexes = collectMatchIndexes(text, findText, regex);
      for (const match of indexes) {
        hits.push({
          entryUid: entry.uid,
          entryName: entry.name,
          field,
          start: match.start,
          end: match.end,
          matchedText: match.matchedText,
          preview: buildFindPreview(text, match.start, match.end),
        });
      }
    }
  }

  return hits;
}

function isSameFindHit(left: FindHit, right: FindHit): boolean {
  return (
    left.entryUid === right.entryUid &&
    left.field === right.field &&
    left.start === right.start &&
    left.end === right.end &&
    left.matchedText === right.matchedText
  );
}

function resetFindState(): void {
  findHits.value = [];
  findHitIndex.value = -1;
}

function moveToFindHit(hit: FindHit, index: number, total: number): void {
  findHitIndex.value = index;
  selectedEntryUid.value = hit.entryUid;
  const entryLabel = hit.entryName || `条目 ${hit.entryUid}`;
  setStatus(`查找 ${index + 1}/${total}: ${entryLabel} · ${getFindFieldLabel(hit.field)} · ${hit.preview}`);
}

function runFind(step: -1 | 0 | 1): void {
  const findText = batchFindText.value;
  if (!findText) {
    toastr.warning('请先输入查找文本');
    return;
  }

  if (!getEnabledFindFields().length) {
    toastr.warning('请至少勾选一个查找字段');
    return;
  }

  if (batchSearchScope.value === 'current' && !selectedEntry.value) {
    toastr.warning('当前条目模式下请先选择一个条目');
    return;
  }

  const excludeTokens = parseBatchExcludeTokens(batchExcludeText.value);
  const regex = resolveBatchRegex(findText);
  if (batchUseRegex.value && !regex) {
    return;
  }

  const hits = collectFindHits(findText, regex, excludeTokens);
  findHits.value = hits;

  if (!hits.length) {
    findHitIndex.value = -1;
    setStatus('查找完成：未找到匹配');
    toastr.info('未找到匹配项');
    return;
  }

  if (step === 0) {
    moveToFindHit(hits[0], 0, hits.length);
    return;
  }

  const prevHit = activeFindHit.value;
  const currentIndex = prevHit ? hits.findIndex(item => isSameFindHit(item, prevHit)) : findHitIndex.value;
  let nextIndex: number;
  if (currentIndex < 0) {
    nextIndex = step > 0 ? 0 : hits.length - 1;
  } else {
    nextIndex = (currentIndex + step + hits.length) % hits.length;
  }
  moveToFindHit(hits[nextIndex], nextIndex, hits.length);
}

function findFirstMatch(): void {
  runFind(0);
}

function findNextMatch(): void {
  runFind(1);
}

function findPreviousMatch(): void {
  runFind(-1);
}

function ensureSelectedEntryExists(): void {
  if (!draftEntries.value.length) {
    selectedEntryUid.value = null;
    return;
  }
  if (selectedEntryUid.value === null) {
    selectedEntryUid.value = draftEntries.value[0].uid;
    return;
  }
  const exists = draftEntries.value.some(entry => entry.uid === selectedEntryUid.value);
  if (!exists) {
    selectedEntryUid.value = draftEntries.value[0].uid;
  }
}

function selectEntry(uid: number): void {
  selectedEntryUid.value = uid;
}

function createEntrySnapshotRecord(
  label: string,
  uid: number,
  name: string,
  entry: WorldbookEntry,
): EntrySnapshot {
  return {
    id: createId('entry-snapshot'),
    label,
    ts: Date.now(),
    uid,
    name: name || `条目 ${uid}`,
    entry: normalizeEntry(klona(entry), uid),
  };
}

function pushEntrySnapshotsBulk(
  items: Array<{
    label: string;
    uid: number;
    name: string;
    entry: WorldbookEntry;
  }>,
): number {
  if (!selectedWorldbookName.value || !items.length) {
    return 0;
  }

  let added = 0;
  const worldbookName = selectedWorldbookName.value;

  updatePersistedState(state => {
    const byWorldbook = state.entry_history[worldbookName] ?? {};

    for (const item of items) {
      const uidKey = String(item.uid);
      const incoming = createEntrySnapshotRecord(item.label, item.uid, item.name, item.entry);
      const list = byWorldbook[uidKey] ?? [];

      if (list[0] && JSON.stringify(list[0].entry) === JSON.stringify(incoming.entry)) {
        continue;
      }

      list.unshift(incoming);
      if (list.length > ENTRY_HISTORY_LIMIT) {
        list.length = ENTRY_HISTORY_LIMIT;
      }
      byWorldbook[uidKey] = list;
      added += 1;
    }

    state.entry_history[worldbookName] = byWorldbook;
  });

  return added;
}

function pushEntrySnapshot(label: string, entry: WorldbookEntry): boolean {
  const added = pushEntrySnapshotsBulk([
    {
      label,
      uid: entry.uid,
      name: entry.name,
      entry,
    },
  ]);
  return added > 0;
}

function collectEntrySnapshotsBeforeSave(): Array<{
  label: string;
  uid: number;
  name: string;
  entry: WorldbookEntry;
}> {
  const result: Array<{
    label: string;
    uid: number;
    name: string;
    entry: WorldbookEntry;
  }> = [];
  const draftByUid = new Map<number, WorldbookEntry>();
  draftEntries.value.forEach(entry => {
    draftByUid.set(entry.uid, entry);
  });

  for (const previous of originalEntries.value) {
    const current = draftByUid.get(previous.uid);
    if (!current) {
      result.push({
        label: '保存前（删除前）',
        uid: previous.uid,
        name: previous.name,
        entry: previous,
      });
      continue;
    }
    if (JSON.stringify(previous) !== JSON.stringify(current)) {
      result.push({
        label: '保存前',
        uid: previous.uid,
        name: previous.name,
        entry: previous,
      });
    }
  }

  return result;
}

function pushSnapshot(label: string): void {
  if (!selectedWorldbookName.value) {
    return;
  }
  const worldbookName = selectedWorldbookName.value;
  const snapshot: WorldbookSnapshot = {
    id: createId('snapshot'),
    label,
    ts: Date.now(),
    entries: klona(draftEntries.value),
  };

  updatePersistedState(state => {
    const list = state.history[worldbookName] ?? [];
    list.unshift(snapshot);
    if (list.length > HISTORY_LIMIT) {
      list.length = HISTORY_LIMIT;
    }
    state.history[worldbookName] = list;
  });
}

function createManualSnapshot(): void {
  if (!selectedWorldbookName.value) {
    toastr.warning('请先选择世界书');
    return;
  }
  pushSnapshot('手动快照');
  toastr.success('已创建快照');
}

function openEntryHistoryModal(): void {
  if (!selectedEntry.value) {
    toastr.warning('请先选择条目');
    return;
  }
  const nonCurrent = entryVersionViews.value.find(item => !item.isCurrent) ?? null;
  entryHistoryRightId.value = '__current__';
  entryHistoryLeftId.value = nonCurrent?.id ?? '__current__';
  showEntryHistoryModal.value = true;
}

function openWorldbookHistoryModal(): void {
  if (!selectedWorldbookName.value) {
    toastr.warning('请先选择世界书');
    return;
  }
  const nonCurrent = worldbookVersionViews.value.find(item => !item.isCurrent) ?? null;
  worldbookHistoryRightId.value = '__current__';
  worldbookHistoryLeftId.value = nonCurrent?.id ?? '__current__';
  showWorldbookHistoryModal.value = true;
}

function createManualEntrySnapshot(): void {
  if (!selectedEntry.value) {
    toastr.warning('请先选择条目');
    return;
  }
  const added = pushEntrySnapshot('手动条目快照', selectedEntry.value);
  if (added) {
    toastr.success('已记录当前条目快照');
  } else {
    toastr.info('当前条目与最近快照一致，未重复记录');
  }
}

function restoreSnapshot(snapshotId: string): void {
  const snapshot = snapshotsForCurrent.value.find(item => item.id === snapshotId);
  if (!snapshot) {
    return;
  }
  if (!confirm(`回滚到快照 "${snapshot.label}" ? 当前未保存修改会被覆盖。`)) {
    return;
  }
  draftEntries.value = normalizeEntryList(snapshot.entries);
  ensureSelectedEntryExists();
  setStatus(`已回滚到快照：${snapshot.label}`);
}

function restoreWorldbookFromLeftHistory(): void {
  const target = selectedWorldbookHistoryLeft.value;
  if (!target || target.isCurrent) {
    return;
  }
  if (!confirm(`恢复到 Left 版本 "${target.label}" ? 当前未保存修改会被覆盖。`)) {
    return;
  }
  draftEntries.value = normalizeEntryList(klona(target.entries));
  ensureSelectedEntryExists();
  setStatus(`已从时光机恢复：${target.label}`);
  toastr.success('已恢复整本世界书到 Left 版本');
}

function deleteSnapshot(snapshotId: string): void {
  if (!selectedWorldbookName.value) {
    return;
  }
  updatePersistedState(state => {
    const list = state.history[selectedWorldbookName.value] ?? [];
    state.history[selectedWorldbookName.value] = list.filter(item => item.id !== snapshotId);
  });
}

function clearCurrentSnapshots(): void {
  if (!selectedWorldbookName.value || !snapshotsForCurrent.value.length) {
    return;
  }
  if (!confirm(`清空 "${selectedWorldbookName.value}" 的全部快照？`)) {
    return;
  }
  updatePersistedState(state => {
    delete state.history[selectedWorldbookName.value];
  });
}

function restoreEntrySnapshot(snapshotId: string): void {
  if (!selectedEntry.value || selectedEntryIndex.value < 0) {
    return;
  }
  const snapshot = entrySnapshotsForSelected.value.find(item => item.id === snapshotId);
  if (!snapshot) {
    return;
  }
  if (!confirm(`回滚当前条目到快照 "${snapshot.label}" ?`)) {
    return;
  }

  // 回滚前自动留一份，便于撤回
  pushEntrySnapshot('回滚前自动快照', selectedEntry.value);

  const restored = normalizeEntry(klona(snapshot.entry), selectedEntry.value.uid);
  restored.uid = selectedEntry.value.uid;
  draftEntries.value.splice(selectedEntryIndex.value, 1, restored);
  selectedEntryUid.value = restored.uid;
  setStatus(`已回滚条目到快照：${snapshot.label}`);
  toastr.success('已恢复条目快照');
}

function restoreEntryFromLeftHistory(): void {
  const target = selectedEntryHistoryLeft.value;
  if (!target || target.isCurrent) {
    return;
  }
  if (!selectedEntry.value || selectedEntryIndex.value < 0) {
    return;
  }
  if (!confirm(`回滚当前条目到 "${target.label}" ?`)) {
    return;
  }
  pushEntrySnapshot('回滚前自动快照', selectedEntry.value);
  const restored = normalizeEntry(klona(target.entry), selectedEntry.value.uid);
  restored.uid = selectedEntry.value.uid;
  draftEntries.value.splice(selectedEntryIndex.value, 1, restored);
  selectedEntryUid.value = restored.uid;
  setStatus(`已从条目时光机恢复：${target.label}`);
  toastr.success('已恢复条目到 Left 版本');
}

function deleteEntrySnapshot(snapshotId: string): void {
  if (!selectedWorldbookName.value || !selectedEntry.value) {
    return;
  }
  const worldbookName = selectedWorldbookName.value;
  const uidKey = String(selectedEntry.value.uid);
  updatePersistedState(state => {
    const byWorldbook = state.entry_history[worldbookName] ?? {};
    const list = byWorldbook[uidKey] ?? [];
    byWorldbook[uidKey] = list.filter(item => item.id !== snapshotId);
    state.entry_history[worldbookName] = byWorldbook;
  });
}

function clearCurrentEntrySnapshots(): void {
  if (!selectedWorldbookName.value || !selectedEntry.value || !entrySnapshotsForSelected.value.length) {
    return;
  }
  if (!confirm(`清空条目 #${selectedEntry.value.uid} 的历史快照？`)) {
    return;
  }
  const worldbookName = selectedWorldbookName.value;
  const uidKey = String(selectedEntry.value.uid);
  updatePersistedState(state => {
    const byWorldbook = state.entry_history[worldbookName] ?? {};
    delete byWorldbook[uidKey];
    state.entry_history[worldbookName] = byWorldbook;
  });
}

function handleSelectedPositionTypeChanged(): void {
  if (!selectedEntry.value) {
    return;
  }
  if (selectedEntry.value.position.type !== 'at_depth') {
    selectedEntry.value.position.role = 'system';
    selectedEntry.value.position.depth = 4;
  }
}

function applyExtraJson(): void {
  if (!selectedEntry.value) {
    return;
  }
  const text = selectedExtraText.value.trim();
  if (!text) {
    selectedEntry.value.extra = undefined;
    return;
  }
  try {
    const parsed = JSON.parse(text);
    const parsedRecord = asRecord(parsed);
    if (!parsedRecord) {
      throw new Error('extra 必须是 JSON 对象');
    }
    selectedEntry.value.extra = klona(parsedRecord);
    toastr.success('extra 已应用');
  } catch (error) {
    toastr.error(`extra JSON 解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function clearExtra(): void {
  if (!selectedEntry.value) {
    return;
  }
  selectedEntry.value.extra = undefined;
  selectedExtraText.value = '';
}

function addEntry(): void {
  const uid = getNextUid(draftEntries.value);
  const entry = createDefaultEntry(uid);
  draftEntries.value.push(entry);
  selectedEntryUid.value = uid;
  setStatus(`已新增条目 #${uid}`);
}

function duplicateSelectedEntry(): void {
  if (!selectedEntry.value || selectedEntryIndex.value < 0) {
    return;
  }
  const uid = getNextUid(draftEntries.value);
  const duplicated = normalizeEntry(klona(selectedEntry.value), uid);
  duplicated.uid = uid;
  duplicated.name = `${duplicated.name} (副本)`;
  draftEntries.value.splice(selectedEntryIndex.value + 1, 0, duplicated);
  selectedEntryUid.value = uid;
  setStatus(`已复制条目 #${selectedEntry.value.uid}`);
}

function removeSelectedEntry(): void {
  if (!selectedEntry.value || selectedEntryIndex.value < 0) {
    return;
  }
  if (!confirm(`确定删除条目 "${selectedEntry.value.name}" ?`)) {
    return;
  }
  pushEntrySnapshot('删除前快照', selectedEntry.value);
  draftEntries.value.splice(selectedEntryIndex.value, 1);
  ensureSelectedEntryExists();
  setStatus('已删除条目');
}

function moveSelectedEntry(direction: -1 | 1): void {
  if (selectedEntryIndex.value < 0) {
    return;
  }
  const target = selectedEntryIndex.value + direction;
  if (target < 0 || target >= draftEntries.value.length) {
    return;
  }
  const [entry] = draftEntries.value.splice(selectedEntryIndex.value, 1);
  draftEntries.value.splice(target, 0, entry);
  selectedEntryUid.value = entry.uid;
}

function normalizeAllEntries(): void {
  draftEntries.value = normalizeEntryList(draftEntries.value.map(entry => klona(entry)));
  ensureSelectedEntryExists();
  setStatus('已完成条目标准化');
}

function sortEntriesByOrderDesc(): void {
  draftEntries.value.sort((left, right) => right.position.order - left.position.order);
  ensureSelectedEntryExists();
  setStatus('已按 order 降序排列');
}

function setEnabledForAll(enabled: boolean): void {
  draftEntries.value.forEach(entry => {
    entry.enabled = enabled;
  });
  setStatus(enabled ? '已启用全部条目' : '已禁用全部条目');
}

function applyBatchReplace(): void {
  const findText = batchFindText.value;
  if (!findText) {
    toastr.warning('请先输入查找文本');
    return;
  }
  if (!getEnabledFindFields().length) {
    toastr.warning('请至少勾选一个查找字段');
    return;
  }
  if (batchSearchScope.value === 'current' && !selectedEntry.value) {
    toastr.warning('当前条目模式下请先选择一个条目');
    return;
  }

  const targetEntries = getBatchTargetEntries();
  if (!targetEntries.length) {
    toastr.warning('没有可处理的条目');
    return;
  }

  const excludeTokens = parseBatchExcludeTokens(batchExcludeText.value);
  const regex = resolveBatchRegex(findText);
  if (batchUseRegex.value && !regex) {
    return;
  }

  let touched = 0;
  let skipped = 0;
  for (const entry of targetEntries) {
    if (shouldExcludeEntryForBatch(entry, excludeTokens)) {
      skipped += 1;
      continue;
    }

    let changed = false;

    if (batchInName.value) {
      const next = regex
        ? entry.name.replace(regex, batchReplaceText.value)
        : entry.name.split(findText).join(batchReplaceText.value);
      if (next !== entry.name) {
        entry.name = next;
        changed = true;
      }
    }

    if (batchInContent.value) {
      const next = regex
        ? entry.content.replace(regex, batchReplaceText.value)
        : entry.content.split(findText).join(batchReplaceText.value);
      if (next !== entry.content) {
        entry.content = next;
        changed = true;
      }
    }

    if (batchInKeys.value) {
      const nextKeys = entry.strategy.keys.map(key => {
        const text = stringifyKeyword(key);
        return regex ? text.replace(regex, batchReplaceText.value) : text.split(findText).join(batchReplaceText.value);
      });
      const normalized = normalizeKeywordList(nextKeys);
      if (
        JSON.stringify(normalized.map(stringifyKeyword)) !== JSON.stringify(entry.strategy.keys.map(stringifyKeyword))
      ) {
        entry.strategy.keys = normalized;
        changed = true;
      }
    }

    if (changed) {
      touched += 1;
    }
  }

  resetFindState();
  setStatus(
    `查找替换完成（${batchSearchScope.value === 'current' ? '当前条目' : '全部条目'}），修改 ${touched} 条，排除 ${skipped} 条`,
  );
}

function downloadJson(filename: string, payload: unknown): void {
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function exportCurrentWorldbook(): void {
  if (!selectedWorldbookName.value) {
    return;
  }
  const payload = {
    format: 'worldbook_assistant_v1',
    name: selectedWorldbookName.value,
    exported_at: new Date().toISOString(),
    entries: draftEntries.value,
  };
  const filename = `${selectedWorldbookName.value.replace(/[\\/:*?"<>|]/g, '_')}.json`;
  downloadJson(filename, payload);
}

function collectRawEntries(root: Record<string, unknown>): unknown[] {
  if (Array.isArray(root.entries)) {
    return root.entries;
  }
  const entriesMap = asRecord(root.entries);
  if (entriesMap) {
    return Object.values(entriesMap);
  }
  const dataRoot = asRecord(root.data);
  if (dataRoot) {
    if (Array.isArray(dataRoot.entries)) {
      return dataRoot.entries;
    }
    const dataEntriesMap = asRecord(dataRoot.entries);
    if (dataEntriesMap) {
      return Object.values(dataEntriesMap);
    }
  }
  return [];
}

function parseImportedPayload(fileName: string, text: string): ImportedPayload {
  const parsed = JSON.parse(text) as unknown;
  const fallbackName = fileName.replace(/\.[^/.]+$/, '') || '导入世界书';

  if (Array.isArray(parsed)) {
    return {
      name: fallbackName,
      entries: normalizeEntryList(parsed),
    };
  }

  const root = asRecord(parsed);
  if (!root) {
    throw new Error('导入内容必须是 JSON 对象或数组');
  }

  const entries = collectRawEntries(root);
  if (!entries.length) {
    throw new Error('未识别到有效的 entries');
  }

  const dataRoot = asRecord(root.data);
  const nameCandidate = toStringSafe(root.name ?? dataRoot?.name, fallbackName).trim();

  return {
    name: nameCandidate || fallbackName,
    entries: normalizeEntryList(entries),
  };
}

function triggerImport(): void {
  importFileInput.value?.click();
}

async function onImportChange(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement | null;
  const file = target?.files?.[0];
  if (!file) {
    return;
  }

  const fileText = await file.text();
  try {
    const payload = parseImportedPayload(file.name, fileText);
    const suggested = payload.name || file.name.replace(/\.[^/.]+$/, '');
    const newNameRaw = prompt('请输入新世界书名称', suggested);
    const newName = toStringSafe(newNameRaw).trim();
    if (!newName) {
      return;
    }
    await createOrReplaceWorldbook(newName, payload.entries, { render: 'immediate' });
    await reloadWorldbookNames(newName);
    await refreshBindings();
    toastr.success(`已导入为新世界书: ${newName}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldFallback = confirm(`解析导入文件失败: ${message}\n是否尝试按酒馆原生方式导入？`);
    if (!shouldFallback) {
      return;
    }
    const response = await importRawWorldbook(file.name, fileText);
    if (!response.ok) {
      throw new Error(`原生导入失败: HTTP ${response.status}`);
    }
    await hardRefresh();
    toastr.success('已按酒馆原生方式导入');
  } finally {
    if (target) {
      target.value = '';
    }
  }
}

async function refreshBindings(): Promise<void> {
  bindings.global = [...getGlobalWorldbookNames()];
  try {
    const charBindings = getCharWorldbookNames('current');
    bindings.charPrimary = charBindings.primary;
    bindings.charAdditional = [...charBindings.additional];
  } catch {
    bindings.charPrimary = null;
    bindings.charAdditional = [];
  }

  try {
    bindings.chat = getChatWorldbookName('current');
  } catch {
    bindings.chat = null;
  }
  if (globalWorldbookMode.value) {
    ensureSelectionForGlobalMode();
  }
}

function resolveContextWorldbookCandidate(): string | null {
  const available = worldbookNames.value;
  if (!available.length) {
    return null;
  }
  const chatBound = toStringSafe(bindings.chat).trim();
  if (chatBound && available.includes(chatBound)) {
    return chatBound;
  }
  const charPrimary = toStringSafe(bindings.charPrimary).trim();
  if (charPrimary && available.includes(charPrimary)) {
    return charPrimary;
  }
  const charAdditional = bindings.charAdditional.find(name => available.includes(name));
  return charAdditional ?? null;
}

function ensureSelectionForGlobalMode(): void {
  if (!globalWorldbookMode.value) {
    return;
  }
  const globals = selectableWorldbookNames.value;
  if (!globals.length) {
    selectedWorldbookName.value = '';
    return;
  }
  if (!globals.includes(selectedWorldbookName.value)) {
    selectedWorldbookName.value = globals[0];
  }
}

function trySelectWorldbookByContext(options: { preferWhenEmptyOnly?: boolean; force?: boolean } = {}): boolean {
  if (globalWorldbookMode.value) {
    return false;
  }
  if (options.preferWhenEmptyOnly && selectedWorldbookName.value) {
    return false;
  }
  const candidate = resolveContextWorldbookCandidate();
  if (!candidate || candidate === selectedWorldbookName.value) {
    return false;
  }
  if (!options.force && hasUnsavedChanges.value) {
    setStatus('检测到聊天/角色世界书变更，但当前有未保存修改，已跳过自动切换');
    return false;
  }
  selectedWorldbookName.value = candidate;
  setStatus(`已自动定位到上下文世界书: ${candidate}`);
  return true;
}

function toggleGlobalMode(): void {
  globalWorldbookMode.value = !globalWorldbookMode.value;
  if (globalWorldbookMode.value) {
    ensureSelectionForGlobalMode();
    setStatus('已切换到全局世界书模式');
    return;
  }
  if (!selectedWorldbookName.value) {
    trySelectWorldbookByContext({ force: true });
  }
  setStatus('已切换到上下文世界书模式');
}

async function applyGlobalWorldbooks(nextGlobal: string[], statusLabel = '已更新全局世界书'): Promise<boolean> {
  const normalized = [...new Set(nextGlobal.map(name => name.trim()).filter(Boolean))].filter(name =>
    worldbookNames.value.includes(name),
  );
  try {
    await rebindGlobalWorldbooks(normalized);
    await refreshBindings();
    ensureSelectionForGlobalMode();
    setStatus(`${statusLabel}（${normalized.length} 本）`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toastr.error(`更新全局世界书失败: ${message}`);
    return false;
  }
}

function addFirstGlobalCandidate(): void {
  const first = globalAddCandidates.value[0];
  if (!first) {
    return;
  }
  void addGlobalWorldbook(first);
}

async function addGlobalWorldbook(name: string): Promise<void> {
  if (!name || bindings.global.includes(name)) {
    return;
  }
  const success = await applyGlobalWorldbooks([...bindings.global, name], `已添加到全局: ${name}`);
  if (success) {
    globalAddSearchText.value = '';
  }
}

async function removeGlobalWorldbook(name: string): Promise<void> {
  if (!name || !bindings.global.includes(name)) {
    return;
  }
  await applyGlobalWorldbooks(
    bindings.global.filter(item => item !== name),
    `已移出全局: ${name}`,
  );
}

async function clearGlobalWorldbooks(): Promise<void> {
  if (!bindings.global.length) {
    return;
  }
  if (!confirm('确定清空所有全局世界书吗？')) {
    return;
  }
  await applyGlobalWorldbooks([], '已清空全局世界书');
}

async function loadWorldbook(name: string): Promise<void> {
  if (!name) {
    return;
  }
  isBusy.value = true;
  try {
    const rawEntries = await getWorldbook(name);
    const normalized = normalizeEntryList(rawEntries);
    draftEntries.value = klona(normalized);
    originalEntries.value = klona(normalized);
    ensureSelectedEntryExists();
    setStatus(`已加载 "${name}"，条目 ${normalized.length}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toastr.error(`读取世界书失败: ${message}`);
    setStatus(`读取失败: ${message}`);
  } finally {
    isBusy.value = false;
  }
}

async function reloadWorldbookNames(preferred?: string): Promise<void> {
  const names = [...getWorldbookNames()].sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));
  worldbookNames.value = names;

  if (!names.length) {
    selectedWorldbookName.value = '';
    draftEntries.value = [];
    originalEntries.value = [];
    selectedEntryUid.value = null;
    return;
  }

  const fallbackName = persistedState.value.last_worldbook;
  const candidate =
    (preferred && names.includes(preferred) && preferred) ||
    (fallbackName && names.includes(fallbackName) && fallbackName) ||
    selectedWorldbookName.value ||
    names[0];

  if (candidate && selectedWorldbookName.value !== candidate) {
    selectedWorldbookName.value = candidate;
    return;
  }

  if (selectedWorldbookName.value && !draftEntries.value.length) {
    await loadWorldbook(selectedWorldbookName.value);
  }
}

async function hardRefresh(): Promise<void> {
  persistedState.value = readPersistedState();
  await reloadWorldbookNames(selectedWorldbookName.value || undefined);
  await refreshBindings();
  if (globalWorldbookMode.value) {
    ensureSelectionForGlobalMode();
  } else {
    trySelectWorldbookByContext({ preferWhenEmptyOnly: true });
  }
  setStatus('已刷新世界书和绑定信息');
}

async function saveCurrentWorldbook(): Promise<void> {
  if (!selectedWorldbookName.value) {
    toastr.warning('请先选择世界书');
    return;
  }
  if (!hasUnsavedChanges.value) {
    setStatus('当前没有需要保存的修改');
    return;
  }
  isSaving.value = true;
  try {
    draftEntries.value = normalizeEntryList(draftEntries.value.map(entry => klona(entry)));
    const pendingEntrySnapshots = collectEntrySnapshotsBeforeSave();
    const savedEntrySnapshotCount = pushEntrySnapshotsBulk(pendingEntrySnapshots);
    await replaceWorldbook(selectedWorldbookName.value, klona(draftEntries.value), { render: 'immediate' });
    originalEntries.value = klona(draftEntries.value);
    pushSnapshot('保存后快照');
    await refreshBindings();
    toastr.success(`已保存: ${selectedWorldbookName.value}`);
    setStatus(`保存成功: ${selectedWorldbookName.value}（条目历史 +${savedEntrySnapshotCount}）`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toastr.error(`保存失败: ${message}`);
    setStatus(`保存失败: ${message}`);
  } finally {
    isSaving.value = false;
  }
}

async function createNewWorldbook(): Promise<void> {
  const nameRaw = prompt('请输入新世界书名称');
  const name = toStringSafe(nameRaw).trim();
  if (!name) {
    return;
  }
  try {
    await createOrReplaceWorldbook(name, [], { render: 'immediate' });
    await reloadWorldbookNames(name);
    await refreshBindings();
    toastr.success(`已创建世界书: ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toastr.error(`创建失败: ${message}`);
  }
}

async function duplicateWorldbook(): Promise<void> {
  if (!selectedWorldbookName.value) {
    return;
  }
  const suggested = `${selectedWorldbookName.value}_copy`;
  const newNameRaw = prompt('请输入复制后的名称', suggested);
  const newName = toStringSafe(newNameRaw).trim();
  if (!newName) {
    return;
  }
  try {
    await createOrReplaceWorldbook(newName, klona(draftEntries.value), { render: 'immediate' });
    await reloadWorldbookNames(newName);
    await refreshBindings();
    toastr.success(`已复制为: ${newName}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toastr.error(`复制失败: ${message}`);
  }
}

async function deleteCurrentWorldbook(): Promise<void> {
  if (!selectedWorldbookName.value) {
    return;
  }
  const current = selectedWorldbookName.value;
  if (!confirm(`确定删除世界书 "${current}" ?`)) {
    return;
  }
  try {
    const success = await deleteWorldbook(current);
    if (!success) {
      throw new Error('返回 false');
    }
    updatePersistedState(state => {
      delete state.history[current];
      delete state.entry_history[current];
    });
    toastr.success(`已删除: ${current}`);
    await reloadWorldbookNames();
    await refreshBindings();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toastr.error(`删除失败: ${message}`);
  }
}

async function toggleGlobalBinding(): Promise<void> {
  if (!selectedWorldbookName.value) {
    return;
  }
  const next = new Set(getGlobalWorldbookNames());
  if (next.has(selectedWorldbookName.value)) {
    next.delete(selectedWorldbookName.value);
  } else {
    next.add(selectedWorldbookName.value);
  }
  await applyGlobalWorldbooks([...next], '已更新全局绑定');
}

function pushActivationLogs(entries: Array<{ world: string } & Record<string, unknown>>): void {
  const logs = entries.map(item => {
    const uid = item.uid ?? item.displayIndex ?? '?';
    const name = toStringSafe(item.name ?? item.comment, `UID ${uid}`);
    const content = toStringSafe(item.content).replace(/\s+/g, ' ').trim().slice(0, 80);
    return {
      id: createId('activation'),
      time: Date.now(),
      world: toStringSafe(item.world, 'unknown'),
      uid: typeof uid === 'number' || typeof uid === 'string' ? uid : '?',
      name,
      contentPreview: content || '(空内容)',
    } satisfies ActivationLog;
  });
  activationLogs.value.unshift(...logs);
  if (activationLogs.value.length > ACTIVATION_LOG_LIMIT) {
    activationLogs.value.length = ACTIVATION_LOG_LIMIT;
  }
}

function clearActivationLogs(): void {
  activationLogs.value = [];
}

function resolveHostWindow(): Window {
  return mainLayoutRef.value?.ownerDocument?.defaultView ?? editorShellRef.value?.ownerDocument?.defaultView ?? window;
}

function clampFloatingPanelToViewport(panel: FloatingPanelState): void {
  const hostWin = resolveHostWindow();
  const viewportWidth = hostWin.innerWidth;
  const viewportHeight = hostWin.innerHeight;
  const maxX = Math.max(8, viewportWidth - panel.width - 8);
  const maxY = Math.max(8, viewportHeight - 68);
  panel.x = clampNumber(panel.x, 8, maxX);
  panel.y = clampNumber(panel.y, 8, maxY);
}

function handleFloatingWindowResize(): void {
  viewportWidth.value = resolveHostWindow().innerWidth;
  clampPaneWidths();
  for (const key of floatingPanelKeys) {
    if (!floatingPanels[key].visible) {
      continue;
    }
    clampFloatingPanelToViewport(floatingPanels[key]);
  }
}

function bringFloatingToFront(key: FloatingPanelKey): void {
  floatingZCounter.value += 1;
  floatingPanels[key].z = floatingZCounter.value;
}

function openFloatingPanel(key: FloatingPanelKey): void {
  const panel = floatingPanels[key];
  panel.visible = true;
  clampFloatingPanelToViewport(panel);
  bringFloatingToFront(key);
}

function closeFloatingPanel(key: FloatingPanelKey): void {
  floatingPanels[key].visible = false;
  if (activeFloatingDrag.value?.key === key) {
    stopFloatingDrag();
  }
}

function toggleFloatingPanel(key: FloatingPanelKey): void {
  if (floatingPanels[key].visible) {
    closeFloatingPanel(key);
    return;
  }
  openFloatingPanel(key);
}

function getFloatingPanelStyle(key: FloatingPanelKey): Record<string, string> {
  const panel = floatingPanels[key];
  return {
    left: `${panel.x}px`,
    top: `${panel.y}px`,
    zIndex: String(panel.z),
    width: `${panel.width}px`,
  };
}

function startFloatingDrag(key: FloatingPanelKey, event: PointerEvent): void {
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }
  const panel = floatingPanels[key];
  const target = event.currentTarget as HTMLElement | null;
  if (!target) {
    return;
  }
  const hostDoc = target.ownerDocument ?? document;
  const hostWin = hostDoc.defaultView ?? window;
  const rect = target.getBoundingClientRect();
  bringFloatingToFront(key);
  const dragState = {
    key,
    pointerId: event.pointerId,
    offsetX: event.clientX - panel.x,
    offsetY: event.clientY - panel.y,
    doc: hostDoc,
    win: hostWin,
  };
  activeFloatingDrag.value = dragState;
  target.setPointerCapture?.(event.pointerId);
  hostDoc.addEventListener('pointermove', onFloatingDragMove);
  hostDoc.addEventListener('pointerup', stopFloatingDrag);
  hostDoc.addEventListener('pointercancel', stopFloatingDrag);
  hostWin.addEventListener('blur', stopFloatingDrag);
  panel.x = clampNumber(event.clientX - dragState.offsetX, 8, Math.max(8, hostWin.innerWidth - panel.width - 8));
  panel.y = clampNumber(event.clientY - dragState.offsetY, 8, Math.max(8, hostWin.innerHeight - rect.height - 8));
  event.preventDefault();
}

function onFloatingDragMove(event: PointerEvent): void {
  const drag = activeFloatingDrag.value;
  if (!drag) {
    return;
  }
  if (event.pointerId !== drag.pointerId) {
    return;
  }
  const panel = floatingPanels[drag.key];
  panel.x = clampNumber(event.clientX - drag.offsetX, 8, Math.max(8, drag.win.innerWidth - panel.width - 8));
  panel.y = clampNumber(event.clientY - drag.offsetY, 8, Math.max(8, drag.win.innerHeight - 68));
}

function stopFloatingDrag(): void {
  const drag = activeFloatingDrag.value;
  if (drag) {
    drag.doc.removeEventListener('pointermove', onFloatingDragMove);
    drag.doc.removeEventListener('pointerup', stopFloatingDrag);
    drag.doc.removeEventListener('pointercancel', stopFloatingDrag);
    drag.win.removeEventListener('blur', stopFloatingDrag);
  }
  activeFloatingDrag.value = null;
}

function clampPaneWidths(): void {
  if (isCompactLayout.value) {
    return;
  }

  const mainRect = mainLayoutRef.value?.getBoundingClientRect();
  if (mainRect) {
    const maxLeft = Math.max(MAIN_PANE_MIN, Math.floor(mainRect.width - MAIN_EDITOR_MIN - RESIZE_HANDLE_SIZE));
    mainPaneWidth.value = clampNumber(mainPaneWidth.value, MAIN_PANE_MIN, maxLeft);
  }

  const editorRect = editorShellRef.value?.getBoundingClientRect();
  if (editorRect) {
    const maxSide = Math.max(EDITOR_SIDE_MIN, Math.floor(editorRect.width - EDITOR_CENTER_MIN - RESIZE_HANDLE_SIZE));
    editorSideWidth.value = clampNumber(editorSideWidth.value, EDITOR_SIDE_MIN, maxSide);
  }
}

function startPaneResize(key: PaneResizeKey, event: PointerEvent): void {
  if (isCompactLayout.value) {
    return;
  }
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }
  const target = event.currentTarget as HTMLElement | null;
  const hostDoc = target?.ownerDocument ?? document;
  const hostWin = hostDoc.defaultView ?? window;
  paneResizeState.value = {
    key,
    pointerId: event.pointerId,
    doc: hostDoc,
    win: hostWin,
  };
  target?.setPointerCapture?.(event.pointerId);
  hostDoc.addEventListener('pointermove', onPaneResizeMove);
  hostDoc.addEventListener('pointerup', stopPaneResize);
  hostDoc.addEventListener('pointercancel', stopPaneResize);
  hostWin.addEventListener('blur', stopPaneResize);
  event.preventDefault();
}

function onPaneResizeMove(event: PointerEvent): void {
  const state = paneResizeState.value;
  if (!state || event.pointerId !== state.pointerId) {
    return;
  }
  if (state.key === 'main') {
    const rect = mainLayoutRef.value?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const left = Math.floor(event.clientX - rect.left);
    const maxLeft = Math.max(MAIN_PANE_MIN, Math.floor(rect.width - MAIN_EDITOR_MIN - RESIZE_HANDLE_SIZE));
    mainPaneWidth.value = clampNumber(left, MAIN_PANE_MIN, maxLeft);
    return;
  }

  const rect = editorShellRef.value?.getBoundingClientRect();
  if (!rect) {
    return;
  }
  const side = Math.floor(rect.right - event.clientX);
  const maxSide = Math.max(EDITOR_SIDE_MIN, Math.floor(rect.width - EDITOR_CENTER_MIN - RESIZE_HANDLE_SIZE));
  editorSideWidth.value = clampNumber(side, EDITOR_SIDE_MIN, maxSide);
}

function stopPaneResize(): void {
  const state = paneResizeState.value;
  if (state) {
    state.doc.removeEventListener('pointermove', onPaneResizeMove);
    state.doc.removeEventListener('pointerup', stopPaneResize);
    state.doc.removeEventListener('pointercancel', stopPaneResize);
    state.win.removeEventListener('blur', stopPaneResize);
  }
  paneResizeState.value = null;
}

function onPanelRefresh(): void {
  void hardRefresh();
}

function onPanelSave(): void {
  void saveCurrentWorldbook();
}

function discardUnsavedDraft(): void {
  if (!hasUnsavedChanges.value) {
    const target = window as unknown as Record<string, unknown>;
    target[DIRTY_STATE_KEY] = false;
    return;
  }
  draftEntries.value = klona(originalEntries.value);
  ensureSelectedEntryExists();
  resetFindState();
  setStatus('已放弃未保存修改');
}

function onPanelDiscard(): void {
  discardUnsavedDraft();
}

onMounted(() => {
  persistedState.value = readPersistedState();

  subscriptions.push(
    eventOn(tavern_events.WORLD_INFO_ACTIVATED, entries => {
      pushActivationLogs(entries as Array<{ world: string } & Record<string, unknown>>);
    }),
  );
  subscriptions.push(
    eventOn(tavern_events.WORLDINFO_UPDATED, () => {
      void hardRefresh();
    }),
  );
  subscriptions.push(
    eventOn(tavern_events.CHAT_CHANGED, () => {
      void (async () => {
        await refreshBindings();
        if (globalWorldbookMode.value) {
          ensureSelectionForGlobalMode();
          return;
        }
        trySelectWorldbookByContext();
      })();
    }),
  );

  window.addEventListener('wb-helper:refresh', onPanelRefresh);
  window.addEventListener('wb-helper:save', onPanelSave);
  window.addEventListener('wb-helper:discard', onPanelDiscard);
  hostResizeWindow.value = resolveHostWindow();
  hostResizeWindow.value.addEventListener('resize', handleFloatingWindowResize);

  handleFloatingWindowResize();
  void hardRefresh();
});

onUnmounted(() => {
  const target = window as unknown as Record<string, unknown>;
  target[DIRTY_STATE_KEY] = false;
  subscriptions.forEach(subscription => {
    subscription.stop();
  });
  stopFloatingDrag();
  stopPaneResize();
  window.removeEventListener('wb-helper:refresh', onPanelRefresh);
  window.removeEventListener('wb-helper:save', onPanelSave);
  window.removeEventListener('wb-helper:discard', onPanelDiscard);
  hostResizeWindow.value?.removeEventListener('resize', handleFloatingWindowResize);
  hostResizeWindow.value = null;
});
</script>

<style scoped>
.wb-assistant-root {
  height: auto;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 10px;
  gap: 10px;
  background: linear-gradient(145deg, #0f172a 0%, #111827 45%, #1e293b 100%);
  color: #e2e8f0;
  font-size: 13px;
  line-height: 1.35;
  border-radius: 10px;
}

.wb-settings-wrapper {
  width: 100%;
}

.wb-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 8px 10px;
  background: rgba(15, 23, 42, 0.6);
}

.wb-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wb-title strong {
  font-size: 16px;
}

.wb-title span {
  color: #94a3b8;
}

.wb-header-actions,
.list-actions,
.tool-line {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.wb-toolbar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 8px;
  background: rgba(15, 23, 42, 0.55);
}

.toolbar-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #cbd5e1;
}

.toolbar-select {
  min-width: 200px;
}

.toolbar-select.small {
  min-width: 160px;
}

.wb-bindings {
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 8px;
  display: grid;
  gap: 8px;
  background: rgba(15, 23, 42, 0.5);
}

.wb-history-shortcuts {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.global-mode-panel {
  border: 1px solid #334155;
  border-radius: 9px;
  background: rgba(15, 23, 42, 0.58);
  padding: 8px;
  display: grid;
  gap: 8px;
}

.global-mode-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.global-mode-title {
  color: #93c5fd;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.global-mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.global-mode-column {
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 8px;
  background: rgba(2, 6, 23, 0.42);
  display: grid;
  gap: 6px;
  min-height: 168px;
}

.global-mode-list {
  border: 1px solid #334155;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.6);
  max-height: 176px;
  min-height: 88px;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.global-mode-item {
  width: 100%;
  border: none;
  border-bottom: 1px solid rgba(51, 65, 85, 0.6);
  background: transparent;
  color: #e2e8f0;
  padding: 7px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  text-align: left;
}

.global-mode-item:last-child {
  border-bottom: none;
}

.global-mode-item:hover {
  background: rgba(56, 189, 248, 0.14);
}

.global-mode-item.add .global-mode-item-action {
  color: #86efac;
}

.global-mode-item.active .global-mode-item-action {
  color: #fca5a5;
}

.global-mode-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-mode-item-action {
  font-size: 12px;
  flex-shrink: 0;
}

.global-mode-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.history-btn {
  border-color: #3b82f6;
  background: rgba(30, 58, 138, 0.25);
}

.utility-btn {
  border-color: #0ea5e9;
  background: rgba(6, 78, 118, 0.25);
}

.utility-btn.active {
  border-color: #22d3ee;
  background: rgba(34, 211, 238, 0.16);
  color: #67e8f9;
}

.wb-main-layout {
  min-height: 460px;
  max-height: 70vh;
  display: grid;
  grid-template-columns: 320px 10px minmax(0, 1fr);
  gap: 0;
}

.wb-entry-list,
.wb-editor {
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(15, 23, 42, 0.55);
  min-height: 0;
}

.list-search {
  display: grid;
  gap: 6px;
}

.list-summary {
  color: #94a3b8;
  font-size: 12px;
}

.list-scroll {
  flex: 1 1 auto;
  min-height: 210px;
  max-height: calc(70vh - 210px);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.entry-item {
  width: 100%;
  text-align: left;
  border: 1px solid #334155;
  background: linear-gradient(145deg, rgba(15, 23, 42, 0.88), rgba(2, 6, 23, 0.9));
  color: #e2e8f0;
  border-radius: 8px;
  padding: 8px 8px 7px 10px;
  cursor: pointer;
  display: grid;
  gap: 6px;
  position: relative;
  transition: border-color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;
}

.entry-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  border-radius: 8px 0 0 8px;
  background: linear-gradient(to bottom, #64748b, rgba(100, 116, 139, 0.05));
}

.entry-item[data-status='constant']::before {
  background: linear-gradient(to bottom, #3b82f6, rgba(59, 130, 246, 0));
}

.entry-item[data-status='vector']::before {
  background: linear-gradient(to bottom, #a855f7, rgba(168, 85, 247, 0));
}

.entry-item[data-status='normal']::before {
  background: linear-gradient(to bottom, #22c55e, rgba(34, 197, 94, 0));
}

.entry-item[data-status='disabled']::before {
  background: linear-gradient(to bottom, #6b7280, rgba(107, 114, 128, 0));
}

.entry-item:hover {
  border-color: #475569;
  transform: translateY(-1px);
}

.entry-item.selected {
  border-color: #38bdf8;
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.5) inset, 0 6px 16px rgba(14, 116, 144, 0.3);
}

.entry-item.disabled {
  opacity: 0.74;
}

.entry-item-head {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.entry-status-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #64748b;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.85);
}

.entry-status-dot[data-status='constant'] {
  background: #3b82f6;
}

.entry-status-dot[data-status='vector'] {
  background: #a855f7;
}

.entry-status-dot[data-status='normal'] {
  background: #22c55e;
}

.entry-status-dot[data-status='disabled'] {
  background: #6b7280;
}

.entry-item-title {
  font-weight: 700;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-item-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.entry-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid #334155;
  border-radius: 999px;
  padding: 1px 8px;
  color: #cbd5e1;
  font-size: 11px;
  background: rgba(15, 23, 42, 0.55);
}

.entry-chip.uid {
  color: #93c5fd;
  font-size: 10px;
  padding: 1px 7px;
}

.entry-chip.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 10px;
}

.entry-chip.status[data-status='constant'] {
  border-color: rgba(59, 130, 246, 0.65);
  color: #93c5fd;
  background: rgba(59, 130, 246, 0.16);
}

.entry-chip.status[data-status='vector'] {
  border-color: rgba(168, 85, 247, 0.65);
  color: #d8b4fe;
  background: rgba(168, 85, 247, 0.16);
}

.entry-chip.status[data-status='normal'] {
  border-color: rgba(34, 197, 94, 0.65);
  color: #86efac;
  background: rgba(34, 197, 94, 0.16);
}

.entry-chip.status[data-status='disabled'] {
  border-color: rgba(107, 114, 128, 0.7);
  color: #cbd5e1;
  background: rgba(100, 116, 139, 0.15);
}

.entry-item-preview {
  color: #94a3b8;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 16px;
  opacity: 0.85;
}

.entry-item-preview::before {
  content: 'Keys: ';
  color: #64748b;
  margin-right: 4px;
}

.wb-editor {
  max-height: 70vh;
  overflow: hidden;
}

.wb-editor-shell {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 10px 360px;
  gap: 0;
}

.wb-resize-handle {
  position: relative;
  width: 10px;
  cursor: col-resize;
  user-select: none;
  touch-action: none;
}

.wb-resize-handle::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 12px;
  bottom: 12px;
  width: 2px;
  border-radius: 999px;
  background: rgba(100, 116, 139, 0.5);
  transition: background-color 0.15s ease;
}

.wb-resize-handle:hover::before,
.wb-resize-handle.dragging::before {
  background: rgba(56, 189, 248, 0.95);
}

.editor-center {
  border: 1px solid #1e293b;
  border-radius: 10px;
  background: rgba(2, 6, 23, 0.7);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: auto;
}

.editor-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-end;
  border-bottom: 1px solid #1e293b;
  padding-bottom: 8px;
}

.editor-comment {
  flex: 1;
}

.editor-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.editor-badge {
  font-size: 10px;
  border: 1px solid #334155;
  border-radius: 999px;
  padding: 2px 8px;
  color: #94a3b8;
  background: rgba(15, 23, 42, 0.72);
  white-space: nowrap;
}

.editor-badge.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.editor-badge.on {
  border-color: rgba(34, 197, 94, 0.65);
  color: #86efac;
}

.editor-badge.off {
  border-color: rgba(107, 114, 128, 0.75);
  color: #cbd5e1;
}

.editor-badge.strategy[data-status='constant'] {
  border-color: rgba(59, 130, 246, 0.65);
  color: #93c5fd;
}

.editor-badge.strategy[data-status='vector'] {
  border-color: rgba(168, 85, 247, 0.65);
  color: #d8b4fe;
}

.editor-badge.strategy[data-status='normal'] {
  border-color: rgba(34, 197, 94, 0.65);
  color: #86efac;
}

.editor-badge.strategy[data-status='disabled'] {
  border-color: rgba(107, 114, 128, 0.75);
  color: #cbd5e1;
}

.editor-keyword-grid .text-area.compact {
  min-height: 36px;
  height: 36px;
  line-height: 1.35;
}

.editor-content-block {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.editor-content-title {
  font-size: 12px;
  color: #93c5fd;
  letter-spacing: 0.01em;
}

.editor-content-area {
  min-height: 320px;
  flex: 1;
  resize: none;
  line-height: 1.5;
}

.editor-advanced {
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 7px;
  background: rgba(15, 23, 42, 0.4);
}

.editor-advanced > summary {
  cursor: pointer;
  font-size: 12px;
  color: #cbd5e1;
}

.editor-advanced[open] > summary {
  margin-bottom: 7px;
}

.editor-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: auto;
}

.editor-card {
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 8px;
  background: rgba(15, 23, 42, 0.7);
  display: grid;
  gap: 7px;
}

.editor-card h4 {
  margin: 0;
  font-size: 12px;
  color: #f59e0b;
}

.strategy-switch {
  display: grid;
  gap: 6px;
}

.strategy-pill {
  border: 1px solid #334155;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.7);
  color: #cbd5e1;
  padding: 6px 8px;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.strategy-pill:hover {
  border-color: #475569;
}

.strategy-pill.active.constant {
  border-color: rgba(59, 130, 246, 0.8);
  background: rgba(59, 130, 246, 0.16);
  color: #93c5fd;
}

.strategy-pill.active.vector {
  border-color: rgba(168, 85, 247, 0.8);
  background: rgba(168, 85, 247, 0.16);
  color: #d8b4fe;
}

.strategy-pill.active.selective {
  border-color: rgba(34, 197, 94, 0.8);
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
}

.editor-grid {
  display: grid;
  gap: 8px;
}

.editor-grid.two-cols {
  grid-template-columns: 1fr 1fr;
}

.editor-grid.three-cols {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field > span {
  color: #93c5fd;
}

.field.disabled {
  opacity: 0.56;
}

.field-end {
  align-self: end;
}

.field-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.text-input,
.text-area,
.toolbar-select {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #334155;
  border-radius: 7px;
  padding: 6px 8px;
  color: #f8fafc;
  background: #0f172a;
}

.text-area {
  min-height: 96px;
  resize: vertical;
}

.text-area.compact {
  min-height: 84px;
}

.text-area.large {
  min-height: 190px;
}

.checkbox-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.wb-tools-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.tool-card {
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 170px;
  background: rgba(15, 23, 42, 0.45);
}

.tool-card h4 {
  margin: 0;
  font-size: 13px;
  color: #93c5fd;
}

.tool-line.stacked {
  display: grid;
  gap: 6px;
}

.find-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.find-scope-line {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.find-summary-text {
  margin-left: auto;
  color: #93c5fd;
  font-size: 12px;
}

.find-active-hit {
  border: 1px solid #334155;
  border-radius: 7px;
  padding: 6px 8px;
  display: grid;
  gap: 2px;
  background: rgba(2, 6, 23, 0.45);
}

.find-active-hit strong {
  color: #cbd5e1;
  font-size: 12px;
}

.find-active-hit span {
  color: #94a3b8;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.batch-exclude-note {
  color: #94a3b8;
  font-size: 11px;
}

.batch-exclude-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.exclude-chip {
  border: 1px solid #475569;
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.6);
}

.tool-details {
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 6px;
  background: rgba(15, 23, 42, 0.35);
}

.tool-details > summary {
  cursor: pointer;
  color: #cbd5e1;
  font-size: 12px;
}

.tool-details[open] > summary {
  margin-bottom: 6px;
}

.history-compare {
  display: grid;
  gap: 6px;
}

.history-preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.history-preview-card {
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 6px;
  display: grid;
  gap: 3px;
  background: rgba(2, 6, 23, 0.48);
}

.history-preview-card strong {
  color: #93c5fd;
  font-size: 11px;
}

.history-preview-card span {
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.35;
}

.history-note {
  border: 1px dashed #334155;
  border-radius: 8px;
  padding: 6px;
  color: #94a3b8;
  font-size: 11px;
  background: rgba(15, 23, 42, 0.32);
}

.tool-scroll {
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tool-list-item {
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 6px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
}

.item-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.item-main strong,
.activation-main strong {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-main span {
  color: #94a3b8;
  font-size: 12px;
}

.item-actions {
  display: flex;
  gap: 6px;
}

.activation-item {
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 6px;
  display: grid;
  gap: 3px;
}

.activation-main,
.activation-sub {
  display: flex;
  justify-content: space-between;
  gap: 6px;
}

.activation-main span,
.activation-sub {
  color: #94a3b8;
  font-size: 12px;
}

.activation-sub span:last-child {
  flex: 1;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-floating-window {
  position: fixed;
  max-width: calc(100vw - 16px);
  max-height: min(74vh, 760px);
  border: 1px solid #334155;
  border-radius: 10px;
  background: linear-gradient(155deg, rgba(2, 6, 23, 0.95), rgba(15, 23, 42, 0.95));
  box-shadow: 0 14px 36px rgba(2, 6, 23, 0.7);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wb-floating-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid #334155;
  background: rgba(15, 23, 42, 0.9);
  cursor: move;
  user-select: none;
  touch-action: none;
}

.wb-floating-header strong {
  font-size: 12px;
  color: #cbd5e1;
}

.wb-floating-header-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.wb-floating-body {
  min-height: 0;
  padding: 8px;
  display: grid;
  gap: 8px;
  overflow: auto;
}

.find-window .wb-floating-body {
  gap: 10px;
}

.activation-window .tool-scroll {
  max-height: min(58vh, 520px);
}

.wb-status {
  border: 1px solid #334155;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.52);
  padding: 8px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #cbd5e1;
  flex-wrap: wrap;
}

.btn {
  border: 1px solid #475569;
  background: #1e293b;
  color: #f8fafc;
  border-radius: 7px;
  padding: 5px 10px;
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  border-color: #38bdf8;
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn.primary {
  background: #0c4a6e;
  border-color: #0284c7;
}

.btn.danger {
  background: #4c0519;
  border-color: #e11d48;
}

.btn.mini {
  padding: 4px 8px;
  font-size: 12px;
}

.empty-note,
.empty-block {
  color: #94a3b8;
  font-size: 12px;
}

.empty-block {
  padding: 14px;
  border: 1px dashed #475569;
  border-radius: 8px;
}

.hidden-input {
  display: none;
}

.wb-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10020;
  padding: 14px;
}

.wb-history-modal {
  width: min(1260px, 100%);
  height: min(88vh, 940px);
  border: 1px solid #334155;
  border-radius: 12px;
  background: linear-gradient(155deg, #0b1325, #020617);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wb-history-modal-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #334155;
  background: rgba(15, 23, 42, 0.85);
}

.wb-history-modal-header strong {
  display: block;
  font-size: 14px;
}

.wb-history-modal-header span {
  color: #94a3b8;
  font-size: 11px;
}

.wb-history-modal-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.wb-history-modal-main {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: 300px 1fr;
  overflow: hidden;
}

.wb-history-versions {
  border-right: 1px solid #334155;
  background: rgba(15, 23, 42, 0.8);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.wb-history-versions-title {
  padding: 8px 10px;
  font-size: 11px;
  color: #94a3b8;
  border-bottom: 1px solid #334155;
}

.wb-history-versions-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.wb-history-version-item {
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 6px;
  display: grid;
  gap: 4px;
  background: rgba(15, 23, 42, 0.56);
}

.wb-history-version-line {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  align-items: center;
}

.wb-history-version-line strong {
  font-size: 11px;
  color: #cbd5e1;
}

.wb-history-version-item span {
  font-size: 11px;
  color: #94a3b8;
  word-break: break-all;
}

.wb-history-lr {
  display: inline-flex;
  gap: 4px;
}

.mini-lr {
  border: 1px solid #475569;
  background: #0f172a;
  color: #94a3b8;
  border-radius: 6px;
  min-width: 24px;
  font-size: 10px;
  cursor: pointer;
}

.mini-lr.active {
  border-color: #22d3ee;
  color: #67e8f9;
}

.wb-history-diff-wrap {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.wb-history-diff-head {
  border-bottom: 1px solid #334155;
  background: rgba(15, 23, 42, 0.58);
  padding: 8px 10px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  color: #94a3b8;
}

.wb-history-diff-grid {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.wb-history-diff-grid > div {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.wb-history-diff-grid > div + div {
  border-left: 1px solid #334155;
}

.wb-history-diff-title {
  padding: 8px 10px;
  border-bottom: 1px solid #334155;
  font-size: 11px;
  color: #93c5fd;
}

.wb-history-diff-body {
  min-height: 0;
  flex: 1;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 11px;
  background: rgba(2, 6, 23, 0.9);
}

.diff-row {
  display: grid;
  grid-template-columns: 54px 1fr;
  align-items: start;
  border-bottom: 1px solid rgba(51, 65, 85, 0.25);
}

.line-no {
  color: #64748b;
  padding: 2px 8px;
  border-right: 1px solid rgba(51, 65, 85, 0.35);
  user-select: none;
}

.line-text {
  white-space: pre-wrap;
  word-break: break-word;
  padding: 2px 8px;
  color: #cbd5e1;
}

.diff-row.add {
  background: rgba(34, 197, 94, 0.18);
}

.diff-row.del {
  background: rgba(239, 68, 68, 0.18);
}

.diff-row.empty {
  background: rgba(100, 116, 139, 0.08);
}

@media (max-width: 1380px) {
  .wb-editor-shell {
    grid-template-columns: 1fr;
  }

  .editor-side {
    overflow: visible;
    max-height: none;
  }

  .wb-history-modal-main {
    grid-template-columns: 1fr;
  }

  .wb-history-versions {
    border-right: none;
    border-bottom: 1px solid #334155;
    max-height: 240px;
  }
}

@media (max-width: 1100px) {
  .global-mode-grid {
    grid-template-columns: 1fr;
  }

  .wb-resize-handle {
    display: none;
  }

  .wb-main-layout {
    grid-template-columns: 1fr;
  }

  .wb-tools-grid {
    grid-template-columns: 1fr;
  }

  .editor-grid.two-cols,
  .editor-grid.three-cols {
    grid-template-columns: 1fr;
  }

  .editor-head {
    flex-direction: column;
    align-items: stretch;
  }

  .editor-badges {
    justify-content: flex-start;
  }

  .history-preview-grid {
    grid-template-columns: 1fr;
  }

  .wb-history-diff-grid {
    grid-template-columns: 1fr;
  }

  .wb-history-diff-grid > div + div {
    border-left: none;
    border-top: 1px solid #334155;
  }

  .wb-status {
    flex-direction: column;
  }

  .wb-floating-window {
    width: calc(100vw - 16px) !important;
    left: 8px !important;
    right: 8px;
  }
}
</style>
