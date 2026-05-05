const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const formFields = [
  "label",
  "category",
  "transport",
  "terrain",
  "water_only",
  "slope",
  "orientation",
  "notes",
];

const categoryShortcuts = {
  "1": { category: "terrain", transport: "none", terrain: "land" },
  "2": { category: "road", transport: "road", terrain: "land" },
  "3": { category: "rail", transport: "rail", terrain: "land" },
  "4": { category: "vehicle" },
  "5": { category: "building", terrain: "land" },
  "6": { category: "industry", terrain: "land" },
  "7": { category: "decoration", terrain: "land" },
  "8": { category: "unknown" },
};

const directionShortcuts = {
  q: "NW",
  w: "N",
  e: "NE",
  a: "W",
  d: "E",
  z: "SW",
  x: "S",
  c: "SE",
};

let images = [];
let index = 0;
let saveTimer = null;
let dirty = false;

const els = {
  position: document.querySelector("#position"),
  strip: document.querySelector("#strip"),
  mainTile: document.querySelector("#mainTile"),
  filename: document.querySelector("#filename"),
  prev: document.querySelector("#prev"),
  next: document.querySelector("#next"),
  zoom: document.querySelector("#zoom"),
  context: document.querySelector("#context"),
  form: document.querySelector("#form"),
  saveStatus: document.querySelector("#saveStatus"),
  connections: document.querySelector("#connections"),
};

function tileUrl(filename) {
  return `/tile?file=${encodeURIComponent(filename)}`;
}

function current() {
  return images[index];
}

function setIndex(nextIndex) {
  if (!images.length) return;
  index = Math.max(0, Math.min(images.length - 1, nextIndex));
  render();
}

function renderDirections() {
  els.connections.innerHTML = "";
  for (const dir of directions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dir";
    button.dataset.dir = dir;
    button.textContent = dir;
    button.title = `${dir} connection`;
    button.addEventListener("click", () => {
      button.classList.toggle("active");
      scheduleSave();
    });
    els.connections.append(button);
  }
}

function renderStrip() {
  const radius = Number(els.context.value || 4);
  const start = Math.max(0, index - radius);
  const end = Math.min(images.length - 1, index + radius);
  els.strip.innerHTML = "";
  for (let i = start; i <= end; i += 1) {
    const item = images[i];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `thumb${i === index ? " active" : ""}`;
    button.title = item.filename;
    button.addEventListener("click", () => setIndex(i));

    const image = document.createElement("img");
    image.src = tileUrl(item.filename);
    image.alt = item.label || item.filename;
    image.style.width = `${Number(item.width || 32) * 4}px`;
    image.style.height = `${Number(item.height || 16) * 4}px`;

    const caption = document.createElement("span");
    caption.textContent = item.slot ? `slot ${item.slot}` : String(i + 1);

    button.append(image, caption);
    els.strip.append(button);
  }
}

function renderForm() {
  const item = current();
  for (const field of formFields) {
    const input = document.querySelector(`#${field}`);
    if (input.type === "checkbox") {
      input.checked = item[field] === "true";
    } else {
      input.value = item[field] || "";
    }
  }

  const active = new Set((item.connections || "").split("|").filter(Boolean));
  document.querySelectorAll(".dir").forEach((button) => {
    button.classList.toggle("active", active.has(button.dataset.dir));
  });
}

function render() {
  const item = current();
  els.position.textContent = `${index + 1} / ${images.length}  |  slot ${item.slot || "?"}  |  ${item.width}x${item.height}`;
  els.mainTile.src = tileUrl(item.filename);
  els.mainTile.alt = item.label || item.filename;
  els.mainTile.style.width = `${Number(item.width || 32) * Number(els.zoom.value)}px`;
  els.mainTile.style.height = `${Number(item.height || 16) * Number(els.zoom.value)}px`;
  els.filename.textContent = item.filename;
  renderStrip();
  renderForm();
  dirty = false;
  els.saveStatus.textContent = "Ready";
}

function setField(id, value) {
  document.querySelector(`#${id}`).value = value;
}

function markChanged() {
  scheduleSave();
}

function collectRow() {
  const item = current();
  const row = {
    filename: item.filename,
    label: document.querySelector("#label").value.trim(),
    category: document.querySelector("#category").value,
    transport: document.querySelector("#transport").value,
    terrain: document.querySelector("#terrain").value,
    water_only: document.querySelector("#water_only").checked,
    slope: document.querySelector("#slope").value,
    orientation: document.querySelector("#orientation").value,
    notes: document.querySelector("#notes").value.trim(),
    connections: [...document.querySelectorAll(".dir.active")].map((button) => button.dataset.dir),
  };
  return row;
}

async function save() {
  const row = collectRow();
  els.saveStatus.textContent = "Saving...";
  const response = await fetch("/api/label", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    els.saveStatus.textContent = "Save failed";
    return;
  }
  const payload = await response.json();
  images[index] = payload.row;
  dirty = false;
  els.saveStatus.textContent = `Saved ${new Date().toLocaleTimeString()}`;
  renderStrip();
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  dirty = true;
  els.saveStatus.textContent = "Unsaved";
  saveTimer = window.setTimeout(save, 350);
}

function move(delta) {
  window.clearTimeout(saveTimer);
  if (dirty) {
    save().finally(() => setIndex(index + delta));
  } else {
    setIndex(index + delta);
  }
}

function saveAndMove(delta) {
  window.clearTimeout(saveTimer);
  save().finally(() => setIndex(index + delta));
}

function toggleConnection(dir) {
  const button = document.querySelector(`.dir[data-dir="${dir}"]`);
  if (!button) return;
  button.classList.toggle("active");
  markChanged();
}

function applyValues(values) {
  for (const [field, value] of Object.entries(values)) {
    if (field === "water_only") {
      document.querySelector(`#${field}`).checked = Boolean(value);
    } else {
      setField(field, value);
    }
  }
  markChanged();
}

function setTransport(value) {
  const updates = { transport: value };
  if (value === "road") {
    updates.category = "road";
    updates.terrain = "land";
  }
  if (value === "rail") {
    updates.category = "rail";
    updates.terrain = "land";
  }
  if (value === "road_vehicle" || value === "rail_vehicle") {
    updates.category = "vehicle";
  }
  applyValues(updates);
}

function setSlope(prefix) {
  if (prefix === "flat") {
    applyValues({ slope: "flat" });
    return;
  }
  const orientation = document.querySelector("#orientation").value || "N";
  applyValues({ slope: `${prefix}_${orientation}` });
}

function adjustZoom(delta) {
  const nextZoom = Math.max(Number(els.zoom.min), Math.min(Number(els.zoom.max), Number(els.zoom.value) + delta));
  els.zoom.value = String(nextZoom);
  const item = current();
  if (!item) return;
  els.mainTile.style.width = `${Number(item.width || 32) * nextZoom}px`;
  els.mainTile.style.height = `${Number(item.height || 16) * nextZoom}px`;
}

async function init() {
  renderDirections();
  const response = await fetch("/api/images");
  const payload = await response.json();
  images = payload.images;
  if (!images.length) {
    els.position.textContent = "No PNG files found.";
    return;
  }
  render();
}

els.prev.addEventListener("click", () => move(-1));
els.next.addEventListener("click", () => move(1));
els.zoom.addEventListener("input", () => {
  const item = current();
  if (!item) return;
  els.mainTile.style.width = `${Number(item.width || 32) * Number(els.zoom.value)}px`;
  els.mainTile.style.height = `${Number(item.height || 16) * Number(els.zoom.value)}px`;
});
els.context.addEventListener("change", renderStrip);
els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  save();
});
els.form.addEventListener("input", scheduleSave);
els.form.addEventListener("change", scheduleSave);

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const isTyping = event.target.matches("input, textarea, select");

  if (isTyping) {
    if (event.key === "Escape") event.target.blur();
    if (event.key === "Enter" && event.target.id === "label") {
      event.preventDefault();
      saveAndMove(event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      saveAndMove(event.shiftKey ? -1 : 1);
    }
    return;
  }

  if (event.metaKey || event.ctrlKey || event.altKey) return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    move(-1);
    return;
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    move(1);
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    saveAndMove(event.shiftKey ? -1 : 1);
    return;
  }
  if (key === "s") {
    event.preventDefault();
    save();
    return;
  }
  if (key === "l") {
    event.preventDefault();
    document.querySelector("#label").focus();
    return;
  }
  if (key === "m") {
    event.preventDefault();
    document.querySelector("#notes").focus();
    return;
  }
  if (categoryShortcuts[key]) {
    event.preventDefault();
    applyValues(categoryShortcuts[key]);
    return;
  }
  if (directionShortcuts[key]) {
    event.preventDefault();
    if (event.shiftKey) {
      applyValues({ orientation: directionShortcuts[key] });
    } else {
      toggleConnection(directionShortcuts[key]);
    }
    return;
  }
  if (key === "f") {
    event.preventDefault();
    setSlope("flat");
    return;
  }
  if (key === "u") {
    event.preventDefault();
    setSlope("up");
    return;
  }
  if (key === "j") {
    event.preventDefault();
    setSlope("down");
    return;
  }
  if (key === "r") {
    event.preventDefault();
    setTransport("road");
    return;
  }
  if (key === "t") {
    event.preventDefault();
    setTransport("rail");
    return;
  }
  if (key === "v") {
    event.preventDefault();
    setTransport("road_vehicle");
    return;
  }
  if (key === "b") {
    event.preventDefault();
    setTransport("rail_vehicle");
    return;
  }
  if (key === "y") {
    event.preventDefault();
    const waterOnly = !document.querySelector("#water_only").checked;
    applyValues({ water_only: waterOnly, terrain: waterOnly ? "water" : document.querySelector("#terrain").value });
    return;
  }
  if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    adjustZoom(-1);
    return;
  }
  if (event.key === "=" || event.key === "+") {
    event.preventDefault();
    adjustZoom(1);
  }
});

init();
