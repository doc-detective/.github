const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");

async function testCanvasIntegration() {
  try {
    console.log("Testing node-canvas for annotations...");
    
    // Create a simple canvas
    const width = 400;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    
    // Fill with white background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
    
    // Add a red rectangle
    console.log("Adding rectangle...");
    ctx.strokeStyle = "red";
    ctx.lineWidth = 3;
    ctx.strokeRect(100, 100, 200, 100);
    
    // Add an arrow (line + triangle)
    console.log("Adding arrow...");
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(50, 50);
    ctx.lineTo(150, 150);
    ctx.stroke();
    
    // Arrow head
    const angle = Math.atan2(150 - 50, 150 - 50);
    ctx.save();
    ctx.translate(150, 150);
    ctx.rotate(angle);
    ctx.fillStyle = "blue";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-15, -7.5);
    ctx.lineTo(-15, 7.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    
    // Add text
    console.log("Adding text...");
    ctx.font = "20px Arial";
    ctx.fillStyle = "yellow";
    ctx.fillRect(48, 175, 205, 30);
    ctx.fillStyle = "black";
    ctx.fillText("Test Annotation", 50, 195);
    
    // Save to file
    const outputPath = path.join(__dirname, "test-canvas-output.png");
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(outputPath, buffer);
    
    console.log(`✓ Success! Output saved to: ${outputPath}`);
    console.log(`File size: ${buffer.length} bytes`);
    
    return true;
  } catch (error) {
    console.error("✗ Error:", error);
    return false;
  }
}

testCanvasIntegration().then((success) => {
  process.exit(success ? 0 : 1);
});
