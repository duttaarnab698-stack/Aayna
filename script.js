// ==============================================
// AAYNA Portfolio + Protected Action Auth System
// ==============================================

// Storage keys.
const USERS_KEY = "AAYNA_USERS";
const CURRENT_USER_KEY = "AAYNA_CURRENT_USER";
const LOCAL_OTP_KEY = "AAYNA_LOCAL_OTP";

// Portfolio video data.
const videoData = [
  {
    id: 11,
    title: "\u0986\u09AE\u09BE\u09B0 \u0997\u09B0\u09CD\u09AC\u09C7\u09B0 \u09AE\u09BE\u09A4\u09C3\u09AD\u09BE\u09B7\u09BE \u2764\uFE0F\uD83E\uDD79",
    category: "Music",
    views: "New",
    date: "Feb 21, 2026",
    thumbnail: "images/bangla-vasha-thumb.jpeg",
    videoUrl: "videos/bangla-vasha.mp4",
    isPortrait: true
  },
  {
    id: 10,
    title: "\u0985\u0997\u09CB\u099B\u09BE\u09B2\u09CB \u09B6\u09B9\u09B0 \u2764\uFE0F\uD83D\uDE0C",
    category: "Short Reels",
    views: "New",
    date: "Feb 15, 2026",
    thumbnail: "images/ogochalo-shohor-thumb.jpg",
    videoUrl: "videos/ogochalo-shohor.mp4",
    isPortrait: true
  },
  {
    id: 9,
    title: "Black & Ethnic: A love story that never goes out of style. \uD83D\uDDA4",
    category: "Short Reels",
    views: "New",
    date: "Feb 14, 2026",
    thumbnail: "images/black-ethnic-thumb.jpg",
    videoUrl: "videos/black-ethnic.mp4",
    isPortrait: true
  },
  {
    id: 0,
    title: "\u09B6\u09C7\u09B7 \u09B8\u09C1\u09B0 \uD83D\uDE42\uD83D\uDC94",
    category: "Short Film",
    views: "New",
    date: "Feb 24, 2026",
    thumbnail: "images/shesh-sur-thumb.jpg",
    videoUrl: "videos/shesh-sur.mp4",
    isPortrait: true
  }
];

const featuredCreationsData = [
  {
    id: "fc1",
    title: "আমার গর্বের মাতৃভাষা ❤️🥹",
    duration: "00:37",
    category: "Music",
    thumbnail: "images/bangla-vasha-thumb.jpeg",
    videoUrl: "videos/bangla-vasha.mp4",
    isPortrait: true
  },
  {
    id: "fc2",
    title: "শেষ সুর 🙂💔",
    duration: "00:44",
    category: "Short Film",
    thumbnail: "images/shesh-sur-thumb.jpg",
    videoUrl: "videos/shesh-sur.mp4",
    isPortrait: true
  },
  {
    id: "fc3",
    title: "অগোছালো শহর ❤️😌",
    duration: "00:28",
    category: "Short Reels",
    thumbnail: "images/ogochalo-shohor-thumb.jpg",
    videoUrl: "videos/ogochalo-shohor.mp4",
    isPortrait: true
  }
];

// Cinematic hero background reels.
const heroReelVideos = [
  { src: "videos/shesh-sur.mp4", thumb: "images/shesh-sur-thumb.jpg" },
  { src: "videos/ogochalo-shohor.mp4", thumb: "images/ogochalo-shohor-thumb.jpg" },
  { src: "videos/black-ethnic.mp4", thumb: "images/black-ethnic-thumb.jpg" }
];

let activeCategory = "All";
let searchTerm = "";
let pendingProtectedAction = null;
let uiFxInitialized = false;
let cinematicCursorInitialized = false;
let particlesInitialized = false;
let pageLoaderInitialized = false;

function executePendingAction() {
  if (!pendingProtectedAction) return;

  // If pending action is a video object, open that video after login.
  if (pendingProtectedAction.type === "video" && typeof pendingProtectedAction.open === "function") {
    pendingProtectedAction.open();
    pendingProtectedAction = null;
    return;
  }

  // Otherwise it is a protected button/link target.
  runProtectedAction(pendingProtectedAction);
  pendingProtectedAction = null;
}

// -------------------------
// LocalStorage helpers
// -------------------------
function getJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getUsers() {
  return getJSON(USERS_KEY, []);
}

function setUsers(users) {
  setJSON(USERS_KEY, users);
}

function getCurrentUser() {
  return getJSON(CURRENT_USER_KEY, null);
}

function setCurrentUser(user) {
  setJSON(CURRENT_USER_KEY, user);
}

function clearCurrentUser() {
  localStorage.removeItem(CURRENT_USER_KEY);
}

function isLoggedIn() {
  return Boolean(getCurrentUser());
}

// -------------------------
// UI helpers
// -------------------------
function showToast(message) {
  const toast = document.getElementById("globalToast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function setButtonLoading(button, loading) {
  if (!button) return;
  button.classList.toggle("is-loading", loading);
  button.disabled = loading;
}

function triggerShake(element) {
  if (!element) return;
  element.classList.remove("login-shake");
  void element.offsetWidth;
  element.classList.add("login-shake");
}

function setGroupError(groupIds, on) {
  groupIds.forEach((id) => {
    const group = document.getElementById(id);
    if (group) group.classList.toggle("error", on);
  });
}

function normalizePhone(value) {
  return (value || "").replace(/\D/g, "");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim());
}

function isStrictIndianPhone(value) {
  return /^\+91\s?\d{10}$/.test((value || "").trim());
}

function toIndianPhone(value) {
  const digits = normalizePhone(value);
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return null;
}

function parseLoginIdentifier(value) {
  const raw = (value || "").trim();
  if (!raw) return { type: "empty", value: "" };
  if (raw.includes("@")) return isValidEmail(raw) ? { type: "email", value: raw.toLowerCase() } : { type: "invalid_email", value: raw };
  if (!isStrictIndianPhone(raw)) return { type: "invalid_phone", value: raw };
  const digits = normalizePhone(raw);
  return { type: "phone", value: `+91${digits.slice(-10)}` };
}

function findUserByIdentifier(identifier) {
  const parsed = parseLoginIdentifier(identifier);
  const users = getUsers();
  if (parsed.type === "email") {
    return users.find((u) => (u.email || "").toLowerCase() === parsed.value) || null;
  }
  if (parsed.type === "phone") {
    return users.find((u) => toIndianPhone(u.phone) === parsed.value) || null;
  }
  return null;
}

async function postJson(url, payload) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      const message = data.message || "Request failed.";
      throw new Error(message);
    }
    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("OTP server is unreachable.");
    }
    throw error;
  }
}

async function postJsonWithFallback(path, payload) {
  const bases = [
    "",
    "http://localhost:5600",
    "http://127.0.0.1:5600",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ];

  let lastError = new Error("OTP server is unreachable.");
  for (const base of bases) {
    try {
      const url = base ? `${base}${path}` : path;
      return await postJson(url, payload);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function isServerUnreachableError(error) {
  return (error?.message || "").toLowerCase().includes("unreachable");
}

function getLocalOtpState() {
  return getJSON(LOCAL_OTP_KEY, {});
}

function setLocalOtpState(state) {
  setJSON(LOCAL_OTP_KEY, state);
}

function createLocalOtp(identifier) {
  const state = getLocalOtpState();
  const prev = state[identifier];
  if (prev && Date.now() - prev.sentAt < 30 * 1000) {
    throw new Error("Please wait 30 seconds before requesting another OTP.");
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  state[identifier] = {
    otp,
    sentAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
    attempts: 0
  };
  setLocalOtpState(state);
  return otp;
}

function verifyLocalOtp(identifier, otpInput) {
  const state = getLocalOtpState();
  const record = state[identifier];
  if (!record) throw new Error("Please send OTP first.");
  if (Date.now() > record.expiresAt) {
    delete state[identifier];
    setLocalOtpState(state);
    throw new Error("OTP expired. Request a new OTP.");
  }
  if (record.attempts >= 5) {
    delete state[identifier];
    setLocalOtpState(state);
    throw new Error("Too many attempts. Request OTP again.");
  }
  if (record.otp !== String(otpInput || "").trim()) {
    record.attempts += 1;
    state[identifier] = record;
    setLocalOtpState(state);
    throw new Error("Invalid OTP.");
  }
  delete state[identifier];
  setLocalOtpState(state);
  return { ok: true };
}

async function sendOtpViaApi(identifier) {
  try {
    const data = await postJsonWithFallback("/api/otp/send", { identifier });
    return { ok: true, fallback: false, message: data.message || "OTP sent successfully." };
  } catch (error) {
    if (!isServerUnreachableError(error)) {
      throw error;
    }
    const otp = createLocalOtp(identifier);
    return {
      ok: true,
      fallback: true,
      message: `Server unavailable, using local OTP mode. OTP: ${otp}`
    };
  }
}

async function verifyOtpViaApi(identifier, otp) {
  try {
    return await postJsonWithFallback("/api/otp/verify", { identifier, otp });
  } catch (error) {
    if (isServerUnreachableError(error)) {
      return verifyLocalOtp(identifier, otp);
    }
    throw error;
  }
}

function enforceIndianPrefix(input, options = {}) {
  if (!input) return;
  const allowEmail = Boolean(options.allowEmail);

  if (!input.value || input.value.trim() === "") input.value = "+91";
  if ((input.value || "").trim() === "+91") input.value = "+91 ";

  input.addEventListener("input", () => {
    let value = (input.value || "").trim();

    if (allowEmail && /[a-zA-Z@]/.test(value)) {
      if (value.startsWith("+91")) {
        input.value = value.slice(3).trimStart();
      }
      return;
    }

    let digits = normalizePhone(value);
    if (digits.startsWith("91")) digits = digits.slice(2);
    digits = digits.slice(0, 10);
    input.value = `+91 ${digits}`;
  });

  input.addEventListener("focus", () => {
    if (!input.value) input.value = "+91 ";
  });
}

function attachRipple(button) {
  if (!button) return;

  button.addEventListener("pointerdown", (event) => {
    const layer = button.querySelector(".ripple-layer");
    if (!layer) return;

    const dot = document.createElement("span");
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);

    dot.className = "ripple-dot";
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.left = `${event.clientX - rect.left - size / 2}px`;
    dot.style.top = `${event.clientY - rect.top - size / 2}px`;

    layer.appendChild(dot);
    setTimeout(() => dot.remove(), 500);
  });
}

// -------------------------
// Navbar auth UI
// -------------------------
function renderNavbarAuth() {
  const navAuth = document.getElementById("navAuth");
  if (!navAuth) return;

  const currentUser = getCurrentUser();

  if (!currentUser) {
    navAuth.innerHTML = `<button class="auth-chip" id="openLoginFromNav" type="button">Login</button>`;
    document.getElementById("openLoginFromNav")?.addEventListener("click", () => openAuthModal());
    return;
  }

  const displayName = currentUser.name || currentUser.fullName || currentUser.email || "User";

  navAuth.innerHTML = `
    <span class="auth-chip">${displayName}</span>
    <button class="auth-chip logout" id="logoutBtn" type="button">Logout</button>
  `;

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    clearCurrentUser();
    renderNavbarAuth();
    showToast("Logged out");
  });
}

// -------------------------
// Protected action system
// -------------------------
function runProtectedAction(target) {
  const action = target.dataset.action || "action";

  if (target.tagName === "A") {
    const href = target.getAttribute("href");
    const external = href && !href.startsWith("#");

    if (external) {
      if (target.target === "_blank") {
        window.open(href, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = href;
      }
      return;
    }
  }

  // Default feedback for protected button actions.
  const actionMap = {
    like: "Video liked",
    comment: "Comment box opened",
    contact: "Opening contact action",
    download: "Download started",
    follow: "You are now following creator"
  };

  showToast(actionMap[action] || "Action completed");
}

function handleProtectedClick(target) {
  if (isLoggedIn()) {
    runProtectedAction(target);
    return;
  }

  pendingProtectedAction = target;
  openAuthModal();
}

// -------------------------
// Auth modal logic
// -------------------------
function openAuthModal() {
  const modal = document.getElementById("authModal");
  if (!modal) return;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function openRegisterModal() {
  const modal = document.getElementById("registerModal");
  if (!modal) return;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeRegisterModal() {
  const modal = document.getElementById("registerModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function initAuthModal() {
  const authModal = document.getElementById("authModal");
  const registerModal = document.getElementById("registerModal");
  if (!authModal) return;

  const authCard = document.getElementById("authCard");
  const registerCard = document.getElementById("registerCard");
  const closeBtn = document.getElementById("closeAuthModal");
  const closeRegisterBtn = document.getElementById("closeRegisterModal");
  const openRegisterBtn = document.getElementById("openRegisterBtn");
  const backToLoginBtn = document.getElementById("backToLoginBtn");
  const loginForm = document.getElementById("authLoginForm");
  const registerForm = document.getElementById("authRegisterForm");

  const loginIdentifier = document.getElementById("authIdentifier");
  const loginPassword = document.getElementById("authPassword");
  const loginError = document.getElementById("authLoginError");
  const loginBtn = document.getElementById("authLoginBtn");

  const regFirstName = document.getElementById("regFirstName");
  const regMiddleName = document.getElementById("regMiddleName");
  const regLastName = document.getElementById("regLastName");
  const regPhone = document.getElementById("regPhone");
  const regEmail = document.getElementById("regEmail");
  const regPassword = document.getElementById("regPassword");
  const regError = document.getElementById("authRegisterError");
  const regBtn = document.getElementById("authRegisterBtn");

  enforceIndianPrefix(loginIdentifier, { allowEmail: true });
  enforceIndianPrefix(regPhone);

  attachRipple(loginBtn);
  attachRipple(regBtn);

  closeBtn?.addEventListener("click", closeAuthModal);
  closeRegisterBtn?.addEventListener("click", closeRegisterModal);
  openRegisterBtn?.addEventListener("click", () => {
    closeAuthModal();
    openRegisterModal();
  });
  backToLoginBtn?.addEventListener("click", () => {
    closeRegisterModal();
    openAuthModal();
  });

  authModal.addEventListener("click", (event) => {
    if (event.target === authModal) closeAuthModal();
  });
  registerModal?.addEventListener("click", (event) => {
    if (event.target === registerModal) closeRegisterModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAuthModal();
      closeRegisterModal();
    }
  });

  loginForm?.addEventListener("input", () => {
    loginError.textContent = "";
    setGroupError(["loginIdentifierGroup", "loginPassGroup"], false);
  });

  registerForm?.addEventListener("input", () => {
    regError.textContent = "";
    setGroupError(["regFirstNameGroup", "regMiddleNameGroup", "regLastNameGroup", "regPhoneGroup", "regEmailGroup", "regPassGroup"], false);
  });

  loginForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const identifier = loginIdentifier.value.trim();
    const password = loginPassword.value.trim();
    const parsed = parseLoginIdentifier(identifier);
    const user = findUserByIdentifier(identifier);

    if (parsed.type === "invalid_phone") {
      loginError.textContent = "Phone must start with +91 and have 10 digits.";
      setGroupError(["loginIdentifierGroup"], true);
      triggerShake(authCard);
      return;
    }

    if (parsed.type === "invalid_email") {
      loginError.textContent = "Enter a valid email address.";
      setGroupError(["loginIdentifierGroup"], true);
      triggerShake(authCard);
      return;
    }

    if (!user) {
      loginError.textContent = "No account found with this email/phone.";
      setGroupError(["loginIdentifierGroup"], true);
      triggerShake(authCard);
      return;
    }

    if (!password) {
      loginError.textContent = "Password is required.";
      setGroupError(["loginPassGroup"], true);
      triggerShake(authCard);
      return;
    }

    if ((user.password || "") !== password) {
      loginError.textContent = "Invalid password.";
      setGroupError(["loginPassGroup"], true);
      triggerShake(authCard);
      return;
    }

    setButtonLoading(loginBtn, true);
    setTimeout(() => {
      setCurrentUser({
        id: user.id,
        name: user.name || user.fullName || "User",
        email: user.email
      });
      localStorage.setItem("AAYNA_LOGIN_COUNT", String(Number(localStorage.getItem("AAYNA_LOGIN_COUNT") || 0) + 1));
      setButtonLoading(loginBtn, false);
      loginError.textContent = "";
      closeAuthModal();
      renderNavbarAuth();
      showToast("Logged in successfully");
      executePendingAction();
    }, 650);
  });

  registerForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const firstName = regFirstName.value.trim();
    const middleName = regMiddleName.value.trim();
    const lastName = regLastName.value.trim();
    const phoneRaw = regPhone.value.trim();
    const email = regEmail.value.trim().toLowerCase();
    const password = regPassword.value.trim();

    if (!firstName || !lastName || !password) {
      regError.textContent = "Please fill all required fields.";
      setGroupError(["regFirstNameGroup", "regLastNameGroup", "regPassGroup"], true);
      triggerShake(registerCard);
      return;
    }

    const hasPhone = Boolean(phoneRaw && phoneRaw !== "+91");
    const hasEmail = Boolean(email);

    if (!hasPhone && !hasEmail) {
      regError.textContent = "Email or phone number (any one) is required.";
      setGroupError(["regPhoneGroup", "regEmailGroup"], true);
      triggerShake(registerCard);
      return;
    }

    if (hasEmail && !isValidEmail(email)) {
      regError.textContent = "Enter a valid email address.";
      setGroupError(["regEmailGroup"], true);
      triggerShake(registerCard);
      return;
    }

    if (hasPhone && !isStrictIndianPhone(phoneRaw)) {
      regError.textContent = "Phone must start with +91 and have 10 digits.";
      setGroupError(["regPhoneGroup"], true);
      triggerShake(registerCard);
      return;
    }
    const phone = hasPhone ? `+91${normalizePhone(phoneRaw).slice(-10)}` : "";

    const users = getUsers();
    const exists = users.some((u) => {
      const sameEmail = hasEmail && (u.email || "").toLowerCase() === email;
      const samePhone = hasPhone && toIndianPhone(u.phone) === phone;
      return sameEmail || samePhone;
    });

    if (exists) {
      regError.textContent = "Email or phone already exists.";
      setGroupError(["regEmailGroup", "regPhoneGroup"], true);
      triggerShake(registerCard);
      return;
    }

    setButtonLoading(regBtn, true);

    setTimeout(() => {
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
      const newUser = {
        id: Date.now(),
        name: firstName,
        firstName,
        middleName,
        lastName,
        fullName,
        phone,
        email,
        password
      };
      users.push(newUser);
      setUsers(users);
      setCurrentUser({ id: newUser.id, name: newUser.fullName, email: newUser.email });
      localStorage.setItem("AAYNA_LOGIN_COUNT", String(Number(localStorage.getItem("AAYNA_LOGIN_COUNT") || 0) + 1));

      setButtonLoading(regBtn, false);
      closeRegisterModal();
      renderNavbarAuth();
      showToast("Account created and logged in");
      executePendingAction();
    }, 700);
  });
}

// -------------------------
// Portfolio interactions
// -------------------------
function createVideoCard(video) {
  const card = document.createElement("article");
  card.className = "video-card reveal reveal-zoom watch-cursor-target";
  const thumbClass = video.id === 11 ? "contain-thumb" : "";
  card.innerHTML = `
    <div class="video-thumb preview-media">
      <img class="${thumbClass}" src="${video.thumbnail}" alt="${video.title} thumbnail" loading="lazy" />
      <video class="preview-video" src="${video.videoUrl}" muted loop playsinline preload="metadata"></video>
      <div class="play-badge"><span>&#9658;</span></div>
    </div>
    <div class="video-meta">
      <h4>${video.title}</h4>
      <p>${video.views} views | ${video.date}</p>
    </div>
  `;
  return card;
}

function createFeaturedCard(item) {
  const card = document.createElement("article");
  card.className = "featured-card reveal reveal-fade-up watch-cursor-target";
  card.innerHTML = `
    <div class="preview-media">
      <img src="${item.thumbnail}" alt="${item.title} thumbnail" loading="lazy" />
      <video class="preview-video" src="${item.videoUrl}" muted loop playsinline preload="metadata"></video>
      <div class="play-badge"><span>&#9658;</span></div>
    </div>
    <div class="featured-meta">
      <h4>${item.title}</h4>
      <p>${item.duration} | ${item.category}</p>
      <button class="feature-watch-btn protected-action" data-action="watch">Watch</button>
    </div>
  `;
  return card;
}

function bindPreviewPlayback(card) {
  const previewVideo = card.querySelector(".preview-video");
  if (!previewVideo) return;

  previewVideo.muted = true;
  previewVideo.playsInline = true;

  card.addEventListener("mouseenter", () => {
    previewVideo.currentTime = 0;
    previewVideo.play().catch(() => {});
  });

  card.addEventListener("mouseleave", () => {
    previewVideo.pause();
    previewVideo.currentTime = 0;
  });
}

function initGlobalClickRipple() {
  const clickableSelector = ".btn, .action-btn, .feature-watch-btn, .collab-action-btn, .collab-service-card, .hero-card-link, .team-btn, .filter-buttons button, .auth-chip";

  document.addEventListener("pointerdown", (event) => {
    const target = event.target.closest(clickableSelector);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const burst = document.createElement("span");
    const size = Math.max(rect.width, rect.height);

    target.classList.add("ripple-host");
    burst.className = "click-ripple";
    burst.style.width = `${size}px`;
    burst.style.height = `${size}px`;
    burst.style.left = `${event.clientX - rect.left - size / 2}px`;
    burst.style.top = `${event.clientY - rect.top - size / 2}px`;

    target.appendChild(burst);
    setTimeout(() => burst.remove(), 520);
  });
}

function observeRevealElements() {
  const revealElements = document.querySelectorAll(".reveal, [data-reveal]");
  if (!revealElements.length || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.14,
      rootMargin: "0px 0px -8% 0px"
    }
  );

  revealElements.forEach((el) => {
    if (!el.classList.contains("show")) observer.observe(el);
  });
}

function initPageLoader() {
  if (pageLoaderInitialized) return;
  if (document.body?.dataset.page === "login" || document.body?.dataset.page === "register") return;

  pageLoaderInitialized = true;
  document.body.classList.add("is-loading");

  // Build a lightweight full-screen intro loader with two timed text beats.
  const loader = document.createElement("div");
  loader.className = "site-loader";
  loader.innerHTML = `
    <div class="loader-inner">
      <span class="loader-line">AAYNA presents</span>
      <span class="loader-line">Creative Stories in Motion</span>
    </div>
  `;
  document.body.appendChild(loader);

  const [lineOne, lineTwo] = loader.querySelectorAll(".loader-line");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const holdDelay = prefersReducedMotion ? 750 : 2000;

  requestAnimationFrame(() => {
    lineOne?.classList.add("is-active");
  });

  setTimeout(() => {
    lineOne?.classList.remove("is-active");
    lineTwo?.classList.add("is-active");
  }, 900);

  setTimeout(() => {
    loader.classList.add("is-hidden");
    document.body.classList.remove("is-loading");
    setTimeout(() => loader.remove(), 640);
  }, 900 + holdDelay);
}

function initFloatingParticles() {
  if (particlesInitialized) return;
  if (document.body?.dataset.page === "login" || document.body?.dataset.page === "register") return;

  particlesInitialized = true;
  const particles = document.createElement("div");
  particles.className = "floating-particles";
  particles.setAttribute("aria-hidden", "true");
  particles.innerHTML = `
    <span class="particle"></span><span class="particle"></span><span class="particle"></span><span class="particle"></span><span class="particle"></span>
    <span class="particle"></span><span class="particle"></span><span class="particle"></span><span class="particle"></span><span class="particle"></span>
  `;
  document.body.appendChild(particles);
}

function initCustomCursor() {
  if (cinematicCursorInitialized) return;
  if (!window.matchMedia("(pointer: fine)").matches) return;

  cinematicCursorInitialized = true;
  document.body.classList.add("has-custom-cursor");

  const cursor = document.createElement("div");
  cursor.className = "custom-cursor";
  cursor.innerHTML = `<span class="custom-cursor-label">Watch Reel</span>`;
  document.body.appendChild(cursor);

  document.addEventListener("pointermove", (event) => {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.classList.add("visible");
  });

  document.addEventListener("pointerleave", () => cursor.classList.remove("visible"));

  // Expand cursor and show "Watch Reel" on media-focused cards/players.
  document.addEventListener("mouseover", (event) => {
    const target = event.target.closest(".watch-cursor-target, .video-card, .featured-card, .featured-reel-player");
    cursor.classList.toggle("cursor-watch", Boolean(target));
  });
}

function initFeaturedReel() {
  const reelPlayer = document.getElementById("featuredReelPlayer");
  const reelVideo = document.getElementById("featuredReelVideo");
  const reelPlayBtn = document.getElementById("featuredReelPlay");
  if (!reelPlayer || !reelVideo || !reelPlayBtn) return;

  const syncState = () => {
    reelPlayer.classList.toggle("is-playing", !reelVideo.paused);
    const icon = reelPlayBtn.querySelector("i");
    const label = reelPlayBtn.querySelector("span");
    if (icon) icon.className = reelVideo.paused ? "fa-solid fa-play" : "fa-solid fa-pause";
    if (label) label.textContent = reelVideo.paused ? "Play Reel" : "Pause";
  };

  const togglePlayback = () => {
    if (reelVideo.paused) {
      reelVideo.play().catch(() => {});
    } else {
      reelVideo.pause();
    }
  };

  reelPlayBtn.addEventListener("click", togglePlayback);
  reelVideo.addEventListener("click", togglePlayback);
  reelVideo.addEventListener("play", syncState);
  reelVideo.addEventListener("pause", syncState);
  reelVideo.addEventListener("ended", syncState);
  syncState();
}

function initCinematicFooter() {
  const footerSections = document.querySelectorAll(".footer-cinematic");
  if (!footerSections.length) return;

  footerSections.forEach((footer) => {
    const typedCredit = footer.querySelector(".typed-credit");
    const typedText = (typedCredit?.dataset.text || typedCredit?.textContent || "").trim();
    let hasTyped = false;

    const runTyping = () => {
      if (!typedCredit || hasTyped || !typedText) return;
      hasTyped = true;
      typedCredit.textContent = "";
      let index = 0;
      const timer = setInterval(() => {
        typedCredit.textContent += typedText.charAt(index);
        index += 1;
        if (index >= typedText.length) clearInterval(timer);
      }, 42);
    };

    if (!("IntersectionObserver" in window)) {
      footer.classList.add("in-view");
      runTyping();
      return;
    }

    footer.classList.add("observe-ready");
    const footerObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          footer.classList.add("in-view");
          runTyping();
          footerObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.2 }
    );

    footerObserver.observe(footer);
  });
}

function initPaymentBookingSection() {
  const copyUpiBtn = document.getElementById("copyUpiBtn");
  const upiIdEl = document.getElementById("studioUpiId");
  const copyUpiNote = document.getElementById("copyUpiNote");
  const paymentPurposeSelect = document.getElementById("paymentPurposeSelect");
  const bookingEmailInput = document.getElementById("bookingEmail");
  const bookingEmailError = document.getElementById("bookingEmailError");
  const generateQrBtn = document.getElementById("generateQrBtn");
  const qrPaymentDoneBtn = document.getElementById("qrPaymentDoneBtn");
  const qrValidityText = document.getElementById("qrValidityText");
  const qrHolder = document.getElementById("qrHolder");
  const qrImage = document.getElementById("paymentQrImage");
  const statusBox = document.getElementById("paymentStatusBox");
  const statusText = document.getElementById("paymentStatusText");
  const razorpayPayBtn = document.getElementById("razorpayPayBtn");
  const successModal = document.getElementById("bookingSuccessModal");
  const closeSuccessModalBtn = document.getElementById("closeBookingSuccessModal");
  const successBookingId = document.getElementById("successBookingId");
  const successBookingEmail = document.getElementById("successBookingEmail");
  const bookingSuccessNote = document.getElementById("bookingSuccessNote");
  const whatsappConfirmBtn = document.getElementById("whatsappConfirmBtn");
  const downloadReceiptBtn = document.getElementById("downloadReceiptBtn");

  if (!statusBox || !statusText || !razorpayPayBtn) return;
  const fixedAmount = "10.00";
  let latestBooking = null;
  let qrExpiryAt = 0;
  let qrTimer = null;

  const resetStatus = () => {
    statusBox.classList.remove("is-processing", "is-success");
  };

  const validateEmail = () => {
    const email = (bookingEmailInput?.value || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      if (bookingEmailError) bookingEmailError.textContent = "Enter a valid email address before payment.";
      bookingEmailInput?.classList.add("field-error");
      bookingEmailInput?.focus();
      return null;
    }
    if (bookingEmailError) bookingEmailError.textContent = "";
    bookingEmailInput?.classList.remove("field-error");
    return email;
  };

  const openSuccessModal = () => {
    if (!successModal) return;
    successModal.classList.add("open");
    successModal.setAttribute("aria-hidden", "false");
  };

  const closeSuccessModal = () => {
    if (!successModal) return;
    successModal.classList.remove("open");
    successModal.setAttribute("aria-hidden", "true");
  };

  const buildUpiLink = () => {
    const upiId = upiIdEl?.textContent?.trim() || "";
    const purpose = paymentPurposeSelect?.value || "Project Booking";
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent("Aayna Studio")}&am=${fixedAmount}&cu=INR&tn=${encodeURIComponent(purpose)}`;
  };

  const generateBookingId = () => {
    const year = new Date().getFullYear();
    const code = String(Math.floor(1000 + Math.random() * 9000));
    return `AAYNA-${year}-${code}`;
  };

  const clearQrTimer = () => {
    clearInterval(qrTimer);
    qrTimer = null;
  };

  const expireQr = () => {
    qrExpiryAt = 0;
    clearQrTimer();
    if (qrHolder) qrHolder.classList.add("qr-hidden");
    if (qrImage) qrImage.src = "";
    if (qrValidityText) qrValidityText.textContent = "QR expired. Generate again.";
  };

  const updateQrCountdown = () => {
    if (!qrExpiryAt) return;
    const remainingMs = qrExpiryAt - Date.now();
    if (remainingMs <= 0) {
      expireQr();
      return;
    }
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const secs = String(totalSeconds % 60).padStart(2, "0");
    if (qrValidityText) qrValidityText.textContent = `QR valid for ${mins}:${secs}`;
  };

  const refreshQrCode = () => {
    if (!qrImage || !qrExpiryAt || Date.now() > qrExpiryAt) return;
    const upiLink = buildUpiLink();
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiLink)}`;
  };

  const finalizeSuccessWithBooking = (booking) => {
    if (!booking) return;
    latestBooking = {
      bookingId: booking.bookingId,
      email: booking.email,
      appName: booking.appName || "Razorpay",
      purpose: booking.purpose,
      amount: String(booking.amount || fixedAmount),
      upiId: booking.upiId || (upiIdEl?.textContent?.trim() || ""),
      createdAt: new Date(booking.createdAt || Date.now())
    };

    resetStatus();
    statusBox.classList.add("is-success");
    statusText.textContent = "Payment Initiated Successfully";
    if (razorpayPayBtn) razorpayPayBtn.disabled = false;

    if (successBookingId) successBookingId.textContent = latestBooking.bookingId;
    if (successBookingEmail) successBookingEmail.textContent = latestBooking.email;
    if (bookingSuccessNote) bookingSuccessNote.textContent = "Confirmation has been sent to your email.";
    if (whatsappConfirmBtn) {
      const msg = `Hello, I have completed my booking. Booking ID: ${latestBooking.bookingId}`;
      whatsappConfirmBtn.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    }
    openSuccessModal();
  };

  const sendBookingConfirmationMail = async (booking) => {
    try {
      await postJsonWithFallback("/api/bookings/confirm", {
        email: booking.email,
        bookingId: booking.bookingId,
        purpose: booking.purpose,
        amount: Number(booking.amount || fixedAmount),
        paymentMethod: booking.appName || "Payment"
      });
      if (bookingSuccessNote) bookingSuccessNote.textContent = "Confirmation has been sent to your email.";
    } catch (error) {
      if (bookingSuccessNote) bookingSuccessNote.textContent = "Booking saved, but email could not be sent right now.";
      showToast(error?.message || "Confirmation email failed.");
    }
  };

  paymentPurposeSelect?.addEventListener("change", refreshQrCode);
  bookingEmailInput?.addEventListener("input", () => {
    if (bookingEmailError) bookingEmailError.textContent = "";
    bookingEmailInput.classList.remove("field-error");
  });
  generateQrBtn?.addEventListener("click", () => {
    const email = validateEmail();
    if (!email) return;

    qrExpiryAt = Date.now() + (5 * 60 * 1000);
    refreshQrCode();
    qrHolder?.classList.remove("qr-hidden");
    updateQrCountdown();
    clearQrTimer();
    qrTimer = setInterval(updateQrCountdown, 1000);
  });
  qrPaymentDoneBtn?.addEventListener("click", async () => {
    const email = validateEmail();
    if (!email) return;
    if (!qrExpiryAt || Date.now() > qrExpiryAt) {
      if (qrValidityText) qrValidityText.textContent = "QR expired. Generate again.";
      return;
    }

    const booking = {
      bookingId: generateBookingId(),
      email,
      appName: "QR Payment",
      purpose: paymentPurposeSelect?.value || "Booking",
      amount: fixedAmount,
      upiId: upiIdEl?.textContent?.trim() || "",
      createdAt: new Date()
    };

    finalizeSuccessWithBooking(booking);
    await sendBookingConfirmationMail(booking);
  });
  closeSuccessModalBtn?.addEventListener("click", closeSuccessModal);
  successModal?.addEventListener("click", (event) => {
    if (event.target === successModal) closeSuccessModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSuccessModal();
  });

  copyUpiBtn?.addEventListener("click", async () => {
    const upiText = upiIdEl?.textContent?.trim() || "";
    if (!upiText) return;

    try {
      // Use modern clipboard API first; fallback keeps support for older browsers.
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(upiText);
      } else {
        const temp = document.createElement("textarea");
        temp.value = upiText;
        temp.setAttribute("readonly", "");
        temp.style.position = "absolute";
        temp.style.left = "-9999px";
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        temp.remove();
      }
      if (copyUpiNote) copyUpiNote.textContent = "UPI ID copied successfully.";
    } catch {
      if (copyUpiNote) copyUpiNote.textContent = "Copy failed. Please copy manually.";
    }

    clearTimeout(copyUpiBtn.copyTimer);
    copyUpiBtn.copyTimer = setTimeout(() => {
      if (copyUpiNote) copyUpiNote.textContent = "";
    }, 2200);
  });

  razorpayPayBtn?.addEventListener("click", async () => {
    const email = validateEmail();
    if (!email) return;
    if (typeof window.Razorpay === "undefined") {
      statusText.textContent = "Razorpay is unavailable. Please try again.";
      return;
    }

    const purpose = paymentPurposeSelect?.value || "Booking";
    try {
      resetStatus();
      statusBox.classList.add("is-processing");
      statusText.textContent = "Processing Payment...";
      razorpayPayBtn.disabled = true;

      const orderResp = await postJsonWithFallback("/api/payments/order", {
        email,
        purpose,
        amount: Number(fixedAmount)
      });

      const options = {
        key: orderResp.keyId,
        amount: orderResp.order.amount,
        currency: orderResp.order.currency,
        name: "AAYNA Studio",
        description: `${purpose} Booking Token`,
        order_id: orderResp.order.id,
        prefill: { email },
        notes: {
          purpose,
          booking_token: fixedAmount
        },
        theme: { color: "#18f2ff" },
        handler: async (response) => {
          try {
            const verifyResp = await postJsonWithFallback("/api/payments/verify", {
              email,
              purpose,
              amount: Number(fixedAmount),
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            finalizeSuccessWithBooking(verifyResp.booking);
            await sendBookingConfirmationMail(verifyResp.booking);
          } catch (err) {
            resetStatus();
            statusText.textContent = err?.message || "Payment verification failed.";
            razorpayPayBtn.disabled = false;
          }
        },
        modal: {
          ondismiss: () => {
            resetStatus();
            statusText.textContent = "Payment was cancelled.";
            razorpayPayBtn.disabled = false;
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      resetStatus();
      statusText.textContent = error?.message || "Unable to start Razorpay payment.";
      razorpayPayBtn.disabled = false;
    }
  });

  downloadReceiptBtn?.addEventListener("click", () => {
    if (!latestBooking) return;

    // Generate a lightweight, downloadable receipt for the completed booking.
    const issuedAt = latestBooking.createdAt.toLocaleString();
    const receiptText = [
      "AAYNA Creative Studio - Booking Receipt",
      "---------------------------------------",
      `Booking ID: ${latestBooking.bookingId}`,
      `Email: ${latestBooking.email}`,
      `Purpose: ${latestBooking.purpose}`,
      `Paid Via: ${latestBooking.appName}`,
      `Amount: INR ${latestBooking.amount}`,
      `UPI ID: ${latestBooking.upiId}`,
      `Issued On: ${issuedAt}`,
      "",
      "Status: Project Slot Reserved",
      "Confirmation has been sent to your email."
    ].join("\n");

    const blob = new Blob([receiptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${latestBooking.bookingId}-receipt.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

function initHeroBackground() {
  const hero = document.querySelector(".hero");
  const videoA = document.getElementById("heroVideoA");
  const videoB = document.getElementById("heroVideoB");
  const fallback = document.getElementById("heroFallback");
  if (!hero || !videoA || !videoB || !fallback || !heroReelVideos.length) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isSmallScreen = window.matchMedia("(max-width: 768px)").matches;
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
  const useStaticFallback = prefersReducedMotion || (isSmallScreen && isTouchDevice);

  const initialIndex = Math.floor(Math.random() * heroReelVideos.length);
  fallback.style.backgroundImage = `url("${heroReelVideos[initialIndex].thumb}")`;

  if (useStaticFallback) {
    hero.classList.add("is-mobile");
    return;
  }

  [videoA, videoB].forEach((videoEl) => {
    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.playsInline = true;
    videoEl.setAttribute("muted", "");
    videoEl.setAttribute("playsinline", "");
    videoEl.setAttribute("autoplay", "");
    videoEl.preload = "metadata";
  });

  let currentIndex = initialIndex;
  let activeVideo = videoA;
  let inactiveVideo = videoB;
  let switchTimer = null;
  let preloadedIndex = null;

  const preloader = document.createElement("video");
  preloader.preload = "metadata";
  preloader.muted = true;

  const getSwitchDelay = () => 8000 + Math.floor(Math.random() * 2001);

  const pickNextIndex = () => {
    if (heroReelVideos.length === 1) return 0;
    let nextIndex = currentIndex;
    while (nextIndex === currentIndex) {
      nextIndex = Math.floor(Math.random() * heroReelVideos.length);
    }
    return nextIndex;
  };

  const loadAndPlay = (videoEl, index) =>
    new Promise((resolve) => {
      const source = heroReelVideos[index].src;
      const onReady = () => {
        videoEl.removeEventListener("loadeddata", onReady);
        videoEl.removeEventListener("error", onError);
        videoEl.currentTime = 0;
        videoEl.play().catch(() => {});
        resolve();
      };
      const onError = () => {
        videoEl.removeEventListener("loadeddata", onReady);
        videoEl.removeEventListener("error", onError);
        resolve();
      };

      if (videoEl.dataset.src !== source) {
        videoEl.dataset.src = source;
        videoEl.src = source;
        videoEl.load();
      }

      if (videoEl.readyState >= 2) {
        onReady();
      } else {
        videoEl.addEventListener("loadeddata", onReady, { once: true });
        videoEl.addEventListener("error", onError, { once: true });
      }
    });

  const preloadNext = () => {
    preloadedIndex = pickNextIndex();
    preloader.src = heroReelVideos[preloadedIndex].src;
    preloader.load();
  };

  const scheduleSwitch = () => {
    clearTimeout(switchTimer);
    switchTimer = setTimeout(async () => {
      const nextIndex = preloadedIndex ?? pickNextIndex();
      const previousVideo = activeVideo;
      const nextVideo = inactiveVideo;

      await loadAndPlay(nextVideo, nextIndex);
      nextVideo.classList.add("active");
      previousVideo.classList.remove("active");

      setTimeout(() => previousVideo.pause(), 850);

      activeVideo = nextVideo;
      inactiveVideo = previousVideo;
      currentIndex = nextIndex;
      preloadedIndex = null;
      fallback.style.backgroundImage = `url("${heroReelVideos[nextIndex].thumb}")`;

      preloadNext();
      scheduleSwitch();
    }, getSwitchDelay());
  };

  loadAndPlay(activeVideo, currentIndex).then(() => {
    activeVideo.classList.add("active");
    hero.classList.add("has-video");
    preloadNext();
    scheduleSwitch();
  });

  if (!prefersReducedMotion) {
    const heroSpeed = 0.12;
    const maxShift = 34;
    let ticking = false;

    const updateParallax = () => {
      const rect = hero.getBoundingClientRect();
      const viewportH = window.innerHeight || document.documentElement.clientHeight;
      const visible = rect.bottom > 0 && rect.top < viewportH;
      if (visible) {
        const rawOffset = Math.max(-maxShift, Math.min(maxShift, window.scrollY * heroSpeed));
        hero.style.setProperty("--hero-parallax", `${rawOffset}px`);
      }
      ticking = false;
    };

    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(updateParallax);
        }
      },
      { passive: true }
    );
    updateParallax();
  }
}

function initStandaloneLoginPage() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  const loginPage = document.getElementById("loginPage");
  const identifierInput = document.getElementById("loginIdentifier");
  const passwordInput = document.getElementById("loginPassword");
  const loginBtn = document.getElementById("loginBtn");
  const loginError = document.getElementById("loginError");

  enforceIndianPrefix(identifierInput, { allowEmail: true });

  attachRipple(loginBtn);

  loginForm.addEventListener("input", () => {
    if (loginError) loginError.textContent = "";
    setGroupError(["groupIdentifier", "groupPassword"], false);
  });

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const identifier = identifierInput?.value.trim() || "";
    const password = passwordInput?.value.trim() || "";
    const parsed = parseLoginIdentifier(identifier);
    const user = findUserByIdentifier(identifier);

    if (parsed.type === "invalid_email") {
      if (loginError) loginError.textContent = "Enter a valid email address.";
      setGroupError(["groupIdentifier"], true);
      triggerShake(loginPage);
      return;
    }
    if (parsed.type === "invalid_phone") {
      if (loginError) loginError.textContent = "Phone must start with +91 and have 10 digits.";
      setGroupError(["groupIdentifier"], true);
      triggerShake(loginPage);
      return;
    }
    if (!user) {
      if (loginError) loginError.textContent = "No account found with this email/phone.";
      setGroupError(["groupIdentifier"], true);
      triggerShake(loginPage);
      return;
    }

    if (!password) {
      if (loginError) loginError.textContent = "Password is required.";
      setGroupError(["groupPassword"], true);
      triggerShake(loginPage);
      return;
    }

    if ((user.password || "") !== password) {
      if (loginError) loginError.textContent = "Invalid password.";
      setGroupError(["groupPassword"], true);
      triggerShake(loginPage);
      return;
    }

    setButtonLoading(loginBtn, true);
    setTimeout(() => {
      setCurrentUser({
        id: user.id,
        name: user.name || user.fullName || "User",
        email: user.email
      });
      localStorage.setItem("AAYNA_LOGIN_COUNT", String(Number(localStorage.getItem("AAYNA_LOGIN_COUNT") || 0) + 1));
      setButtonLoading(loginBtn, false);
      showToast("Logged in successfully");
      window.location.href = "index.html";
    }, 550);
  });
}

function initPortfolioPage() {
  initPageLoader();
  initFloatingParticles();
  initCustomCursor();

  const videoGrid = document.getElementById("videoGrid");
  const hasVideoGrid = Boolean(videoGrid);

  const filterButtons = document.querySelectorAll("#filterButtons button");
  const searchInput = document.getElementById("searchInput");
  const modal = document.getElementById("videoModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalPlayer = document.getElementById("modalPlayer");
  const modalLocalPlayer = document.getElementById("modalLocalPlayer");
  const modalLocalSource = document.getElementById("modalLocalSource");
  const modalPlayerWrap = document.querySelector(".player-wrap");
  const closeModalBtn = document.getElementById("closeModal");
  const menuToggle = document.getElementById("menuToggle");
  const navMenu = document.getElementById("navMenu");
  const teamCards = document.querySelectorAll(".team-card");
  const latestVideoLink = document.getElementById("latestVideoLink");
  const latestReelTitle = document.getElementById("latestReelTitle");
  const latestReelMeta = document.getElementById("latestReelMeta");
  const processTriggers = document.querySelectorAll(".process-trigger");
  const processToast = document.getElementById("processToast");
  const processToastTitle = document.getElementById("processToastTitle");
  const processToastText = document.getElementById("processToastText");
  const featuredGrid = document.getElementById("featuredGrid");

  renderNavbarAuth();
  initPaymentBookingSection();
  initHeroBackground();
  initFeaturedReel();
  if (!uiFxInitialized) {
    initGlobalClickRipple();
    uiFxInitialized = true;
  }

  let currentLatestVideo = null;
  const latestReels = [...videoData]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  function setLatestReelCard(video, animate = false) {
    if (!video || !latestReelTitle || !latestReelMeta) return;

    if (animate) {
      latestReelTitle.classList.add("is-switching");
      latestReelMeta.classList.add("is-switching");
      setTimeout(() => {
        latestReelTitle.textContent = video.title;
        latestReelMeta.textContent = `${video.category} | ${video.date}`;
        latestReelTitle.classList.remove("is-switching");
        latestReelMeta.classList.remove("is-switching");
      }, 180);
    } else {
      latestReelTitle.textContent = video.title;
      latestReelMeta.textContent = `${video.category} | ${video.date}`;
    }

    currentLatestVideo = video;
  }

  if (latestReels.length) {
    let latestCardIndex = 0;
    setLatestReelCard(latestReels[latestCardIndex], false);

    if (latestReels.length > 1) {
      setInterval(() => {
        latestCardIndex = (latestCardIndex + 1) % latestReels.length;
        setLatestReelCard(latestReels[latestCardIndex], true);
      }, 6200);
    }
  }

  function openModal(video) {
    if (!modal || !modalTitle || !modalPlayerWrap || !modalPlayer || !modalLocalPlayer || !modalLocalSource) return;
    modalTitle.textContent = video.title;
    const isLocalVideo = /\.(mp4|mov|webm|ogg)$/i.test(video.videoUrl);
    modalPlayerWrap.classList.toggle("portrait-mode", Boolean(video.isPortrait));

    if (isLocalVideo) {
      modalPlayer.classList.add("hidden");
      modalPlayer.src = "";
      modalLocalPlayer.classList.remove("hidden");
      modalLocalSource.src = video.videoUrl;
      modalLocalPlayer.load();
      modalLocalPlayer.play().catch(() => {});
    } else {
      modalLocalPlayer.pause();
      modalLocalPlayer.classList.add("hidden");
      modalLocalSource.src = "";
      modalPlayer.classList.remove("hidden");
      modalPlayer.src = `${video.videoUrl}?autoplay=1`;
    }

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    if (!modal || !modalPlayerWrap || !modalPlayer || !modalLocalPlayer || !modalLocalSource) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    modalPlayerWrap.classList.remove("portrait-mode");
    modalPlayer.src = "";
    modalLocalPlayer.pause();
    modalLocalSource.src = "";
    modalLocalPlayer.load();
  }

  function renderVideos() {
    if (!videoGrid) return;
    const filtered = videoData
      .filter((video) => {
        const matchCategory = activeCategory === "All" || video.category === activeCategory;
        const matchSearch = video.title.toLowerCase().includes(searchTerm.toLowerCase());
        return matchCategory && matchSearch;
      })
      // Newest videos first.
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    videoGrid.innerHTML = "";
    if (!filtered.length) {
      videoGrid.innerHTML = "<p>No videos found. Try a different search or category.</p>";
      return;
    }

    filtered.forEach((video) => {
      const card = createVideoCard(video);
      bindPreviewPlayback(card);
      card.addEventListener("click", (event) => {
        if (!isLoggedIn()) {
          pendingProtectedAction = {
            type: "video",
            open: () => openModal(video)
          };
          openAuthModal();
          return;
        }

        openModal(video);
      });
      videoGrid.appendChild(card);
    });

    observeRevealElements();
  }

  function renderFeaturedCreations() {
    if (!featuredGrid) return;
    featuredGrid.innerHTML = "";

    featuredCreationsData.forEach((item) => {
      const card = createFeaturedCard(item);
      bindPreviewPlayback(card);

      const watchBtn = card.querySelector(".feature-watch-btn");
      watchBtn?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!isLoggedIn()) {
          pendingProtectedAction = {
            type: "video",
            open: () => openModal(item)
          };
          openAuthModal();
          return;
        }

        openModal(item);
      });

      card.addEventListener("click", () => {
        if (!isLoggedIn()) {
          pendingProtectedAction = {
            type: "video",
            open: () => openModal(item)
          };
          openAuthModal();
          return;
        }

        openModal(item);
      });

      featuredGrid.appendChild(card);
    });

    observeRevealElements();
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category;
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      renderVideos();
    });
  });

  searchInput?.addEventListener("input", (event) => {
    searchTerm = event.target.value.trim();
    renderVideos();
  });

  closeModalBtn?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  menuToggle?.addEventListener("click", () => navMenu?.classList.toggle("open"));

  document.querySelectorAll('a[href="about.html"], a[href="featured.html"]').forEach((pageLink) => {
    pageLink.addEventListener("click", (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const href = pageLink.getAttribute("href") || "";
      const currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
      if (!href || href.toLowerCase() === currentPage) return;

      event.preventDefault();
      document.body.classList.add("page-leaving");
      setTimeout(() => {
        window.location.href = href;
      }, 320);
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const targetId = anchor.getAttribute("href");
      if (!targetId || targetId === "#") return;
      if (targetId === "#home") {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        navMenu?.classList.remove("open");
        return;
      }
      const targetSection = document.querySelector(targetId);
      if (!targetSection) return;
      event.preventDefault();
      targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
      navMenu?.classList.remove("open");
    });
  });

  teamCards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    });
  });

  processTriggers.forEach((trigger, index) => {
    trigger.addEventListener("click", () => {
      processTriggers.forEach((item) => item.classList.remove("active"));
      trigger.classList.add("active");
      if (processToast) {
        const detail = trigger.dataset.detail || "";
        const [rawTitle, ...rest] = detail.split(" - ");
        const cleanTitle = (rawTitle || "Step").trim();
        const cleanText = rest.join(" - ").trim();
        const iconClass = trigger.querySelector(".process-icon i")?.className || "fa-regular fa-lightbulb";
        const rect = trigger.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const toastWidth = Math.min(520, viewportWidth * 0.9);
        const safeLeft = Math.max(28 + toastWidth / 2, Math.min(viewportWidth - 28 - toastWidth / 2, rect.left + rect.width / 2));
        const top = Math.max(84, rect.top - 96);

        if (processToastTitle) processToastTitle.textContent = cleanTitle;
        if (processToastText) processToastText.textContent = cleanText;
        const toastIcon = processToast.querySelector(".process-toast-icon i");
        if (toastIcon) toastIcon.className = iconClass;

        processToast.style.left = `${safeLeft}px`;
        processToast.style.top = `${top}px`;
        processToast.style.setProperty("--pointer-left", `${Math.max(18, Math.min(toastWidth - 18, rect.left + rect.width / 2 - (safeLeft - toastWidth / 2)))}px`);
        processToast.classList.add("show");
        clearTimeout(processToast.timer);
        processToast.timer = setTimeout(() => processToast.classList.remove("show"), 2200);
      }
    });

    if (index === 0) trigger.classList.add("active");
  });

  latestVideoLink?.addEventListener("click", (event) => {
    const href = latestVideoLink.getAttribute("href") || "";
    if (href && !href.startsWith("#")) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      document.body.classList.add("page-leaving");
      setTimeout(() => {
        window.location.href = href;
      }, 320);
      return;
    }

    event.preventDefault();
    document.getElementById("videos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!currentLatestVideo) return;

    if (!isLoggedIn()) {
      pendingProtectedAction = {
        type: "video",
        open: () => setTimeout(() => openModal(currentLatestVideo), 350)
      };
      openAuthModal();
      return;
    }

    setTimeout(() => openModal(currentLatestVideo), 350);
  });

  // Global protected-action click detection.
  document.addEventListener("click", (event) => {
    const target = event.target.closest(".protected-action");
    if (!target) return;

    event.preventDefault();
    handleProtectedClick(target);
  });

  if (hasVideoGrid) {
    renderVideos();
  }
  renderFeaturedCreations();
  observeRevealElements();
  initCinematicFooter();
}

// -------------------------
// Visitor analytics + admin dashboard
// -------------------------
const VISITOR_ANALYTICS_KEY = "AAYNA_VISITOR_ANALYTICS";
const VISITOR_SESSION_KEY = "AAYNA_VISITOR_SESSION_ID";
const ADMIN_SESSION_KEY = "AAYNA_ADMIN_AUTH";

function getVisitorAnalytics() {
  return getJSON(VISITOR_ANALYTICS_KEY, {
    totalVisits: 0,
    totalPageViews: 0,
    lastVisitId: 0,
    dailyVisits: {},
    sessions: {},
    visitLog: []
  });
}

function setVisitorAnalytics(data) {
  setJSON(VISITOR_ANALYTICS_KEY, data);
}

function getCurrentPageKey() {
  const bodyPage = document.body?.dataset?.page;
  if (bodyPage) return bodyPage.toLowerCase();

  const fileName = window.location.pathname.split("/").pop() || "index.html";
  return fileName.replace(".html", "").toLowerCase() || "index";
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getReadableDate(date) {
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function getReadableTime(date) {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function getVisitorSessionId() {
  let sessionId = sessionStorage.getItem(VISITOR_SESSION_KEY);
  if (sessionId) return sessionId;

  sessionId = `SID-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  sessionStorage.setItem(VISITOR_SESSION_KEY, sessionId);
  return sessionId;
}

function shouldTrackVisitorPage() {
  const excludedPages = new Set(["admin", "dashboard", "login", "register"]);
  return !excludedPages.has(getCurrentPageKey());
}

function trackVisitor() {
  if (!shouldTrackVisitorPage()) return;

  const analytics = getVisitorAnalytics();
  const now = new Date();
  const dateKey = getDateKey(now);
  const pageKey = getCurrentPageKey();
  const sessionId = getVisitorSessionId();
  const isNewSession = !analytics.sessions[sessionId];
  const currentSession = analytics.sessions[sessionId] || {
    sessionId,
    firstSeen: now.toISOString(),
    lastActive: now.toISOString(),
    visitCount: 0,
    pages: []
  };

  currentSession.visitCount += 1;
  currentSession.lastActive = now.toISOString();
  if (!currentSession.pages.includes(pageKey)) {
    currentSession.pages.push(pageKey);
  }

  analytics.totalPageViews += 1;
  if (isNewSession) {
    analytics.totalVisits += 1;
    analytics.dailyVisits[dateKey] = (analytics.dailyVisits[dateKey] || 0) + 1;
  }
  analytics.lastVisitId += 1;
  analytics.sessions[sessionId] = currentSession;
  analytics.visitLog.unshift({
    id: analytics.lastVisitId,
    dateKey,
    dateLabel: getReadableDate(now),
    timeLabel: getReadableTime(now),
    sessionId,
    page: pageKey,
    sessionVisit: currentSession.visitCount,
    timestamp: now.toISOString()
  });

  // Keep the latest rows so the admin table stays fast.
  analytics.visitLog = analytics.visitLog.slice(0, 250);
  setVisitorAnalytics(analytics);
}

function getActiveSessionCount(analytics) {
  const now = Date.now();
  const activeWindow = 30 * 60 * 1000;

  return Object.values(analytics.sessions || {}).filter((session) => {
    return now - new Date(session.lastActive).getTime() <= activeWindow;
  }).length;
}

function setAdminAuthState(isLoggedIn) {
  if (isLoggedIn) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
  } else {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }
}

function isAdminLoggedIn() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

function initAdminDashboard() {
  if (getCurrentPageKey() !== "admin") return;

  const loginView = document.getElementById("adminLoginView");
  const dashboardView = document.getElementById("adminDashboardView");
  const loginForm = document.getElementById("adminLoginForm");
  const loginError = document.getElementById("adminLoginError");
  const logoutBtn = document.getElementById("adminLogoutBtn");
  const resetBtn = document.getElementById("resetVisitorDataBtn");
  const totalVisitorsEl = document.getElementById("totalVisitorsCard");
  const todayVisitorsEl = document.getElementById("todayVisitorsCard");
  const activeSessionsEl = document.getElementById("activeSessionsCard");
  const totalPageViewsEl = document.getElementById("totalPageViewsCard");
  const tableBody = document.getElementById("visitorTableBody");
  const emptyState = document.getElementById("visitorEmptyState");
  const lastUpdated = document.getElementById("adminLastUpdated");
  const chartCanvas = document.getElementById("visitorChart");

  let visitorChart = null;

  function toggleAdminView() {
    const loggedIn = isAdminLoggedIn();
    loginView?.classList.toggle("hidden", loggedIn);
    dashboardView?.classList.toggle("hidden", !loggedIn);
  }

  function renderChart(analytics) {
    if (!chartCanvas || typeof Chart === "undefined") return;

    const labels = Object.keys(analytics.dailyVisits || {}).sort();
    const values = labels.map((key) => analytics.dailyVisits[key]);
    const prettyLabels = labels.map((key) => {
      const date = new Date(`${key}T00:00:00`);
      return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    });

    if (visitorChart) {
      visitorChart.destroy();
    }

    visitorChart = new Chart(chartCanvas, {
      type: "line",
      data: {
        labels: prettyLabels,
        datasets: [
          {
            label: "Visits",
            data: values,
            borderColor: "#42f5ff",
            backgroundColor: "rgba(66, 245, 255, 0.16)",
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: "#f6f7ff"
            }
          }
        },
        scales: {
          x: {
            ticks: { color: "#b8c0da" },
            grid: { color: "rgba(255,255,255,0.06)" }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: "#b8c0da",
              precision: 0
            },
            grid: { color: "rgba(255,255,255,0.06)" }
          }
        }
      }
    });
  }

  function renderDashboard() {
    const analytics = getVisitorAnalytics();
    const todayKey = getDateKey(new Date());
    const totalVisitors = analytics.totalVisits || 0;
    const todayVisitors = analytics.dailyVisits?.[todayKey] || 0;
    const activeSessions = getActiveSessionCount(analytics);
    const totalPageViews = analytics.totalPageViews || 0;
    const visitRows = analytics.visitLog || [];

    if (totalVisitorsEl) totalVisitorsEl.textContent = totalVisitors;
    if (todayVisitorsEl) todayVisitorsEl.textContent = todayVisitors;
    if (activeSessionsEl) activeSessionsEl.textContent = activeSessions;
    if (totalPageViewsEl) totalPageViewsEl.textContent = totalPageViews;
    if (lastUpdated) lastUpdated.textContent = `Last updated: ${getReadableDate(new Date())} ${getReadableTime(new Date())}`;

    if (tableBody) {
      tableBody.innerHTML = "";
      visitRows.forEach((visit) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>#${visit.id}</td>
          <td>${visit.dateLabel}</td>
          <td>${visit.timeLabel}</td>
          <td>${visit.sessionId}</td>
        `;
        tableBody.appendChild(row);
      });
    }

    if (emptyState) {
      emptyState.classList.toggle("hidden", visitRows.length > 0);
    }

    renderChart(analytics);
  }

  loginForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    loginError.textContent = "";

    const username = document.getElementById("adminUsername")?.value.trim();
    const password = document.getElementById("adminPassword")?.value.trim();

    if (username !== "24155383@kiit.ac.in" || password !== "123456") {
      loginError.textContent = "Invalid admin username or password.";
      return;
    }

    setAdminAuthState(true);
    toggleAdminView();
    renderDashboard();
  });

  logoutBtn?.addEventListener("click", () => {
    setAdminAuthState(false);
    toggleAdminView();
  });

  resetBtn?.addEventListener("click", () => {
    const confirmed = window.confirm("Reset all saved visitor data?");
    if (!confirmed) return;

    localStorage.removeItem(VISITOR_ANALYTICS_KEY);
    renderDashboard();
  });

  toggleAdminView();
  if (isAdminLoggedIn()) {
    renderDashboard();
  }
}

trackVisitor();
initAuthModal();
initStandaloneLoginPage();
initPortfolioPage();
initAdminDashboard();

