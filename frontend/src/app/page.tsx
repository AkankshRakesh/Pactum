"use client";

import { useEffect, useState } from "react";

import styles from "./page.module.css";

const VIEW_W = 320;
const VIEW_H = 560;

export default function Home() {
  const [stageReady, setStageReady] = useState(false);

  useEffect(() => {
    const readyTimer = window.setTimeout(() => setStageReady(true), 50);
    return () => window.clearTimeout(readyTimer);
  }, []);

  useEffect(() => {
    const phases = [
      window.setTimeout(
        () => document.getElementById("splash")?.classList.add("is-phase-1"),
        200
      ),
      window.setTimeout(
        () => document.getElementById("splash")?.classList.add("is-phase-2"),
        700
      ),
      window.setTimeout(
        () => document.getElementById("splash")?.classList.add("is-phase-3"),
        1400
      ),
    ];

    return () => {
      phases.forEach(window.clearTimeout);
    };
  }, []);

  /*
   * Contract animation
   */
  useEffect(() => {
    const stage = document.getElementById("ca-stage");
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
    const viewport = document.getElementById("ca-viewport");

    if (
      !stage ||
      !camera ||
      !doc ||
      !startScreen ||
      !makeBtn ||
      !printBtn ||
      !printRow ||
      !lockBadge ||
      !docTitle ||
      !clause1 ||
      !clause2 ||
      !clause3 ||
      !suggestionBox ||
      !suggestionText ||
      !sigBlock ||
      !sig1 ||
      !sig2 ||
      !viewport
    ) {
      return;
    }

    // Rebind as non-null HTMLElement so TypeScript keeps the narrowing
    // inside the deeply nested closures below (flow analysis from the
    // guard above does not survive across nested function boundaries
    // for the original `const`s pulled from getElementById).
    const stageEl: HTMLElement = stage;
    const cameraEl: HTMLElement = camera;
    const docEl: HTMLElement = doc;
    const startScreenEl: HTMLElement = startScreen;
    const makeBtnEl: HTMLElement = makeBtn;
    const printBtnEl: HTMLElement = printBtn;
    const printRowEl: HTMLElement = printRow;
    const lockBadgeEl: HTMLElement = lockBadge;
    const docTitleEl: HTMLElement = docTitle;
    const clause1El: HTMLElement = clause1;
    const clause2El: HTMLElement = clause2;
    const clause3El: HTMLElement = clause3;
    const suggestionBoxEl: HTMLElement = suggestionBox;
    const suggestionTextEl: HTMLElement = suggestionText;
    const sigBlockEl: HTMLElement = sigBlock;
    const sig1El: HTMLElement = sig1;
    const sig2El: HTMLElement = sig2;
    const viewportEl: HTMLElement = viewport;

    let loopTimer: number | undefined;
    let cancelled = false;

    /*
     * -------------------------------------------------------------
     * Scale the fixed 320x560 stage to fill #ca-viewport.
     * -------------------------------------------------------------
     */
    function fitStage() {
      const availW = viewportEl.clientWidth;
      const availH = viewportEl.clientHeight;

      const scale = Math.max(
        0.1,
        Math.max(availW / VIEW_W, availH / VIEW_H)
      );

      stageEl.style.transform = `scale(${scale})`;
    }

    fitStage();

    window.addEventListener("resize", fitStage);
    window.addEventListener("load", fitStage);

    /*
     * -------------------------------------------------------------
     * Typing animation
     * -------------------------------------------------------------
     */
    function typeInto(
      el: HTMLElement,
      text: string,
      speed: number,
      cb?: () => void
    ) {
      el.textContent = "";

      let i = 0;

      const id = window.setInterval(() => {
        el.textContent += text[i];
        i++;

        if (i >= text.length) {
          window.clearInterval(id);

          if (cb) {
            cb();
          }
        }
      }, speed);
    }

    /*
     * -------------------------------------------------------------
     * Field highlight
     * -------------------------------------------------------------
     */
    function typeIntoHighlighted(
      el: HTMLElement,
      text: string,
      speed: number,
      actorClass: string,
      cb?: () => void
    ) {
      el.classList.add("ca-field-active", actorClass);

      typeInto(el, text, speed, () => {
        window.setTimeout(() => {
          el.classList.remove("ca-field-active", actorClass);

          if (cb) {
            cb();
          }
        }, 800);
      });
    }

    /*
     * -------------------------------------------------------------
     * Button press animation
     * -------------------------------------------------------------
     */
    function pressButton(btn: HTMLElement, cb?: () => void) {
      btn.classList.add("ca-btn-press");

      window.setTimeout(() => {
        btn.classList.remove("ca-btn-press");

        if (cb) {
          cb();
        }
      }, 220);
    }

    /*
     * -------------------------------------------------------------
     * Camera positioning
     * -------------------------------------------------------------
     */
    function posOf(el: HTMLElement) {
      let x = 0;
      let y = 0;
      let node: HTMLElement | null = el;

      while (node && node.id !== "ca-camera") {
        x += node.offsetLeft;
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }

      return { x, y };
    }

    function setCam(
      scale: number,
      x: number,
      y: number,
      cb?: () => void
    ) {
      cameraEl.style.transform = `scale(${scale}) translate(${x}px, ${y}px)`;

      if (cb) {
        window.setTimeout(cb, 1350);
      }
    }

    function focusOnEl(
      el: HTMLElement,
      scale: number,
      cb?: () => void
    ) {
      const p = posOf(el);

      const cx = p.x + el.offsetWidth / 2;
      const cy = p.y + el.offsetHeight / 2;

      const tx = VIEW_W / 2 / scale - cx;
      const ty = VIEW_H / 2 / scale - cy;

      setCam(scale, tx, ty, cb);
    }

    function focusFull(cb?: () => void) {
      setCam(1, 0, 0, cb);
    }

    /*
     * -------------------------------------------------------------
     * Reset animation
     * -------------------------------------------------------------
     */
    function resetStage() {
      docEl.style.transition = "none";
      docEl.style.transform = "translateY(0)";
      docEl.style.opacity = "0";

      startScreenEl.style.opacity = "0";
      startScreenEl.style.display = "flex";

      docTitleEl.textContent = "";
      clause1El.textContent = "";
      clause2El.textContent = "";
      clause3El.textContent = "";
      sig1El.textContent = "";
      sig2El.textContent = "";

      [
        docTitleEl,
        clause1El,
        clause2El,
        clause3El,
        sig1El,
        sig2El,
        suggestionBoxEl,
      ].forEach((el) => {
        el.classList.remove(
          "ca-field-active",
          "ca-actor-you",
          "ca-actor-alex"
        );
      });

      suggestionBoxEl.style.display = "none";
      printRowEl.style.opacity = "0";
      lockBadgeEl.style.display = "none";

      setCam(1, 0, 0);

      /*
       * Force reflow so removing the transition takes effect.
       */
      void docEl.offsetWidth;

      docEl.style.transition =
        "transform .9s cubic-bezier(.5,0,.75,0), opacity .9s ease";
    }

    /*
     * -------------------------------------------------------------
     * Main animation loop
     * -------------------------------------------------------------
     */
    function runLoop() {
      if (cancelled) return;

      resetStage();

      loopTimer = window.setTimeout(() => {
        if (cancelled) return;

        startScreenEl.style.opacity = "1";

        window.setTimeout(() => {
          if (cancelled) return;

          pressButton(makeBtnEl, () => {
            startScreenEl.style.opacity = "0";
            docEl.style.opacity = "1";

            focusOnEl(clause2El, 1.15, () => {
              typeIntoHighlighted(
                docTitleEl,
                "Service agreement",
                40,
                "ca-actor-you",
                () => {
                  typeIntoHighlighted(
                    clause1El,
                    "1. Scope: design and delivery of product.",
                    16,
                    "ca-actor-you",
                    () => {
                      typeIntoHighlighted(
                        clause2El,
                        "2. Payment: due within 30 days.",
                        16,
                        "ca-actor-you",
                        () => {
                          focusFull(() => {
                            suggestionBoxEl.style.display = "block";

                            focusOnEl(
                              suggestionBoxEl,
                              1.2,
                              () => {
                                typeIntoHighlighted(
                                  suggestionTextEl,
                                  "Suggestion: change to 15 days.",
                                  14,
                                  "ca-actor-alex",
                                  () => {
                                    window.setTimeout(() => {
                                      clause2El.textContent =
                                        "2. Payment: due within 15 days.";

                                      suggestionBoxEl.style.display = "none";

                                      focusOnEl(
                                        clause3El,
                                        1.15,
                                        () => {
                                          typeIntoHighlighted(
                                            clause3El,
                                            "3. Termination: 14 days notice.",
                                            16,
                                            "ca-actor-you",
                                            () => {
                                              focusOnEl(
                                                sigBlockEl,
                                                1.15,
                                                () => {
                                                  typeIntoHighlighted(
                                                    sig1El,
                                                    "Yabadabadoo",
                                                    55,
                                                    "ca-actor-you",
                                                    () => {
                                                      typeIntoHighlighted(
                                                        sig2El,
                                                        "Akanksh R.",
                                                        55,
                                                        "ca-actor-alex",
                                                        () => {
                                                          printRowEl.style.opacity =
                                                            "1";

                                                          focusOnEl(
                                                            printRowEl,
                                                            1.2,
                                                            () => {
                                                              pressButton(
                                                                printBtnEl,
                                                                () => {
                                                                  lockBadgeEl.style.display =
                                                                    "flex";

                                                                  focusFull(
                                                                    () => {
                                                                      window.setTimeout(
                                                                        () => {
                                                                          docEl.style.transform =
                                                                            "translateY(-620px)";
                                                                          docEl.style.opacity =
                                                                            "0";

                                                                          startScreenEl.style.opacity =
                                                                            "1";

                                                                          loopTimer =
                                                                            window.setTimeout(
                                                                              runLoop,
                                                                              900
                                                                            );
                                                                        },
                                                                        1200
                                                                      );
                                                                    }
                                                                  );
                                                                }
                                                              );
                                                            }
                                                          );
                                                        }
                                                      );
                                                    }
                                                  );
                                                }
                                              );
                                            }
                                          );
                                        }
                                      );
                                    }, 700);
                                  }
                                );
                              }
                            );
                          });
                        }
                      );
                    }
                  );
                }
              );
            });
          });
        }, 800);
      }, 500);
    }

    /*
     * -------------------------------------------------------------
     * Reduced motion
     * -------------------------------------------------------------
     */
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      docTitleEl.textContent = "Service agreement";
      clause1El.textContent =
        "1. Scope: design and delivery of product.";
      clause2El.textContent =
        "2. Payment: due within 15 days.";
      clause3El.textContent =
        "3. Termination: 14 days notice.";
      sig1El.textContent = "Yabadabadoo";
      sig2El.textContent = "Akanksh R.";

      docEl.style.opacity = "1";
      startScreenEl.style.opacity = "0";
      printRowEl.style.opacity = "1";
      lockBadgeEl.style.display = "flex";
    } else {
      runLoop();
    }

    /*
     * -------------------------------------------------------------
     * Cleanup when component unmounts
     * -------------------------------------------------------------
     */
    return () => {
      cancelled = true;

      if (loopTimer !== undefined) {
        window.clearTimeout(loopTimer);
      }

      window.removeEventListener("resize", fitStage);
      window.removeEventListener("load", fitStage);
    };
  }, []);

  return (
    <main>
      <div className={styles.docShell}>
        <section className={styles.splash} id="splash">
          <div className={styles.splashPanel}>
            <div className={styles.splashMeta}>
              Platform Service Agreement
              <br />
              Rev. 4.1 · Est. 2024
            </div>

            <div>
              <div className={styles.splashBrandLabel}>
                The Contract Platform
              </div>

              <h1 className={styles.splashBrandName}>PACTUM</h1>

              <div className={styles.splashBrandDivider} />

              <div className={styles.splashBrandPills}>
                {["Immutable", "Binding", "Final"].map((pill) => (
                  <span
                    className={styles.splashBrandPill}
                    key={pill}
                  >
                    {pill}
                  </span>
                ))}
              </div>

              <a href="/dashboard" className={styles.splashCta}>
                Get started →
              </a>
            </div>
          </div>

          <div
            id="ca-viewport"
            className={`${styles.splashStage} ${styles.caViewport} ${
              stageReady ? styles.splashReady : ""
            }`}
          >
            <div id="ca-stage" className={styles.caStage}>
              <div id="ca-camera" className={styles.caCamera}>
                <div id="ca-startScreen" className={styles.caStartScreen}>
                  <button
                    id="ca-makeBtn"
                    type="button"
                    className={styles.caMakeBtn}
                  >
                    <span>＋</span> Make contract
                  </button>
                </div>

                <div id="ca-doc" className={styles.caDoc}>
                  <div id="ca-docTitle" className={styles.caDocTitle}></div>

                  <div className={styles.caDivider}></div>

                  <div
                    id="ca-clause1"
                    className={styles.caClause}
                  ></div>

                  <div
                    id="ca-clause2"
                    className={styles.caClause}
                  ></div>

                  <div
                    id="ca-suggestionBox"
                    className={styles.caSuggestionBox}
                  >
                    <span id="ca-suggestionText"></span>
                  </div>

                  <div
                    id="ca-clause3"
                    className={styles.caClause}
                  ></div>

                  <div className={styles.caDivider}></div>

                  <div id="ca-sigBlock" className={styles.caSigBlock}>
                    <div>
                      <div className={styles.caSigLabel}>
                        Signed by You
                      </div>

                      <div
                        id="ca-sig1"
                        className={styles.caSigLine}
                      ></div>
                    </div>

                    <div>
                      <div className={styles.caSigLabel}>
                        Signed by Akanksh R.
                      </div>

                      <div
                        id="ca-sig2"
                        className={styles.caSigLine}
                      ></div>
                    </div>
                  </div>

                  <div id="ca-printRow" className={styles.caPrintRow}>
                    <button
                      id="ca-printBtn"
                      type="button"
                      className={styles.caPrintBtn}
                    >
                      Seal contract
                    </button>
                  </div>

                  <div id="ca-lockBadge" className={styles.caLockBadge}>
                    <span>✓ Contract sealed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}