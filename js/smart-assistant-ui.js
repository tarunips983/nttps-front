window.analyzeAI = async function () {
  const text = document.getElementById("aiInput").value.trim();
  if (!text) return alert("Enter text");

  const res = await fetch(`${SERVER_URL}/ai/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  const data = await res.json();

  window.aiResult = data.extracted;
  window.aiTargetModule = data.module;

  document.getElementById("aiDetectedModule").innerText =
    "Detected Module: " + data.module.toUpperCase();

  renderAIPreview(data.extracted);
  document.getElementById("aiSaveBtn").disabled = false;
};

function renderAIPreview(obj) {
  const table = Object.entries(obj).map(
    ([k, v]) => `<tr><td><b>${k}</b></td><td contenteditable data-key="${k}">${v}</td></tr>`
  ).join("");

  document.getElementById("aiPreview").innerHTML = `
    <table class="estimate-table">
      <tbody>${table}</tbody>
    </table>
  `;
}
