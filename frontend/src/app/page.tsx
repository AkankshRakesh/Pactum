"use client";

import { useEffect, useState } from "react";

import styles from "./page.module.css";

const VIEW_W = 320;
const VIEW_H = 560;

export default function Home() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const themeTimer = window.setTimeout(() => {
      setDark(window.localStorage.getItem("pactum-theme") === "dark");
    }, 0);

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
      window.clearTimeout(themeTimer);
      phases.forEach(window.clearTimeout);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    window.localStorage.setItem("pactum-theme", dark ? "dark" : "light");
  }, [dark]);

  /*
   * Contract animation
   */
  useEffect(() => {
    const stage = document.getElementById("ca-stage");

    if (!stage) return;

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

    if (
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
      !sig2
    ) {
      return;
    }

    const viewport = document.getElementById("ca-viewport");

    let loopTimer: number | undefined;
    let cancelled = false;

    /*
     * -------------------------------------------------------------
     * Scale the fixed 320x560 stage to fill #ca-viewport.
     * -------------------------------------------------------------
     */
    function fitStage() {
      if (!viewport) return;

      const availW = viewport.clientWidth;
      const availH = viewport.clientHeight;

      const scale = Math.max(
        0.1,
        Math.max(availW / VIEW_W, availH / VIEW_H)
      );

      stage.style.transform = `scale(${scale})`;
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
      camera.style.transform = `scale(${scale}) translate(${x}px, ${y}px)`;

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
      doc.style.transition = "none";
      doc.style.transform = "translateY(0)";
      doc.style.opacity = "0";

      startScreen.style.opacity = "0";
      startScreen.style.display = "flex";

      docTitle.textContent = "";
      clause1.textContent = "";
      clause2.textContent = "";
      clause3.textContent = "";
      sig1.textContent = "";
      sig2.textContent = "";

      [
        docTitle,
        clause1,
        clause2,
        clause3,
        sig1,
        sig2,
        suggestionBox,
      ].forEach((el) => {
        el.classList.remove(
          "ca-field-active",
          "ca-actor-you",
          "ca-actor-alex"
        );
      });

      suggestionBox.style.display = "none";
      printRow.style.opacity = "0";
      lockBadge.style.display = "none";

      setCam(1, 0, 0);

      /*
       * Force reflow so removing the transition takes effect.
       */
      void doc.offsetWidth;

      doc.style.transition =
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

        startScreen.style.opacity = "1";

        window.setTimeout(() => {
          if (cancelled) return;

          pressButton(makeBtn, () => {
            startScreen.style.opacity = "0";
            doc.style.opacity = "1";

            focusOnEl(clause2, 1.15, () => {
              typeIntoHighlighted(
                docTitle,
                "Service agreement",
                40,
                "ca-actor-you",
                () => {
                  typeIntoHighlighted(
                    clause1,
                    "1. Scope: design and delivery of product.",
                    16,
                    "ca-actor-you",
                    () => {
                      typeIntoHighlighted(
                        clause2,
                        "2. Payment: due within 30 days.",
                        16,
                        "ca-actor-you",
                        () => {
                          focusFull(() => {
                            suggestionBox.style.display = "block";

                            focusOnEl(
                              suggestionBox,
                              1.2,
                              () => {
                                typeIntoHighlighted(
                                  suggestionText,
                                  "Suggestion: change to 15 days.",
                                  14,
                                  "ca-actor-alex",
                                  () => {
                                    window.setTimeout(() => {
                                      clause2.textContent =
                                        "2. Payment: due within 15 days.";

                                      suggestionBox.style.display = "none";

                                      focusOnEl(
                                        clause3,
                                        1.15,
                                        () => {
                                          typeIntoHighlighted(
                                            clause3,
                                            "3. Termination: 14 days notice.",
                                            16,
                                            "ca-actor-you",
                                            () => {
                                              focusOnEl(
                                                sigBlock,
                                                1.15,
                                                () => {
                                                  typeIntoHighlighted(
                                                    sig1,
                                                    "Yabadabadoo",
                                                    55,
                                                    "ca-actor-you",
                                                    () => {
                                                      typeIntoHighlighted(
                                                        sig2,
                                                        "Akanksh R.",
                                                        55,
                                                        "ca-actor-alex",
                                                        () => {
                                                          printRow.style.opacity =
                                                            "1";

                                                          focusOnEl(
                                                            printRow,
                                                            1.2,
                                                            () => {
                                                              pressButton(
                                                                printBtn,
                                                                () => {
                                                                  lockBadge.style.display =
                                                                    "flex";

                                                                  focusFull(
                                                                    () => {
                                                                      window.setTimeout(
                                                                        () => {
                                                                          doc.style.transform =
                                                                            "translateY(-620px)";
                                                                          doc.style.opacity =
                                                                            "0";

                                                                          startScreen.style.opacity =
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
      docTitle.textContent = "Service agreement";
      clause1.textContent =
        "1. Scope: design and delivery of product.";
      clause2.textContent =
        "2. Payment: due within 15 days.";
      clause3.textContent =
        "3. Termination: 14 days notice.";
      sig1.textContent = "Yabadabadoo";
      sig2.textContent = "Akanksh R.";

      doc.style.opacity = "1";
      startScreen.style.opacity = "0";
      printRow.style.opacity = "1";
      lockBadge.style.display = "flex";
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
      <button
        className={styles.modeToggle}
        onClick={() => setDark((current) => !current)}
        title={dark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {dark ? "☀" : "☾"}
      </button>

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

              <a href="#contract" className={styles.splashCta}>
                Get started →
              </a>
            </div>
          </div>

          <div id="ca-viewport">
            <div id="ca-stage">
              <div id="ca-camera">
                <div id="ca-startScreen">
                  <button id="ca-makeBtn" type="button">
                    <span>＋</span> Make contract
                  </button>
                </div>

                <div id="ca-doc">
                  <div id="ca-docTitle"></div>

                  <div className="ca-divider"></div>

                  <div
                    id="ca-clause1"
                    className="ca-clause"
                  ></div>

                  <div
                    id="ca-clause2"
                    className="ca-clause"
                  ></div>

                  <div id="ca-suggestionBox">
                    <span id="ca-suggestionText"></span>
                  </div>

                  <div
                    id="ca-clause3"
                    className="ca-clause"
                  ></div>

                  <div className="ca-divider"></div>

                  <div id="ca-sigBlock">
                    <div>
                      <div className="ca-sigLabel">
                        Signed by You
                      </div>

                      <div
                        id="ca-sig1"
                        className="ca-sigLine"
                      ></div>
                    </div>

                    <div>
                      <div className="ca-sigLabel">
                        Signed by Akanksh R.
                      </div>

                      <div
                        id="ca-sig2"
                        className="ca-sigLine"
                      ></div>
                    </div>
                  </div>

                  <div id="ca-printRow">
                    <button id="ca-printBtn" type="button">
                      Seal contract
                    </button>
                  </div>

                  <div id="ca-lockBadge">
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