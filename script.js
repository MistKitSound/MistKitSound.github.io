(function initContactDropdown() {
  const toggle = document.getElementById("contactToggle");
  const dropdown = document.getElementById("contactDropdown");

  if (!toggle || !dropdown) {
    return;
  }

  toggle.addEventListener("click", () => {
    const isExpanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isExpanded));
    dropdown.hidden = isExpanded;
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (!dropdown.contains(target) && target !== toggle) {
      toggle.setAttribute("aria-expanded", "false");
      dropdown.hidden = true;
    }
  });
})();

const PLAYER_STORAGE_KEY = "soundtrack-store-player-state-v2";
const SEEK_THROTTLE_MS = 200;
const DEFAULT_TRACKS_FALLBACK = [
  "Abyssal Drift.ogg",
  "Digital Church.ogg",
  "Ephireal.ogg",
  "heartbreak.org.ogg",
  "High Technologies.ogg",
  "i_wanna_spend_my_money_but_i_dont_have_enough.ogg",
  "Low Voltage.ogg",
  "Natural Disaster.ogg",
  "Natural Routine.ogg",
  "owo.ogg",
  "speedwalk.ogg"
];

const audio = new Audio();
audio.preload = "metadata";

let playerUi = null;
let playerState = {
  trackName: "",
  trackFile: "",
  trackImage: "",
  currentTime: 0,
  duration: 0,
  volume: 0.9,
  isPlaying: false
};
let saveTimer = null;

function readPlayerState() {
  try {
    const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") {
      return;
    }
    playerState = { ...playerState, ...saved };
  } catch (_error) {
    // ignore invalid storage
  }
}

function persistPlayerState() {
  try {
    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(playerState));
  } catch (_error) {
    // ignore storage limits
  }
}

function schedulePersist() {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
  }
  saveTimer = window.setTimeout(persistPlayerState, SEEK_THROTTLE_MS);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = String(whole % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function imageCandidatePaths(trackName) {
  return [
    `./content/images/${trackName}.jpg`,
    `./content/images/${trackName}.jpeg`,
    `./content/images/${trackName}.png`,
    `./content/images/${trackName}.webp`
  ];
}

function getFallbackCover() {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><rect width="140" height="140" fill="#21163f"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#b084ff" font-family="Arial" font-size="16">No image</text></svg>'
    )
  );
}

function createImageElement(trackName) {
  const img = document.createElement("img");
  const candidates = imageCandidatePaths(trackName);
  let idx = 0;

  img.src = candidates[idx];
  img.alt = `${trackName} cover`;
  img.addEventListener("error", () => {
    idx += 1;
    if (idx < candidates.length) {
      img.src = candidates[idx];
    } else {
      img.src = getFallbackCover();
    }
  });
  return img;
}

function setPlayingClass(trackName) {
  document.querySelectorAll(".track-item").forEach((item) => {
    const elementName = item.getAttribute("data-track-name");
    const shouldPlay = playerState.isPlaying && elementName === trackName;
    item.classList.toggle("playing", shouldPlay);
  });
}

function updatePlayerUI() {
  if (!playerUi) {
    return;
  }

  const hasTrack = Boolean(playerState.trackFile);
  playerUi.wrapper.classList.toggle("visible", hasTrack);
  if (!hasTrack) {
    return;
  }

  playerUi.title.textContent = playerState.trackName || "Unknown track";
  playerUi.cover.src = playerState.trackImage || getFallbackCover();
  playerUi.playBtn.textContent = playerState.isPlaying ? "Pause" : "Play";
  playerUi.volumeSlider.value = String(playerState.volume);
  playerUi.progressSlider.max = String(playerState.duration || audio.duration || 0);
  playerUi.progressSlider.value = String(playerState.currentTime || 0);
  playerUi.timeText.textContent = `${formatTime(playerState.currentTime)} / ${formatTime(playerState.duration || audio.duration || 0)}`;
  setPlayingClass(playerState.trackName);
}

function setTrackImage(trackName) {
  const probe = createImageElement(trackName);
  const img = new Image();
  img.src = probe.src;
  img.onload = () => {
    playerState.trackImage = img.src;
    updatePlayerUI();
    schedulePersist();
  };
  img.onerror = () => {
    playerState.trackImage = getFallbackCover();
    updatePlayerUI();
    schedulePersist();
  };
}

function bindAudioEvents() {
  audio.addEventListener("timeupdate", () => {
    playerState.currentTime = audio.currentTime || 0;
    playerState.duration = Number.isFinite(audio.duration) ? audio.duration : playerState.duration;
    updatePlayerUI();
    schedulePersist();
  });

  audio.addEventListener("loadedmetadata", () => {
    playerState.duration = Number.isFinite(audio.duration) ? audio.duration : playerState.duration;
    updatePlayerUI();
    schedulePersist();
  });

  audio.addEventListener("ended", () => {
    playerState.isPlaying = false;
    playerState.currentTime = 0;
    updatePlayerUI();
    persistPlayerState();
  });

  window.addEventListener("beforeunload", () => {
    playerState.currentTime = audio.currentTime || 0;
    playerState.duration = Number.isFinite(audio.duration) ? audio.duration : playerState.duration;
    persistPlayerState();
  });
}

function createGlobalPlayer() {
  const wrapper = document.createElement("section");
  wrapper.className = "global-player";
  wrapper.innerHTML = `
    <div class="global-player-left">
      <img class="global-cover" alt="Track cover">
      <div class="global-meta">
        <h3 class="global-title">Track</h3>
        <p class="global-time">0:00 / 0:00</p>
      </div>
    </div>
    <div class="global-player-center">
      <button class="play-btn global-play" type="button">Play</button>
      <input class="progress-slider" type="range" min="0" max="100" step="0.1" value="0" aria-label="Track progress">
    </div>
    <div class="global-player-right">
      <button class="volume-icon-btn" type="button" aria-expanded="false" aria-label="Toggle volume">🔊</button>
      <div class="volume-popover" hidden>
        <input class="global-volume-slider" type="range" min="0" max="1" step="0.01" value="0.9" aria-label="Volume">
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);

  const playBtn = wrapper.querySelector(".global-play");
  const progressSlider = wrapper.querySelector(".progress-slider");
  const volumeIconBtn = wrapper.querySelector(".volume-icon-btn");
  const volumePopover = wrapper.querySelector(".volume-popover");
  const volumeSlider = wrapper.querySelector(".global-volume-slider");
  const title = wrapper.querySelector(".global-title");
  const timeText = wrapper.querySelector(".global-time");
  const cover = wrapper.querySelector(".global-cover");

  if (
    !(playBtn instanceof HTMLButtonElement) ||
    !(progressSlider instanceof HTMLInputElement) ||
    !(volumeIconBtn instanceof HTMLButtonElement) ||
    !(volumePopover instanceof HTMLDivElement) ||
    !(volumeSlider instanceof HTMLInputElement) ||
    !(title instanceof HTMLElement) ||
    !(timeText instanceof HTMLElement) ||
    !(cover instanceof HTMLImageElement)
  ) {
    return;
  }

  playerUi = { wrapper, playBtn, progressSlider, volumeIconBtn, volumePopover, volumeSlider, title, timeText, cover };

  playBtn.addEventListener("click", async () => {
    if (!playerState.trackFile) {
      return;
    }
    if (audio.paused) {
      try {
        await audio.play();
        playerState.isPlaying = true;
      } catch (_error) {
        playerState.isPlaying = false;
      }
    } else {
      audio.pause();
      playerState.isPlaying = false;
    }
    updatePlayerUI();
    persistPlayerState();
  });

  progressSlider.addEventListener("input", () => {
    if (!audio.src) {
      return;
    }
    audio.currentTime = Number(progressSlider.value);
    playerState.currentTime = audio.currentTime;
    updatePlayerUI();
    schedulePersist();
  });

  volumeIconBtn.addEventListener("click", () => {
    const expanded = volumeIconBtn.getAttribute("aria-expanded") === "true";
    volumeIconBtn.setAttribute("aria-expanded", String(!expanded));
    volumePopover.hidden = expanded;
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node) || !playerUi) {
      return;
    }
    if (!playerUi.volumePopover.contains(target) && target !== playerUi.volumeIconBtn) {
      playerUi.volumePopover.hidden = true;
      playerUi.volumeIconBtn.setAttribute("aria-expanded", "false");
    }
  });

  volumeSlider.addEventListener("input", () => {
    const next = Number(volumeSlider.value);
    playerState.volume = next;
    audio.volume = next;
    schedulePersist();
  });
}

async function playTrack(track) {
  if (!track || !track.file) {
    return;
  }

  if (playerState.trackFile === track.file && !audio.paused) {
    audio.pause();
    playerState.isPlaying = false;
    updatePlayerUI();
    persistPlayerState();
    return;
  }

  const isSameTrack = playerState.trackFile === track.file;
  playerState.trackName = track.name;
  playerState.trackFile = track.file;
  if (!isSameTrack) {
    playerState.currentTime = 0;
  }

  audio.src = track.file;
  audio.volume = playerState.volume;
  if (isSameTrack && playerState.currentTime > 0) {
    audio.currentTime = playerState.currentTime;
  }

  setTrackImage(track.name);
  try {
    await audio.play();
    playerState.isPlaying = true;
  } catch (_error) {
    playerState.isPlaying = false;
  }
  updatePlayerUI();
  persistPlayerState();
}

async function loadTracks() {
  const fallbackTracks = Array.isArray(window.TRACKS_FALLBACK) && window.TRACKS_FALLBACK.length
    ? window.TRACKS_FALLBACK
    : DEFAULT_TRACKS_FALLBACK;

  try {
    const response = await fetch("./content/audio/tracks.json", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error("tracks.json is missing");
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((track) => {
        if (typeof track === "string") {
          const name = track.replace(/\.[^/.]+$/, "");
          return { name, file: `./content/audio/${track}` };
        }

        if (track && typeof track === "object" && track.name && track.file) {
          return { name: String(track.name), file: String(track.file) };
        }

        return null;
      })
      .filter(Boolean);
  } catch (_error) {
    return fallbackTracks
      .map((track) => {
        if (typeof track !== "string") {
          return null;
        }
        const name = track.replace(/\.[^/.]+$/, "");
        return { name, file: `./content/audio/${track}` };
      })
      .filter(Boolean);
  }
}

function buildTrackList(list, tracks, showAllTracks, moreBtn) {
  list.innerHTML = "";
  if (moreBtn) {
    moreBtn.hidden = true;
    moreBtn.textContent = "More tracks";
  }

  if (!tracks.length) {
    const empty = document.createElement("li");
    empty.className = "track-item";
    empty.textContent = "No tracks found. Add files to /content/audio and list them in /content/audio/tracks.json.";
    list.appendChild(empty);
    return;
  }

  tracks.forEach((track, index) => {
    const item = document.createElement("li");
    item.className = "track-item";
    item.setAttribute("data-track-name", track.name);
    item.setAttribute("tabindex", "0");
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Play ${track.name}`);
    if (!showAllTracks && index > 2) {
      item.classList.add("hidden-track");
    }

    const image = createImageElement(track.name);
    const meta = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "track-name";
    title.textContent = track.name;

    const subtitle = document.createElement("p");
    subtitle.className = "track-subtitle";
    subtitle.textContent = "Click to play / stop";

    const buyBtn = document.createElement("a");
    buyBtn.className = "buy-track-btn section-link";
    buyBtn.href = "#pricing";
    buyBtn.setAttribute("data-section-link", "pricing");
    buyBtn.textContent = "Buy this track";
    buyBtn.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    meta.append(title, subtitle);
    item.append(image, meta, buyBtn);
    item.addEventListener("click", () => playTrack(track));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        playTrack(track);
      }
    });
    list.appendChild(item);
  });

  if (moreBtn && !showAllTracks && tracks.length > 3) {
    moreBtn.hidden = false;
    let expanded = false;
    moreBtn.addEventListener("click", () => {
      expanded = !expanded;
      const hiddenTracks = list.querySelectorAll(".hidden-track");
      hiddenTracks.forEach((trackItem) => {
        trackItem.classList.toggle("hidden-track", !expanded);
      });
      moreBtn.textContent = expanded ? "Show less" : "More tracks";
    });
  }

  setPlayingClass(playerState.trackName);
}

function initTrackLists() {
  const lists = document.querySelectorAll("[data-track-list]");
  if (!lists.length) {
    return;
  }

  lists.forEach((list) => {
    if (!(list instanceof HTMLUListElement)) {
      return;
    }
    list.innerHTML = `<li class="track-list-loading">Loading tracks...</li>`;
  });

  loadTracks().then((tracks) => {
    lists.forEach((list) => {
      if (!(list instanceof HTMLUListElement)) {
        return;
      }
      const mode = list.getAttribute("data-track-list");
      const showAllTracks = mode === "all";
      const listId = list.id;
      const moreBtn = listId ? document.querySelector(`[data-more-btn="${listId}"]`) : null;
      buildTrackList(list, tracks, showAllTracks, moreBtn instanceof HTMLButtonElement ? moreBtn : null);
    });
  });
}

function getSectionFromHash() {
  const raw = window.location.hash.replace("#", "").trim().toLowerCase();
  const allowed = new Set(["profile", "pricing", "license", "faq", "tracks"]);
  if (allowed.has(raw)) {
    return raw;
  }
  return "profile";
}

function showSection(sectionName, updateHash) {
  const sections = document.querySelectorAll("[data-section]");
  sections.forEach((section) => {
    const isActive = section.getAttribute("data-section") === sectionName;
    section.classList.toggle("is-active", isActive);
  });

  document.querySelectorAll("[data-section-link]").forEach((link) => {
    const isActive = link.getAttribute("data-section-link") === sectionName;
    link.classList.toggle("active", isActive);
  });

  if (updateHash) {
    window.location.hash = sectionName;
  }
}

function initSectionNavigation() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const link = target.closest("[data-section-link]");
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }
    event.preventDefault();
    const sectionName = link.getAttribute("data-section-link") || "profile";
    showSection(sectionName, true);
  });

  window.addEventListener("hashchange", () => {
    showSection(getSectionFromHash(), false);
  });
}

function restoreAudioFromState() {
  audio.volume = playerState.volume;
  if (!playerState.trackFile) {
    return;
  }

  audio.src = playerState.trackFile;
  audio.currentTime = playerState.currentTime || 0;
  if (!playerState.trackImage) {
    setTrackImage(playerState.trackName);
  }

  if (playerState.isPlaying) {
    audio.play()
      .then(() => {
        playerState.isPlaying = true;
        updatePlayerUI();
      })
      .catch(() => {
        playerState.isPlaying = false;
        updatePlayerUI();
        persistPlayerState();
      });
  } else {
    updatePlayerUI();
  }
}

readPlayerState();
bindAudioEvents();
createGlobalPlayer();
initSectionNavigation();
initTrackLists();
showSection(getSectionFromHash(), false);
restoreAudioFromState();
updatePlayerUI();
