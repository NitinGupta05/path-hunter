// =========================
// CONFIG & GLOBAL STATE
// =========================
const CELL_SIZE = 32;
let ROWS = 15;
let COLS = 30;
let gridArray = [];
let isMousePressed = false;
let isRunning = false;
let currentTool = "pointer";
let draggingNode = null;

let startPos = { r: 5, c: 5 };
let endPos = { r: 5, c: 25 };

// =========================
// ALGORITHM INFO
// =========================
const ALGO_INFO = {
  bfs: {
    title: "Breadth-First Search (BFS)",
    tags: [
      { text: "Unweighted", type: "unweighted" },
      { text: "Shortest path guaranteed", type: "graph" }
    ],
    definition:
      "BFS explores the grid level by level. It first visits all cells at distance 1 from the start, then distance 2, and so on. On this unweighted grid, the first time it reaches the target, it has found a shortest path in terms of number of steps.",
    howItWorks:
      "BFS uses a <strong>Queue (FIFO)</strong>. When a cell is processed, all of its valid neighbors are added to the back of the queue. A visited flag ensures that each cell is processed at most once, creating a clean wave-like expansion from the start node.",
    realWorld:
      "Typical use cases: shortest path in unweighted graphs (degrees of separation), broadcasting in networks, and checking whether one node is reachable from another. Time complexity is O(V + E), where V is the number of cells and E the edges between them."
  },
  dfs: {
    title: "Depth-First Search (DFS)",
    tags: [
      { text: "Unweighted", type: "unweighted" },
      { text: "Exploration / backtracking", type: "graph" }
    ],
    definition:
      "DFS explores as far as possible along one direction before backtracking. Instead of spreading out evenly like BFS, it dives deep into one branch, then rewinds and tries alternative branches.",
    howItWorks:
      "DFS uses a <strong>Stack (LIFO)</strong> (or recursion). Starting from the start node, it pushes neighbors onto the stack. The cell on top of the stack is processed next, so the search keeps following one branch until it runs out of options, then backtracks. Each cell stores a <code>previousNode</code> pointer to reconstruct a path if the target is reached.",
    realWorld:
      "DFS is useful for exhaustive exploration and backtracking, such as solving puzzles, generating mazes, and detecting cycles in graphs. On this grid, DFS does <strong>not</strong> guarantee a shortest or straight path, so its route may look long or zig-zag even when a much shorter path exists."
  },
  astar: {
    title: "A* (A-Star) Search",
    tags: [
      { text: "Heuristic-guided", type: "weighted" },
      { text: "Efficient shortest path", type: "graph" }
    ],
    definition:
      "A* is a best-first search algorithm that tries to reach the target efficiently by combining the cost from the start with an estimate of the remaining distance. It behaves like a blend of Dijkstra's algorithm and greedy search.",
    howItWorks:
      "Each cell has a score <code>F = G + H</code>. <strong>G</strong> is the exact cost from the start node, and <strong>H</strong> is a heuristic estimate of the distance to the target. Here we use the <strong>Manhattan distance</strong> (horizontal + vertical moves) as the heuristic. At each step, A* picks the cell with the smallest F from the open set and updates its neighbors.",
    realWorld:
      "A* is widely used in navigation (maps), game AI pathfinding, and robotics. With an admissible heuristic (one that never overestimates the true distance), A* is both complete and optimal: it finds a path if one exists and that path is guaranteed to be shortest."
  }
};

// =========================
// DOM REFERENCES
// =========================
const gridEl = document.getElementById("grid");
const gridContainer = document.getElementById("gridContainer");
const infoPanel = document.getElementById("infoPanel");
const themeSwitch = document.getElementById("themeSwitch");

// =========================
// THEME INIT (PERSISTENT)
// =========================
function initTheme() {
  const saved = localStorage.getItem("ph-theme");
  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    if (themeSwitch) themeSwitch.checked = true;
  } else {
    document.documentElement.removeAttribute("data-theme");
    if (themeSwitch) themeSwitch.checked = false;
  }
}

// =========================
// GRID CREATION
// =========================
function calculateGridSize() {
  const maxWidth = Math.min(window.innerWidth * 0.9, 1200);
  const height = Math.min(window.innerHeight * 0.7, 650);

  COLS = Math.floor(maxWidth / CELL_SIZE);
  ROWS = Math.floor(height / CELL_SIZE);

  if (ROWS < 5) ROWS = 5;
  if (COLS < 5) COLS = 5;

  startPos = {
    r: Math.min(startPos.r, ROWS - 1),
    c: Math.min(startPos.c, COLS - 1)
  };
  endPos = {
    r: Math.min(endPos.r, ROWS - 1),
    c: Math.min(endPos.c, COLS - 1)
  };

  createGrid();
}

function createGrid() {
  gridEl.innerHTML = "";
  gridEl.style.gridTemplateColumns = `repeat(${COLS}, var(--cell-size))`;
  gridArray = [];

  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const div = document.createElement("div");
      div.className = "cell";
      div.addEventListener("mousedown", (e) => handleMouseDown(r, c, e));
      div.addEventListener("mouseenter", () => handleMouseEnter(r, c));
      div.addEventListener("mouseup", handleMouseUp);
      gridEl.appendChild(div);

      row.push({
        element: div,
        r,
        c,
        isWall: false,
        isVisited: false,
        previousNode: null,
        distance: Infinity,
        fCost: Infinity,
        gCost: Infinity
      });
    }
    gridArray.push(row);
  }

  updateSpecialNodes();
}

function updateSpecialNodes() {
  gridArray.forEach((row) =>
    row.forEach((n) => n.element.classList.remove("start", "end"))
  );

  if (gridArray[startPos.r]) {
    gridArray[startPos.r][startPos.c].element.classList.add("start");
  }
  if (gridArray[endPos.r]) {
    gridArray[endPos.r][endPos.c].element.classList.add("end");
  }
}

function isStartOrEnd(r, c) {
  return (
    (r === startPos.r && c === startPos.c) ||
    (r === endPos.r && c === endPos.c)
  );
}

// =========================
// TOOL / THEME HANDLERS
// =========================
function setTool(tool) {
  currentTool = tool;
  document.querySelectorAll(".tool-btn").forEach((b) =>
    b.classList.remove("active")
  );
  const btn = document.getElementById(`tool-${tool}`);
  if (btn) btn.classList.add("active");
  gridContainer.className = `grid-container tool-${tool}`;
}

function setMapTheme(theme) {
  gridContainer.setAttribute("data-map", theme);
}

// =========================
// MOUSE INTERACTION
// =========================
function handleMouseDown(r, c, e) {
  if (isRunning) return;
  e.preventDefault();

  infoPanel.classList.remove("visible", "error-state");
  isMousePressed = true;

  if (r === startPos.r && c === startPos.c) {
    draggingNode = "start";
    return;
  }
  if (r === endPos.r && c === endPos.c) {
    draggingNode = "end";
    return;
  }

  if (currentTool === "pencil") addWall(r, c, true);
  else if (currentTool === "eraser") addWall(r, c, false);
}

function handleMouseEnter(r, c) {
  if (!isMousePressed || isRunning) return;

  if (draggingNode === "start") {
    if ((r !== endPos.r || c !== endPos.c) && !gridArray[r][c].isWall) {
      startPos = { r, c };
      updateSpecialNodes();
    }
    return;
  }

  if (draggingNode === "end") {
    if ((r !== startPos.r || c !== startPos.c) && !gridArray[r][c].isWall) {
      endPos = { r, c };
      updateSpecialNodes();
    }
    return;
  }

  if (currentTool === "pencil") addWall(r, c, true);
  else if (currentTool === "eraser") addWall(r, c, false);
}

function handleMouseUp() {
  isMousePressed = false;
  draggingNode = null;
}

function addWall(r, c, state) {
  if (isStartOrEnd(r, c)) return;
  const node = gridArray[r][c];
  node.isWall = state;
  if (state) node.element.classList.add("wall");
  else node.element.classList.remove("wall");
}

// =========================
// MAZE / PATTERN GENERATION
// =========================
function handleMazeGen() {
  if (isRunning) return;
  const type = document.getElementById("mazeSelect").value;
  if (!type) return;

  resetBoard();

  if (type === "random") generateDFSMaze();
  else if (type === "spiral") generateSpiralPattern();
  else if (type === "recursive") recursiveDivision(1, ROWS - 2, 1, COLS - 2);

  document.getElementById("mazeSelect").value = "";
}

function recursiveDivision(rStart, rEnd, cStart, cEnd) {
  if (rEnd - rStart < 2 || cEnd - cStart < 2) return;

  const orientation = rEnd - rStart > cEnd - cStart ? "H" : "V";

  if (orientation === "H") {
    const wallR =
      Math.floor(Math.random() * (rEnd - rStart - 1)) + rStart + 1;
    const gapC = Math.floor(Math.random() * (cEnd - cStart + 1)) + cStart;

    for (let c = cStart; c <= cEnd; c++) {
      if (c !== gapC && !isStartOrEnd(wallR, c)) addWall(wallR, c, true);
    }

    recursiveDivision(rStart, wallR - 1, cStart, cEnd);
    recursiveDivision(wallR + 1, rEnd, cStart, cEnd);
  } else {
    const wallC =
      Math.floor(Math.random() * (cEnd - cStart - 1)) + cStart + 1;
    const gapR = Math.floor(Math.random() * (rEnd - rStart + 1)) + rStart;

    for (let r = rStart; r <= rEnd; r++) {
      if (r !== gapR && !isStartOrEnd(r, wallC)) addWall(r, wallC, true);
    }

    recursiveDivision(rStart, rEnd, cStart, wallC - 1);
    recursiveDivision(rStart, rEnd, wallC + 1, cEnd);
  }
}

function generateSpiralPattern() {
  let rStart = 1;
  let rEnd = ROWS - 2;
  let cStart = 1;
  let cEnd = COLS - 2;

  while (rStart <= rEnd && cStart <= cEnd) {
    for (let c = cStart; c <= cEnd; c++) {
      if (!isStartOrEnd(rStart, c)) addWall(rStart, c, true);
    }
    rStart += 2;

    for (let r = rStart - 2; r <= rEnd; r++) {
      if (!isStartOrEnd(r, cEnd)) addWall(r, cEnd, true);
    }
    cEnd -= 2;

    if (rStart <= rEnd) {
      for (let c = cEnd + 2; c >= cStart; c--) {
        if (!isStartOrEnd(rEnd, c)) addWall(rEnd, c, true);
      }
      rEnd -= 2;
    }

    if (cStart <= cEnd) {
      for (let r = rEnd + 2; r >= rStart; r--) {
        if (!isStartOrEnd(r, cStart)) addWall(r, cStart, true);
      }
      cStart += 2;
    }
  }

  clearNeighbors(startPos);
  clearNeighbors(endPos);
}

function generateDFSMaze() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isStartOrEnd(r, c)) addWall(r, c, true);
    }
  }

  const stack = [];
  const visited = new Set();
  const startKey = `${startPos.r},${startPos.c}`;
  stack.push(startPos);
  visited.add(startKey);

  while (stack.length > 0) {
    const curr = stack.pop();
    const neighbors = getMazeNeighbors(curr.r, curr.c, visited);
    if (neighbors.length > 0) {
      stack.push(curr);
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      const wallR = (curr.r + next.r) / 2;
      const wallC = (curr.c + next.c) / 2;
      addWall(wallR, wallC, false);
      addWall(next.r, next.c, false);
      visited.add(`${next.r},${next.c}`);
      stack.push(next);
    }
  }

  addWall(startPos.r, startPos.c, false);
  addWall(endPos.r, endPos.c, false);
}

function getMazeNeighbors(r, c, visited) {
  const neighbors = [];
  const dirs = [
    [0, -2],
    [0, 2],
    [-2, 0],
    [2, 0]
  ];

  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
      if (!visited.has(`${nr},${nc}`)) neighbors.push({ r: nr, c: nc });
    }
  }
  return neighbors;
}

function clearNeighbors(pos) {
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0]
  ];

  for (const [dr, dc] of dirs) {
    const r = pos.r + dr;
    const c = pos.c + dc;
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) addWall(r, c, false);
  }
}

// =========================
// MAIN VISUALIZATION ENTRY
// =========================
async function startVisualization() {
  if (isRunning) return;

  try {
    isRunning = true;
    const btn = document.getElementById("visualizeBtn");
    if (btn) btn.disabled = true;

    infoPanel.classList.remove("visible", "error-state");
    resetVisuals();

    const algo = document.getElementById("algoSelect").value;
    const startNode = gridArray[startPos.r][startPos.c];
    const endNode = gridArray[endPos.r][endPos.c];

    let visitedNodes = [];
    if (algo === "bfs") visitedNodes = bfs(startNode, endNode);
    else if (algo === "dfs") visitedNodes = dfs(startNode, endNode);
    else if (algo === "astar") visitedNodes = astar(startNode, endNode);

    await animate(visitedNodes, endNode, algo);
  } catch (err) {
    console.error("Visualization error:", err);
  } finally {
    isRunning = false;
    const btn = document.getElementById("visualizeBtn");
    if (btn) btn.disabled = false;
  }
}

// =========================
// BFS (UNWEIGHTED, SHORTEST PATH)
// =========================
function bfs(start, end) {
  const queue = [start];
  const visitedOrder = [];
  start.isVisited = true;

  while (queue.length) {
    const current = queue.shift();
    visitedOrder.push(current);

    if (current === end) return visitedOrder;

    const neighbors = getNeighbors(current);
    for (const n of neighbors) {
      if (!n.isVisited && !n.isWall) {
        n.isVisited = true;
        n.previousNode = current;
        queue.push(n);
      }
    }
  }
  return visitedOrder;
}

// =========================
// DFS (YOUR LOGIC)
// =========================
function dfs(start, end) {
  let stack = [start];
  let visited = [];
  start.isVisited = true;

  while (stack.length) {
    let current = stack.pop();
    visited.push(current);

    if (current === end) return visited;

    let neighbors = getNeighbors(current);

    for (let n of neighbors) {
      if (!n.isVisited && !n.isWall) {
        n.isVisited = true;
        n.previousNode = current;
        stack.push(n);
      }
    }
  }
  return visited;
}

// =========================
// A* SEARCH
// =========================
function astar(start, end) {
  const openSet = [start];
  const visitedOrder = [];

  start.gCost = 0;
  start.fCost = heuristic(start, end);

  while (openSet.length) {
    openSet.sort((a, b) => a.fCost - b.fCost);
    const current = openSet.shift();

    if (current.isVisited) continue;
    current.isVisited = true;
    visitedOrder.push(current);

    if (current === end) return visitedOrder;

    const neighbors = getNeighbors(current);
    for (const n of neighbors) {
      if (n.isWall || n.isVisited) continue;

      const tentativeG = current.gCost + 1;
      if (tentativeG < n.gCost) {
        n.previousNode = current;
        n.gCost = tentativeG;
        n.fCost = tentativeG + heuristic(n, end);
        if (!openSet.includes(n)) openSet.push(n);
      }
    }
  }
  return visitedOrder;
}

function heuristic(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

function getNeighbors(node) {
  const { r, c } = node;
  const neighbors = [];

  if (r > 0) neighbors.push(gridArray[r - 1][c]); // Up
  if (c < COLS - 1) neighbors.push(gridArray[r][c + 1]); // Right
  if (r < ROWS - 1) neighbors.push(gridArray[r + 1][c]); // Down
  if (c > 0) neighbors.push(gridArray[r][c - 1]); // Left

  return neighbors;
}

// =========================
// ANIMATION + RESULTS
// =========================
async function animate(visitedNodes, endNode, algo) {
  const delay = algo === "dfs" ? 12 : algo === "astar" ? 10 : 8;
  const cls = `visited-${algo}`;

  for (let i = 0; i < visitedNodes.length; i++) {
    const node = visitedNodes[i];
    if (!isStartOrEnd(node.r, node.c)) node.element.classList.add(cls);
    await new Promise((r) => setTimeout(r, delay));
  }

  // reconstruct path
  const path = [];
  let curr = endNode;
  while (curr) {
    path.unshift(curr);
    curr = curr.previousNode;
  }

  const startNode = gridArray[startPos.r][startPos.c];
  const success =
    path.length >= 1 &&
    path[0] === startNode &&
    !endNode.isWall &&
    endNode.isVisited;

  if (success) {
    for (let i = 0; i < path.length; i++) {
      const node = path[i];
      if (!isStartOrEnd(node.r, node.c)) node.element.classList.add("path");
      await new Promise((r) => setTimeout(r, 20));
    }
  } else {
    gridContainer.classList.add("shake-anim");
    setTimeout(() => gridContainer.classList.remove("shake-anim"), 500);
  }

  showResults(algo, visitedNodes.length, success ? path.length : 0, success);
}

function showResults(algo, visited, pathLen, success) {
  const data = ALGO_INFO[algo];
  const titleEl = document.getElementById("algoTitle");
  const statusEl = document.getElementById("statusValue");
  const tagsEl = document.getElementById("algoTags");
  const detailContainer = document.getElementById("algoDetailContent");

  titleEl.textContent = success
    ? `${data.title} — Path Found`
    : `${data.title} — Path Not Found`;
  titleEl.style.color = success ? "var(--primary)" : "var(--error)";

  tagsEl.innerHTML = "";
  data.tags.forEach((tag) => {
    const span = document.createElement("span");
    span.className = `badge badge-${tag.type}`;
    span.textContent = tag.text;
    tagsEl.appendChild(span);
  });

  detailContainer.innerHTML = `
    <h4>Definition</h4>
    <p>${data.definition}</p>
    <h4>How it works</h4>
    <p>${data.howItWorks}</p>
    <h4>Where it is used</h4>
    <p>${data.realWorld}</p>
  `;

  document.getElementById("visitedCount").textContent = visited;
  document.getElementById("pathLength").textContent = success ? pathLen : "∞";

  statusEl.textContent = success
    ? "Success: Path found"
    : "Failed: No path exists";
  statusEl.style.color = success ? "var(--success)" : "var(--error)";

  if (!success) infoPanel.classList.add("error-state");
  infoPanel.classList.add("visible");
}

// =========================
// RESET
// =========================
function resetVisuals() {
  gridArray.forEach((row) =>
    row.forEach((n) => {
      n.isVisited = false;
      n.distance = Infinity;
      n.gCost = Infinity;
      n.fCost = Infinity;
      n.previousNode = null;
      n.element.classList.remove(
        "visited-bfs",
        "visited-dfs",
        "visited-astar",
        "path"
      );
    })
  );
}

function resetBoard() {
  if (isRunning) return;
  resetVisuals();
  gridArray.forEach((row) =>
    row.forEach((n) => {
      n.isWall = false;
      n.element.classList.remove("wall");
    })
  );
  infoPanel.classList.remove("visible", "error-state");
  document.getElementById("statusValue").textContent = "Idle";
  document.getElementById("visitedCount").textContent = "0";
  document.getElementById("pathLength").textContent = "0";
}

// =========================
// EVENT BINDINGS & INIT
// =========================
document
  .getElementById("tool-pointer")
  .addEventListener("click", () => setTool("pointer"));

document
  .getElementById("tool-pencil")
  .addEventListener("click", () => setTool("pencil"));

document
  .getElementById("tool-eraser")
  .addEventListener("click", () => setTool("eraser"));

document.getElementById("resetBtn").addEventListener("click", resetBoard);

document
  .getElementById("visualizeBtn")
  .addEventListener("click", startVisualization);

document
  .getElementById("mapThemeSelect")
  .addEventListener("change", (e) => setMapTheme(e.target.value));

document
  .getElementById("mazeSelect")
  .addEventListener("change", handleMazeGen);

if (themeSwitch) {
  themeSwitch.addEventListener("change", (e) => {
    if (e.target.checked) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("ph-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("ph-theme", "light");
    }
  });
}

window.addEventListener("resize", () => {
  if (!isRunning) calculateGridSize();
});

// init
initTheme();
calculateGridSize();
