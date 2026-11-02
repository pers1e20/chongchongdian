#!/usr/bin/env python3
"""
CSS 死代码审计 —— 冲充电 P2

原理：用浏览器真实命中的选择器集合（由 app/_audit.html 收集）反查每条 CSS 规则。
某条规则按逗号拆开后，若所有片段都未命中任何界面的 DOM，则视为死规则。

用法：
    python3 docs/p2-audit.py --html app/charging-tracker.html --hits hits.json
    python3 docs/p2-audit.py --html app/charging-tracker.html --hits hits.json --list

输出：可删规则块的行号区间、行数、选择器清单。
"""
import argparse
import json
import re
import sys

AT_RULE_PREFIX = '@'
# 这些选择器永远保留，不参与死代码判定
ALWAYS_KEEP = (':root', 'html', 'body', '*', '::selection', '::-webkit-scrollbar')


def load_text(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def line_index(text):
    """返回每个字符所在行号（从 1 开始）"""
    idx = [1] * (len(text) + 1)
    line = 1
    for i, ch in enumerate(text):
        idx[i] = line
        if ch == '\n':
            line += 1
    idx[len(text)] = line
    return idx


def css_bounds(text):
    a = text.find('<style>')
    b = text.find('</style>')
    if a < 0 or b < 0 or b < a:
        raise SystemExit('找不到 <style> 区间')
    return a + len('<style>'), b


def parse_rules(text, base):
    """解析 CSS，返回 [(cstart, cend, start_line, end_line, selector)]，cstart/cend 为相对 text 的字符偏移"""
    idx = line_index(text)
    rules = []
    stack = []
    buf_start = 0
    i = 0
    n = len(text)

    while i < n:
        ch = text[i]
        if ch == '/' and i + 1 < n and text[i + 1] == '*':
            j = text.find('*/', i + 2)
            i = n if j < 0 else j + 2
            buf_start = i
            continue

        if ch == '{':
            raw = text[buf_start:i]
            sel = ' '.join(raw.split())
            lead = len(raw) - len(raw.lstrip())
            cstart = buf_start + lead
            start_line = idx[cstart] if cstart < n else idx[buf_start]
            kind = 'at' if sel.startswith(AT_RULE_PREFIX) or not sel else 'rule'
            stack.append({'sel': sel, 'start': start_line, 'cstart': cstart, 'kind': kind})
            i += 1
            buf_start = i
            continue

        if ch == '}':
            if stack:
                frame = stack.pop()
                if frame['kind'] == 'rule':
                    rules.append((frame['cstart'], i + 1, frame['start'], idx[i], frame['sel']))
            i += 1
            buf_start = i
            continue

        i += 1

    return rules


def split_selector(sel):
    """按逗号拆分，注意不拆括号内的逗号（:not(.a,.b) 这类）"""
    out, depth, cur = [], 0, ''
    for ch in sel:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth = max(0, depth - 1)
        if ch == ',' and depth == 0:
            out.append(cur.strip())
            cur = ''
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def source_classes(js_path, html_path):
    """从 JS 与 HTML body 的 class 属性里提取真实出现过的类名。
    注意：不使用裸词匹配，避免 Icons.chart 这类键名污染判定。"""
    text = ''
    for p in (js_path, html_path):
        try:
            text += load_text(p) + '\n'
        except OSError:
            pass
    out = set()
    # class="a b c   （允许未闭合，拼接串会截断在下一个引号）
    for m in re.finditer(r'class="([^"]*)', text):
        for tok in re.split(r'\s+', m.group(1)):
            tok = tok.strip()
            if re.fullmatch(r'[A-Za-z_][\w-]*', tok):
                out.add(tok)
    # classList.add('x') 之类
    for m in re.finditer(r"classList\.(?:add|remove|toggle|contains)\(\s*'([^']+)'", text):
        for tok in m.group(1).split():
            if re.fullmatch(r'[A-Za-z_][\w-]*', tok):
                out.add(tok)
    # 动态类变量：?'ic-fast' : 'ic-slow'
    for m in re.finditer(r"'([a-z][\w-]*)'\s*:\s*'([a-z][\w-]*)'", text):
        out.add(m.group(1))
        out.add(m.group(2))
    return out


def classes_of(sel):
    return set(re.findall(r'\.([A-Za-z_][\w-]*)', sel))


def is_keep(sel, hits):
    s = sel.strip()
    if not s:
        return True
    if s.startswith(AT_RULE_PREFIX):
        return True
    if s in ALWAYS_KEEP:
        return True
    # 无类选择器（纯元素/属性/伪元素）保留
    if not re.search(r'\.([A-Za-z_][\w-]*)', s):
        return True
    return s in hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--html', default='app/charging-tracker.html')
    ap.add_argument('--hits', default='hits.json')
    ap.add_argument('--list', action='store_true', help='打印每个可删块的选择器')
    ap.add_argument('--json', help='把可删块（逐块起止行）写入该文件，供删除脚本使用')
    ap.add_argument('--js', default='app/charging-tracker.js')
    args = ap.parse_args()

    full = load_text(args.html)
    a, b = css_bounds(full)
    css = full[a:b]
    rules = parse_rules(css, a)

    hits = set(json.load(open(args.hits, encoding='utf-8')))
    src = source_classes(args.js, args.html)

    dead, kept_unhit = [], []
    for cstart, cend, start, end, sel in rules:
        parts = split_selector(sel)
        if not parts:
            continue
        alive = [p for p in parts if is_keep(p, hits)]
        if alive:
            continue
        touched = set()
        for p in parts:
            touched |= classes_of(p)
        if touched & src:
            kept_unhit.append((start, end, sel))
            continue
        dead.append((cstart, cend, start, end, sel))

    total_lines = sum(e - s + 1 for _, _, s, e, _ in dead)
    print(f'规则块总数      {len(rules)}')
    print(f'可删规则块      {len(dead)}  （{total_lines} 行）')
    print(f'保留但未命中    {len(kept_unhit)}')

    if args.list:
        print('\n--- 可删清单 ---')
        for _, _, s, e, sel in dead:
            print(f'{s}-{e}  {sel[:110]}')

    # 合并相邻区间（仅用于展示，删除按字符区间逐块进行）
    merged = []
    for _, _, s, e, _ in sorted(dead, key=lambda x: x[2]):
        if merged and s - merged[-1][1] <= 3:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    print(f'\n合并后区间      {len(merged)} 段')
    print(', '.join(f'{s}–{e}' for s, e in merged))

    if args.json:
        json.dump(
            {'blocks': [[cs, ce, s, e, sel] for cs, ce, s, e, sel in dead],
             'keep_unhit': [[s, e, sel] for s, e, sel in kept_unhit]},
            open(args.json, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
        print(f'\n逐块清单已写入 {args.json}（{len(dead)} 块）')


if __name__ == '__main__':
    sys.exit(main())
