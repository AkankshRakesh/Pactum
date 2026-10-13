(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const stage = document.getElementById("ca-stage");
    if (!stage) return; // partial not present on this page

    const camera = document.getElementById("ca-camera");
    const doc = document.getElementById("ca-doc");
    const startScreen = document.getElementById("ca-startScreen");
    const makeBtn = document.getElementById("ca-makeBtn");
    const printBtn = document.getElementById("ca-printBtn");
    const printRow = document.getElementById("ca-printRow");
    const lockBadge = document.getElementById("ca-lockBadge");
    const docTitle = document.getElementById("ca-docTitle");
    const clause1 = document.getElementById("ca-clause1");
    const clause2 = document.getElementById("ca-clause2");
    const clause3 = document.getElementById("ca-clause3");
    const suggestionBox = document.getElementById("ca-suggestionBox");
    const suggestionText = document.getElementById("ca-suggestionText");
    const sigBlock = document.getElementById("ca-sigBlock");
    const sig1 = document.getElementById("ca-sig1");
    const sig2 = document.getElementById("ca-sig2");

    const VIEW_W = 320;
    const VIEW_H = 560;

    /* -------------------------------------------------------------
     * Scale the fixed 320x560 stage to fill #ca-viewport, whatever
     * size that ends up being (e.g. the entire right half of the
     * splash section). The animation's internal coordinate math
     * (posOf/setCam) all operates in the untouched 320x560 space —
     * we only ever scale the outer element visually.
     * ------------------------------------------------------------- */
    const viewport = document.getElementById("ca-viewport");

    function fitStage() {
      if (!viewport) return;
      const availW = viewport.clientWidth;
      const availH = viewport.clientHeight;
      // Math.max => "cover": scale up until both axes are filled,
      // cropping whichever axis overflows. Swap to Math.min for
      // "contain" (letterboxed, nothing cropped) instead.
      const scale = Math.max(0.1, Math.max(availW / VIEW_W, availH / VIEW_H));
      stage.style.transform = `scale(${scale})`;
    }

    fitStage();
    window.addEventListener("resize", fitStage);
    window.addEventListener("load", fitStage);

    function typeInto(el, text, speed, cb) {
      el.textContent = "";
      let i = 0;
      const id = setInterval(() => {
        el.textContent += text[i];
        i++;
        if (i >= text.length) {
          clearInterval(id);
          if (cb) cb();
        }
      }, speed);
    }

    /* -------------------------------------------------------------
     * Field highlight — indicates who ("You" vs "Alex") is currently
     * filling a given field. Replaces the old cursor choreography:
     * add the actor's color class while typing, hold it briefly
     * after typing finishes so it registers, then clear it.
     * ------------------------------------------------------------- */
    function typeIntoHighlighted(el, text, speed, actorClass, cb) {
      el.classList.add("ca-field-active", actorClass);
      typeInto(el, text, speed, () => {
        setTimeout(() => {
          el.classList.remove("ca-field-active", actorClass);
          if (cb) cb();
        }, 800);
      });
    }

    /* Button-press micro-interaction, replacing the cursor "click". */
    function pressButton(btn, cb) {
      btn.classList.add("ca-btn-press");
      setTimeout(() => {
        btn.classList.remove("ca-btn-press");
        if (cb) cb();
      }, 220);
    }

    function posOf(el) {
      let x = 0, y = 0, node = el;
      while (node && node.id !== "ca-camera") {
        x += node.offsetLeft;
        y += node.offsetTop;
        node = node.offsetParent;
      }
      return { x, y };
    }

    function setCam(scale, x, y, cb) {
      camera.style.transform = `scale(${scale}) translate(${x}px, ${y}px)`;
      if (cb) setTimeout(cb, 1350);
    }

    function focusOnEl(el, scale, cb) {
      const p = posOf(el);
      const cx = p.x + el.offsetWidth / 2;
      const cy = p.y + el.offsetHeight / 2;
      const tx = (VIEW_W / 2) / scale - cx;
      const ty = (VIEW_H / 2) / scale - cy;
      setCam(scale, tx, ty, cb);
    }

    function focusFull(cb) {
      setCam(1, 0, 0, cb);
    }

    let loopTimer;
    let cancelled = false;

    function resetStage() {
      doc.style.transition = "none";
      doc.style.transform = "translateY(0)";
      doc.style.opacity = 0;

      startScreen.style.opacity = 0;
      startScreen.style.display = "flex";

      docTitle.textContent = "";
      clause1.textContent = "";
      clause2.textContent = "";
      clause3.textContent = "";
      sig1.textContent = "";
      sig2.textContent = "";

      [docTitle, clause1, clause2, clause3, sig1, sig2, suggestionBox].forEach((el) => {
        el.classList.remove("ca-field-active", "ca-actor-you", "ca-actor-alex");
      });

      suggestionBox.style.display = "none";
      printRow.style.opacity = 0;
      lockBadge.style.display = "none";

      setCam(1, 0, 0);

      void doc.offsetWidth; // force reflow so removing the transition takes effect
      doc.style.transition = "transform .9s cubic-bezier(.5,0,.75,0), opacity .9s ease";
    }

    function runLoop() {
      if (cancelled) return;
      resetStage();

      loopTimer = setTimeout(() => {
        if (cancelled) return;
        startScreen.style.opacity = 1;

        setTimeout(() => {
          if (cancelled) return;
          pressButton(makeBtn, () => {
            startScreen.style.opacity = 0;
            doc.style.opacity = 1;

            focusOnEl(clause2, 1.15, () => {
              typeIntoHighlighted(docTitle, "Service agreement", 40, "ca-actor-you", () => {
                typeIntoHighlighted(clause1, "1. Scope: design and delivery of product.", 16, "ca-actor-you", () => {
                  typeIntoHighlighted(clause2, "2. Payment: due within 30 days.", 16, "ca-actor-you", () => {
                    focusFull(() => {
                      suggestionBox.style.display = "block";
                      focusOnEl(suggestionBox, 1.2, () => {
                        typeIntoHighlighted(suggestionText, "Suggestion: change to 15 days.", 14, "ca-actor-alex", () => {
                          setTimeout(() => {
                            clause2.textContent = "2. Payment: due within 15 days.";
                            suggestionBox.style.display = "none";
                            focusOnEl(clause3, 1.15, () => {
                              typeIntoHighlighted(clause3, "3. Termination: 14 days notice.", 16, "ca-actor-you", () => {
                                focusOnEl(sigBlock, 1.15, () => {
                                  typeIntoHighlighted(sig1, "Yabadabadoo", 55, "ca-actor-you", () => {
                                    typeIntoHighlighted(sig2, "Akanksh R.", 55, "ca-actor-alex", () => {
                                      printRow.style.opacity = 1;
                                      focusOnEl(printRow, 1.2, () => {
                                        pressButton(printBtn, () => {
                                          lockBadge.style.display = "flex";
                                          focusFull(() => {
                                            setTimeout(() => {
                                              doc.style.transform = "translateY(-620px)";
                                              doc.style.opacity = 0;
                                              startScreen.style.opacity = 1;
                                              loopTimer = setTimeout(runLoop, 900);
                                            }, 1200);
                                          });
                                        });
                                      });
                                    });
                                  });
                                });
                              });
                            });
                          }, 700);
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        }, 800);
      }, 500);
    }

    // Respect reduced-motion preference: show the sealed end-state, skip looping.
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      docTitle.textContent = "Service agreement";
      clause1.textContent = "1. Scope: design and delivery of product.";
      clause2.textContent = "2. Payment: due within 15 days.";
      clause3.textContent = "3. Termination: 14 days notice.";
      sig1.textContent = "Yabadabadoo";
      sig2.textContent = "Akanksh R.";
      doc.style.opacity = 1;
      startScreen.style.opacity = 0;
      printRow.style.opacity = 1;
      lockBadge.style.display = "flex";
      return;
    }

    runLoop();

    window.addEventListener("beforeunload", () => {
      cancelled = true;
      clearTimeout(loopTimer);
      window.removeEventListener("resize", fitStage);
    });
  }
})();