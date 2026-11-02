#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
冲充电 · 点击目标审计
=====================
在无法使用真机点击的情况下，静态验证三类静默失效：

1. onclick 里调用了 App 上不存在的方法（点了必抛 TypeError）
2. getElementById / querySelector 引用了页面上不存在的 id（拿到 null，后续全崩）
3. App 内部 this.xxx() 调用了不存在的方法

用法：
    python3 docs/click-audit.py

退出码：发现问题返回 1，全通过返回 0。
"""

import re
import sys
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, 'app', 'charging-tracker.html')
JS = os.path.join(ROOT, 'app', 'charging-tracker.js')


def main():
    html = io.open(HTML, encoding='utf-8').read()
    js = io.open(JS, encoding='utf-8').read()

    # ---------- App 对象方法集合（限定在 var App = { ... } 区间内） ----------
    a = js.find('var App = {')
    b = js.find('window.App = App;')
    app_src = js[a:b] if a != -1 and b > a else js
    methods = set(re.findall(r'^[ \t]{2,6}([A-Za-z_]\w*)[ \t]*:[ \t]*function\b', app_src, re.M))

    # ---------- 页面上真实存在的 id ----------
    ids = set(re.findall(r'\bid=["\']([A-Za-z][\w-]*)["\']', html))
    ids |= set(re.findall(r'\\bid=\\?["\']([A-Za-z][\w-]*)\\?["\']', js))
    ids |= set(re.findall(r'\bid=["\']([A-Za-z][\w-]*)["\']', js))

    # ---------- JS 主动查找的 id ----------
    refs = {}
    for m in re.finditer(r'getElementById\(\s*[\'"]([\w-]+)[\'"]\s*\)', js):
        refs.setdefault(m.group(1), []).append(js.count('\n', 0, m.start()) + 1)
    for m in re.finditer(r'querySelector(?:All)?\(\s*[\'"]#([\w-]+)', js):
        refs.setdefault(m.group(1), []).append(js.count('\n', 0, m.start()) + 1)

    # ---------- onclick 里的调用 ----------
    calls = []
    for label, text in (('html', html), ('js', js)):
        for chunk in re.split(r'onclick\s*=', text)[1:]:
            head = chunk[:200]
            line = text.count('\n', 0, text.find(chunk)) + 1
            for c in re.finditer(r'\b(App|Store)\.([A-Za-z_]\w*)\s*\(', head):
                calls.append((label, line, c.group(1), c.group(2), head[:80].replace('\n', ' ')))

    fail = 0

    print('=' * 70)
    print('1. onclick 调用不存在的方法')
    print('=' * 70)
    bad = []
    for src, line, obj, meth, ctx in calls:
        if obj == 'Store':
            bad.append((src, line, f'Store.{meth}()', 'Store 未挂到 window，点击必抛 ReferenceError', ctx))
        elif meth not in methods:
            bad.append((src, line, f'App.{meth}()', 'App 上无此方法', ctx))
    if bad:
        for src, line, sig, why, ctx in bad:
            print(f'  X {src}:{line}  {sig}  ->  {why}')
            print(f'      {ctx}')
        fail += len(bad)
    else:
        print('  无')

    print()
    print('=' * 70)
    print('2. 引用了页面不存在的 id')
    print('=' * 70)
    missing = [(rid, ls) for rid, ls in sorted(refs.items()) if rid not in ids]
    if missing:
        for rid, ls in missing:
            print(f'  X #{rid}  <- 引用行 {ls}')
        fail += len(missing)
    else:
        print('  无')

    print()
    print('=' * 70)
    print('3. App 内部 this.xxx() 调用不存在的方法')
    print('=' * 70)
    inner = []
    for m in re.finditer(r'\bthis\.([A-Za-z_]\w*)\s*\(', app_src):
        meth = m.group(1)
        if meth not in methods:
            inner.append((meth, js.count('\n', 0, a + m.start()) + 1))
    if inner:
        seen = set()
        for meth, line in inner:
            if meth in seen:
                continue
            seen.add(meth)
            print(f'  X this.{meth}()  <- 首次出现于第 {line} 行')
        fail += len(seen)
    else:
        print('  无')

    print()
    print('=' * 70)
    print(f'统计：页面 id {len(ids)} · App 方法 {len(methods)} · onclick 调用 {len(calls)}')
    print('结果：' + ('通过' if fail == 0 else f'{fail} 项需修复'))
    print('=' * 70)
    return 1 if fail else 0


if __name__ == '__main__':
    sys.exit(main())
