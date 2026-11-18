/* ==========================================================
   QR Code Reader & Generator
   - Read a QR code from an uploaded image (jsQR)
   - Show / delete names, saved in localStorage
   - Create a QR code and download it (QRCode.js)
   ========================================================== */

// The key name used to save data in localStorage
const STORAGE_KEY = "qrScannedNames";

// ----- Get the HTML elements we need -----
const fileInput    = document.getElementById("file-input");
const preview      = document.getElementById("preview");
const workCanvas   = document.getElementById("work-canvas");
const message      = document.getElementById("message");
const cameraBtn     = document.getElementById("camera-btn");
const cameraBox     = document.getElementById("camera-box");
const cameraVideo   = document.getElementById("camera-video");
const cameraStopBtn = document.getElementById("camera-stop-btn");
const nameList     = document.getElementById("name-list");
const emptyMessage = document.getElementById("empty-message");

const textInput     = document.getElementById("text-input");
const generateBtn   = document.getElementById("generate-btn");
const createMessage = document.getElementById("create-message");
const qrResult      = document.getElementById("qr-result");
const qrCanvas      = document.getElementById("qr-canvas");
const qrTemp        = document.getElementById("qr-temp");
const downloadBtn   = document.getElementById("download-btn");

// The list of names. Each item looks like { id: 123, text: "Sakura" }
let names = loadNames();


/* ==========================================================
   3-4: Data storage (localStorage)
   ========================================================== */

// Load saved names. If nothing is saved (or the data is broken), return an empty list.
function loadNames() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const data = saved ? JSON.parse(saved) : [];
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Could not load saved names:", error);
    return [];
  }
}

// Save the current list. Called every time the list changes.
function saveNames() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
  } catch (error) {
    console.error("Could not save names:", error);
  }
}


/* ==========================================================
   3-2 / 3-3: Show names and delete names
   ========================================================== */

// Draw the whole list on the screen
function renderNames() {
  nameList.innerHTML = "";                       // clear the old list
  emptyMessage.hidden = names.length > 0;        // show "no names yet" when empty

  names.forEach(function (item) {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.className = "name-text";
    span.textContent = item.text;                // textContent is safe (no HTML injection)

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "削除";
    deleteButton.setAttribute("aria-label", item.text + " を削除 / Delete " + item.text);
    deleteButton.addEventListener("click", function () {
      deleteName(item.id);
    });

    li.appendChild(span);
    li.appendChild(deleteButton);
    nameList.appendChild(li);
  });
}

// Add a new name, save it, and redraw the list
function addName(text) {
  names.push({ id: Date.now() + Math.random(), text: text });
  saveNames();
  renderNames();
}

// Delete only the name with this id. Other names stay.
function deleteName(id) {
  names = names.filter(function (item) {
    return item.id !== id;
  });
  saveNames();      // update localStorage right away
  renderNames();
}


/* ==========================================================
   3-1: Read a QR code from an uploaded image
   ========================================================== */

// Show a message in the "read" card. type = "error" or "success"
function showMessage(text, type) {
  message.textContent = text;
  message.className = "message " + (type || "");
}

// Load an image file into an <img> element (returns a Promise)
function loadImage(file) {
  return new Promise(function (resolve, reject) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () { resolve({ img: img, url: url }); };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

// Try to decode a QR code from an image.
// We try a few sizes, because very large or very small images can be hard to read.
function decodeQR(img) {
  const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
  const maxSizes = [1000, 500, 1500];

  for (const maxSize of maxSizes) {
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    workCanvas.width  = Math.max(1, Math.round(img.naturalWidth * scale));
    workCanvas.height = Math.max(1, Math.round(img.naturalHeight * scale));

    // Fill white first, so transparent PNGs are read correctly
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, workCanvas.width, workCanvas.height);
    ctx.drawImage(img, 0, 0, workCanvas.width, workCanvas.height);

    const imageData = ctx.getImageData(0, 0, workCanvas.width, workCanvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth"
    });

    if (result && result.data.trim() !== "") {
      return result.data.trim();
    }
  }
  return null;   // no QR code found
}

// When the user selects image(s)
fileInput.addEventListener("change", async function () {
  const files = Array.from(fileInput.files);
  if (files.length === 0) return;

  stopCamera();   // turn the camera off if it is on

  // Make sure the QR library loaded (it needs internet)
  if (typeof jsQR === "undefined") {
    showMessage("QRライブラリを読み込めませんでした。インターネット接続を確認してください。 / Could not load the QR library. Check your internet connection.", "error");
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    // Only accept image files
    if (!file.type.startsWith("image/")) {
      failCount++;
      continue;
    }

    try {
      const loaded = await loadImage(file);
      preview.src = loaded.url;     // show the selected image
      preview.hidden = false;

      const text = decodeQR(loaded.img);
      if (text) {
        addName(text);              // appears in the list automatically
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      failCount++;
    }
  }

  // Show the result
  if (failCount > 0 && successCount === 0) {
    showMessage("QRコードを読み取れませんでした。別の画像を試してください。 / Could not read a QR code from this image. Please try another one.", "error");
  } else if (failCount > 0) {
    showMessage(successCount + "件を追加しました。" + failCount + "件は読み取れませんでした。 / Added " + successCount + ". " + failCount + " could not be read.", "error");
  } else {
    showMessage(successCount + "件の名前を追加しました！ / Added " + successCount + " name(s)!", "success");
  }

  fileInput.value = "";   // reset so the same file can be chosen again
});


/* ==========================================================
   3-1 (extra): Scan a QR code with the camera
   ========================================================== */

let cameraStream = null;   // the camera stream (null = camera is off)
let scanning = false;      // true while we are looking for a QR code

cameraBtn.addEventListener("click", startCamera);
cameraStopBtn.addEventListener("click", function () {
  stopCamera();
  showMessage("カメラを止めました。 / Camera stopped.", "");
});

async function startCamera() {
  if (typeof jsQR === "undefined") {
    showMessage("QRライブラリを読み込めませんでした。 / Could not load the QR library.", "error");
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMessage("このブラウザではカメラを使えません。画像を選んでください。 / Camera is not available here. Please choose an image instead.", "error");
    return;
  }

  try {
    // "environment" = back camera on phones (PCs use the webcam)
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    cameraVideo.srcObject = cameraStream;
    await cameraVideo.play();

    cameraBox.hidden = false;
    preview.hidden = true;
    showMessage("読み取り中… / Scanning...", "");

    scanning = true;
    requestAnimationFrame(scanFrame);
  } catch (error) {
    stopCamera();
    showMessage("カメラを開けませんでした。許可を確認してください。 / Could not open the camera. Please allow camera access.", "error");
  }
}

// Look at the current video frame. Repeats until a QR code is found.
function scanFrame() {
  if (!scanning) return;

  if (cameraVideo.readyState === cameraVideo.HAVE_ENOUGH_DATA && cameraVideo.videoWidth > 0) {
    const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
    workCanvas.width  = cameraVideo.videoWidth;
    workCanvas.height = cameraVideo.videoHeight;
    ctx.drawImage(cameraVideo, 0, 0, workCanvas.width, workCanvas.height);

    const imageData = ctx.getImageData(0, 0, workCanvas.width, workCanvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert"
    });

    if (result && result.data.trim() !== "") {
      addName(result.data.trim());   // appears in the list automatically
      stopCamera();                  // stop after one success (so it is not added many times)
      showMessage("読み取れました！「" + result.data.trim() + "」を追加しました。 / Scanned! Added to the list.", "success");
      return;
    }
  }
  requestAnimationFrame(scanFrame);
}

// Turn the camera off
function stopCamera() {
  scanning = false;
  if (cameraStream) {
    cameraStream.getTracks().forEach(function (track) { track.stop(); });
    cameraStream = null;
  }
  cameraVideo.srcObject = null;
  cameraBox.hidden = true;
}


/* ==========================================================
   3-5: Create a QR code and download it
   ========================================================== */

generateBtn.addEventListener("click", generateQR);
textInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") generateQR();
});

function generateQR() {
  const text = textInput.value.trim();

  if (text === "") {
    createMessage.textContent = "文字を入力してください。 / Please enter some text.";
    createMessage.className = "message error";
    qrResult.hidden = true;
    return;
  }

  if (typeof QRCode === "undefined") {
    createMessage.textContent = "QRライブラリを読み込めませんでした。 / Could not load the QR library.";
    createMessage.className = "message error";
    return;
  }

  // Let QRCode.js draw into a hidden box
  qrTemp.innerHTML = "";
  new QRCode(qrTemp, {
    text: text,
    width: 200,
    height: 200,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });

  // Copy it onto our visible canvas with a white border (the "quiet zone"),
  // which makes the QR code easier for phones to scan.
  const source = qrTemp.querySelector("canvas");
  const ctx = qrCanvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, qrCanvas.width, qrCanvas.height);
  ctx.drawImage(source, 20, 20, 200, 200);

  qrResult.hidden = false;
  createMessage.textContent = "QRコードを作りました！ / Your QR code is ready!";
  createMessage.className = "message success";
}

// Download the QR code as a PNG image
downloadBtn.addEventListener("click", function () {
  const link = document.createElement("a");
  link.href = qrCanvas.toDataURL("image/png");
  link.download = "qrcode.png";
  link.click();
});


/* ==========================================================
   Start: draw the saved names when the page opens
   ========================================================== */
renderNames();