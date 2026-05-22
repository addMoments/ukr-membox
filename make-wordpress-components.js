const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const outputDir = path.join(__dirname, 'wordpress-components');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read index.html
const indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');

// Extract header HTML (between <!-- HEADER START --> and <!-- HEADER END -->)
const headerMatch = indexHtml.match(/<!-- HEADER START -->([\s\S]*?)<!-- HEADER END -->/);
const headerHtml = headerMatch ? headerMatch[1].trim() : '';

// Extract footer HTML (between <!-- FOOTER START --> and <!-- FOOTER END -->)
const footerMatch = indexHtml.match(/<!-- FOOTER START -->([\s\S]*?)<!-- FOOTER END -->/);
const footerHtml = footerMatch ? footerMatch[1].trim() : '';

// Read header assets
const headerStyle = fs.readFileSync(path.join(publicDir, 'assets/header/style.css'), 'utf8');

// Read footer assets
const footerStyle = fs.readFileSync(path.join(publicDir, 'assets/footer/style.css'), 'utf8');

// Read merged script
const hfScript = fs.readFileSync(path.join(publicDir, 'assets/hfSetup.js'), 'utf8');

// Create header.html
const headerOutput = `${headerHtml}

<style>
${headerStyle}
</style>`;

// Create footer.html (merged script goes here)
const footerOutput = `${footerHtml}

<script defer>
${hfScript}
</script>

<style>
${footerStyle}
</style>`;

// Write files
const publicUrl = "https://memboxpub-qo1gff2e.s3.eu-north-1.amazonaws.com/ui";
fs.writeFileSync(path.join(outputDir, 'header.html'), headerOutput.replaceAll("%PUBLIC_URL%", publicUrl));
fs.writeFileSync(path.join(outputDir, 'footer.html'), footerOutput.replaceAll("%PUBLIC_URL%", publicUrl));

console.log('WordPress components created:');
console.log(`  - ${path.join(outputDir, 'header.html')}`);
console.log(`  - ${path.join(outputDir, 'footer.html')}`);
