// ---- Element refs ----
const camera = document.getElementById("camera");
const doc = document.getElementById("doc");
const startScreen = document.getElementById("startScreen");
const makeBtn = document.getElementById("makeBtn");
const printBtn = document.getElementById("printBtn");
const printRow = document.getElementById("printRow");
const lockBadge = document.getElementById("lockBadge");
const docTitle = document.getElementById("docTitle");
const clause1 = document.getElementById("clause1");
const clause2 = document.getElementById("clause2");
const clause3 = document.getElementById("clause3");
const suggestionBox = document.getElementById("suggestionBox");
const suggestionText = document.getElementById("suggestionText");
const sigBlock = document.getElementById("sigBlock");
const sig1 = document.getElementById("sig1");
const sig2 = document.getElementById("sig2");
const you = document.getElementById("cursorYou");
const alex = document.getElementById("cursorAlex");

const VIEW_W = 320;
const VIEW_H = 560;

// ---- Helpers ----

// Type text into an element one character at a time
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

// Get an element's position relative to #camera (unscaled layout coordinates)
function posOf(el) {
  let x = 0, y = 0, node = el;
  while (node && node.id !== "camera") {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent;
  }
  return { x, y };
}

// Move a cursor to an absolute (x, y) point in camera space
function moveCursorTo(cursorEl, x, y, cb) {
  cursorEl.style.opacity = 1;
  cursorEl.style.top = y + "px";
  cursorEl.style.left = x + "px";
  if (cb) setTimeout(cb, 950);
}

// Move a cursor to a position near a target element, offset by (dx, dy)
function moveCursorNearEl(cursorEl, targetEl, dx, dy, cb) {
  const p = posOf(targetEl);
  moveCursorTo(cursorEl, p.x + dx, p.y + dy, cb);
}

// Zoom/pan the camera to a given scale and translate
function setCam(scale, x, y, cb) {
  camera.style.transform = `scale(${scale}) translate(${x}px, ${y}px)`;
  if (cb) setTimeout(cb, 1350);
}

// Zoom the camera so a target element is centered in the viewport
function focusOnEl(elOrId, scale, cb) {
  const el = typeof elOrId === "string" ? document.getElementById(elOrId) : elOrId;
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

// ---- Reset state for a fresh loop ----
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

  suggestionBox.style.display = "none";
  printRow.style.opacity = 0;
  lockBadge.style.display = "none";

  you.style.opacity = 0;
  alex.style.opacity = 0;

  setCam(1, 0, 0);

  // Force reflow so the transition removal above takes effect immediately
  void doc.offsetWidth;
  doc.style.transition = "transform .9s cubic-bezier(.5,0,.75,0), opacity .9s ease";
}

// ---- Main animation sequence ----
function runLoop() {
  resetStage();

  setTimeout(() => {
    startScreen.style.opacity = 1;

    moveCursorNearEl(you, makeBtn, -20, -6, () => {
      startScreen.style.opacity = 0;
      doc.style.opacity = 1;
      you.style.opacity = 0;

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
                                                printRow.style.opacity = 1;

                                                focusOnEl(printRow, 1.2, () => {
                                                  moveCursorNearEl(you, printBtn, 10, 10, () => {
                                                    setTimeout(() => {
                                                      you.style.opacity = 0;
                                                      alex.style.opacity = 0;
                                                      lockBadge.style.display = "flex";

                                                      focusFull(() => {
                                                        setTimeout(() => {
                                                          doc.style.transform = "translateY(-620px)";
                                                          doc.style.opacity = 0;
                                                          startScreen.style.opacity = 1;

                                                          moveCursorNearEl(you, makeBtn, -20, -6, () => {
                                                            setTimeout(runLoop, 500);
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

// ---- Start ----
runLoop();