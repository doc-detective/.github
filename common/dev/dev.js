const { validate, schemas, refineStep } = require("../src/index");

(async () => {

const originalStep = {
  stepId: "step-123",
  find: { selector: ".old-button-class" },
};

const refinedStep = await refineStep({
  step: originalStep,
  failureMessage: "Element not found: .old-button-class",
  context: {
    dom: `<html><body>
      <button class="new-submit-button" id="submit">Submit</button>
    </body></html>`,
  },
});
console.log(refinedStep);
})();

