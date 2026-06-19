// Notes accept light rich text (highlight / font-size via inline styles). Strip
// anything that could execute: script/style/iframe blocks, inline event handlers,
// and javascript: URLs. CSS in a style="" attribute cannot run JS in modern
// browsers, so it is kept (that is how highlight & font-size are saved).
function sanitizeNote(html) {
  if (html == null) return '';
  return String(html)
    .replace(/<\/?(script|style|iframe|object|embed|link|meta|form)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '')
    .trim();
}

module.exports = { sanitizeNote };
