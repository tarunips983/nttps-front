if (!window.API) {
  window.API = "https://nttps-backend.onrender.com";
}

(function () {

  if (window.__SMART_AI_LOADED__) return;
  window.__SMART_AI_LOADED__ = true;

  const API = window.API || window.SERVER_URL;

let aiMemory = [];
let aiMemoryLoaded = false;
window.__LAST_AI_INPUT__ = "";
let aiOriginalResult = null;
let AI_MODE = "CHAT"; // CHAT | EDIT
  
function detectEditIntent(text) {
  return /add|save|create|insert|update|edit/i.test(text);
}

  function getAIInputElement() {
  return document.getElementById("aiInput");
}
  
function getAIMessagesElement() {
  return document.getElementById("aiMessages");
  
}



function renderAIData(table, rows) {
  rows.forEach(row => {
    switch (table) {
      case "records":
        addBotMessage(formatRecordRow(row));
        break;

      case "estimates":
        addBotMessage(formatEstimateRow(row));
        break;

      case "daily_progress":
        addBotMessage(formatDailyRow(row));
        break;

      case "cl_biodata":
        addBotMessage(formatCLRow(row));
        break;

      case "pending_users":
        addBotMessage(formatPendingUserRow(row));
        break;

      default:
        addBotMessage(`<pre>${JSON.stringify(row, null, 2)}</pre>`);
    }
  });
}

  function renderObject(obj) {
  let html = `<table style="width:100%;border-collapse:collapse">`;

  for (const key in obj) {
    html += `
      <tr>
        <th style="border:1px solid #ccc;padding:6px;background:#f5f5f5;text-align:left">
          ${key}
        </th>
        <td style="border:1px solid #ccc;padding:6px">
          ${obj[key] ?? ""}
        </td>
      </tr>`;
  }

  html += "</table>";
  return html;
}

  
async function handleAskAI() {
  const input = getAIInputElement();
  if (!input) {
    console.error("AI input not found");
    return;
  }

  const question = input.value.trim();
  if (!question) return;

  // ✅ ENTER CHAT MODE
  if (typeof window.enterChatMode === "function") {
    window.enterChatMode();
  }

  // ✅ SHOW USER MESSAGE
  if (typeof window.addUserMessage === "function") {
    window.addUserMessage(question);
    saveChatMessage("user", question);
  }

  input.value = "";
  window.__LAST_AI_INPUT__ = question;

  const token = localStorage.getItem("adminToken");
  if (!token) {
    if (typeof window.addBotMessage === "function") {
      window.addBotMessage("🔒 Please login to chat with Smart Assistant.");
    }
    return;
  }

  try {
    await analyzeAI(question);
  } catch (err) {
    console.error(err);
    if (typeof window.addBotMessage === "function") {
      window.addBotMessage("❌ Error while processing your request.");
    }
  }
}

async function analyzeAI(text) {
  showTyping();

  const token = localStorage.getItem("adminToken");
  if (!token) {
    hideTyping();
    addBotMessage("🔒 Please login to use Smart Assistant.");
    return;
  }

  try {
    const res = await fetch(`${API}/ai/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });

    const result = await res.json();
    hideTyping();

    /*
      Expected backend response format:
      {
        reply: string,
        table?: string,
        columns?: string[],
        data?: array
      }
    */

    if (result.reply) {
      addBotMessage(result.reply);
    }

    if (result.data && result.columns) {
      renderAIResult(result.columns, result.data);
    }

  } catch (err) {
    hideTyping();
    console.error(err);
    addBotMessage("❌ AI service error. Please try again.");
  }
}

  function renderAIResult(columns, rows) {
  if (!rows || !rows.length) {
    addBotMessage("No data found.");
    return;
  }

  // 🔹 Single value → natural reply
  if (columns.length === 1) {
    const col = columns[0];
    addBotMessage(`<b>${col.replace(/_/g, " ")}:</b> ${rows[0][col] ?? "N/A"}`);
    return;
  }

  // 🔹 Multiple columns → table
  let html = `<table style="width:100%;border-collapse:collapse">`;

  html += "<tr>";
  columns.forEach(c => {
    html += `<th style="border:1px solid #ccc;padding:6px">${c}</th>`;
  });
  html += "</tr>";

  rows.forEach(row => {
    html += "<tr>";
    columns.forEach(c => {
      html += `<td style="border:1px solid #ccc;padding:6px">${row[c] ?? ""}</td>`;
    });
    html += "</tr>";
  });

  html += "</table>";
  addBotMessage(html);
}



async function loadAIMemory() {
  // 🔒 Disable memory – real AI will query DB live
  aiMemory = [];
  aiMemoryLoaded = true;
}


function parseTabularRow(text, columns) {
  const cells = text
    .replace(/\r?\n/g, "")
    .split("\t")
    .map(v => v.trim());

  const result = {};
  columns.forEach((col, i) => {
    result[col] = cells[i] || "";
  });

  return result;
}
  
function isTabularPaste(text) {
  // Only treat as tabular if it is ACTUALLY tab-separated
  const tabCount = (text.match(/\t/g) || []).length;

  // At least 3 tabs = real table row
  if (tabCount >= 3) return true;

  return false;
}



        
function detectNumberSeries(text) {
    const numbers = text.match(/\b\d{10}\b/g) || [];

    let prNo = "";
    let estimateNo = "";

    numbers.forEach(n => {
        if (n.startsWith("10")) prNo = n;
        if (n.startsWith("13")) estimateNo = n;
    });

    return { prNo, estimateNo };
}
const DIVISION_KEYWORDS = {
    "TM&CAM": [
        "hydraulic", "cylinder", "actuator", "servo",
        "lubricant", "oil", "pump", "valve", "seal",
        "bearing", "gear", "mechanical"
    ],
    "EM": [
        "motor", "transformer", "breaker", "relay",
        "electrical", "panel", "cable", "switchgear"
    ],
    "C&I": [
        "plc", "dcs", "sensor", "transmitter",
        "control", "instrument", "automation"
    ],
    "MM": [
        "dispatch", "stores", "indent", "purchase",
        "vendor", "supply"
    ]
};
function detectDivision(text) {
    if (/tm&cam/i.test(text)) return "TM&CAM";
    if (/stage[-\s]?v/i.test(text)) return "Stage-V";
    if (/sd[-\s]?iv/i.test(text)) return "SD-IV";
    return "";
}

function cleanWorkName(text) {
    return text
        .replace(/pr\s*no\s*\d+/i, "")
        .replace(/\b\d{10}\b/g, "")
        .replace(/[-–]/g, "")
        .trim();
}


        
let aiResult = null;
let aiTargetModule = "records"; // default



function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function showTyping() {
  const t = document.getElementById("aiTyping");
  if (t) t.style.display = "block";
}

function hideTyping() {
  const t = document.getElementById("aiTyping");
  if (t) t.style.display = "none";
}

  
function findLearnedMatch(text, module) {
    const normalize = s =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 50); // slightly longer improves recall

    const inputKey = normalize(text);

    // simple fuzzy similarity (deterministic, fast)
    function similarity(a, b) {
        let matches = 0;
        const len = Math.min(a.length, b.length);

        for (let i = 0; i < len; i++) {
            if (a[i] === b[i]) matches++;
        }
        return matches / Math.max(a.length, b.length);
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const row of aiMemory) {
        if (row.module !== module) continue;

        const memoryKey = normalize(row.raw_text);
        if (!memoryKey) continue;

        const score = similarity(inputKey, memoryKey);

        // 🔑 threshold controls "smartness"
        if (score > 0.65 && score > bestScore) {
            bestScore = score;
            bestMatch = row.corrected;
        }
    }

    return bestMatch;
}





function cleanDailyActivity(text) {
    return text
        // remove date
        .replace(/\b\d{2}[-/]\d{2}[-/]\d{4}\b/g, "")
        // remove keywords
        .replace(/daily work progress\.?/gi, "")
        .replace(/today\.?/gi, "")
        // remove manpower line
        .replace(/manpower\s*[:\-].*/gi, "")
        // clean extra spaces / lines
        .replace(/\n+/g, " ")
        .trim();
}

function detectNameFromText(text) {
    // Match patterns like: M. raju, M Raju, Raju Kumar
    const m = text.match(/\b([A-Z]\.\s*[A-Za-z]+|[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/);
    return m ? m[0].trim() : "";
}


function detectDOJFromText(text) {
    // Year only (2016)
    const y = text.match(/\b(19\d{2}|20\d{2})\b/);
    if (y) return y[1];

    // Full date
    const d = text.match(/\b\d{2}[./-]\d{2}[./-]\d{4}\b/);
    if (d) return d[0];

    return "";
}


function detectWagesFromText(text) {
    const m1 = text.match(/paid\s*(\d+)/i);
    if (m1) return m1[1];

    const m2 = text.match(/(\d+)\s*(per\s*day|daily)/i);
    if (m2) return m2[1];

    return "";
}

function detectAadharFromText(text) {
    const m = text.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
    return m ? m[0].replace(/\s/g, "") : "";
}

        

async function searchExistingData(module, text) {
    const token = localStorage.getItem("adminToken");
    if (!token) return null;

    const isPR = /^\d{10}$/.test(text.trim());

const query = isPR
  ? `prNo:${text.trim()}`
  : text.split(/\s+/).slice(0, 6).join(" ");


    const res = await fetch(
  `${API}/ai/search/${module}?q=${encodeURIComponent(query)}`,
  { headers: { Authorization: `Bearer ${token}` } }
);


    if (!res.ok) return null;

    const results = await res.json();
    return results.length ? results[0] : null;
}


function parseTextToData(text, target) {

    const get = (r) => {
        const m = text.match(r);
        if (!m) return "";
        if (typeof m[1] === "string") return m[1].trim();
        return m[0]?.trim() || "";
    };

    const numbers = text.match(/\b\d{10}\b/g) || [];
    const prNo = numbers.find(n => n.startsWith("10")) || "";
    const estimateNo = numbers.find(n => n.startsWith("13") || n.startsWith("21")) || "";

    if (target === "records") {
        return {
            prNo,
            workName: cleanWorkName(text),
            divisionLabel: detectDivision(text),
            sendTo: /ce\s*o&m/i.test(text) ? "CE O&M" : "",
            recordType: "PR"
        };
    }

    if (target === "estimates") {
        return {
            estimateNo,
            description: cleanWorkName(text),
            divisionLabel: detectDivision(text)
        };
    }

    if (target === "daily") {
        return {
            date: get(/\b(\d{2}[-/]\d{2}[-/]\d{4})\b/) || new Date().toISOString().slice(0, 10),
            activity: cleanDailyActivity(text),
            manpower: get(/manpower\s*[:\-]\s*(.+)/i),
            divisionLabel: detectDivision(text),
            status: /completed|done/i.test(text) ? "Completed" : "In Progress"
        };
    }

    if (target === "cl") {
        return {
            name: detectNameFromText(text),
            gender: /\bmale\b/i.test(text) ? "Male" :
                    /\bfemale\b/i.test(text) ? "Female" : "",
            aadhar: detectAadharFromText(text),
            doj: detectDOJFromText(text),
            wages: detectWagesFromText(text),
            nominee: get(/\b([A-Z]\.\s*[A-Za-z]+)\s+(Mother|Father|Wife|Husband)/i),
            divisionLabel: detectDivision(text)
        };
    }

    return {};
}
function looksLikeTableRow(text) {
    const numberCount = (text.match(/\d+/g) || []).length;
    const hasMultipleSpaces = /\s{2,}/.test(text);
    const hasKnownMarkers = /MB\s*No|Pg|D\.No|WE\s*No|PO\s*No/i.test(text);

    return numberCount >= 4 && hasMultipleSpaces && hasKnownMarkers;
}
function parseEstimateTableRow(text) {
    return {
        estimateNo: (text.match(/\b(13|21)\d{8}\b/) || [""])[0],
        divisionLabel: (text.match(/TM&CAM|EM\s*&\s*MRT|I&C|C&I/i) || [""])[0],
        poNo: (text.match(/\b52\d{8}\b/) || [""])[0],
        description: text
            .replace(/\b(13|21)\d{8}\b/g, "")
            .replace(/\b52\d{8}\b/g, "")
            .replace(/D\.No.*$/i, "")
            .trim(),
        dNo: (text.match(/D\.No[:\s]*([\d/]+)/i) || ["",""])[1],
        date: (text.match(/\b\d{2}-\d{2}-\d{4}\b/) || [""])[0],
        mbNo: (text.match(/MB\s*No[-:\s]*(\d+)/i) || ["",""])[1],
        pageNo: (text.match(/Pg[-:\s]*(\d+)/i) || ["",""])[1]
    };
}


function renderAIPreview(target, data) {
  const preview = document.getElementById("aiPreview");
  if (!preview) return;

  let html = `
    <div style="overflow-x:auto">
      <table style="border-collapse:collapse;width:100%;background:#fff">
  `;

  Object.keys(data).forEach(k => {
    html += `
      <tr>
        <th style="
          text-align:left;
          padding:6px;
          border:1px solid #ddd;
          width:220px;
          background:#f5f7fa
        ">
          ${k}
        </th>
        <td
          contenteditable="true"
          data-key="${k}"
          style="
            padding:6px;
            border:1px solid #ddd;
            background:#fffbe6;
          "
        >
          ${data[k] ?? ""}
        </td>
      </tr>`;
  });

  html += "</table></div>";

  preview.innerHTML = html;
}




async function saveAIData() {

    const token = localStorage.getItem("adminToken");
    if (!token) {
        showToast("Session expired. Login again.", true);
        return;
    }
// ✅ Capture edited preview values BEFORE saving
document.querySelectorAll("#aiPreview td[data-key]").forEach(td => {
    const key = td.dataset.key;
    aiResult[key] = td.innerText.trim();
});


    let url = "";
    let payload = {};

    switch (aiTargetModule) {

        case "records":
            url = `${API}/upload`;
            payload = {
                prNo: aiResult.prNo,
                workName: aiResult.workName,
                divisionLabel: aiResult.divisionLabel,
                sendTo: aiResult.sendTo || "",
                recordType: "PR"
            };
            break;

        case "estimates":
            url = `${API}/estimates`;
            payload = {
                estimateNo: aiResult.estimateNo,
                description: aiResult.description,
                division: aiResult.divisionLabel
            };
            break;

        case "daily":
            url = `${API}/daily-progress`;
            payload = {
                date: normalizeDate(aiResult.date),
                tableHTML: `
                    <tr>
                        <td>${normalizeDate(aiResult.date)}</td>
                        <td>${aiResult.divisionLabel || ""}</td>
                        <td></td>
                        <td>${aiResult.activity}</td>
                        <td>${aiResult.manpower || ""}</td>
                        <td>${aiResult.status}</td>
                        <td></td>
                        <td></td>
                    </tr>
                `,
                rowCount: 1
            };
            break;

        case "cl": {
            url = `${API}/cl`;
            const fd = new FormData();
            Object.entries(aiResult).forEach(([k, v]) =>
                fd.append(k, v || "")
            );

            const res = await fetch(url, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: fd
            });

            if (!res.ok) {
                showToast("CL save failed", true);
                return;
            }

            showToast("Saved to CL BIO DATA ✔");
            loadCLData();
            document.getElementById("aiSaveBtn").disabled = true;

            // ✅ LEARN ONLY AFTER SUCCESS
            await learnAI();

            return;
        }
    }

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const err = await res.json();
        showToast(err.error || "Save failed", true);
        return;
    }

    showToast(`Saved to ${aiTargetModule.toUpperCase()} successfully ✔`);

    if (aiTargetModule === "records") loadRecords();
    if (aiTargetModule === "estimates") loadEstimateList();
    if (aiTargetModule === "daily") loadSavedProgress();
  
const saveBtn = document.getElementById("aiSaveBtn");
if (saveBtn) {
  saveBtn.style.display = "none";
}

  
    document.getElementById("aiSaveBtn").disabled = true;

    // ✅ LEARN ONLY AFTER SUCCESS
    await learnAI();

}

async function learnAI() {
    const token = localStorage.getItem("adminToken");
    if (!token) return;

    try {
        await fetch(`${API}/ai/learn`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                rawText: __LAST_AI_INPUT__,
                module: aiTargetModule,
                extracted: aiOriginalResult,
                corrected: aiResult
            })
        });
    } catch (err) {
        console.warn("AI learning skipped:", err.message);
    }
}

        
function normalizeDate(dateStr) {
    if (!dateStr) return "";

    // DD-MM-YYYY → DD/MM/YYYY
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
        return dateStr.replace(/-/g, "/");
    }

    // YYYY-MM-DD → DD/MM/YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split("-");
        return `${d}/${m}/${y}`;
    }

    return dateStr;
}
// expose to window (GLOBAL)
const CHAT_KEY = "smartChatHistory";



  
function saveChatMessage(role, text) {
  const history = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
  history.push({ role, text, time: Date.now() });
  localStorage.setItem(CHAT_KEY, JSON.stringify(history));
}

function loadChatHistory() {
  return JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
}

function clearChatHistory() {
  localStorage.removeItem(CHAT_KEY);
}

function safeAddMessage(text, role = "bot") {
  if (role === "user") {
    if (window.addUserMessage) window.addUserMessage(text);
  } else {
    if (window.addBotMessage) window.addBotMessage(text);
  }
}

 

  // expose core functions safely

// ================== GLOBAL API ==================

window.analyzeAI = analyzeAI;
window.saveAIData = saveAIData;
window.loadAIMemory = loadAIMemory;

window.saveChatMessage = saveChatMessage;
window.loadChatHistory = loadChatHistory;
// 🔥 expose UI helpers to CORE


// 🔥 ADD THIS LINE
window.handleAskAI = handleAskAI;

console.log("✅ Smart Assistant Core loaded");

})();

