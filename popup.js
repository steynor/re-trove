document.getElementById("checkBtn").addEventListener("click", async () => {
  const button = document.getElementById("checkBtn");
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  const result = document.getElementById("result");

  // Reset UI
  button.disabled = true;
  loading.style.display = "block";
  error.style.display = "none";
  result.innerText = "";

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      throw new Error("No active tab found");
    }

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractProductData,
    });

    const product = injectionResults[0].result;

    if (!product.success) {
      throw new Error("Could not find product information on this page");
    }

    const prompt = `Analyze this product page and estimate environmental savings from buying it second-hand. Find the materials, dimensions, and product type from the text, then calculate CO2 and water savings. In the explanation, I want you to include the dimensions and materials of the product but with a maximum of 60 words.
    Format as:
    💨 [X] kg CO2 saved,
    💧 [X] liters water saved,
    [explanation]

Page content: ${product.details}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to get AI analysis");
    }

    const data = await res.json();
    result.innerText = data.choices[0].message.content;
  } catch (err) {
    error.textContent = err.message || "An error occurred";
    error.style.display = "block";
  } finally {
    button.disabled = false;
    loading.style.display = "none";
  }
});

function extractProductData() {
  return {
    success: true,
    details: document.body.innerText,
  };
}
