const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Set necessary security headers for SharedArrayBuffer
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

// Serve static files from the current directory
app.use(express.static('./'));

app.listen(port, () => {
  console.log(`SVG Animator running at http://localhost:${port}`);
}); 