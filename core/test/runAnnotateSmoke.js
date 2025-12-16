const path = require('path');
const { annotateScreenshot } = require('../src/tests/annotateScreenshot');

(async () => {
  const filePath = path.resolve(__dirname, 'test-canvas-output.png');
  console.log('Using file:', filePath);

  // Simple driver stub with execute returning devicePixelRatio
  const driver = {
    execute: async (fn, ...args) => {
      // If fn is a function (from WDIO's execute), call it in node context where window isn't defined
      // We'll handle only window.devicePixelRatio case
      try {
        if (typeof fn === 'function') {
          const code = fn.toString();
          if (code.includes('window.devicePixelRatio')) return 1;
        }
      } catch (e) {}
      return undefined;
    },
  };

  const annotations = [
    { text: { content: 'Smoke test', fontSize: 24, color: '#00AA00' }, position: { x: 20, y: 20 } },
    { rectangle: { stroke: '#FF0000', strokeWidth: 4 }, position: { x: 50, y: 50 } },
    { circle: { radius: 30, stroke: '#0000FF', strokeWidth: 3 }, position: { x: 200, y: 80 } },
  ];

  const res = await annotateScreenshot({ config: { logLevel: 'silent' }, filePath, annotations, driver });
  console.log('Result:', res);
})();