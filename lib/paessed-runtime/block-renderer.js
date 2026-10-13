/* Safe DOM renderer; paragraph flow adapted from the PAESSED standalone viewer. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PaessedBlocks = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Scroll only oversized formulas; ordinary inline math must not clip tall ink.
  function fitMath(container) {
    for (const math of container.querySelectorAll('.paessed-math-inline')) {
      const content = math.querySelector('.katex');
      const width = math.parentElement.clientWidth;
      math.classList.toggle('paessed-math-overflow', !!content && width > 0 && content.getBoundingClientRect().width > width + 1);
    }
    for (const scroll of container.querySelectorAll('.paessed-math, .paessed-table-wrap')) {
      if (scroll.scrollWidth > scroll.clientWidth + 1) {
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
              if (previous?.type === 'text' && /[.!?:]\s*$/.test(previous.text) && /^\s*[A-ZÁÉÍÓÚÜÑ¿¡]/.test(block.text)) flush();
              inlineTarget().append(element('span', 'paessed-block paessed-text', block.text));
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
  return Object.freeze({ renderBlocks, fitMath });
});
