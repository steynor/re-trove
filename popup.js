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

    const prompt = `As a sustainability expert, provide a very concise analysis of this second-hand item's environmental impact savings based on material and dimension of products. Use exactly this format with no additional text:

💨 [X] kg CO2 saved
💧 [X] liters of water saved
[One sentence explanation of calculation method]

Product Details:
${product.details}`;

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
  try {
    // Initialize product details object
    const details = [];

    // Try to find product dimensions
    const dimensionsPattern =
      /(\d+(?:\.\d+)?(?:\s*[x×]\s*\d+(?:\.\d+)?)*\s*(?:cm|mm|m|inch|"|'|feet|ft))/i;
    const dimensionsText = Array.from(document.querySelectorAll("*"))
      .map((element) => element.textContent)
      .find((text) => dimensionsPattern.test(text));
    if (dimensionsText) {
      const dimensions = dimensionsText.match(dimensionsPattern)[0];
      details.push(`Dimensions: ${dimensions}`);
    }

    // Try to find materials
    const materialKeywords = [
      "wood",
      "cotton",
      "polyester",
      "metal",
      "steel",
      "aluminum",
      "plastic",
      "leather",
      "glass",
      "ceramic",
    ];
    const materialsFound = new Set();

    document.body.innerText
      .toLowerCase()
      .split(/\W+/)
      .forEach((word) => {
        if (materialKeywords.includes(word)) {
          materialsFound.add(word);
        }
      });

    if (materialsFound.size > 0) {
      details.push(`Materials: ${Array.from(materialsFound).join(", ")}`);
    }

    // Try to find product name/title
    const title =
      document.querySelector("h1")?.innerText ||
      document.title.split("|")[0].trim() ||
      "Unknown Product";
    details.push(`Product: ${title}`);

    // Try to find condition
    const conditionKeywords = [
      "used",
      "pre-owned",
      "refurbished",
      "second-hand",
      "secondhand",
    ];
    const condition =
      conditionKeywords.find((keyword) =>
        document.body.innerText.toLowerCase().includes(keyword)
      ) || "second-hand";
    details.push(`Condition: ${condition}`);

    return {
      success: details.length >= 2,
      details: details.join("\n"),
    };
  } catch (error) {
    return {
      success: false,
      details: "Could not extract product information",
    };
  }
}
