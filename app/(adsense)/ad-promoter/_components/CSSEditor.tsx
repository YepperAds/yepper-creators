'use client';
// @ts-nocheck
import React, { useRef } from 'react';

// CSS Editor Component with Syntax Highlighting
const CSSEditor = ({  value, onChange, onValidate  }: any) => {
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);

  const handleScroll = (e) => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = e.target.scrollTop;
      highlightRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  const highlightCSS = (code) => {
    if (!code) return '';
    
    const lines = code.split('\n');
    return lines.map((line: any, idx: any) => {
      let highlighted = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/ /g, '&nbsp;');

      // Comments
      highlighted = highlighted.replace(
        /(\/\*.*?\*\/)/g,
        '<span style="color: #6A9955;">$1</span>'
      );

      // Selectors
      highlighted = highlighted.replace(
        /^(&nbsp;*)(\.[a-zA-Z0-9_-]+|#[a-zA-Z0-9_-]+|[a-zA-Z][a-zA-Z0-9]*)/,
        '$1<span style="color: #D7BA7D;">$2</span>'
      );

      // Properties
      highlighted = highlighted.replace(
        /([a-z-]+)(&nbsp;*):(?!\/\/)/g,
        '<span style="color: #9CDCFE;">$1</span>$2:'
      );

      // Colors
      highlighted = highlighted.replace(
        /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/g,
        '<span style="color: #CE9178;">$1</span>'
      );

      // Numbers with units
      highlighted = highlighted.replace(
        /(\d+(?:\.\d+)?)(px|em|rem|%|vh|vw|s|ms|deg)/g,
        '<span style="color: #B5CEA8;">$1$2</span>'
      );

      // Keywords
      highlighted = highlighted.replace(
        /\b(none|auto|flex|block|inline|center|left|right|bold|normal|solid|transparent)\b/g,
        '<span style="color: #569CD6;">$1</span>'
      );

      return `<div style="height: 21px;">${highlighted}</div>`;
    }).join('');
  };

  const handleTab = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newCode = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newCode);
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const lineCount = value.split('\n').length;

  return (
    <div style={{
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid #3e3e3e',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
    }}>
      {/* Editor Header */}
      <div style={{
        background: '#1e1e1e',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #3e3e3e'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56' }}></div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }}></div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f' }}></div>
          </div>
          <span style={{ fontSize: '12px', color: '#858585', fontFamily: 'monospace', marginLeft: '12px' }}>custom-styles.css</span>
        </div>
        <span style={{ fontSize: '11px', color: '#6e6e6e' }}>CSS</span>
      </div>

      {/* Editor Body */}
      <div style={{
        display: 'flex',
        background: '#1e1e1e',
        height: '450px'
      }}>
        {/* Line Numbers */}
        <div style={{
          background: '#1e1e1e',
          padding: '16px 12px',
          textAlign: 'right',
          borderRight: '1px solid #3e3e3e',
          userSelect: 'none',
          minWidth: '45px'
        }}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} style={{
              color: '#858585',
              fontSize: '13px',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              lineHeight: '21px',
              height: '21px'
            }}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Editor Content */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Syntax Highlighted Background */}
          <div
            ref={highlightRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              margin: 0,
              padding: '16px',
              fontSize: '13px',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              lineHeight: '21px',
              color: '#D4D4D4',
              background: 'transparent',
              overflow: 'auto',
              whiteSpace: 'pre',
              wordWrap: 'normal',
              pointerEvents: 'none'
            }}
            dangerouslySetInnerHTML={{ __html: highlightCSS(value) }}
          />

          {/* Actual Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e: any) => {
              onChange(e.target.value);
              if (onValidate) onValidate(e.target.value);
            }}
            onScroll={handleScroll}
            onKeyDown={handleTab}
            placeholder="/* Type your CSS here... */"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              margin: 0,
              padding: '16px',
              fontSize: '13px',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              lineHeight: '21px',
              color: 'transparent',
              caretColor: '#fff',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              overflow: 'auto',
              whiteSpace: 'pre',
              wordWrap: 'normal',
              tabSize: 2,
              WebkitTextFillColor: 'transparent'
            }}
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      </div>

      {/* Status Bar */}
      <div style={{
        background: '#007acc',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '11px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>CSS</span>
          <span>{lineCount} lines</span>
        </div>
        <div>
          <span>Spaces: 2</span>
        </div>
      </div>
    </div>
  );
};

export default CSSEditor;
