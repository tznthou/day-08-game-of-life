/**
 * Conway's Game of Life
 * 使用 d3.js 進行 SVG 渲染與動畫
 */

// ============ 常數 ============
const ROWS = 50;
const COLS = 50;
const CELL_SIZE = 10;
const GAP = 1;
const ALIVE_COLOR = '#1f2937';
const DEAD_COLOR = '#e5e7eb';

// 動畫相關常數
const RANDOM_DENSITY = 0.3;           // 隨機初始化密度
const TRANSITION_RATIO = 0.8;         // 動畫時間比例（相對於 interval）
const MAX_TRANSITION_MS = 200;        // 最大動畫時間
const HOVER_SCALE = 1.2;              // hover 放大倍率
const HOVER_DURATION = 100;           // hover 動畫時間
const BORN_SCALE_START = 0.3;         // 新生細胞初始縮放
const BORN_OVERSHOOT = 1.5;           // 彈跳效果強度
const DIED_SCALE_END = 0.5;           // 死亡細胞結束縮放

// 細胞年齡顏色常數
const AGE_COLORS = [
  { age: 0, color: '#10b981' },   // emerald-500 (新生)
  { age: 3, color: '#06b6d4' },   // cyan-500 (年輕)
  { age: 10, color: '#6366f1' },  // indigo-500 (成熟)
  { age: 30, color: '#8b5cf6' }   // violet-500 (穩定)
];

// 統計圖表常數
const CHART_WIDTH = 500;
const CHART_HEIGHT = 120;
const CHART_MARGIN = { top: 10, right: 20, bottom: 30, left: 50 };
const CHART_MAX_POINTS = 100;         // 最多顯示 100 個資料點
const CHART_LINE_COLOR = '#6366f1';   // 折線顏色（indigo-500）
const CHART_AREA_COLOR = '#c7d2fe';   // 面積顏色（indigo-200）

// ============ 狀態 ============
let grid = [];
let cellAge = [];     // 追蹤每個細胞連續存活的世代數
let prevGrid = null;  // 追蹤前一狀態，用於計算哪些細胞改變了
let isRunning = false;
let interval = 200; // ms
let timeoutId = null;
let generation = 0;

// 統計資料
let historyData = [];  // [{ generation, count }, ...]

// ============ DOM 元素 ============
const svg = d3.select('#grid');
const chartSvg = d3.select('#chart');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const btnRandom = document.getElementById('btn-random');
const speedSlider = document.getElementById('speed-slider');
const speedDisplay = document.getElementById('speed-display');
const generationDisplay = document.getElementById('generation');
const aliveCountDisplay = document.getElementById('alive-count');
const patternBtns = document.querySelectorAll('.pattern-btn');

// 圖表元素（初始化時建立）
let chartG, xScale, yScale, xAxis, yAxis, line, area, linePath, areaPath;

// ============ 預設圖案 ============
const PATTERNS = {
  glider: {
    name: '滑翔機',
    width: 3,
    height: 3,
    cells: [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]
  },
  lwss: {
    name: '輕量太空船',
    width: 5,
    height: 4,
    cells: [[1, 0], [4, 0], [0, 1], [0, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3]]
  },
  blinker: {
    name: '閃爍器',
    width: 3,
    height: 1,
    cells: [[0, 0], [1, 0], [2, 0]]
  },
  beacon: {
    name: '信標',
    width: 4,
    height: 4,
    cells: [[0, 0], [1, 0], [0, 1], [3, 2], [2, 3], [3, 3]]
  },
  pulsar: {
    name: '脈衝星',
    width: 13,
    height: 13,
    cells: [
      // 上方橫線
      [2, 0], [3, 0], [4, 0], [8, 0], [9, 0], [10, 0],
      // 左上直線
      [0, 2], [0, 3], [0, 4], [5, 2], [5, 3], [5, 4],
      // 右上直線
      [7, 2], [7, 3], [7, 4], [12, 2], [12, 3], [12, 4],
      // 中上橫線
      [2, 5], [3, 5], [4, 5], [8, 5], [9, 5], [10, 5],
      // 中下橫線
      [2, 7], [3, 7], [4, 7], [8, 7], [9, 7], [10, 7],
      // 左下直線
      [0, 8], [0, 9], [0, 10], [5, 8], [5, 9], [5, 10],
      // 右下直線
      [7, 8], [7, 9], [7, 10], [12, 8], [12, 9], [12, 10],
      // 下方橫線
      [2, 12], [3, 12], [4, 12], [8, 12], [9, 12], [10, 12]
    ]
  },
  gosperGun: {
    name: '高斯帕滑翔機槍',
    width: 36,
    height: 9,
    cells: [
      // 左方塊
      [0, 4], [0, 5], [1, 4], [1, 5],
      // 左半結構
      [10, 4], [10, 5], [10, 6],
      [11, 3], [11, 7],
      [12, 2], [12, 8],
      [13, 2], [13, 8],
      [14, 5],
      [15, 3], [15, 7],
      [16, 4], [16, 5], [16, 6],
      [17, 5],
      // 右半結構
      [20, 2], [20, 3], [20, 4],
      [21, 2], [21, 3], [21, 4],
      [22, 1], [22, 5],
      [24, 0], [24, 1], [24, 5], [24, 6],
      // 右方塊
      [34, 2], [34, 3], [35, 2], [35, 3]
    ]
  }
};

// ============ 工具函式 ============

/**
 * 計算細胞中心座標
 */
function getCellCenter(x, y) {
  return {
    cx: x * (CELL_SIZE + GAP) + CELL_SIZE / 2,
    cy: y * (CELL_SIZE + GAP) + CELL_SIZE / 2
  };
}

/**
 * 建立空的二維網格陣列
 */
function createGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

/**
 * 建立年齡網格陣列
 */
function createAgeGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

/**
 * 根據細胞年齡取得顏色
 * 使用 d3.interpolateRgb 進行平滑顏色過渡
 */
function getCellColor(age) {
  if (age <= 0) return DEAD_COLOR;

  // 找到年齡落在哪個區間
  for (let i = AGE_COLORS.length - 1; i >= 0; i--) {
    if (age >= AGE_COLORS[i].age) {
      // 如果是最後一個區間，直接返回該顏色
      if (i === AGE_COLORS.length - 1) {
        return AGE_COLORS[i].color;
      }
      // 否則進行插值
      const current = AGE_COLORS[i];
      const next = AGE_COLORS[i + 1];
      const t = (age - current.age) / (next.age - current.age);
      return d3.interpolateRgb(current.color, next.color)(t);
    }
  }
  return AGE_COLORS[0].color;
}

/**
 * 計算活細胞數量
 */
function countAliveCells() {
  let count = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      count += grid[y][x];
    }
  }
  return count;
}

// ============ 初始化 ============
function init() {
  // 設定網格 SVG 尺寸
  const width = COLS * (CELL_SIZE + GAP) - GAP;
  const height = ROWS * (CELL_SIZE + GAP) - GAP;
  svg.attr('width', width).attr('height', height);

  // 建立空網格
  createEmptyGrid();

  // 繪製初始網格
  drawGrid();

  // 初始化圖表
  initChart();

  // 綁定事件
  bindEvents();

  // 更新速度顯示
  updateSpeedDisplay();

  // 更新活細胞數顯示
  updateAliveCountDisplay();
}

function createEmptyGrid() {
  grid = createGrid();
  cellAge = createAgeGrid();
  prevGrid = null;
  generation = 0;
  historyData = [];
  updateGenerationDisplay();
}

// ============ 統計圖表 ============

/**
 * 初始化 d3.js 折線圖
 */
function initChart() {
  const innerWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const innerHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;

  // 設定 SVG 尺寸
  chartSvg
    .attr('width', CHART_WIDTH)
    .attr('height', CHART_HEIGHT);

  // 建立圖表群組
  chartG = chartSvg.append('g')
    .attr('transform', `translate(${CHART_MARGIN.left}, ${CHART_MARGIN.top})`);

  // X 軸比例尺
  xScale = d3.scaleLinear()
    .domain([0, CHART_MAX_POINTS])
    .range([0, innerWidth]);

  // Y 軸比例尺
  yScale = d3.scaleLinear()
    .domain([0, ROWS * COLS * 0.5])  // 最大 50% 活細胞
    .range([innerHeight, 0]);

  // X 軸
  xAxis = chartG.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => `${d}`));

  // X 軸標籤
  chartG.append('text')
    .attr('class', 'axis-label')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 25)
    .attr('text-anchor', 'middle')
    .attr('fill', '#9ca3af')
    .attr('font-size', '10px')
    .text('世代');

  // Y 軸
  yAxis = chartG.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(yScale).ticks(4));

  // Y 軸標籤
  chartG.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -35)
    .attr('text-anchor', 'middle')
    .attr('fill', '#9ca3af')
    .attr('font-size', '10px')
    .text('活細胞數');

  // 面積生成器
  area = d3.area()
    .x(d => xScale(d.generation))
    .y0(innerHeight)
    .y1(d => yScale(d.count))
    .curve(d3.curveMonotoneX);

  // 折線生成器
  line = d3.line()
    .x(d => xScale(d.generation))
    .y(d => yScale(d.count))
    .curve(d3.curveMonotoneX);

  // 面積路徑
  areaPath = chartG.append('path')
    .attr('class', 'area')
    .attr('fill', CHART_AREA_COLOR)
    .attr('opacity', 0.5);

  // 折線路徑
  linePath = chartG.append('path')
    .attr('class', 'line')
    .attr('fill', 'none')
    .attr('stroke', CHART_LINE_COLOR)
    .attr('stroke-width', 2);

  // 設定座標軸樣式
  chartSvg.selectAll('.domain, .tick line')
    .attr('stroke', '#e5e7eb');
  chartSvg.selectAll('.tick text')
    .attr('fill', '#9ca3af')
    .attr('font-size', '10px');
}

/**
 * 更新統計圖表
 */
function updateChart() {
  const count = countAliveCells();
  const innerWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;

  // 加入新資料點
  historyData.push({ generation, count });

  // 限制資料點數量
  if (historyData.length > CHART_MAX_POINTS) {
    historyData.shift();
  }

  // 更新 X 軸範圍
  const minGen = historyData.length > 0 ? historyData[0].generation : 0;
  const maxGen = Math.max(minGen + CHART_MAX_POINTS, generation);
  xScale.domain([minGen, maxGen]);

  // 更新 Y 軸範圍（動態調整）
  const maxCount = d3.max(historyData, d => d.count) || 100;
  yScale.domain([0, Math.max(maxCount * 1.2, 100)]);

  // 更新座標軸
  xAxis.transition().duration(100).call(d3.axisBottom(xScale).ticks(5));
  yAxis.transition().duration(100).call(d3.axisLeft(yScale).ticks(4));

  // 更新折線和面積
  const transitionDuration = Math.min(interval * 0.5, 100);

  areaPath
    .datum(historyData)
    .transition()
    .duration(transitionDuration)
    .attr('d', area);

  linePath
    .datum(historyData)
    .transition()
    .duration(transitionDuration)
    .attr('d', line);

  // 更新座標軸樣式
  chartSvg.selectAll('.domain, .tick line')
    .attr('stroke', '#e5e7eb');
  chartSvg.selectAll('.tick text')
    .attr('fill', '#9ca3af')
    .attr('font-size', '10px');

  // 更新活細胞數顯示
  updateAliveCountDisplay();
}

/**
 * 重置圖表
 */
function resetChart() {
  historyData = [];

  // 重置 X 軸範圍
  xScale.domain([0, CHART_MAX_POINTS]);
  yScale.domain([0, ROWS * COLS * 0.5]);

  xAxis.call(d3.axisBottom(xScale).ticks(5));
  yAxis.call(d3.axisLeft(yScale).ticks(4));

  areaPath.attr('d', null);
  linePath.attr('d', null);

  // 更新座標軸樣式
  chartSvg.selectAll('.domain, .tick line')
    .attr('stroke', '#e5e7eb');
  chartSvg.selectAll('.tick text')
    .attr('fill', '#9ca3af')
    .attr('font-size', '10px');

  updateAliveCountDisplay();
}

// ============ 繪製 ============

/**
 * 將二維網格扁平化為 d3 可用的資料格式
 */
function getFlatData() {
  const data = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const wasAlive = prevGrid ? prevGrid[y][x] : 0;
      const isAlive = grid[y][x];
      const age = cellAge[y][x];
      const { cx, cy } = getCellCenter(x, y);
      data.push({
        x,
        y,
        cx,  // 預先計算中心 X
        cy,  // 預先計算中心 Y
        alive: isAlive,
        age,  // 細胞年齡
        color: isAlive ? getCellColor(age) : DEAD_COLOR,  // 根據年齡計算顏色
        justBorn: isAlive && !wasAlive,  // 剛出生
        justDied: !isAlive && wasAlive   // 剛死亡
      });
    }
  }
  return data;
}

/**
 * 繪製網格
 * @param {boolean} animate - 是否啟用動畫
 */
function drawGrid(animate = false) {
  const data = getFlatData();
  const transitionDuration = animate ? Math.min(interval * TRANSITION_RATIO, MAX_TRANSITION_MS) : 0;

  const cells = svg.selectAll('rect')
    .data(data, d => `${d.x}-${d.y}`);

  // Enter：首次建立所有細胞
  cells.enter()
    .append('rect')
    .attr('x', d => d.x * (CELL_SIZE + GAP))
    .attr('y', d => d.y * (CELL_SIZE + GAP))
    .attr('width', CELL_SIZE)
    .attr('height', CELL_SIZE)
    .attr('fill', d => d.color)
    .attr('rx', 2)
    .style('cursor', 'pointer')
    .style('transform-origin', d => `${d.cx}px ${d.cy}px`)
    .on('click', onCellClick)
    .on('mouseenter', onCellMouseEnter)
    .on('mouseleave', onCellMouseLeave);

  // Update：更新現有細胞
  if (animate && transitionDuration > 0) {
    cells.each(function (d) {
      const cell = d3.select(this);

      // 清除可能殘留的動畫
      cell.interrupt();

      if (d.justBorn) {
        // 新生細胞：從小變大 + 顏色變化
        cell
          .style('transform', `scale(${BORN_SCALE_START})`)
          .style('transform-origin', `${d.cx}px ${d.cy}px`)
          .transition()
          .duration(transitionDuration)
          .ease(d3.easeBackOut.overshoot(BORN_OVERSHOOT))
          .style('transform', 'scale(1)')
          .attr('fill', d.color);
      } else if (d.justDied) {
        // 死亡細胞：縮小 + 淡出
        cell
          .style('transform-origin', `${d.cx}px ${d.cy}px`)
          .transition()
          .duration(transitionDuration)
          .ease(d3.easeQuadIn)
          .style('transform', `scale(${DIED_SCALE_END})`)
          .attr('fill', DEAD_COLOR)
          .on('end', function () {
            d3.select(this).style('transform', 'scale(1)');
          });
      } else {
        // 沒變化的細胞（存活中的細胞顏色可能因年齡變化）
        cell
          .transition()
          .duration(transitionDuration)
          .attr('fill', d.color);
      }
    });
  } else {
    // 不需要動畫，直接更新
    cells
      .attr('fill', d => d.color)
      .style('transform', 'scale(1)');
  }
}

// ============ 遊戲邏輯 ============

/**
 * 計算指定細胞的活鄰居數量（Moore 鄰域）
 * 規則：檢查周圍 8 格，邊界視為死亡
 */
function countNeighbors(y, x) {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dy === 0 && dx === 0) continue;
      const ny = y + dy;
      const nx = x + dx;
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
        count += grid[ny][nx];
      }
    }
  }
  return count;
}

/**
 * 執行一步演化
 * Conway's Game of Life 規則：
 * 1. 活細胞周圍有 2 或 3 個活鄰居 → 存活
 * 2. 活細胞周圍少於 2 個（孤獨）或多於 3 個（擁擠）→ 死亡
 * 3. 死細胞周圍恰好有 3 個活鄰居 → 復活
 */
function step() {
  const newGrid = createGrid();
  const newAge = createAgeGrid();

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const neighbors = countNeighbors(y, x);
      const alive = grid[y][x];

      if (alive) {
        // 活細胞：2 或 3 個鄰居則存活
        if (neighbors === 2 || neighbors === 3) {
          newGrid[y][x] = 1;
          newAge[y][x] = cellAge[y][x] + 1;  // 年齡 +1
        } else {
          newGrid[y][x] = 0;
          newAge[y][x] = 0;
        }
      } else {
        // 死細胞：恰好 3 個鄰居則復活
        if (neighbors === 3) {
          newGrid[y][x] = 1;
          newAge[y][x] = 1;  // 新生細胞年齡 = 1
        } else {
          newGrid[y][x] = 0;
          newAge[y][x] = 0;
        }
      }
    }
  }

  // 優化：直接指針賦值，避免深拷貝
  prevGrid = grid;
  grid = newGrid;
  cellAge = newAge;
  generation++;
  updateGenerationDisplay();
  drawGrid(true);
  updateChart();
}

// ============ 控制函式 ============

function start() {
  if (isRunning) return;
  isRunning = true;
  btnStart.classList.add('ring-2', 'ring-emerald-300');
  runLoop();
}

function runLoop() {
  if (!isRunning) return;
  step();
  timeoutId = setTimeout(runLoop, interval);
}

function pause() {
  isRunning = false;
  btnStart.classList.remove('ring-2', 'ring-emerald-300');
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  // 重置所有細胞的 transform，避免動畫殘留
  svg.selectAll('rect')
    .interrupt()
    .style('transform', 'scale(1)');
}

function reset() {
  pause();
  createEmptyGrid();
  drawGrid();
  resetChart();
}

function randomize() {
  pause();
  cellAge = createAgeGrid();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const alive = Math.random() < RANDOM_DENSITY ? 1 : 0;
      grid[y][x] = alive;
      cellAge[y][x] = alive;  // 新生細胞年齡 = 1
    }
  }
  prevGrid = null;  // 重置 prevGrid 避免錯誤動畫
  generation = 0;
  updateGenerationDisplay();
  drawGrid();
  resetChart();
  updateAliveCountDisplay();
}

function loadPattern(name) {
  pause();
  createEmptyGrid();

  const pattern = PATTERNS[name];
  if (!pattern) return;

  // 計算置中偏移（Gosper Gun 放左上一點，讓滑翔機有空間飛）
  let offsetX, offsetY;
  if (name === 'gosperGun') {
    offsetX = 2;
    offsetY = 2;
  } else {
    offsetX = Math.floor((COLS - pattern.width) / 2);
    offsetY = Math.floor((ROWS - pattern.height) / 2);
  }

  // 放置圖案
  pattern.cells.forEach(([x, y]) => {
    const nx = x + offsetX;
    const ny = y + offsetY;
    if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
      grid[ny][nx] = 1;
      cellAge[ny][nx] = 1;  // 新生細胞年齡 = 1
    }
  });

  drawGrid();
  resetChart();
  updateAliveCountDisplay();
}

// ============ 事件處理 ============

function onCellClick(event, d) {
  const wasAlive = grid[d.y][d.x];
  grid[d.y][d.x] = wasAlive ? 0 : 1;

  // 更新細胞年齡
  cellAge[d.y][d.x] = wasAlive ? 0 : 1;

  // 同步更新 prevGrid，避免下次 step 誤判為 justBorn/justDied
  if (prevGrid) {
    prevGrid[d.y][d.x] = grid[d.y][d.x];
  }

  // 點擊不用動畫，立即更新
  const color = grid[d.y][d.x] ? getCellColor(cellAge[d.y][d.x]) : DEAD_COLOR;
  d3.select(event.target).attr('fill', color);

  // 更新活細胞數
  updateAliveCountDisplay();
}

function onCellMouseEnter() {
  // 遊戲執行中禁用 hover 效果，避免干擾動畫
  if (isRunning) return;

  const cell = d3.select(this);
  cell
    .interrupt()
    .transition()
    .duration(HOVER_DURATION)
    .style('transform', `scale(${HOVER_SCALE})`);
}

function onCellMouseLeave() {
  // 遊戲執行中禁用 hover 效果
  if (isRunning) return;

  const cell = d3.select(this);
  cell
    .interrupt()
    .transition()
    .duration(HOVER_DURATION)
    .style('transform', 'scale(1)');
}

function updateSpeedDisplay() {
  const fps = Math.round(1000 / interval);
  speedDisplay.textContent = `${fps} 代/秒`;
}

function updateGenerationDisplay() {
  generationDisplay.textContent = generation;
}

function updateAliveCountDisplay() {
  const count = countAliveCells();
  aliveCountDisplay.textContent = `目前: ${count} 個`;
}

function bindEvents() {
  btnStart.addEventListener('click', start);
  btnPause.addEventListener('click', pause);
  btnReset.addEventListener('click', reset);
  btnRandom.addEventListener('click', randomize);

  speedSlider.addEventListener('input', (e) => {
    interval = parseInt(e.target.value);
    updateSpeedDisplay();
    // 如果正在運行，重新設定計時器
    if (isRunning) {
      clearTimeout(timeoutId);
      runLoop();
    }
  });

  patternBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      loadPattern(btn.dataset.pattern);
    });
  });
}

// ============ 啟動 ============
init();
