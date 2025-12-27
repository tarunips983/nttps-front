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



async function loadAIMemory() {
    const token = localStorage.getItem("adminToken");
    if (!token || !window.API) {
  console.warn("AI memory skipped: missing token or API");
  return;
}

    const res = await fetch(`${API}/ai/memory`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    aiMemory = res.ok ? await res.json() : [];
    aiMemoryLoaded = true; // ✅ ADD THIS LINE
}

const RECORD_COLUMNS = [
  "prNo",
  "prDate",
  "workName",
  "amount",
  "budgetHead",
  "poNo",
  "poDate",
  "firmName",
  "divisionLabel",
  "pageNo",
  "remarks",
  "status",
  "highValueSpares"
];

const ESTIMATE_COLUMNS = [
  "description",
  "divisionLabel",
  "prNo",
  "estimateNo",
  "tSpecNo",
  "firmContractor",
  "poNo",
  "grossAmount",
  "amount",
  "loaNo",
  "sapBillingDoc",
  "mbNo",
  "pageNo",
  "backCharging",
  "startDate"
];
const DAILY_COLUMNS = [
  "date",
  "divisionLabel",
  "subDivision",
  "activity",
  "manpower",
  "status",
  "remarks",
  "location"
];
const CL_COLUMNS = [
  "name",
  "gender",
  "aadhar",
  "doj",
  "wages",
  "nominee",
  "relation",
  "divisionLabel"
];
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
  return text.includes("\t") || /\s{2,}/.test(text);
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

function detectModuleSmart(text) {
    const lower = text.toLowerCase();

    let score = {
        cl: 0,
        daily: 0,
        records: 0,
        estimates: 0
    };

    // ---------- CL SCORING ----------
    if (/\b(male|female)\b/.test(lower)) score.cl += 2;
    if (/\b\d{12}\b/.test(text)) score.cl += 3;          // Aadhaar
    if (/\b\d{2}[./-]\d{2}[./-]\d{4}\b/.test(text)) score.cl += 2; // DOB
    if (/\b(mother|father|wife|husband)\b/.test(lower)) score.cl += 2;
    if (text.split(/\s+/).length > 8) score.cl += 1;     // tabular row

    // ---------- DAILY SCORING ----------
    if (/today|progress|completed|carried out|manpower/.test(lower)) score.daily += 3;

    // ---------- RECORDS / ESTIMATES ----------
    const numbers = text.match(/\b\d{10}\b/g) || [];
    numbers.forEach(n => {
        if (n.startsWith("10")) score.records += 4;
        if (n.startsWith("13") || n.startsWith("21")) score.estimates += 4;
    });

    // ---------- FINAL DECISION ----------
    return Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
}

function findLearnedMatch(text, module) {
    const normalize = s =>
        s.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);

    const inputKey = normalize(text);

    for (const row of aiMemory) {
        if (row.module !== module) continue;

        const memoryKey = normalize(row.raw_text);

        if (inputKey.startsWith(memoryKey) || memoryKey.startsWith(inputKey)) {
            return row.corrected;
        }
    }
    return null;
}


async function analyzeAI(passedText) {


 if (!aiMemoryLoaded) {
  await loadAIMemory();
}

  const text = (passedText || window.__LAST_AI_INPUT__ || "").trim();
if (!text) {
  addBotMessage("⚠️ No input text received.");
  return;
}


  aiTargetModule = detectModuleSmart(text);

  /* ======================================================
     1️⃣ TABULAR DATA → DIRECT COLUMN MAPPING (BEST)
     ====================================================== */
  if (isTabularPaste(text)) {
    if (aiTargetModule === "records")
      aiResult = parseTabularRow(text, RECORD_COLUMNS);

    else if (aiTargetModule === "estimates")
      aiResult = parseTabularRow(text, ESTIMATE_COLUMNS);

    else if (aiTargetModule === "daily")
      aiResult = parseTabularRow(text, DAILY_COLUMNS);

    else if (aiTargetModule === "cl")
      aiResult = parseTabularRow(text, CL_COLUMNS);
  }

  /* ======================================================
     2️⃣ EXISTING SUPABASE DATA MATCH
     ====================================================== */
  else {
    const dbMatch = await searchExistingData(aiTargetModule, text);
    if (dbMatch) {
      aiResult = dbMatch;
    } else {
      /* ==================================================
         3️⃣ AI LEARNING MEMORY
         ================================================== */
      const learned = findLearnedMatch(text, aiTargetModule);
      if (learned) {
        aiResult = learned;
      } else {
        /* ==============================================
           4️⃣ REGEX FALLBACK (LAST OPTION)
           ============================================== */
        aiResult = parseTextToData(text, aiTargetModule);
      }
    }
  }

  aiOriginalResult = JSON.parse(JSON.stringify(aiResult));

  const aiTargetEl = document.getElementById("aiTarget");
if (aiTargetEl) {
  aiTargetEl.innerHTML =
    `Detected Module: <b>${aiTargetModule.toUpperCase()}</b>`;
}


  renderAIPreview(aiTargetModule, aiResult);
  document.getElementById("aiSaveBtn").disabled = false;
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

    const keywords = text.split(/\s+/).slice(0, 6).join(" ");

    const res = await fetch(
        `${API}/ai/search/${module}?q=${encodeURIComponent(keywords)}`,
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


function renderAIPreview(module, data) {
  const preview = document.getElementById("aiPreview");

  let html = `<table class="ai-preview-table">`;

  Object.entries(data).forEach(([key, value]) => {
    html += `
      <tr>
        <th>${key}</th>
        <td contenteditable="true" data-key="${key}">
          ${value ?? ""}
        </td>
      </tr>
    `;
  });

  html += `</table>`;
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

  // expose core functions safely

// ================== GLOBAL API ==================
window.analyzeAI = analyzeAI;
window.saveAIData = saveAIData;
window.loadAIMemory = loadAIMemory;

console.log("✅ Smart Assistant Core loaded");


})();
