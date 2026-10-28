/* Safe DOM renderer; paragraph flow adapted from the PAESSED standalone viewer. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PaessedBlocks = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // KaTeX's positioned glyph boxes can extend beyond its logical line height.
  // Grow only a horizontal scroll viewport's padding before clipping its Y axis.
  function fitVertical(scroll, content) {
    scroll.style.removeProperty('--paessed-overflow-pad-start');
    scroll.style.removeProperty('--paessed-overflow-pad-end');
    const style = scroll.ownerDocument.defaultView.getComputedStyle(scroll);
    const rect = scroll.getBoundingClientRect();
    const top = rect.top + scroll.clientTop;
    const bottom = top + scroll.clientHeight;
    let paintedTop = top;
    let paintedBottom = bottom;
    // Exclude the clipped accessible MathML and zero-width layout struts.
    // SVG viewports already bound their paths; measuring the paths would count
    // the deliberately oversized tails used to stretch radical bars.
    for (const node of [content, ...content.querySelectorAll('.katex-html, .katex-html span, .katex-html svg')]) {
      const bounds = node.getBoundingClientRect();
      if (!bounds.width || !bounds.height) continue;
      paintedTop = Math.min(paintedTop, bounds.top);
      paintedBottom = Math.max(paintedBottom, bounds.bottom);
    }
    const above = Math.ceil(top - paintedTop);
    // Scroll metrics also include anonymous line boxes and pixel rounding that
    // are not exposed as element rectangles (notably nested fractions).
    const below = Math.ceil(Math.max(paintedBottom - bottom, scroll.scrollHeight - scroll.clientHeight));
    if (above) scroll.style.setProperty('--paessed-overflow-pad-start', (parseFloat(style.paddingTop) + above + 1) + 'px');
    if (below) scroll.style.setProperty('--paessed-overflow-pad-end', (parseFloat(style.paddingBottom) + below + 1) + 'px');
  }

  // Both inline and display math remain non-scrolling until their content is
  // wider than the available parent content box. Resize/font loads recheck it.
  function fitMath(container) {
    for (const math of container.querySelectorAll('.paessed-math')) {
      const content = math.querySelector('.katex');
      const parent = math.parentElement;
      const style = parent.ownerDocument.defaultView.getComputedStyle(parent);
      const width = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const punctuation = math.querySelector('.paessed-math-punctuation');
      const needed = content ? content.getBoundingClientRect().width + (punctuation?.getBoundingClientRect().width || 0) : 0;
      const overflow = !!content && width > 0 && needed > width + 1;
      math.classList.toggle('paessed-math-overflow', overflow);
      if (overflow) fitVertical(math, content);
      else {
        math.style.removeProperty('--paessed-overflow-pad-start');
        math.style.removeProperty('--paessed-overflow-pad-end');
      }
    }
    for (const wrap of container.querySelectorAll('.paessed-table-wrap')) {
      const table = wrap.querySelector('.paessed-table');
      const overflow = !!table && wrap.clientWidth > 0 && table.getBoundingClientRect().width > wrap.clientWidth + 1;
      wrap.classList.toggle('paessed-table-overflow', overflow);
      if (overflow) fitVertical(wrap, table);
      else {
        wrap.style.removeProperty('--paessed-overflow-pad-start');
        wrap.style.removeProperty('--paessed-overflow-pad-end');
      }
    }
    for (const scroll of container.querySelectorAll('.paessed-math, .paessed-table-wrap')) {
      const viewport = scroll.classList.contains('paessed-math-overflow') || scroll.classList.contains('paessed-table-overflow');
      if (viewport && scroll.scrollWidth > scroll.clientWidth + 1) {
        scroll.setAttribute('tabindex', '0');
        scroll.setAttribute('role', 'region');
        scroll.setAttribute('aria-label', scroll.classList.contains('paessed-table-wrap') ? 'Tabla desplazable' : 'Fórmula desplazable');
      } else {
        scroll.removeAttribute('tabindex');
        if (scroll.getAttribute('role') === 'region') {
          scroll.removeAttribute('role');
          scroll.removeAttribute('aria-label');
        }
      }
    }
  }

// Optional 0.2.0 prose convention. Never parse HTML or alter invalid markup.
function parseInlineText(text) {
 const tokens = [...text.matchAll(/<\/?[bi]>/g)];
 const stack = [];
 for (const token of tokens) {
  const tag = token[0][1] === '/' ? token[0][2] : token[0][1];
  if (token[0][1] === '/') {
   if (stack.pop() !== tag) return [{text, bold:false, italic:false}];
  } else stack.push(tag);
 }
 if (stack.length) return [{text, bold:false, italic:false}];
 const runs = []; let offset = 0; let bold = 0; let italic = 0;
 const add = value => { if (value) runs.push({text:value, bold:bold > 0, italic:italic > 0}); };
 for (const token of tokens) {
  add(text.slice(offset, token.index));
  const close = token[0][1] === '/'; const tag = close ? token[0][2] : token[0][1];
  if (tag === 'b') bold += close ? -1 : 1; else italic += close ? -1 : 1;
  offset = token.index + token[0].length;
 }
 add(text.slice(offset));
 return runs;
}
function plainText(text) { return parseInlineText(text).map(run => run.text).join(''); }
function appendInlineText(node, text, doc) {
 const runs = parseInlineText(text);
 if (!runs.some(run => run.bold || run.italic)) { node.textContent = plainText(text); return; }
 for (const run of runs) {
  const outer = doc.createElement(run.bold ? 'b' : run.italic ? 'i' : 'span');
  if (run.bold && run.italic) {
   const inner = doc.createElement('i'); inner.textContent = run.text; outer.append(inner);
  } else outer.textContent = run.text;
  node.append(outer);
 }
}

  function renderBlocks(container, blocks, options = {}) {
    const doc = container.ownerDocument;
    const fragment = doc.createDocumentFragment();
    function element(tag, className, text) {
      const node = doc.createElement(tag);
      node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }
    function pending(message, role = 'alert') {
      const node = element('div', 'paessed-block paessed-unresolved', message);
      node.setAttribute('role', role);
      return node;
    }
    function render(parent, list, depth) {
      if (depth > 16) throw new Error('Bloques demasiado anidados');
      if (!Array.isArray(list)) throw new Error('Lista de bloques inválida');
      let paragraph = null;
      let previous = null;
      let displayMath = null;
      const flush = () => { paragraph = null; };
      const inlineTarget = () => {
        if (!paragraph) {
          paragraph = element('p', 'paessed-paragraph');
          parent.append(paragraph);
        }
        return paragraph;
      };
      for (const block of list) {
        try {
          if (!block || typeof block !== 'object') throw new Error('Bloque inválido');
          switch (block.type) {
            case 'text': {
              if (typeof block.text !== 'string') throw new Error('Texto inválido');
              // Closing punctuation belongs to the preceding display equation,
              // not to a new paragraph. Keep display mode and source text intact.
              if (previous?.type === 'math' && previous.display && displayMath && /^[ \t]*[.,;:!?…]+[ \t]*$/.test(block.text)) {
                displayMath.append(element('span', 'paessed-block paessed-text paessed-math-punctuation', block.text));
                break;
              }
              // Standalone's sentence boundary rule; never guess token spacing.
              if (previous?.type === 'text' && /[.!?:]\s*$/.test(plainText(previous.text)) && /^\s*[A-ZÁÉÍÓÚÜÑ¿¡]/.test(plainText(block.text))) flush();
              const text = element('span', 'paessed-block paessed-text');
              appendInlineText(text, block.text, doc);
              inlineTarget().append(text);
              break;
            }
            case 'math': {
              if (block.display) { flush(); displayMath = null; }
              const math = element(block.display ? 'div' : 'span', 'paessed-block paessed-math ' + (block.display ? 'paessed-math-display' : 'paessed-math-inline'));
              if (!options.katex) throw new Error('KaTeX no disponible');
              try {
                options.katex.render(block.latex, math, {
                  displayMode: !!block.display, output: 'htmlAndMathml',
                  throwOnError: true, trust: false, strict: 'warn', maxExpand: 1000, maxSize: 20,
                });
              } catch (error) {
                flush();
                parent.append(pending('Fórmula pendiente de render: ' + block.latex));
                if (options.onError) options.onError(error, block);
                break;
              }
              (block.display ? parent : inlineTarget()).append(math);
              if (block.display) { displayMath = math; flush(); }
              break;
            }
            case 'image': {
              flush();
              const url = options.assetUrls instanceof Map ? options.assetUrls.get(block.asset_id) : options.assetUrls?.[block.asset_id];
              // The package reader supplies local PNGs, never remote/active content.
              if (!url || !/^(?:blob:|data:image\/png;base64,)/i.test(url)) {
                parent.append(options.loadingAssets
                  ? pending('Cargando recurso: ' + block.asset_id, 'status')
                  : pending('Recurso no disponible: ' + block.asset_id));
                break;
              }
              const image = element('img', 'paessed-block paessed-image');
              image.alt = block.alt || 'Imagen ' + block.asset_id;
              image.decoding = 'async';
              image.addEventListener('error', () => {
                image.replaceWith(pending('No se pudo decodificar la imagen: ' + image.alt));
                if (options.onError) options.onError(new Error('Imagen no decodificable'), block);
              }, { once: true });
              image.src = url;
              parent.append(image);
              break;
            }
            case 'table': {
              flush();
              const wrap = element('div', 'paessed-block paessed-table-wrap');
              const table = element('table', 'paessed-table');
              table.setAttribute('aria-label', 'Tabla incluida en la pregunta');
              const tbody = doc.createElement('tbody');
              for (const row of block.rows) {
                const tr = doc.createElement('tr');
                for (const cell of row) {
                  const td = doc.createElement('td');
                  render(td, cell, depth + 1);
                  tr.append(td);
                }
                tbody.append(tr);
              }
              table.append(tbody);
              wrap.append(table);
              parent.append(wrap);
              break;
            }
            case 'unresolved':
              flush();
              parent.append(pending('Pendiente: ' + block.reason, 'status'));
              break;
            default: throw new Error('Bloque no soportado: ' + block.type);
          }
        } catch (error) {
          flush();
          parent.append(pending('Contenido pendiente de render: ' + error.message));
          if (options.onError) options.onError(error, block);
        }
        previous = block;
      }
    }
    try { render(fragment, blocks, 0); }
    catch (error) { fragment.append(pending(error.message)); }
    container.replaceChildren(fragment);
    fitMath(container);
    return container;
  }
  return Object.freeze({ renderBlocks, fitMath, parseInlineText, plainText });
});
