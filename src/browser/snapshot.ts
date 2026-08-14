import type { ElementTarget, SnapshotNode, SnapshotResult } from "./types.js";

/**
 * In-page JavaScript expression that scans the DOM, builds the accessibility tree,
 * assigns unique ref attributes (data-bunpw-ref), and formats the output string.
 */
export const SNAPSHOT_SCRIPT = `
(() => {
  let nextRef = 1;

  function isVisible(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0 || el.getClientRects().length > 0;
  }

  function getRole(el) {
    const explicitRole = el.getAttribute('role');
    if (explicitRole) return explicitRole.toLowerCase();

    const tag = el.tagName.toLowerCase();
    switch (tag) {
      case 'a':
        return el.hasAttribute('href') ? 'link' : null;
      case 'button':
        return 'button';
      case 'input': {
        const type = (el.type || 'text').toLowerCase();
        if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
        if (type === 'checkbox') return 'checkbox';
        if (type === 'radio') return 'radio';
        if (['search', 'text', 'email', 'password', 'tel', 'url', 'number'].includes(type)) return 'textbox';
        return type;
      }
      case 'textarea':
        return 'textbox';
      case 'select':
        return 'combobox';
      case 'option':
        return 'option';
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
        return 'heading';
      case 'img':
        return 'image';
      case 'nav':
        return 'navigation';
      case 'main':
        return 'main';
      case 'header':
        return 'banner';
      case 'footer':
        return 'contentinfo';
      case 'form':
        return 'form';
      case 'ul': case 'ol':
        return 'list';
      case 'li':
        return 'listitem';
      case 'table':
        return 'table';
      case 'dialog':
        return 'dialog';
      default:
        return null;
    }
  }

  function getAccessibleName(el) {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label').trim();
    
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const labels = labelledby.split(/\\s+/).map(id => document.getElementById(id)?.textContent?.trim()).filter(Boolean);
      if (labels.length > 0) return labels.join(' ');
    }

    if (el.getAttribute('placeholder')) return el.getAttribute('placeholder').trim();
    if (el.getAttribute('alt')) return el.getAttribute('alt').trim();
    if (el.getAttribute('title')) return el.getAttribute('title').trim();

    // Check associated <label> for inputs
    if (el.labels && el.labels.length > 0) {
      const labelTexts = Array.from(el.labels).map(l => l.textContent.trim()).filter(Boolean);
      if (labelTexts.length > 0) return labelTexts.join(' ');
    }

    return '';
  }

  function isInteractive(el, role) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const interactiveRoles = [
      'button', 'link', 'textbox', 'checkbox', 'radio',
      'combobox', 'option', 'tab', 'menuitem', 'switch', 'slider'
    ];
    if (role && interactiveRoles.includes(role)) return true;
    if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') return true;
    if (el.onclick || el.hasAttribute('onclick')) return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function buildTree(node, depth = 0) {
    if (depth > 50) return null; // Avoid extreme DOM depth

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim().replace(/\\s+/g, ' ');
      return text ? { type: 'text', text } : null;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const el = node;
    if (!isVisible(el)) return null;

    const role = getRole(el);
    const interactive = isInteractive(el, role);

    let ref = null;
    if (interactive) {
      ref = 'e' + (nextRef++);
      el.setAttribute('data-bunbrowser-ref', ref);
      el.setAttribute('data-bunpw-ref', ref);
    }

    const children = [];
    for (const child of el.childNodes) {
      const childNode = buildTree(child, depth + 1);
      if (childNode) {
        children.push(childNode);
      }
    }

    const tag = el.tagName.toLowerCase();
    const name = getAccessibleName(el);

    // Compute states
    const checked = el.checked;
    const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
    const expanded = el.getAttribute('aria-expanded') === 'true' ? true : (el.getAttribute('aria-expanded') === 'false' ? false : undefined);
    const focused = document.activeElement === el;
    const selected = el.selected || el.getAttribute('aria-selected') === 'true';
    const required = el.required || el.getAttribute('aria-required') === 'true';
    const readonly = el.readOnly || el.getAttribute('aria-readonly') === 'true';

    let value = undefined;
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      value = el.value;
    }

    // Collapse purely redundant generic containers with single text/child if not interactive
    const info = {
      tag,
      role: role || (children.length > 0 ? 'generic' : null),
      ref,
      name: name || undefined,
      value: value !== undefined && value !== '' ? value : undefined,
      checked: checked ? true : undefined,
      disabled: disabled ? true : undefined,
      expanded,
      focused: focused ? true : undefined,
      selected: selected ? true : undefined,
      required: required ? true : undefined,
      readonly: readonly ? true : undefined,
      children: children.length > 0 ? children : undefined
    };

    return info;
  }

  function formatTree(node, indent = 0) {
    if (!node) return '';
    const spaces = '  '.repeat(indent);

    if (node.type === 'text') {
      return spaces + '"' + node.text + '"\\n';
    }

    let line = spaces;
    if (node.ref) line += '[' + node.ref + '] ';
    if (node.role) line += node.role + ' ';
    if (node.name) line += '"' + node.name + '" ';
    if (node.value !== undefined) line += 'value="' + node.value + '" ';
    if (node.checked) line += '[checked] ';
    if (node.disabled) line += '[disabled] ';
    if (node.expanded === true) line += '[expanded] ';
    if (node.expanded === false) line += '[collapsed] ';
    if (node.focused) line += '[focused] ';
    if (node.selected) line += '[selected] ';
    if (node.required) line += '[required] ';
    if (node.readonly) line += '[readonly] ';

    line = line.trimEnd() + '\\n';

    let out = line;
    if (node.children) {
      for (const child of node.children) {
        out += formatTree(child, indent + 1);
      }
    }
    return out;
  }

  const rawTree = buildTree(document.body || document.documentElement);
  const treeText = formatTree(rawTree);

  return {
    url: window.location.href,
    title: document.title || '',
    treeText: treeText || '(empty page)',
    elementsCount: nextRef - 1,
    rawTree
  };
})()
`;

/**
 * Resolves an ElementTarget ({ ref, selector, x, y }) to a CSS selector or coordinates.
 */
export function resolveTarget(target: ElementTarget): { selector?: string; x?: number; y?: number } {
  if (target.ref) {
    let cleanRef = target.ref.trim();
    if (cleanRef.startsWith("ref=")) {
      cleanRef = cleanRef.replace("ref=", "");
    }
    if (cleanRef.startsWith("[")) {
      cleanRef = cleanRef.replace(/^[\[]|\]$/g, "");
    }
    return { selector: `[data-bunbrowser-ref="${cleanRef}"], [data-bunpw-ref="${cleanRef}"]` };
  }

  if (target.selector) {
    return { selector: target.selector };
  }

  if (typeof target.x === "number" && typeof target.y === "number") {
    return { x: target.x, y: target.y };
  }

  throw new Error("Target must specify either 'ref', 'selector', or 'x' and 'y' coordinates");
}
