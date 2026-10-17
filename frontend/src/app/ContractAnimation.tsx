import { useEffect, useRef } from "react";

export default function ContractAnimation() {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = stageRef.current;
    if (!root) return;

    const camera      = root.querySelector<HTMLElement>("#ca-camera")!;
    const doc         = root.querySelector<HTMLElement>("#ca-doc")!;
    const startScreen = root.querySelector<HTMLElement>("#ca-startScreen")!;
    const printRow    = root.querySelector<HTMLElement>("#ca-printRow")!;
    const lockBadge   = root.querySelector<HTMLElement>("#ca-lockBadge")!;
    const docTitle    = root.querySelector<HTMLElement>("#ca-docTitle")!;
    const clause1     = root.querySelector<HTMLElement>("#ca-clause1")!;
    const clause2     = root.querySelector<HTMLElement>("#ca-clause2")!;
    const clause3     = root.querySelector<HTMLElement>("#ca-clause3")!;
    const suggestionBox  = root.querySelector<HTMLElement>("#ca-suggestionBox")!;
    const suggestionText = root.querySelector<HTMLElement>("#ca-suggestionText")!;
    const sigBlock    = root.querySelector<HTMLElement>("#ca-sigBlock")!;
    const sig1        = root.querySelector<HTMLElement>("#ca-sig1")!;
    const sig2        = root.querySelector<HTMLElement>("#ca-sig2")!;
    const you         = root.querySelector<HTMLElement>("#ca-cursorYou")!;
    const alex        = root.querySelector<HTMLElement>("#ca-cursorAlex")!;

    const VIEW_W = 320, VIEW_H = 560;

    function typeInto(el: HTMLElement, text: string, speed: number, cb?: () => void) {
      el.textContent = "";
      let i = 0;
      const id = setInterval(() => {
        el.textContent += text[i++];
        if (i >= text.length) { clearInterval(id); cb?.(); }
      }, speed);
    }

    function posOf(el: HTMLElement) {
      let x = 0, y = 0, node: HTMLElement | null = el;
      while (node && node !== camera) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent as HTMLElement | null; }
      return { x, y };
    }

    function moveCursorTo(cur: HTMLElement, x: number, y: number, cb?: () => void) {
      cur.style.opacity = "1";
      cur.style.top = y + "px";
      cur.style.left = x + "px";
      if (cb) setTimeout(cb, 950);
    }

    function moveCursorNearEl(cur: HTMLElement, target: HTMLElement, dx: number, dy: number, cb?: () => void) {
      const p = posOf(target);
      moveCursorTo(cur, p.x + dx, p.y + dy, cb);
    }

    function setCam(scale: number, x: number, y: number, cb?: () => void) {
      camera.style.transform = `scale(${scale}) translate(${x}px, ${y}px)`;
      if (cb) setTimeout(cb, 1350);
    }

    function focusOnEl(el: HTMLElement, scale: number, cb?: () => void) {
      const p = posOf(el);
      const cx = p.x + el.offsetWidth / 2;
      const cy = p.y + el.offsetHeight / 2;
      setCam(scale, (VIEW_W / 2) / scale - cx, (VIEW_H / 2) / scale - cy, cb);
    }

    function focusFull(cb?: () => void) { setCam(1, 0, 0, cb); }

    let loopTimer: ReturnType<typeof setTimeout>;
    let cancelled = false;

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
      suggestionBox.style.display = "none";
      printRow.style.opacity = "0";
      lockBadge.style.display = "none";
      you.style.opacity = "0";
      alex.style.opacity = "0";
      setCam(1, 0, 0);
      void doc.offsetWidth;
      doc.style.transition = "transform .9s cubic-bezier(.5,0,.75,0), opacity .9s ease";
    }

    const makeBtn = root.querySelector<HTMLElement>("#ca-makeBtn")!;
    const printBtn = root.querySelector<HTMLElement>("#ca-printBtn")!;

    function runLoop() {
      if (cancelled) return;
      resetStage();
      loopTimer = setTimeout(() => {
        if (cancelled) return;
        startScreen.style.opacity = "1";
        moveCursorNearEl(you, makeBtn, -20, -6, () => {
          if (cancelled) return;
          startScreen.style.opacity = "0";
          doc.style.opacity = "1";
          you.style.opacity = "0";
          focusOnEl(clause2, 1.15, () => {
            moveCursorNearEl(you, docTitle, -18, 2, () => {
              typeInto(docTitle, "Service agreement", 40, () => {
                moveCursorNearEl(you, clause1, -18, 2, () => {
                  typeInto(clause1, "1. Scope: design and delivery of product.", 16, () => {
                    moveCursorNearEl(you, clause2, -18, 2, () => {
                      typeInto(clause2, "2. Payment: due within 30 days.", 16, () => {
                        focusFull(() => {
                          moveCursorNearEl(alex, doc, 260, 0, () => {
                            suggestionBox.style.display = "block";
                            focusOnEl(suggestionBox, 1.2, () => {
                              moveCursorNearEl(alex, suggestionBox, -14, 4, () => {
                                typeInto(suggestionText, "Suggest: change to 15 days.", 14, () => {
                                  setTimeout(() => {
                                    clause2.textContent = "2. Payment: due within 15 days.";
                                    suggestionBox.style.display = "none";
                                    focusOnEl(clause3, 1.15, () => {
                                      moveCursorNearEl(you, clause3, -18, 2, () => {
                                        typeInto(clause3, "3. Termination: 14 days notice.", 16, () => {
                                          focusOnEl(sigBlock, 1.15, () => {
                                            moveCursorNearEl(you, sig1, -16, 4, () => {
                                              typeInto(sig1, "Jordan R.", 55, () => {
                                                moveCursorNearEl(alex, sig2, -16, 4, () => {
                                                  typeInto(sig2, "Alex K.", 55, () => {
                                                    printRow.style.opacity = "1";
                                                    focusOnEl(printRow, 1.2, () => {
                                                      moveCursorNearEl(you, printBtn, 10, 10, () => {
                                                        setTimeout(() => {
                                                          you.style.opacity = "0";
                                                          alex.style.opacity = "0";
                                                          lockBadge.style.display = "flex";
                                                          focusFull(() => {
                                                            setTimeout(() => {
                                                              doc.style.transform = "translateY(-620px)";
                                                              doc.style.opacity = "0";
                                                              startScreen.style.opacity = "1";
                                                              moveCursorNearEl(you, makeBtn, -20, -6, () => {
                                                                loopTimer = setTimeout(runLoop, 500);
                                                              });
                                                            }, 1200);
                                                          });
                                                        }, 500);
                                                      });
                                                    });
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
                });
              });
            });
          });
        });
      }, 500);
    }

    runLoop();
    return () => { cancelled = true; clearTimeout(loopTimer); };
  }, []);

  return (
    <div
      ref={stageRef}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: "transparent",
      }}
    >
      <style>{`
        #ca-stage {
          position: relative;
          width: 320px;
          height: 560px;
          overflow: hidden;
          background: transparent !important;
          border-radius: 4px;
          border: none;
          box-shadow: none;
        }

        .dark #ca-stage {
          background: transparent !important;
          border-color: transparent;
        }
        #ca-camera {
          position: absolute; top: 0; left: 0;
          width: 320px; height: 560px;
          transform-origin: 0 0;
          transition: transform 1.3s cubic-bezier(.65,0,.35,1);
        }
        #ca-startScreen {
          position: absolute; top: 0; left: 0;
          width: 320px; height: 560px;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity .6s ease;
        }
        #ca-makeBtn {
          font-family: 'Courier Prime', monospace;
          font-size: 13px; padding: 10px 18px;
          border-radius: 0; border: 1px solid rgba(26,24,16,0.25);
          background: #fff; color: #1a1810; cursor: pointer;
          letter-spacing: 0.04em;
        }
        .dark #ca-makeBtn { background: #2a2620; color: #e8e0cc; border-color: rgba(232,224,204,0.2); }
        #ca-doc {
          position: absolute; top: 40px; left: 20px;
          width: 280px; min-height: 420px;
          background: #ffffff; border-radius: 0;
          border: 1px solid #e2e0d8; padding: 20px 22px;
          opacity: 0;
          transition: transform .9s cubic-bezier(.5,0,.75,0), opacity .9s ease;
        }
        .dark #ca-doc { background: #252018; border-color: rgba(232,224,204,0.12); }
        #ca-docTitle {
          font-family: 'Playfair Display', serif;
          font-size: 14px; font-weight: 700;
          color: #1a1810; min-height: 20px;
        }
        .dark #ca-docTitle { color: #e8e0cc; }
        .ca-divider { height: 1px; background: rgba(26,24,16,0.15); margin: 10px 0 14px; }
        .dark .ca-divider { background: rgba(232,224,204,0.12); }
        .ca-clause {
          font-family: 'Courier Prime', monospace;
          font-size: 11px; line-height: 1.7; color: #1a1810; min-height: 16px; margin-top: 8px;
        }
        .dark .ca-clause { color: #e8e0cc; }
        #ca-suggestionBox {
          margin-top: 10px; padding: 8px 10px;
          background: rgba(184,28,16,0.06);
          border: 1px solid rgba(184,28,16,0.3);
          font-size: 11px; color: #b81c10; display: none;
          font-family: 'Courier Prime', monospace;
        }
        #ca-sigBlock { display: flex; flex-direction: column; gap: 16px; }
        .ca-sigLabel {
          font-family: 'Courier Prime', monospace;
          font-size: 9px; color: #8a887f;
          margin-bottom: 4px; letter-spacing: 0.1em; text-transform: uppercase;
        }
        .ca-sigLine {
          height: 26px; border-bottom: 1px solid rgba(26,24,16,0.3);
          font-family: 'Playfair Display', serif; font-style: italic;
          font-size: 15px; color: #1a1810;
        }
        .dark .ca-sigLine { border-color: rgba(232,224,204,0.25); color: #e8e0cc; }
        #ca-printRow { margin-top: 22px; text-align: center; opacity: 0; transition: opacity 0.4s ease; }
        #ca-printBtn {
          font-family: 'Courier Prime', monospace; font-size: 12px;
          padding: 9px 20px; border-radius: 0;
          border: 1px solid rgba(26,24,16,0.3);
          background: #1a1810; color: #f4efe3; cursor: pointer;
          letter-spacing: 0.1em; text-transform: uppercase;
        }
        .dark #ca-printBtn { background: #e8e0cc; color: #1a1810; }
        #ca-lockBadge {
          margin-top: 14px; display: none; align-items: center;
          justify-content: center; gap: 6px;
          font-family: 'Courier Prime', monospace;
          font-size: 11px; color: #2f7d4f; letter-spacing: 0.08em;
        }
        .ca-cursor {
          position: absolute; top: 0; left: 0; opacity: 0;
          transition: top .9s ease, left .9s ease, opacity .4s ease;
          z-index: 5; display: flex; align-items: center;
        }
        .ca-pointer { font-size: 14px; transform: rotate(-45deg); display: inline-block; }
        #ca-cursorYou .ca-pointer { color: #378ADD; }
        #ca-cursorAlex .ca-pointer { color: #b81c10; }
      `}</style>

      <div id="ca-stage">
        <div id="ca-camera">
          <div id="ca-startScreen">
            <button id="ca-makeBtn"><span>＋</span> Make contract</button>
          </div>

          <div id="ca-doc">
            <div id="ca-docTitle" />
            <div className="ca-divider" />
            <div id="ca-clause1" className="ca-clause" />
            <div id="ca-clause2" className="ca-clause" />
            <div id="ca-suggestionBox">
              <span id="ca-suggestionText" />
            </div>
            <div id="ca-clause3" className="ca-clause" />
            <div className="ca-divider" style={{ marginTop: 20 }} />
            <div id="ca-sigBlock">
              <div>
                <div className="ca-sigLabel">Signed by You</div>
                <div id="ca-sig1" className="ca-sigLine" />
              </div>
              <div>
                <div className="ca-sigLabel">Signed by Alex</div>
                <div id="ca-sig2" className="ca-sigLine" />
              </div>
            </div>
            <div id="ca-printRow">
              <button id="ca-printBtn">Seal contract</button>
            </div>
            <div id="ca-lockBadge">
              <span>✓ Contract sealed</span>
            </div>
          </div>

          <div id="ca-cursorYou" className="ca-cursor"><span className="ca-pointer">➤</span></div>
          <div id="ca-cursorAlex" className="ca-cursor"><span className="ca-pointer">➤</span></div>
        </div>
      </div>
    </div>
  );
}
