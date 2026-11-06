#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
冲充电 · 设计体系自检
=====================
四类硬检查，防止样式回退：

1. 颜色字面量只允许出现在令牌块（:root[data-theme] / THEME_COLORS）
2. 渐变/投影/模糊只允许在令牌块定义，组件内只引用 var()
3. JS + HTML 里出现的每个 class 都能在 CSS 找到规则
4. 令牌在浅/深两套都已定义，正文对比度 ≥ 4.5

用法：python3 docs/style-audit.py
退出码：有问题返回 1。
"""

import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, 'app', 'charging-tracker.html')
JS = os.path.join(ROOT, 'app', 'charging-tracker.js')

FAILS = []
WARNS = []


def fail(msg):
    FAILS.append(msg)


def warn(msg):
    WARNS.append(msg)


def read(path):
    return io.open(path, encoding='utf-8').read()


def token_block(css, theme):
    m = re.search(r':root\[data-theme="' + theme + r'"\]\s*\{(.*?)\n    \}', css, re.S)
    return m.group(1) if m else ''


def lum(hex_color):
    h = hex_color.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    r, g, b = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b):
    l1, l2 = sorted([lum(a), lum(b)], reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


def main():
    html = read(HTML)
    js = read(JS)

    style = re.search(r'<style>(.*?)</style>', html, re.S).group(1)
    light = token_block(style, 'light')
    dark = token_block(style, 'dark')

    # ---------- 1. 颜色字面量 ----------
    # 去掉两个令牌块后扫描
    rest = style.replace(light, '').replace(dark, '')
    # 允许 @media (prefers-contrast) 里的令牌覆写
    rest_lines = rest.split('\n')
    for i, line in enumerate(rest_lines, 1):
        if re.search(r'--c-[a-z0-9-]+\s*:\s*(#|rgba?\()', line):
            continue
        # 遮罩用的 mask 渐变属于几何工具，不是视觉光影
        if re.search(r'(?:-webkit-)?mask\s*:', line):
            continue
        for m in re.finditer(r'#[0-9a-fA-F]{3,8}\b|rgba?\(', line):
            fail('CSS 颜色字面量：%s（第 %d 行附近）' % (m.group(0), i))

    # HTML 内联样式
    for m in re.finditer(r'style="([^"]*)"', html):
        if re.search(r'#[0-9a-fA-F]{3,8}\b|rgba?\(', m.group(1)):
            fail('HTML 内联颜色：' + m.group(1)[:80])

    # JS 颜色（排除 #i- 图标引用与 THEME_COLORS 常量）
    for i, line in enumerate(js.split('\n'), 1):
        if 'THEME_COLORS' in line:
            continue
        for m in re.finditer(r'#[0-9a-fA-F]{3,8}\b', line):
            if line[max(0, m.start() - 3):m.start()] == '#i-':
                continue
            fail('JS 颜色字面量：%s（第 %d 行）' % (m.group(0), i))

    # ---------- 2. 光影：只允许令牌化 ----------
    scan = re.sub(r'@supports[^{]*\{', '', rest)
    scan = re.sub(r'(?:-webkit-)?mask\s*:[^;}]+', '', scan)
    for pat, label in [
        (r'linear-gradient|radial-gradient', '渐变'),
        (r'text-shadow\s*:', '文字阴影'),
        (r'drop-shadow\(', '发光/投影滤镜'),
    ]:
        for m in re.finditer(pat, scan):
            fail('发现%s：%s' % (label, scan[max(0, m.start() - 30):m.end() + 20].replace('\n', ' ')))

    for m in re.finditer(r'box-shadow\s*:\s*([^;}]+)', scan):
        val = m.group(1).strip()
        if val == 'none':
            continue
        cleaned = re.sub(r'var\(--(?:shadow|glass|solid)[\w-]*\)', '', val)
        # 允许控件自身的发丝描边（0.5/1/1.5px）
        cleaned = re.sub(r'(?:inset\s+)?0\s+0\s+0\s+[\d.]+px\s+var\(--c-[\w-]+\)', '', cleaned)
        cleaned = re.sub(r'[\s,]+', '', cleaned)
        if cleaned:
            fail('未走令牌的 box-shadow：' + val[:90])

    for m in re.finditer(r'(?<![\w-])backdrop-filter\s*:\s*([^;}]+)', scan):
        val = m.group(1).strip()
        if val not in ('none', 'var(--blur-chrome)', 'blur(1px)'):
            fail('未走令牌的 backdrop-filter：' + val[:60])

    # ---------- 3. class 覆盖 ----------
    css_classes = set(re.findall(r'\.([a-zA-Z][\w-]*)', style))
    used = set()
    for m in re.finditer(r'class="([^"]+)"', html + js):
        raw = m.group(1)
        if '+' in raw or "'" in raw:
            continue
        for c in raw.split():
            used.add(c)
    # 动态添加/状态类
    for m in re.finditer(r"classList\.(?:add|toggle|remove)\('([\w-]+)'", js):
        used.add(m.group(1))

    whitelist = {
        'active', 'open', 'show', 'invalid', 'danger', 'last', 'long', 'tabular',
        'i-fill', 'i-sm', 'ok', 'warn', 'info', 'fast', 'slow', 'body', 'check',
        'i', 'num'
    }
    missing = sorted(c for c in used if c not in css_classes and c not in whitelist)
    for c in missing:
        fail('类名没有 CSS 规则：.' + c)

    # ---------- 4. 令牌完整性与对比度 ----------
    tokens_light = dict(re.findall(r'(--[\w-]+)\s*:\s*([^;]+);', light))
    tokens_dark = dict(re.findall(r'(--[\w-]+)\s*:\s*([^;]+);', dark))
    required = ['--c-bg', '--c-surface', '--c-surface-2', '--c-fill', '--c-line',
                '--c-line-strong', '--c-text', '--c-text-2', '--c-text-3',
                '--c-placeholder', '--c-selected', '--c-ok', '--c-warn', '--c-danger',
                '--glass-tint', '--glass-sheen', '--glass-border', '--glass-rim',
                '--glass-shadow', '--glass-chip', '--glass-card-rim', '--surface-tint',
                '--hero-tint', '--shadow-card', '--hero-glow', '--ambient-glow',
                '--solid-tint', '--solid-rim', '--solid-shadow', '--blur-chrome',
                '--rim-gradient']
    for t in required:
        if t not in tokens_light:
            fail('浅色缺少令牌 ' + t)
        if t not in tokens_dark:
            fail('深色缺少令牌 ' + t)

    pairs = [
        ('--c-text', '--c-bg'), ('--c-text', '--c-surface'),
        ('--c-text-2', '--c-surface'), ('--c-text-3', '--c-surface'),
        ('--c-text-2', '--c-bg'), ('--c-text-3', '--c-bg'),
        ('--c-danger', '--c-surface'), ('--c-ok', '--c-surface'), ('--c-warn', '--c-surface'),
    ]
    for theme, tokens in [('浅色', tokens_light), ('深色', tokens_dark)]:
        for fg, bg in pairs:
            a, b = tokens.get(fg, '').strip(), tokens.get(bg, '').strip()
            if not a.startswith('#') or not b.startswith('#'):
                continue
            ratio = contrast(a, b)
            if ratio < 4.5:
                fail('%s %s on %s 对比度 %.2f < 4.5' % (theme, fg, bg, ratio))

    # ---------- 报告 ----------
    print('=' * 62)
    print('冲充电 · 设计体系自检')
    print('=' * 62)
    print('CSS 规则 %d 条 · class %d 个 · 令牌 %d/%d'
          % (len(re.findall(r'\{', style)), len(css_classes), len(tokens_light), len(tokens_dark)))
    if WARNS:
        print('\n提示：')
        for w in WARNS:
            print('  · ' + w)
    if FAILS:
        print('\n问题 %d 项：' % len(FAILS))
        for f in FAILS[:40]:
            print('  ! ' + f)
        if len(FAILS) > 40:
            print('  … 其余 %d 项省略' % (len(FAILS) - 40))
        print('\n结果：未通过')
        return 1
    print('\n结果：通过（颜色只在令牌块 / 光影只引用令牌 / 类名全覆盖 / 对比度达标）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
