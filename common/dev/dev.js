const { validate, schemas, refineStep } = require("../src/index");
const { detectProvider } = require("../src/ai");

(async () => {

const providerInfo = detectProvider({
  integrations: {
    openAi: { apiKey: "sk-..." },
  }
}, "openai/gpt-5.1");
console.log("Detected provider and model:", providerInfo);
})();

