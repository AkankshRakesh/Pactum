(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    initDarkMode();
    initSplashPhases();
    initStamps();
    initTypewriter();
    initAccordion();
    initBillingToggle();
    initSignForm();
  });

  /* ---------------------------------------------------------------
   * Dark mode toggle (persisted via localStorage)
   * ------------------------------------------------------------- */
  function initDarkMode() {
    const btn = document.getElementById("mode-toggle");
    if (!btn) return;

    const stored = window.localStorage.getItem("pactum-theme");
    let dark = stored === "dark";
    applyTheme(dark);

    btn.addEventListener("click", () => {
      dark = !dark;
      applyTheme(dark);
      window.localStorage.setItem("pactum-theme", dark ? "dark" : "light");
    });

    function applyTheme(isDark) {
      document.documentElement.classList.toggle("dark", isDark);
      btn.textContent = isDark ? "☀" : "☾";
      btn.title = isDark ? "Switch to light mode" : "Switch to dark mode";
    }
  }

  /* ---------------------------------------------------------------
   * Splash reveal phases (matches the React phase 0/1/2/3 timing)
   * ------------------------------------------------------------- */
  function initSplashPhases() {
    const splash = document.getElementById("splash");
    if (!splash) return;

    setTimeout(() => splash.classList.add("is-phase-1"), 200);
    setTimeout(() => splash.classList.add("is-phase-2"), 700);
    setTimeout(() => splash.classList.add("is-phase-3"), 1400);
  }

  /* ---------------------------------------------------------------
   * Stamp reveal animation
   * ------------------------------------------------------------- */
  function initStamps() {
    document.querySelectorAll("[data-stamp]").forEach((el, i) => {
      const rotate = el.dataset.stampRotate || "-6";
      el.style.setProperty("--r", `${rotate}deg`);
      const delay = i === 0 ? 0 : 100;
      setTimeout(() => el.classList.add("is-visible"), delay);
    });
  }

  /* ---------------------------------------------------------------
   * Typewriter effect for the preamble
   * ------------------------------------------------------------- */
  function initTypewriter() {
    const el = document.getElementById("preamble-text");
    if (!el) return;

    const fullText = el.dataset.fullText || "";
    const speed = parseInt(el.dataset.speed, 10) || 18;
    const delay = parseInt(el.dataset.delay, 10) || 0;
    const paragraphs = fullText.split("\n\n");

    // Build one <p> per paragraph up front, fill them as we type.
    el.innerHTML = "";
    const pEls = paragraphs.map(() => {
      const p = document.createElement("p");
      el.appendChild(p);
      return p;
    });

    const cursor = document.createElement("span");
    cursor.className = "preamble__cursor";
    cursor.textContent = "▌";

    setTimeout(() => {
      let flatIndex = 0;
      const flatChars = [];
      paragraphs.forEach((para, pi) => {
        for (let ci = 0; ci < para.length; ci++) {
          flatChars.push({ pi, ch: para[ci] });
        }
      });

      const interval = setInterval(() => {
        if (flatIndex >= flatChars.length) {
          clearInterval(interval);
          cursor.remove();
          return;
        }
        const { pi, ch } = flatChars[flatIndex];
        pEls[pi].textContent += ch;
        pEls[pi].appendChild(cursor); // keep cursor at the live edge
        flatIndex++;
      }, speed);
    }, delay);
  }

  /* ---------------------------------------------------------------
   * Article I — clause accordion (single-open, click to toggle)
   * ------------------------------------------------------------- */
  function initAccordion() {
    const clauses = document.querySelectorAll("[data-clause]");
    clauses.forEach((clause) => {
      clause.addEventListener("click", () => {
        const wasOpen = clause.classList.contains("is-open");
        clauses.forEach((c) => c.classList.remove("is-open"));
        if (!wasOpen) clause.classList.add("is-open");
      });
    });
  }

  /* ---------------------------------------------------------------
   * Article III — monthly / annual billing toggle
   * ------------------------------------------------------------- */
  function initBillingToggle() {
    const toggle = document.getElementById("billing-toggle");
    if (!toggle) return;
    const buttons = toggle.querySelectorAll("button[data-billing]");
    const prices = document.querySelectorAll("[data-price]");

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.billing; // "monthly" | "annual"
        buttons.forEach((b) => b.classList.toggle("is-active", b === btn));
        prices.forEach((priceEl) => {
          const value = mode === "monthly" ? priceEl.dataset.monthly : priceEl.dataset.annual;
          priceEl.textContent = `$${value}`;
        });
      });
    });
  }

  /* ---------------------------------------------------------------
   * Execution block — sign form
   * ------------------------------------------------------------- */
  function initSignForm() {
    const form = document.getElementById("sign-form");
    const nameInput = document.getElementById("sign-name");
    const companyInput = document.getElementById("sign-company");
    const submitBtn = document.getElementById("sign-submit");
    const executedCard = document.getElementById("executed-card");
    const executedName = document.getElementById("executed-name");
    const executedMeta = document.getElementById("executed-meta");
    const executedStamp = document.getElementById("executed-stamp");
    if (!form) return;

    nameInput.addEventListener("input", () => {
      submitBtn.disabled = nameInput.value.trim().length === 0;
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return;

      // NOTE: this is a prototype — wire this POST up to a real Django view
      // (see the view stub in views.py) once you're ready to persist signatures.

      const now = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      executedName.textContent = name;
      const company = companyInput.value.trim();
      executedMeta.textContent = `Executed: ${now}${company ? " · " + company : ""}`;

      form.style.display = "none";
      executedCard.classList.add("is-visible");

      executedStamp.classList.remove("is-visible");
      // restart the stamp animation
      void executedStamp.offsetWidth;
      setTimeout(() => executedStamp.classList.add("is-visible"), 100);
    });
  }
})();
